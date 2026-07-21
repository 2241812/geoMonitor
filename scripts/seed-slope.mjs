/**
 * seed-slope.mjs
 *
 * Reads all public/geoJSON/*_Slope.geojson files and inserts their
 * features into the Supabase `slope` table using a direct PG connection.
 *
 * Usage:
 *   node scripts/seed-slope.mjs
 */
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SLOPE_DIR = join(ROOT, 'public', 'geoJSON');

const client = new pg.Client({
  host: 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.micsfokodqqqgwtlctca',
  password: 'denrCAR2026',
  ssl: { rejectUnauthorized: false },
});

const DECIMALS = 4; // ~11m accuracy
const BATCH = 1; // 1 at a time — geometries are huge

/** Round all coordinates in a geometry to N decimal places */
function roundCoords(geometry, decimals) {
  const f = Math.pow(10, decimals);
  function roundRing(ring) { return ring.map(c => [Math.round(c[0] * f) / f, Math.round(c[1] * f) / f]); }
  if (geometry.type === 'Polygon') return { ...geometry, coordinates: geometry.coordinates.map(roundRing) };
  if (geometry.type === 'MultiPolygon') return { ...geometry, coordinates: geometry.coordinates.map(poly => poly.map(roundRing)) };
  return geometry;
}

async function main() {
  await client.connect();
  // Give Postgres up to 10 minutes per statement for huge slope geometries
  await client.query('SET statement_timeout = 600000');

  // --- Clear existing data ---
  console.log('Clearing existing slope data...');
  await client.query('DELETE FROM slope');
  console.log('  Cleared');

  const files = readdirSync(SLOPE_DIR).filter(f => f.endsWith('_Slope.geojson')).sort();
  console.log(`Found ${files.length} slope files in ${SLOPE_DIR}`);

  let totalFeatures = 0;

  for (const file of files) {
    const basinCode = file.replace('_Slope.geojson', '');
    const raw = readFileSync(join(SLOPE_DIR, file), 'utf-8');
    const geojson = JSON.parse(raw);
    const features = geojson.features || [];

    console.log(`  ${basinCode}: ${features.length} features`);

    for (let i = 0; i < features.length; i += BATCH) {
      const batch = features.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const feat of batch) {
        const geom = roundCoords(feat.geometry, DECIMALS);
        values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
        params.push(basinCode, feat.properties.gridcode, JSON.stringify(geom));
      }

      const sql = `INSERT INTO slope (basin_code, gridcode, geom) VALUES ${values.join(',')}`;
      try {
        await client.query(sql, params);
      } catch (err) {
        console.error(`  ERROR ${basinCode} batch ${Math.floor(i / BATCH)}: ${err.message}`);
        process.exit(1);
      }
    }

    totalFeatures += features.length;
  }

  const { rows: [{ count }] } = await client.query('SELECT count(*) FROM slope');
  console.log(`\nDone. Inserted ${totalFeatures} slope features.`);
  console.log(`Verification: ${count} rows in slope table`);

  await client.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
