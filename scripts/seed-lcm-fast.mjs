/**
 * seed-lcm-fast.mjs
 *
 * Seeds LCM using multi-row batched INSERTs for speed.
 * Skips already-seeded basins.
 */
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LCM_DIR = join(ROOT, 'public', 'geoJSON', 'LCM');

const client = new pg.Client({
  host: 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.micsfokodqqqgwtlctca',
  password: 'denrCAR2026',
  ssl: { rejectUnauthorized: false }
});

const DECIMALS = 4;
const BATCH = 500;

function roundCoords(geometry, decimals) {
  const f = Math.pow(10, decimals);
  function roundRing(ring) { return ring.map(c => [Math.round(c[0] * f) / f, Math.round(c[1] * f) / f]); }
  if (geometry.type === 'Polygon') return { ...geometry, coordinates: geometry.coordinates.map(roundRing) };
  if (geometry.type === 'MultiPolygon') return { ...geometry, coordinates: geometry.coordinates.map(poly => poly.map(roundRing)) };
  return geometry;
}

async function main() {
  await client.connect();
  await client.query('SET statement_timeout = 600000');

  const { rows: existing } = await client.query(`
    SELECT basin_code, count(*) as cnt FROM lcm GROUP BY basin_code
  `);
  const existingMap = Object.fromEntries(existing.map(r => [r.basin_code, parseInt(r.cnt)]));

  const lcmFiles = readdirSync(LCM_DIR).filter(f => f.endsWith('_LCM2025.geojson')).sort();
  let lcmTotal = Object.values(existingMap).reduce((a, b) => a + b, 0);

  for (const file of lcmFiles) {
    const basinCode = file.replace('_LCM2025.geojson', '');
    const raw = readFileSync(join(LCM_DIR, file), 'utf-8');
    const geojson = JSON.parse(raw);
    const features = geojson.features || [];
    const alreadySeeded = existingMap[basinCode] || 0;

    if (alreadySeeded >= features.length) {
      console.log(`${basinCode}: ${alreadySeeded}/${features.length} — complete`);
      continue;
    }

    console.log(`${basinCode}: ${alreadySeeded}/${features.length} — seeding ${features.length - alreadySeeded} remaining`);

    const remaining = features.slice(alreadySeeded);

    for (let i = 0; i < remaining.length; i += BATCH) {
      const batch = remaining.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const feat of batch) {
        const geom = roundCoords(feat.geometry, DECIMALS);
        values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
        params.push(basinCode, feat.properties.LCM_CLASS || null, JSON.stringify(feat.properties), JSON.stringify(geom));
      }

      const sql = `INSERT INTO lcm (basin_code, lcm_class, properties, geom) VALUES ${values.join(',')}`;
      const { error } = await client.query(sql, params);
      if (error) {
        console.error(`  ERROR batch ${Math.floor(i / BATCH)}: ${error.message}`);
        // Continue anyway
      }
      lcmTotal += batch.length;
    }
    console.log(`  Done (${lcmTotal} total)`);
  }

  const { rows: [{ count }] } = await client.query('SELECT count(*) FROM lcm');
  console.log(`\nLCM total: ${count} rows`);
  console.log('=== Done ===');
  await client.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
