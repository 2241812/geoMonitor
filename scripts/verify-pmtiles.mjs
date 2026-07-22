import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { bytesToHeader } from 'pmtiles';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function verify(name) {
  const p = resolve(ROOT, 'public', `${name}.pmtiles`);
  const buf = readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const header = bytesToHeader(ab);
  console.log(`[VERIFY] ${name}.pmtiles Header:`, {
    specVersion: header.specVersion,
    internalCompression: header.internalCompression,
    tileCompression: header.tileCompression,
    tileType: header.tileType,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    numAddressedTiles: header.numAddressedTiles,
  });
}

try {
  verify('slope');
  verify('lcm');
  console.log('✅ PMTiles Header Verification SUCCESSFUL!');
} catch (err) {
  console.error('❌ PMTiles Header Verification FAILED:', err);
  process.exit(1);
}
