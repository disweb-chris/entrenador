# Se construye desde la raíz del repo, porque el MCP reutiliza src/lib:
#   docker build -f mcp/Dockerfile -t entrenador-mcp .
FROM node:22-slim
WORKDIR /app
# package.json de la raíz sólo por "type": "module", que necesita src/lib.
COPY package.json ./package.json
COPY src/lib ./src/lib
COPY mcp/package.json mcp/package-lock.json ./mcp/
RUN cd mcp && npm ci --omit=dev
COPY mcp/src ./mcp/src
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "mcp/src/server.js"]
