# geoMonitor Optimization & Refactoring Plan (For MiMo v2.5)

This document outlines a detailed execution plan for optimizing data fetching and overall application performance in the geoMonitor codebase. It also includes instructions for migrating away from the current, non-functional Google Apps Script email system.

Please follow these instructions sequentially.

## 1. Data Fetching & Caching Optimizations

Currently, data fetching (especially for heavy layers like LCM and Slope from Supabase) relies on sequential processing and basic in-memory caching. We need to improve this to reduce load times and TTI (Time to Interactive).

### Step 1.1: Parallelize Supabase Fetches (`src/lib/supabase-geo.js`)
**Current Bottleneck:** In `fetchAllLCMFromSupabase`, the application loops over `BASIN_CODES` sequentially, waiting for one basin to finish downloading before starting the next.
**Action Required:**
- Refactor `fetchAllLCMFromSupabase` to use a concurrency pool or `Promise.all` with a chunk size limit (e.g., fetching 3-4 basins concurrently).
- **Code Advice:** Use an asynchronous chunking utility or simply `Promise.all` across sliced arrays of `BASIN_CODES`. 
```javascript
// Conceptual example for MiMo:
const CONCURRENCY = 4;
for (let i = 0; i < BASIN_CODES.length; i += CONCURRENCY) {
    const chunk = BASIN_CODES.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (code) => {
        // execute _fetchPaginated for this code
    }));
}
```

### Step 1.2: Implement Persistent Client-Side Caching (IndexedDB)
**Current Bottleneck:** `_cachedBasinLCM` only lives in RAM. If the user refreshes, they redownload megabytes of data.
**Action Required:**
- Implement IndexedDB caching for large GeoJSON payloads.
- **Code Advice:** Introduce a lightweight wrapper like `idb-keyval` (or write a native IndexedDB wrapper in `supabase-geo.js`). Before making a `fetch` or `supabase.from()` call, check if the data exists in IndexedDB with an expiration timestamp or version hash.
- **Target Files:** `src/lib/supabase-geo.js` and potentially `src/lib/app.js` (for TopoJSON files like `CAR Watersheds Outline.topojson`).

### Step 1.3: Vector Tiles for Heavy Overlays
**Current Bottleneck:** Fetching 20,000+ polygons via REST (like for `UCH` LCM data) and rendering them in Leaflet SVG/Canvas chokes the main thread.
**Action Required:**
- Review the usage of `src/lib/vector-tile-layer.js`. The `AGENTS.md` mentions `convert-pmtiles.mjs`. 
- Instruct MiMo to transition the heaviest layers (Land Cover, Slope) entirely to PMTiles instead of raw GeoJSON over Supabase, offloading the rendering to the `tile-worker.js`.

---

## 2. Overall Code & Rendering Optimizations

### Step 2.1: Debounce Map Event Listeners
**Current Bottleneck:** Map events like `zoomend` or `mousemove` might be firing expensive DOM updates too frequently.
**Action Required:**
- Check `src/lib/hydro-mode.js` and `app.js` for listeners attached to `map.on('zoomend', ...)`. Ensure that heavy re-renders (like recalculating styling for thousands of polygons) are debounced.

### Step 2.2: TopoJSON Decoding Web Worker
**Current Bottleneck:** `window.decodeGeo` blocks the main thread when converting large TopoJSON files to GeoJSON during app initialization.
**Action Required:**
- Move `topojson.feature()` decoding into a Web Worker, especially for `CAR Watersheds.topojson` and `CAR NAMRIA Boundary.topojson`. 
- **Code Advice:** Create `src/workers/topo-worker.js`, send the raw JSON string/object, and return the decoded GeoJSON feature collection.

---

## 3. Alternative to the Email System (Data Request System)

**The Problem:** The current configuration (`config.js`) uses `dataRequestEmail` and a `dataRequestEndpoint` pointing to a Google Apps Script (`script.google.com/macros/...`). Google Apps Scripts are notoriously unreliable for cross-origin form submissions, often failing due to CORS, execution limits, or silent failures in script deployment.

**The Solution:** Since geoMonitor is already heavily utilizing **Supabase**, we should leverage it for data requests. 

### Step 3.1: Supabase Database Table (Recommended)
Instead of trying to send an email directly from the browser, we should insert the user's data request into a Supabase table.
- **Action Required for MiMo:**
  1. Create a SQL migration (or instruct the admin to run it) to create a table: `data_requests` with columns: `id`, `name`, `email`, `organization`, `request_details`, `status`, `created_at`.
  2. In the React UI (likely a modal or panel where this request is made), replace the `fetch()` call to the Google App Script with a Supabase insert:
  ```javascript
  const { error } = await supabase
    .from('data_requests')
    .insert([{ name, email, organization, request_details }]);
  ```

### Step 3.2: Supabase Edge Function + Resend (For actual Email Delivery)
If an actual email *must* reach the inbox of `ddsalvador@denr.gov.ph` immediately:
- **Action Required for MiMo:**
  1. Write a Supabase Edge Function (`/supabase/functions/send-request/index.ts`).
  2. Use a transactional email service like **Resend** or **SendGrid** inside the Edge Function.
  3. The Edge function can be triggered either directly via the client, or via a Supabase Database Webhook triggered by the insert in Step 3.1.

### Step 3.3: Web3Forms (Fallback No-Backend Alternative)
If Edge Functions are too complex right now, replace the Google Apps script with **Web3Forms**.
- **Action Required for MiMo:**
  1. Generate an Access Key at web3forms.com for `ddsalvador@denr.gov.ph`.
  2. Update the frontend form to `POST` directly to `https://api.web3forms.com/submit`.
  3. This requires zero backend code and bypasses CORS issues cleanly.

---

**MiMo v2.5 Execution Directive:**
Begin by implementing **Section 3** (Email Alternative via Supabase Insert) to restore broken functionality immediately. Then proceed to **Section 1.1** (Parallel Supabase Fetches) and **Section 1.2** (IndexedDB caching). Test the map's TTI (Time to Interactive) after each phase.
