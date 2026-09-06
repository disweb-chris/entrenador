// Genera los íconos PWA sin dependencias: un PNG es la firma, un IHDR, los
// scanlines comprimidos con zlib y un IEND. Se corre a mano cuando cambia la
// marca, no en cada build — los PNG quedan versionados en public/.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BG = [0x0a, 0x0a, 0x0a];
const FG = [0xf0, 0xf0, 0xf0];

// ── PNG encoder ───────────────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  // 10..12 = compression, filter, interlace = 0

  // Cada scanline lleva un byte de filtro al frente (0 = sin filtro).
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels(x, y, size);
      const i = rowStart + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Marca: una barra con discos ───────────────────────────────────────────────
// Coordenadas en una grilla de 512 y escaladas al tamaño pedido, para que el
// dibujo sea idéntico en todas las resoluciones. Todo cae dentro del 80%
// central, que es la zona segura de los íconos maskable de Android.

const BARS = [
  [96, 242, 320, 28],   // barra
  [128, 156, 40, 200],  // disco grande izq
  [344, 156, 40, 200],  // disco grande der
  [186, 188, 26, 136],  // disco chico izq
  [300, 188, 26, 136],  // disco chico der
];

function pixels(x, y, size) {
  const s = size / 512;
  for (const [bx, by, bw, bh] of BARS) {
    if (x >= bx * s && x < (bx + bw) * s && y >= by * s && y < (by + bh) * s) return FG;
  }
  return BG;
}

mkdirSync(OUT, { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  writeFileSync(join(OUT, name), encodePng(size, pixels));
  console.log(`${name} (${size}×${size})`);
}
