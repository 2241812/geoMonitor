/**
 * seed-lcm.mjs
 *
 * Reads all public/geoJSON/LCM/*_LCM2025.geojson files and inserts their
 * features into the Supabase `lcm` table.
 *
 * Usage:
 *   node scripts/seed-lcm.mjs
 *
 * Env vars (or .env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LCM_DIR = join(ROOT, 'public', 'geoJSON', 'LCM');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env or env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BATCH_SIZE = 10;
const DECIMALS = 4;

/** Round all coordinates in a geometry to N decimal places */
function roundCoords(geometry, decimals) {
  const f = Math.pow(10, decimals);
  function roundRing(ring) { return ring.map(c => [Math.round(c[0] * f) / f, Math.round(c[1] * f) / f]); }
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(roundRing) };
  }
  if (geometry.type === 'MultiPolygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(poly => poly.map(roundRing)) };
  }
  return geometry;
}

async function main() {
  console.log('Clearing existing LCM data...');
  const { error: delErr } = await supabase.from('lcm').delete().neq('id', 0);
  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1); }
  console.log('  Cleared');

  const files = readdirSync(LCM_DIR).filter(f => f.endsWith('_LCM2025.geojson')).sort();
  console.log(`Found ${files.length} LCM files in ${LCM_DIR}`);

  let totalFeatures = 0;

  for (const file of files) {
    const basinCode = file.replace('_LCM2025.geojson', '');
    const raw = readFileSync(join(LCM_DIR, file), 'utf-8');
    const geojson = JSON.parse(raw);
    const features = geojson.features || [];

    console.log(`  ${basinCode}: ${features.length} features`);

    const rows = features.map(f => ({
      basin_code: basinCode,
      lcm_class: f.properties.LCM_CLASS || null,
      properties: f.properties,
      geom: roundCoords(f.geometry, DECIMALS),
    }));

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('lcm').insert(batch).select('id');
      if (error) {
        console.error(`  ERROR ${basinCode} batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
        process.exit(1);
      }
    }

    totalFeatures += features.length;
  }

  console.log(`\nDone. Inserted ${totalFeatures} LCM features across ${files.length} basins.`);

  const { count } = await supabase.from('lcm').select('*', { count: 'exact', head: true });
  console.log(`Verification: ${count} rows in lcm table`);
}

main().catch(err => { console.error(err); process.exit(1); });
