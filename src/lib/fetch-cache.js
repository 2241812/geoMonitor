/**
 * fetch-cache.js — Cached fetch with deduplication, abort, and retry.
 *
 * Guarantees:
 *   1. Same key fetched twice simultaneously → one request, shared promise
 *   2. Cache-first reads (configurable TTL)
 *   3. AbortController integration for mode-switch cancellation
 *   4. Retry with exponential backoff on transient failures
 */

const _cache = new Map();
const _inflight = new Map();

/**
 * @param {string} key   — unique cache key (e.g. 'watershed', 'boundary:1')
 * @param {string} url   — fetch URL
 * @param {object} opts
 * @param {number}  [opts.ttl=Infinity]  — cache lifetime in ms (0 = no cache)
 * @param {number}  [opts.retries=2]     — retry count on transient failure
 * @param {AbortSignal} [opts.signal]    — external abort signal (e.g. from mode switch)
 * @param {boolean} [opts.force=false]   — bypass cache, re-fetch
 * @returns {Promise<object|null>} decoded JSON or null on failure
 */
export async function fetchWithCache(key, url, opts = {}) {
  const { ttl = Infinity, retries = 2, signal, force = false } = opts;

  if (!force) {
    const cached = _cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }

  if (_inflight.has(key)) {
    return _inflight.get(key);
  }

  const promise = _doFetch(url, retries, signal);
  _inflight.set(key, promise);

  try {
    const data = await promise;
    if (data !== null && ttl > 0) {
      _cache.set(key, { data, expiresAt: Date.now() + ttl });
    }
    return data;
  } finally {
    _inflight.delete(key);
  }
}

async function _doFetch(url, retries, signal) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, { signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      return window.decodeGeo ? window.decodeGeo(json) : json;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 200 * 2 ** attempt));
      }
    }
  }
  if (import.meta.env.DEV) console.warn(`fetchWithCache failed (${url}):`, lastError);
  return null;
}

export function cacheDelete(key) {
  _cache.delete(key);
}

export function cacheClear() {
  _cache.clear();
  _inflight.clear();
}
