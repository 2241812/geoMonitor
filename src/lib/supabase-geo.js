import { createClient } from '@supabase/supabase-js';
import { cacheGet, cacheSet, cacheDelete } from './db-cache.js';

let _client = null;

const CACHE_VERSION = 'v1';
const CONCURRENCY = 4;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://micsfokodqqqgwtlctca.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pY3Nmb2tvZHFxcWd3dGxjdGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjExNjgsImV4cCI6MjA5ODUzNzE2OH0.zTrxYk4-QJ-nsM_SlcqiA1IR7XpZXpFmjCN2xBQgTY4';
const BASIN_CODES = ['ABR','ABU','AGN','AMB','ARI','BUD','CAB','MLG','NAG','SIF','SMR','UCH','UMT','ZUM'];
const BASIN_FEATURE_COUNTS = { ABR: 20366, ABU: 6220, AGN: 5000, AMB: 5875, ARI: 2481, BUD: 2277, CAB: 784, MLG: 3000, NAG: 3160, SIF: 2705, SMR: 1400, UCH: 19868, UMT: 4000, ZUM: 1221 };

let _cachedAllLCM = null;
let _cachedBasinLCM = {};
let _cachedBasinSlope = {};

function _cacheKey(basinCode, classes) {
  return basinCode + '::' + (classes || []).sort().join(',');
}

function _idbKey(basinCode, classes) {
  return CACHE_VERSION + ':lcm:' + _cacheKey(basinCode, classes);
}

/* ── Slope cache helpers ── */
function _slopeCacheKey(basinCode, quality = 'balanced') {
  return 'slope:' + basinCode + '::' + quality;
}
function _slopeIdbKey(basinCode, quality = 'balanced') {
  return CACHE_VERSION + ':slope:' + basinCode + '::' + quality;
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

export async function fetchLCMFromSupabase(basinCode, onProgress, classes) {
  const key = _cacheKey(basinCode, classes);
  if (_cachedBasinLCM[key]) {
    if (onProgress) onProgress(100, `${basinCode} LCM loaded from cache`);
    return _cachedBasinLCM[key];
  }
  const idbKey = _idbKey(basinCode, classes);
  const cached = await cacheGet(idbKey);
  if (cached) {
    _cachedBasinLCM[key] = cached;
    if (onProgress) onProgress(100, `${basinCode} LCM loaded from cache`);
    return cached;
  }
  if (onProgress) onProgress(0, `Fetching ${basinCode} LCM…`);
  const estimate = BASIN_FEATURE_COUNTS[basinCode] || 5000;
  const data = await _fetchPaginated('lcm', 'lcm_class, properties, geom', basinCode, onProgress, estimate, classes);
  if (data.length === 0) throw new Error('No LCM data found for basin: ' + basinCode);
  if (onProgress) onProgress(90, `Rebuilding GeoJSON (${data.length} features)…`);
  const geojson = { type: 'FeatureCollection', features: _buildLCMFeatures(data) };
  _cachedBasinLCM[key] = geojson;
  cacheSet(idbKey, geojson);
  return geojson;
}

export async function fetchAllLCMFromSupabase(onProgress, classes) {
  const key = _cacheKey('ALL', classes);
  if (_cachedAllLCM && _cachedAllLCM._key === key) {
    if (onProgress) onProgress(100, 'All basins LCM loaded from cache');
    return _cachedAllLCM;
  }
  const idbKey = _idbKey('ALL', classes);
  const cached = await cacheGet(idbKey);
  if (cached) {
    cached._key = key;
    _cachedAllLCM = cached;
    if (onProgress) onProgress(100, 'All basins LCM loaded from cache');
    return cached;
  }
  if (onProgress) onProgress(0, 'Fetching LCM for all basins…');

  let allFeatures = [];
  let doneCount = 0;

  for (let i = 0; i < BASIN_CODES.length; i += CONCURRENCY) {
    const chunk = BASIN_CODES.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (code) => {
        const estimate = BASIN_FEATURE_COUNTS[code] || 5000;
        const data = await _fetchPaginated('lcm', 'lcm_class, properties, geom', code, null, estimate, classes);
        return { code, data };
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { code, data } = result.value;
        for (const row of data) {
          const props = { LCM_CLASS: row.lcm_class };
          if (row.properties) {
            Object.assign(props, typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties);
          }
          allFeatures.push({ type: 'Feature', properties: props, geometry: row.geom });
        }
        doneCount++;
        if (onProgress) {
          const pct = Math.round((doneCount / BASIN_CODES.length) * 90);
          onProgress(pct, `Fetched ${code} (${data.length} features) [${doneCount}/${BASIN_CODES.length}]`);
        }
      } else {
        if (import.meta.env.DEV) console.warn('LCM fetch failed:', result.reason?.message);
        doneCount++;
      }
    }
  }

  if (allFeatures.length === 0) throw new Error('No LCM data found in Supabase');
  if (onProgress) onProgress(95, `Rebuilding GeoJSON (${allFeatures.length} features)…`);
  const result = { type: 'FeatureCollection', features: allFeatures };
  result._key = key;
  _cachedAllLCM = result;
  cacheSet(idbKey, result);
  return result;
}

export async function submitDataRequest(payload) {
  const supabase = getClient();
  return supabase.from('data_requests').insert([{
    name: payload.name,
    email: payload.email,
    organization: payload.organization || '',
    contact_number: payload.contactNumber || '',
    object_name: payload.objectName || '',
    object_meta: payload.objectMeta || '',
    data_layers: payload.dataLayers || [],
    format: payload.format || 'GeoJSON',
    extent: payload.extent || 'Entire CAR',
    purpose: payload.purpose || '',
    notes: payload.notes || '',
    source_url: payload.sourceUrl || '',
  }]);
}

/* ── Slope fetch ── */

function _buildSlopeFeatures(rows, forceFull = false) {
  return rows.map(row => ({
    type: 'Feature',
    properties: {
      gridcode: row.gridcode,
      _simplified: forceFull ? false : !!row.geom_simplified,
    },
    geometry: forceFull ? row.geom : (row.geom_simplified || row.geom),
  }));
}

export async function fetchSlopeFromSupabase(basinCode, onProgress, quality = 'balanced') {
  const key = _slopeCacheKey(basinCode, quality);
  if (_cachedBasinSlope[key]) {
    if (onProgress) onProgress(100, `${basinCode} slope loaded from cache`);
    return _cachedBasinSlope[key];
  }
  const idbKey = _slopeIdbKey(basinCode, quality);
  const cached = await cacheGet(idbKey);
  if (cached) {
    _cachedBasinSlope[key] = cached;
    if (onProgress) onProgress(100, `${basinCode} slope loaded from cache`);
    return cached;
  }
  if (onProgress) onProgress(0, `Fetching ${basinCode} slope (${quality})…`);
  const supabase = getClient();

  const selectCols = quality === 'full' ? 'gridcode, geom' : 'gridcode, geom, geom_simplified';
  let { data, error } = await supabase
    .from('slope')
    .select(selectCols)
    .eq('basin_code', basinCode);

  if (error && error.message && error.message.includes('geom_simplified')) {
    if (onProgress) onProgress(0, `Fetching ${basinCode} slope (full geom)…`);
    const retry = await supabase
      .from('slope')
      .select('gridcode, geom')
      .eq('basin_code', basinCode);
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error('Supabase slope query failed: ' + error.message);
  if (!data || data.length === 0) throw new Error('No slope data for basin: ' + basinCode);
  if (onProgress) onProgress(90, `Rebuilding GeoJSON (${data.length} features)…`);
  const geojson = { type: 'FeatureCollection', features: _buildSlopeFeatures(data, quality === 'full') };
  _cachedBasinSlope[key] = geojson;
  cacheSet(idbKey, geojson);
  return geojson;
}

export function invalidateSlopeCache(basinCode) {
  if (basinCode) {
    ['fast', 'balanced', 'full'].forEach(quality => {
      delete _cachedBasinSlope[_slopeCacheKey(basinCode, quality)];
      cacheDelete(_slopeIdbKey(basinCode, quality));
    });
  } else {
    _cachedBasinSlope = {};
    cacheDelete(_slopeIdbKey('ALL'));
  }
}

export function invalidateLCMCache(basinCode) {
  if (basinCode) {
    for (const key of Object.keys(_cachedBasinLCM)) {
      if (key === basinCode || key.startsWith(basinCode + '::')) {
        delete _cachedBasinLCM[key];
        cacheDelete(CACHE_VERSION + ':lcm:' + key);
      }
    }
  } else {
    _cachedAllLCM = null;
    _cachedBasinLCM = {};
    cacheDelete(_idbKey('ALL', null));
  }
}

export async function fetchAvailableLCMClasses(basinCode) {
  if (!basinCode) return null;
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('lcm')
      .select('lcm_class')
      .eq('basin_code', basinCode.toUpperCase());
    if (error || !data) return null;
    return Array.from(new Set(data.map(r => r.lcm_class).filter(Boolean)));
  } catch (_) {
    return null;
  }
}
