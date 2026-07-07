/**
 * seed-slope.mjs
 *
 * Reads all public/geoJSON/Slope/*_Slope.geojson files and inserts their
 * features into the Supabase `slope` table.
 *
 * Usage:
 *   node scripts/seed-slope.mjs
 *
 * Env vars (or .env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *
 * The script clears existing slope data first, then bulk-inserts.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SLOPE_DIR = join(ROOT, 'public', 'geoJSON', 'Slope');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env or env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BATCH_SIZE = 50;

async function main() {
  console.log('Clearing existing slope data...');
  const { error: delErr } = await supabase.from('slope').delete().neq('id', 0);
  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1); }
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

    const rows = features.map(f => ({
      basin_code: basinCode,
      gridcode: f.properties.gridcode,
      geom: f.geometry,
    }));

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('slope').insert(batch).select('id');
      if (error) {
        console.error(`  ERROR ${basinCode} batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
        process.exit(1);
      }
    }

    totalFeatures += features.length;
  }

  console.log(`\nDone. Inserted ${totalFeatures} slope features across ${files.length} basins.`);

  const { count } = await supabase.from('slope').select('*', { count: 'exact', head: true });
  console.log(`Verification: ${count} rows in slope table`);
}

main().catch(err => { console.error(err); process.exit(1); });
