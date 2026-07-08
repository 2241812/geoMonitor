import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join, extname } from 'node:path';

const distDir = new URL('../dist/geoJSON', import.meta.url).pathname;

function compressDir(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      compressDir(full);
      continue;
    }
    if (extname(entry.name) !== '.geojson' && extname(entry.name) !== '.json') continue;
    const buf = readFileSync(full);
    if (buf.length < 1024) continue;
    const origSize = statSync(full).size;
    writeFileSync(full + '.gz', gzipSync(buf, { level: 9 }));
    writeFileSync(full + '.br', brotliCompressSync(buf, { params: { [2]: 11 } }));
    const gzSize = statSync(full + '.gz').size;
    const brSize = statSync(full + '.br').size;
    console.log(`${entry.name}: ${(origSize/1024/1024).toFixed(1)}MB → gzip ${(gzSize/1024/1024).toFixed(1)}MB, brotli ${(brSize/1024/1024).toFixed(1)}MB`);
  }
}

compressDir(distDir);
console.log('Done compressing geoJSON files.');
