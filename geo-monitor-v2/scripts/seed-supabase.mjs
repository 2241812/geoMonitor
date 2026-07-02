/**
 * seed-supabase.mjs
 *
 * Reads all public/temp_assets/*_Slope.geojson files and inserts their
 * features into the Supabase `slope` table.
 *
 * Usage:
 *   SUPABASE_URL=https://micsfokodqqqgwtlctca.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJh... \
 *   node scripts/seed-supabase.mjs
 *
 * The script first clears existing slope data (TRUNCATE), then bulk-inserts.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSETS_DIR = join(ROOT, 'public', 'temp_assets');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Usage: SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<key> node scripts/seed-supabase.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // Step 1: Clear existing data
  console.log('Clearing existing slope data...');
  const { error: truncateErr } = await supabase
    .from('slope')
    .delete()
    .neq('id', 0); // delete all rows
  if (truncateErr) {
    console.error('Failed to clear slope table:', truncateErr.message);
    process.exit(1);
  }
  console.log('  OK');

  // Step 2: Find and parse all slope GeoJSON files
  const files = readdirSync(ASSETS_DIR)
    .filter(f => f.endsWith('_Slope.geojson'))
    .sort();

  console.log(`Found ${files.length} slope files`);

  let totalFeatures = 0;
  const batchSize = 20; // insert in batches of 20 rows

  for (const file of files) {
    const basinCode = file.replace('_Slope.geojson', ''); // e.g. "AGN", "ABR"
    const filePath = join(ASSETS_DIR, file);
    const raw = readFileSync(filePath, 'utf-8');
    const geojson = JSON.parse(raw);
    const features = geojson.features || [];

    console.log(`  ${basinCode}: ${features.length} features`);

    // Build rows for this basin
    const rows = features.map(f => ({
      basin_code: basinCode,
      gridcode: f.properties.gridcode,
      geom: f.geometry, // GeoJSON geometry object
    }));

    // Insert in batches
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('slope')
        .insert(batch)
        .select('id');
      if (error) {
        console.error(`  ERROR inserting ${basinCode} batch ${i / batchSize}: ${error.message}`);
        process.exit(1);
      }
    }

    totalFeatures += features.length;
  }

  console.log(`\nDone. Inserted ${totalFeatures} slope features across ${files.length} basins.`);

  // Step 3: Verify
  const { count, error: countErr } = await supabase
    .from('slope')
    .select('*', { count: 'exact', head: true });
  if (countErr) {
    console.error('Verify failed:', countErr.message);
  } else {
    console.log(`Verification: ${count} rows in slope table (expected ${totalFeatures})`);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
