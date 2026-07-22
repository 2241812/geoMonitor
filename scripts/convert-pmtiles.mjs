/**
 * convert-pmtiles.mjs
 *
 * Converts slope + LCM GeoJSON to PMTiles (v3) using geojson-vt + vt-pbf.
 *
 * USAGE:
 *   node scripts/convert-pmtiles.mjs              ← simplified data (temp_assets)
 *   node scripts/convert-pmtiles.mjs --raw         ← raw data via Tippecanoe
 *
 * Output: public/slope.pmtiles, public/lcm.pmtiles
 *
 * For raw data on Windows, install Tippecanoe via WSL:
 *   wsl --install -d Ubuntu && wsl sudo apt install tippecanoe
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import geojsonvt from 'geojson-vt';
import vt from 'vt-pbf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MAX_ZOOM = 16;
const MIN_ZOOM = 6;
const TILE_SIZE = 8192;
const USE_RAW = process.argv.includes('--raw');

const SRC_DIRS = USE_RAW
  ? { slope: resolve(ROOT, 'raw slop geoJSON'), lcm: resolve(ROOT, 'raw LCM geoJSON') }
  : { slope: resolve(ROOT, 'temp_assets'),  lcm: resolve(ROOT, 'temp_assets') };

const OUT = resolve(ROOT, 'public');

/* ── Raw PMTiles v3 writer (no leaf dirs: builds a flat root directory) ── */

function varintBig(n) {
  const b = [];
  while (n >= 128n) { b.push(Number(n & 127n) | 128); n >>= 7n; }
  b.push(Number(n));
  return Buffer.from(b);
}

function tileId(z, x, y) {
  let id = 0n;
  for (let i = 0; i < z; i++) {
    const m = 1n << BigInt(i);
    id |= (BigInt(x) & m) << BigInt(2 * i) | (BigInt(y) & m) << BigInt(2 * i + 1);
  }
  return id;
}

/** Encode one PMTiles directory entry: [tile_id varint, run_length varint, length varint, offset varint] */
function entry(tid, runLen, length, offset) {
  return Buffer.concat([
    varintBig(tid), varintBig(runLen), varintBig(BigInt(length)), varintBig(BigInt(offset)),
  ]);
}

/** Write a 64-bit LE word into buffer at offset */
function u64(buf, val, off) {
  const v = typeof val === 'bigint' ? val : BigInt(val);
  buf.writeUInt32LE(Number(v & 0xFFFFFFFFn), off);
  buf.writeUInt32LE(Number((v >> 32n) & 0xFFFFFFFFn), off + 4);
}

/** Load full high-resolution GeoJSON files */
async function loadGeoJSON(dirPath, dataset) {
  if (dataset === 'slope') {
    const slopeFile = resolve(ROOT, 'public/geoJSON/Slope.geojson');
    console.log(`Reading high-resolution slope GeoJSON: ${slopeFile}`);
    const fc = JSON.parse(readFileSync(slopeFile, 'utf8'));
    console.log(`  Total slope features: ${fc.features ? fc.features.length : 0}`);
    return fc;
  } else {
    const lcmDir = resolve(ROOT, 'public/geoJSON/LCM');
    const files = (await readdir(lcmDir)).filter(f => /_LCM2025\.geojson$/i.test(f));
    if (!files.length) throw new Error(`No LCM files found in ${lcmDir}`);
    console.log(`Reading ${files.length} high-resolution LCM files...`);
    const feats = [];
    for (const f of files) {
      const fc = JSON.parse(readFileSync(resolve(lcmDir, f), 'utf8'));
      if (fc.type === 'FeatureCollection') feats.push(...fc.features);
      else if (fc.type === 'Feature') feats.push(fc);
      console.log(`  ${f}: ${fc.features ? fc.features.length : 1} features`);
    }
    console.log(`  Total LCM features: ${feats.length}`);
    return { type: 'FeatureCollection', features: feats };
  }
}

function lng2tile(lng, zoom) {
  return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
}
function lat2tile(lat, zoom) {
  const rad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, zoom));
}

/** Convert one dataset → PMTiles archive */
async function convertDataset(name, layerName, dirPath) {
  console.log(`\n═══ ${name} ═══\n`);
  const gj = await loadGeoJSON(dirPath, name);
  if (!gj) return false;

  console.log('Tiling via geojson-vt...');
  const idx = geojsonvt(gj, { maxZoom: MAX_ZOOM, indexMaxZoom: MAX_ZOOM, tolerance: 0, extent: TILE_SIZE, buffer: 128 });

  const allTiles = [];
  const minLng = 118.5, maxLng = 122.5, minLat = 15.5, maxLat = 19.0;
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const minX = Math.max(0, lng2tile(minLng, z));
    const maxX = Math.min((1 << z) - 1, lng2tile(maxLng, z));
    const minY = Math.max(0, lat2tile(maxLat, z));
    const maxY = Math.min((1 << z) - 1, lat2tile(minLat, z));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const t = idx.getTile(z, x, y);
        if (t && t.features && t.features.length) {
          try { allTiles.push({ z, x, y, data: Buffer.from(vt.fromGeojsonVt({ [layerName]: t }, { version: 2, extent: TILE_SIZE })) }); }
          catch (_) { /* skip encode failures */ }
        }
      }
    }
    console.log(`  z${z}: ${allTiles.filter(t => t.z === z).length} tiles`);
  }
  if (!allTiles.length) { console.error(`No tiles for ${name}`); return false; }

  const rawBytes = allTiles.reduce((s, t) => s + t.data.length, 0);
  console.log(`  Tiles: ${allTiles.length}, data: ${(rawBytes / 1024 / 1024).toFixed(2)} MB`);

  /* Write individual MVT files for direct HTTP serving with VectorGrid */
  const tilesDir = resolve(OUT, 'tiles', name);
  for (const t of allTiles) {
    const zDir = resolve(tilesDir, String(t.z));
    const xDir = resolve(zDir, String(t.x));
    mkdirSync(xDir, { recursive: true });
    writeFileSync(resolve(xDir, `${t.y}.mvt`), t.data);
  }
  console.log(`  MVT files written to tiles/${name}/`);

  /* Sort by tile_id for binary-search lookups */
  allTiles.sort((a, b) => {
    const na = tileId(a.z, a.x, a.y), nb = tileId(b.z, b.x, b.y);
    return na < nb ? -1 : na > nb ? 1 : 0;
  });

  // Metadata JSON
  const meta = {
    name, format: 'pbf', type: 'overlay',
    bounds: [119.5, 16.0, 121.5, 18.5],
    center: [120.5, 17.2, 8],
    minzoom: MIN_ZOOM, maxzoom: MAX_ZOOM,
    vector_layers: [{
      id: layerName, description: layerName,
      minzoom: MIN_ZOOM, maxzoom: MAX_ZOOM,
      fields: name === 'lcm'
        ? { LCM_CLASS: 'string', AREA_HA: 'number', PROVINCE: 'string', REGION: 'string', AGG: 'string', OBJECTID: 'number' }
        : { gridcode: 'number', SL_Cate: 'string', Slope_Desc: 'string', Shape_Area: 'number', Shape_Length: 'number' },
    }],
  };
  const metaBuf = Buffer.from(JSON.stringify(meta), 'utf8');

  /* Compute tile data buffer (with correct real offsets) */
  const tileDataBufs = allTiles.map(t => t.data);
  const tileDataBuf = Buffer.concat(tileDataBufs);

  /*
   * Build a FLAT root directory.
   * PMTiles v3 limits root directory entries to 255 (uint8).
   * For our ~500 tiles, use a SINGLE leaf directory:
   *   root dir: [1 leaf entry with tile_id of first tile, run_length=0 → leaf]
   *   leaf dir: [all tile entries, each with run_length=1]
   */
  const useLeaf = allTiles.length > 255;

  /* Layout:
   *   [Header 5120] [root-dir] [leaf-dir] [metadata] [tile data]
   *
   * If no leaf needed:
   *   [Header 5120] [root-dir] [metadata] [tile data]
   */

  let rootDir, leafDir;
  const tileDataStartOffset = 5120; // base for offset calculations

  if (useLeaf) {
    /* Leaf directory: all tile entries (no run-length limit per-entry) */
    const leafEntries = [];
    for (const t of allTiles) {
      const idx = allTiles.indexOf(t);
      const priorBytes = idx > 0 ? tileDataBufs.slice(0, idx).reduce((s, b) => s + b.length, 0) : 0;
      leafEntries.push(entry(tileId(t.z, t.x, t.y), 1n, BigInt(t.data.length),
        BigInt(tileDataStartOffset + metaBuf.length + 0/* leaf-dir-size unknown yet */ + priorBytes)));
    }
    leafDir = Buffer.concat(leafEntries);

    /* Root dir: single entry pointing to leaf dir */
    /* leaf dir goes after root dir, before metadata, before tile data */
    const rootDirEntry = entry(
      tileId(allTiles[0].z, allTiles[0].x, allTiles[0].y),
      0n,                              // run_length=0 → leaf directory signal
      BigInt(leafDir.length),
      BigInt(tileDataStartOffset + /* root-dir size */ 0) // will fix after we measure rootDir
    );

    rootDir = rootDirEntry;

    /* Fix leaf entry offsets: leaf dir starts after root dir */
    const leafDirStart = tileDataStartOffset + rootDir.length;
    const fixedLeafEntries = [];
    for (const t of allTiles) {
      const idx = allTiles.indexOf(t);
      const priorBytes = idx > 0 ? tileDataBufs.slice(0, idx).reduce((s, b) => s + b.length, 0) : 0;
      fixedLeafEntries.push(entry(tileId(t.z, t.x, t.y), 1n, BigInt(t.data.length),
        BigInt(leafDirStart + leafDir.length + metaBuf.length + priorBytes)));
    }
    leafDir = Buffer.concat(fixedLeafEntries);

    /* Fix root entry offset */
    rootDir = entry(
      tileId(allTiles[0].z, allTiles[0].x, allTiles[0].y),
      0n, BigInt(leafDir.length), BigInt(leafDirStart)
    );
  } else {
    /* Flat root dir: all tile entries */
    const entries = [];
    for (const t of allTiles) {
      const idx = allTiles.indexOf(t);
      const priorBytes = idx > 0 ? tileDataBufs.slice(0, idx).reduce((s, b) => s + b.length, 0) : 0;
      entries.push(entry(tileId(t.z, t.x, t.y), 1n, BigInt(t.data.length),
        BigInt(tileDataStartOffset + metaBuf.length + priorBytes)));
    }
    rootDir = Buffer.concat(entries);
  }

  /* Fix metadata + tile data offsets with actual sizes */
  const rootLen = rootDir.length;
  const leafLen = leafDir ? leafDir.length : 0;
  const metaLen = metaBuf.length;

  /* Rebuild with correct offsets */
  if (useLeaf) {
    const leafStart = 5120 + rootLen;
    const metaStart = leafStart + leafLen;
    const tileStart = metaStart + metaLen;

    const fixedLeafEntries = [];
    for (const t of allTiles) {
      const idx = allTiles.indexOf(t);
      const priorBytes = idx > 0 ? tileDataBufs.slice(0, idx).reduce((s, b) => s + b.length, 0) : 0;
      fixedLeafEntries.push(entry(tileId(t.z, t.x, t.y), 1n, BigInt(t.data.length),
        BigInt(tileStart + priorBytes)));
    }
    leafDir = Buffer.concat(fixedLeafEntries);

    rootDir = entry(tileId(allTiles[0].z, allTiles[0].x, allTiles[0].y), 0n,
      BigInt(leafDir.length), BigInt(leafStart));
  } else {
    const metaStart = 5120 + rootLen;
    const tileStart = metaStart + metaLen;
    const entries = [];
    for (const t of allTiles) {
      const idx = allTiles.indexOf(t);
      const priorBytes = idx > 0 ? tileDataBufs.slice(0, idx).reduce((s, b) => s + b.length, 0) : 0;
      entries.push(entry(tileId(t.z, t.x, t.y), 1n, BigInt(t.data.length),
        BigInt(tileStart + priorBytes)));
    }
    rootDir = Buffer.concat(entries);
  }

  const rootDirLen = rootDir.length;
  const leafDirLen = leafDir ? leafDir.length : 0;
  const metaOff = 5120 + rootDirLen;
  const leafOff = 5120 + rootDirLen;
  const tileOff = useLeaf ? 5120 + rootDirLen + leafDirLen + metaLen : 5120 + rootDirLen + metaLen;

  /* Header */
  const h = Buffer.alloc(5120, 0);
  h.write('PMTiles', 0);
  h.writeUInt8(3, 7);           /* spec_version = 3 */
  u64(h, 5120, 8);              /* root_dir_offset */
  u64(h, rootDirLen, 16);       /* root_dir_length */
  u64(h, metaOff, 24);          /* metadata_offset */
  u64(h, metaLen, 32);          /* metadata_length */
  u64(h, leafOff, 40);          /* leaf_dir_offset */
  u64(h, leafDirLen, 48);       /* leaf_dir_length */
  u64(h, tileOff, 56);          /* tile_data_offset */
  u64(h, tileDataBuf.length, 64); /* tile_data_length */
  u64(h, allTiles.length, 72);  /* num_addressed_tiles */

  const rootEntryCount = useLeaf ? 1 : allTiles.length;
  u64(h, rootEntryCount, 80);   /* num_tile_entries (8 bytes) */
  u64(h, useLeaf ? 0 : allTiles.length, 88); /* num_tile_contents (8 bytes) */

  h.writeUInt8(0, 96);          /* clustered */
  h.writeUInt8(1, 97);          /* internal_compression = 1 (None) */
  h.writeUInt8(1, 98);          /* tile_compression = 1 (None) */
  h.writeUInt8(1, 99);          /* tile_type = 1 (MVT) */
  h.writeUInt8(MIN_ZOOM, 100);  /* min_zoom */
  h.writeUInt8(MAX_ZOOM, 101);  /* max_zoom */
  h.writeInt32LE(Math.round(118.5 * 1e7), 102);   /* min_lon */
  h.writeInt32LE(Math.round(15.5 * 1e7), 106);   /* min_lat */
  h.writeInt32LE(Math.round(122.5 * 1e7), 110);   /* max_lon */
  h.writeInt32LE(Math.round(19.0 * 1e7), 114);   /* max_lat */
  h.writeUInt8(8, 118);                            /* center_zoom */
  h.writeInt32LE(Math.round(120.5 * 1e7), 119);   /* center_lon */
  h.writeInt32LE(Math.round(17.2 * 1e7), 123);   /* center_lat */

  const parts = [h, rootDir];
  if (leafDir) parts.push(leafDir);
  parts.push(metaBuf, tileDataBuf);
  const archive = Buffer.concat(parts);

  const outName = name + '.pmtiles';
  const outPath = resolve(OUT, outName);
  writeFileSync(outPath, archive);
  console.log(`\n✅ ${outName}: ${(archive.length / 1024 / 1024).toFixed(1)} MB, ${allTiles.length} tiles (z${MIN_ZOOM}-${MAX_ZOOM})\n`);
  return true;
}

/* ── Main ── */
async function main() {
  if (!existsSync(SRC_DIRS.slope)) {
    console.error(`Slope source directory not found: ${SRC_DIRS.slope}`);
    process.exit(1);
  }
  if (!existsSync(SRC_DIRS.lcm)) {
    console.error(`LCM source directory not found: ${SRC_DIRS.lcm}`);
    process.exit(1);
  }
  if (!existsSync(OUT)) {
    mkdirSync(OUT, { recursive: true });
  }

  if (USE_RAW) {
    console.warn('\n⚠️  WARNING: Raw data may exceed Node.js heap limits.');
    console.warn('   Recommended: install Tippecanoe and use the shell script instead.\n');
  }

  const slopeOK = await convertDataset('slope', 'slope', SRC_DIRS.slope);
  const lcmOK = await convertDataset('lcm', 'lcm', SRC_DIRS.lcm);

  console.log(`\n═══════════════════════════════════════`);
  console.log(`Slope: ${slopeOK ? '✅' : '❌'}  |  LCM: ${lcmOK ? '✅' : '❌'}`);
  console.log(`═══════════════════════════════════════\n`);

  if (!slopeOK || !lcmOK) process.exit(1);
}

main().catch(err => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
