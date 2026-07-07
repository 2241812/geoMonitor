import { createClient } from '@supabase/supabase-js';

let _client = null;

const SUPABASE_URL = 'https://micsfokodqqqgwtlctca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pY3Nmb2tvZHFxcWd3dGxjdGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjExNjgsImV4cCI6MjA5ODUzNzE2OH0.zTrxYk4-QJ-nsM_SlcqiA1IR7XpZXpFmjCN2xBQgTY4';
const BASIN_CODES = ['ABR','ABU','AGN','AMB','ARI','BUD','CAB','MLG','NAG','SIF','SMR','UCH','UMT','ZUM'];

function getClient() {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

async function _fetchPaginated(table, columns, basinCode, onProgress) {
  const supabase = getClient();
  const PAGE_SIZE = 5000;
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    if (onProgress) onProgress(Math.min(90, Math.round((offset / 50000) * 90)), `Fetching batch ${Math.floor(offset / PAGE_SIZE) + 1}…`);

    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('basin_code', basinCode)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error('Supabase query failed: ' + error.message);

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      hasMore = data.length >= PAGE_SIZE;
      offset += PAGE_SIZE;
    }
  }
  return allData;
}

function _buildLCMFeatures(rows) {
  return rows.map(row => {
    const props = { LCM_CLASS: row.lcm_class };
    if (row.properties) {
      Object.assign(props, typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties);
    }
    return { type: 'Feature', properties: props, geometry: row.geom };
  });
}

/**
 * Fetch LCM features for a single basin from Supabase.
 */
export async function fetchLCMFromSupabase(basinCode, onProgress) {
  if (onProgress) onProgress(0, `Fetching ${basinCode} LCM…`);
  const data = await _fetchPaginated('lcm', 'lcm_class, properties, geom', basinCode, onProgress);
  if (data.length === 0) throw new Error('No LCM data found for basin: ' + basinCode);
  if (onProgress) onProgress(90, `Rebuilding GeoJSON (${data.length} features)…`);
  return { type: 'FeatureCollection', features: _buildLCMFeatures(data) };
}

/**
 * Fetch LCM features for ALL basins from Supabase (for level 0 overview).
 * Fetches each basin in parallel.
 */
export async function fetchAllLCMFromSupabase(onProgress) {
  if (onProgress) onProgress(0, 'Fetching LCM for all basins…');

  const allFeatures = [];
  for (let i = 0; i < BASIN_CODES.length; i++) {
    const code = BASIN_CODES[i];
    try {
      const data = await _fetchPaginated('lcm', 'lcm_class, properties, geom', code, null);
      data.forEach(row => {
        const props = { LCM_CLASS: row.lcm_class };
        if (row.properties) {
          Object.assign(props, typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties);
        }
        allFeatures.push({ type: 'Feature', properties: props, geometry: row.geom });
      });
      if (onProgress) onProgress(10 + Math.round(((i + 1) / BASIN_CODES.length) * 80), `Fetched ${code} (${data.length})…`);
    } catch (e) {
      console.warn(`LCM fetch failed for ${code}:`, e.message);
    }
  }

  if (allFeatures.length === 0) throw new Error('No LCM data found in Supabase');
  if (onProgress) onProgress(95, `Rebuilding GeoJSON (${allFeatures.length} features)…`);
  return { type: 'FeatureCollection', features: allFeatures };
}
