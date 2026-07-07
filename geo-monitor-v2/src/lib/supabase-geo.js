/**
 * supabase-geo.js
 * Fetches slope and LCM GeoJSON from Supabase, returning the exact same
 * FeatureCollection structure as the raw local files.
 */
import { createClient } from '@supabase/supabase-js';
import { APP } from './app.js';

let _client = null;

function getClient() {
  if (_client) return _client;
  const cfg = APP.config.supabase;
  if (!cfg || !cfg.url || !cfg.anonKey) return null;
  _client = createClient(cfg.url, cfg.anonKey);
  return _client;
}

/**
 * Fetch slope features for a basin from Supabase.
 * Returns: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { gridcode }, geometry }] }
 */
export async function fetchSlopeFromSupabase(basinCode, onProgress) {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase not configured');

  if (onProgress) onProgress(0, `Fetching ${basinCode} slope from Supabase…`);

  const { data, error } = await supabase
    .from('slope')
    .select('gridcode, geom')
    .eq('basin_code', basinCode)
    .limit(50000);

  if (error) throw new Error('Supabase slope query failed: ' + error.message);

  if (!data || data.length === 0) {
    throw new Error('No slope data found for basin: ' + basinCode);
  }

  if (onProgress) onProgress(50, `Rebuilding GeoJSON (${data.length} features)…`);

  const features = data.map(row => ({
    type: 'Feature',
    properties: { gridcode: row.gridcode },
    geometry: row.geom
  }));

  return { type: 'FeatureCollection', features };
}

/**
 * Fetch merged slope features for ALL basins from Supabase.
 * Fetches per-basin in parallel to avoid single-query timeout.
 */
export async function fetchAllSlopeFromSupabase(onProgress) {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase not configured');

  if (onProgress) onProgress(0, 'Fetching all slope data from Supabase…');

  const { data: codes, error: codeErr } = await supabase
    .from('slope')
    .select('basin_code')
    .limit(100000);

  if (codeErr) throw new Error('Supabase slope query failed: ' + codeErr.message);
  if (!codes || codes.length === 0) throw new Error('No slope data found in Supabase');

  const basinCodes = [...new Set(codes.map(r => r.basin_code))];
  if (onProgress) onProgress(10, `Fetching ${basinCodes.length} basins…`);

  const allFeatures = [];
  const results = await Promise.allSettled(
    basinCodes.map((code, i) =>
      supabase.from('slope')
        .select('gridcode, geom')
        .eq('basin_code', code)
        .limit(50000)
        .then(({ data, error }) => {
          if (error) throw error;
          if (data) {
            data.forEach(row => {
              allFeatures.push({
                type: 'Feature',
                properties: { gridcode: row.gridcode, basin_code: code },
                geometry: row.geom
              });
            });
          }
          if (onProgress) onProgress(10 + Math.round(((i + 1) / basinCodes.length) * 80), `Fetched ${code} (${data?.length || 0} features)…`);
        })
    )
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.warn('Some basin fetches failed:', failures.map(f => f.reason?.message));
  }

  if (allFeatures.length === 0) {
    throw new Error('No slope data found in Supabase');
  }

  if (onProgress) onProgress(95, `Rebuilding GeoJSON (${allFeatures.length} features)…`);
  return { type: 'FeatureCollection', features: allFeatures };
}

/**
 * Fetch LCM features for a basin from Supabase.
 * Handles pagination for basins with >1000 features.
 */
export async function fetchLCMFromSupabase(basinCode, onProgress) {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase not configured');

  if (onProgress) onProgress(0, `Fetching ${basinCode} LCM from Supabase…`);

  // Paginate to get ALL rows (PostgREST default limit is 1000)
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
