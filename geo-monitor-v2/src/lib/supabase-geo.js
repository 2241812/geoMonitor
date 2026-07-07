import { createClient } from '@supabase/supabase-js';

let _client = null;

const SUPABASE_URL = 'https://micsfokodqqqgwtlctca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pY3Nmb2tvZHFxcWd3dGxjdGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjExNjgsImV4cCI6MjA5ODUzNzE2OH0.zTrxYk4-QJ-nsM_SlcqiA1IR7XpZXpFmjCN2xBQgTY4';
const BASIN_CODES = ['ABR','ABU','AGN','AMB','ARI','BUD','CAB','MLG','NAG','SIF','SMR','UCH','UMT','ZUM'];
const BASIN_FEATURE_COUNTS = { ABR: 20366, ABU: 6220, AGN: 5000, AMB: 5875, ARI: 2481, BUD: 2277, CAB: 784, MLG: 3000, NAG: 3160, SIF: 2705, SMR: 1400, UCH: 19868, UMT: 4000, ZUM: 1221 };

let _cachedAllLCM = null;
let _cachedBasinLCM = {};

function _cacheKey(basinCode, classes) {
  return basinCode + '::' + (classes || []).sort().join(',');
}

function getClient() {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

async function _fetchPaginated(table, columns, basinCode, onProgress, estimateSize, classes) {
  const supabase = getClient();
  const PAGE_SIZE = 1000;
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    if (onProgress) onProgress(Math.min(90, Math.round((offset / (estimateSize || 5000)) * 90)), `Fetching batch ${Math.floor(offset / PAGE_SIZE) + 1}…`);

    let query = supabase
      .from(table)
      .select(columns)
      .eq('basin_code', basinCode);

    if (classes && classes.length > 0) {
      query = query.in('lcm_class', classes);
    }

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

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
export async function fetchLCMFromSupabase(basinCode, onProgress, classes) {
  const key = _cacheKey(basinCode, classes);
  if (_cachedBasinLCM[key]) {
    if (onProgress) onProgress(100, `${basinCode} LCM loaded from cache`);
    return _cachedBasinLCM[key];
  }
  if (onProgress) onProgress(0, `Fetching ${basinCode} LCM…`);
  const estimate = BASIN_FEATURE_COUNTS[basinCode] || 5000;
  const data = await _fetchPaginated('lcm', 'lcm_class, properties, geom', basinCode, onProgress, estimate, classes);
  if (data.length === 0) throw new Error('No LCM data found for basin: ' + basinCode);
  if (onProgress) onProgress(90, `Rebuilding GeoJSON (${data.length} features)…`);
  const geojson = { type: 'FeatureCollection', features: _buildLCMFeatures(data) };
  _cachedBasinLCM[key] = geojson;
  return geojson;
}

export async function fetchAllLCMFromSupabase(onProgress, classes) {
  const key = _cacheKey('ALL', classes);
  if (_cachedAllLCM && _cachedAllLCM._key === key) {
    if (onProgress) onProgress(100, 'All basins LCM loaded from cache');
    return _cachedAllLCM;
  }
  if (onProgress) onProgress(0, 'Fetching LCM for all basins…');

  const totalEstimate = BASIN_CODES.reduce((sum, c) => sum + (BASIN_FEATURE_COUNTS[c] || 5000), 0);
  let allFeatures = [];
  let fetchedCount = 0;

  for (let i = 0; i < BASIN_CODES.length; i++) {
    const code = BASIN_CODES[i];
    try {
      const estimate = BASIN_FEATURE_COUNTS[code] || 5000;
      const data = await _fetchPaginated('lcm', 'lcm_class, properties, geom', code, null, estimate, classes);
      data.forEach(row => {
        const props = { LCM_CLASS: row.lcm_class };
        if (row.properties) {
          Object.assign(props, typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties);
        }
        allFeatures.push({ type: 'Feature', properties: props, geometry: row.geom });
      });
      fetchedCount += data.length;
      if (onProgress) onProgress(10 + Math.round(((i + 1) / BASIN_CODES.length) * 80), `Fetched ${code} (${data.length}) [${fetchedCount}/${totalEstimate}]…`);
    } catch (e) {
      console.warn(`LCM fetch failed for ${code}:`, e.message);
    }
  }

  if (allFeatures.length === 0) throw new Error('No LCM data found in Supabase');
  if (onProgress) onProgress(95, `Rebuilding GeoJSON (${allFeatures.length} features)…`);
  const result = { type: 'FeatureCollection', features: allFeatures };
  result._key = key;
  _cachedAllLCM = result;
  return _cachedAllLCM;
}

export function invalidateLCMCache(basinCode) {
  if (basinCode) {
    delete _cachedBasinLCM[basinCode];
  } else {
    _cachedAllLCM = null;
    _cachedBasinLCM = {};
  }
}
