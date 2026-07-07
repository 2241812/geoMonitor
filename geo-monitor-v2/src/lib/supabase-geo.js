import { createClient } from '@supabase/supabase-js';

let _client = null;

const SUPABASE_URL = 'https://micsfokodqqqgwtlctca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pY3Nmb2tvZHFxcWd3dGxjdGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjExNjgsImV4cCI6MjA5ODUzNzE2OH0.zTrxYk4-QJ-nsM_SlcqiA1IR7XpZXpFmjCN2xBQgTY4';

function getClient() {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

/**
 * Fetch LCM features for a basin from Supabase.
 * Paginates to handle basins with >1000 features (PostgREST default limit).
 * Returns: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { LCM_CLASS, ... }, geometry }] }
 */
export async function fetchLCMFromSupabase(basinCode, onProgress) {
  const supabase = getClient();

  if (onProgress) onProgress(0, `Fetching ${basinCode} LCM from Supabase…`);

  const PAGE_SIZE = 5000;
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    if (onProgress) onProgress(Math.min(90, Math.round((offset / 50000) * 90)), `Fetching LCM batch ${Math.floor(offset / PAGE_SIZE) + 1}…`);

    const { data, error } = await supabase
      .from('lcm')
      .select('lcm_class, properties, geom')
      .eq('basin_code', basinCode)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error('Supabase LCM query failed: ' + error.message);

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }
  }

  if (allData.length === 0) {
    throw new Error('No LCM data found for basin: ' + basinCode);
  }

  if (onProgress) onProgress(90, `Rebuilding GeoJSON (${allData.length} features)…`);

  const features = allData.map(row => {
    const props = { LCM_CLASS: row.lcm_class };
    if (row.properties) {
      Object.assign(props, typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties);
    }
    return {
      type: 'Feature',
      properties: props,
      geometry: row.geom
    };
  });

  return { type: 'FeatureCollection', features };
}
