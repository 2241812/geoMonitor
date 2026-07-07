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
 * This matches the exact structure of geoJSON/Slope/{CODE}_Slope.geojson
 */
export async function fetchSlopeFromSupabase(basinCode, onProgress) {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase not configured');

  if (onProgress) onProgress(0, `Fetching ${basinCode} slope from Supabase…`);

  const { data, error } = await supabase
    .from('slope')
    .select('gridcode, geom')
    .eq('basin_code', basinCode);

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
 * Returns: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { gridcode }, geometry }] }
 * This matches the exact structure of geoJSON/Slope.geojson (the merged file)
 */
export async function fetchAllSlopeFromSupabase(onProgress) {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase not configured');

  if (onProgress) onProgress(0, 'Fetching all slope data from Supabase…');

  const { data, error } = await supabase
    .from('slope')
    .select('basin_code, gridcode, geom');

  if (error) throw new Error('Supabase slope query failed: ' + error.message);

  if (!data || data.length === 0) {
    throw new Error('No slope data found in Supabase');
  }

  if (onProgress) onProgress(50, `Rebuilding GeoJSON (${data.length} features)…`);

  const features = data.map(row => ({
    type: 'Feature',
    properties: { gridcode: row.gridcode, basin_code: row.basin_code },
    geometry: row.geom
  }));

  return { type: 'FeatureCollection', features };
}

/**
 * Fetch LCM features for a basin from Supabase.
 * Returns: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { LCM_CLASS, ... }, geometry }] }
 * This matches the exact structure of geoJSON/LCM/{CODE}_LCM2025.geojson
 */
export async function fetchLCMFromSupabase(basinCode, onProgress) {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase not configured');

  if (onProgress) onProgress(0, `Fetching ${basinCode} LCM from Supabase…`);

  const { data, error } = await supabase
    .from('lcm')
    .select('lcm_class, properties, geom')
    .eq('basin_code', basinCode);

  if (error) throw new Error('Supabase LCM query failed: ' + error.message);

  if (!data || data.length === 0) {
    throw new Error('No LCM data found for basin: ' + basinCode);
  }

  if (onProgress) onProgress(50, `Rebuilding GeoJSON (${data.length} features)…`);

  const features = data.map(row => {
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
