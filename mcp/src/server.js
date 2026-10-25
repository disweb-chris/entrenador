#!/usr/bin/env node
// Punto de entrada. Dos modos:
//   node src/server.js          → HTTP (Streamable HTTP), para usarlo como conector remoto
//   node src/server.js --stdio  → stdio, para Claude Desktop / Claude Code en la misma máquina
//
// Variables de entorno: ver README.md.
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createStore } from "./store.js";
import { buildServer } from "./tools.js";

function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return applicationDefault(); // GOOGLE_APPLICATION_CREDENTIALS o la cuenta del entorno (Cloud Run)
  // JSON tal cual o en base64: algunos paneles de hosting rompen los saltos de línea de la clave.
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return cert(JSON.parse(json));
}

initializeApp({ credential: credential(), projectId: process.env.FIREBASE_PROJECT_ID || "entrenador-b3153" });
const store = createStore(getFirestore(), process.env.ENTRENADOR_UID);

if (process.argv.includes("--stdio")) {
  await buildServer(store).connect(new StdioServerTransport());
} else {
  startHttp();
}

function startHttp() {
  const token = process.env.MCP_TOKEN;
  if (!token && process.env.MCP_ALLOW_NO_AUTH !== "1") {
    // Firebase Admin se saltea las reglas: un endpoint abierto es lectura y escritura para cualquiera.
    console.error("Falta MCP_TOKEN. Definilo (o MCP_ALLOW_NO_AUTH=1 sólo para pruebas locales).");
    process.exit(1);
  }

  const sameToken = given => {
    if (!token) return true;
    const a = Buffer.from(String(given ?? ""));
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  const port = Number(process.env.PORT) || 3000;
  http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") return send(res, 200, { ok: true });

    // El token va en el header o en la ruta (/mcp/<token>): los conectores
    // personalizados de claude.ai sólo dejan configurar la URL.
    const [, base, pathToken] = url.pathname.split("/");
    if (base !== "mcp") return send(res, 404, { error: "Usá /mcp" });
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!sameToken(pathToken ?? bearer)) return send(res, 401, { error: "No autorizado" });

    if (req.method !== "POST") {
      // Modo sin estado: no hay stream de notificaciones por GET ni sesiones que cerrar.
      return send(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Método no permitido" }, id: null });
    }

    try {
      const body = await readJson(req);
      const server = buildServer(store);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => { transport.close(); server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: "Error interno" }, id: null });
    }
  }).listen(port, () => console.error(`MCP entrenador escuchando en :${port}/mcp`));
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error("Body demasiado grande"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : undefined); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}
