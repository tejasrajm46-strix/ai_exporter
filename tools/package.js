// Build the release archive from the shipped extension files only.
// The archive is the load-unpacked payload: no README, no artwork, no tooling.
// Usage: npm run package
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

const INCLUDE_DIRS = ["background", "content", "export", "icons", "popup", "ui", "utils"];
const INCLUDE_FILES = ["manifest.json"];

// Release name carries the version as published (0.9.0 -> AI_exported_0.9.zip).
const ZIP_NAME = `AI_exported_${manifest.version.replace(/\.0$/, "")}.zip`;

function collect(directory, prefix) {
  const entries = [];
  for (const name of readdirSync(directory).sort()) {
    const full = path.join(directory, name);
    const archiveName = `${prefix}/${name}`;
    if (statSync(full).isDirectory()) entries.push(...collect(full, archiveName));
    else if (name !== ".DS_Store") entries.push({ name: archiveName, file: full });
  }
  return entries;
}

const entries = INCLUDE_FILES.map((name) => ({ name, file: path.join(ROOT, name) }));
for (const dir of INCLUDE_DIRS) entries.push(...collect(path.join(ROOT, dir), dir));

/* ------------------------------------------------------------------- zip ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Fixed timestamp keeps the archive byte-for-byte reproducible.
const dosDate = (2026 - 1980) << 9 | (11 << 5) | 11;
const dosTime = 12 << 11;

const locals = [];
const centrals = [];
let offset = 0;

for (const entry of entries) {
  const data = readFileSync(entry.file);
  const deflated = deflateRawSync(data, { level: 9 });
  const store = deflated.length >= data.length;
  const body = store ? data : deflated;
  const name = Buffer.from(entry.name, "utf8");
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(store ? 0 : 8, 8);
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, name, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(store ? 0 : 8, 10);
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += local.length + name.length + body.length;
}

const centralSize = centrals.reduce((total, part) => total + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);

const archive = Buffer.concat([...locals, ...centrals, end]);
mkdirSync(path.join(ROOT, "dist"), { recursive: true });
const out = path.join(ROOT, "dist", ZIP_NAME);
writeFileSync(out, archive);

console.log(`packaged ${entries.length} files -> ${path.relative(ROOT, out)}`);
console.log(`${(archive.length / 1024).toFixed(0)} KiB (${archive.length} bytes)`);
