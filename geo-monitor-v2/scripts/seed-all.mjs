/**
 * seed-all.mjs
 *
 * Seeds slope + LCM tables via direct Postgres connection (bypasses PostgREST timeout).
 *
 * Usage: node scripts/seed-all.mjs
 */
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SLOPE_DIR = join(ROOT, 'public', 'geoJSON', 'Slope');
const LCM_DIR = join(ROOT, 'public', 'geoJSON', 'LCM');

const dbConfig = {
  host: 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.micsfokodqqqgwtlctca',
  password: 'denrCAR2026',
  ssl: { rejectUnauthorized: false }
};

const DECIMALS = 4;

function roundCoords(geometry, decimals) {
  const f = Math.pow(10, decimals);
  function roundRing(ring) { return ring.map(c => [Math.round(c[0] * f) / f, Math.round(c[1] * f) / f]); }
  if (geometry.type === 'Polygon') return { ...geometry, coordinates: geometry.coordinates.map(roundRing) };
  if (geometry.type === 'MultiPolygon') return { ...geometry, coordinates: geometry.coordinates.map(poly => poly.map(roundRing)) };
  return geometry;
}

async function main() {
  const client = new pg.Client(dbConfig);
  await client.connect();
  await client.query('SET statement_timeout = 300000');
  try {
    // === SLOPE ===
    console.log('=== Seeding slope ===');
    console.log('Clearing...');
    await client.query('TRUNCATE slope RESTART IDENTITY CASCADE');

    const slopeFiles = readdirSync(SLOPE_DIR).filter(f => f.endsWith('_Slope.geojson')).sort();
    let slopeTotal = 0;

    for (const file of slopeFiles) {
      const basinCode = file.replace('_Slope.geojson', '');
      const raw = readFileSync(join(SLOPE_DIR, file), 'utf-8');
      const geojson = JSON.parse(raw);
      const features = geojson.features || [];
      console.log(`  ${basinCode}: ${features.length} features`);

      for (const feat of features) {
        const geom = roundCoords(feat.geometry, DECIMALS);
        await client.query(
          'INSERT INTO slope (basin_code, gridcode, geom) VALUES ($1, $2, $3)',
          [basinCode, feat.properties.gridcode, JSON.stringify(geom)]
        );
        slopeTotal++;
      }
      console.log(`    Done (${slopeTotal} total)`);
    }

    const { rows: [{ count: slopeCount }] } = await client.query('SELECT count(*) FROM slope');
    console.log(`Slope: ${slopeCount} rows\n`);

    // === LCM ===
    console.log('=== Seeding LCM ===');
    console.log('Clearing...');
    await client.query('TRUNCATE lcm RESTART IDENTITY CASCADE');

    const lcmFiles = readdirSync(LCM_DIR).filter(f => f.endsWith('_LCM2025.geojson')).sort();
    let lcmTotal = 0;

    for (const file of lcmFiles) {
      const basinCode = file.replace('_LCM2025.geojson', '');
      const raw = readFileSync(join(LCM_DIR, file), 'utf-8');
      const geojson = JSON.parse(raw);
      const features = geojson.features || [];
      console.log(`  ${basinCode}: ${features.length} features`);

      for (const feat of features) {
        const geom = roundCoords(feat.geometry, DECIMALS);
        await client.query(
          'INSERT INTO lcm (basin_code, lcm_class, properties, geom) VALUES ($1, $2, $3, $4)',
          [basinCode, feat.properties.LCM_CLASS || null, JSON.stringify(feat.properties), JSON.stringify(geom)]
        );
        lcmTotal++;
      }
      console.log(`    Done (${lcmTotal} total)`);
    }

    const { rows: [{ count: lcmCount }] } = await client.query('SELECT count(*) FROM lcm');
    console.log(`LCM: ${lcmCount} rows\n`);

    console.log('=== All done ===');
  } finally {
    client.release();
    await client.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
