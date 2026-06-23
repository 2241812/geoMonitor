/**
 * preprocess_watersheds.js
 *
 * Computes which NAMRIA and CADASTRE administrative boundaries
 * (provinces + municipalities) each top-level watershed basin intersects with.
 *
 * Output: main/geoJSON/watershed-intersections.json
 *
 * Schema:
 * {
 *   "<boundaryId>": ["Watershed Name A", "Watershed Name B", ...],
 *   "namria": {
 *     "<watershedName>": {
 *       "provinces": ["abra", "benguet", ...],
 *       "municipalities": ["benguet:itogon", ...]
 *     }
 *   },
 *   "cad": {
 *     "<watershedName>": {
 *       "provinces": ["abra", "benguet", ...],
 *       "municipalities": ["benguet:itogon", ...]
 *     }
 *   }
 * }
 *
 * The top-level keys (boundary IDs) are kept for backward compatibility
 * with the admin-mode watershed overlay feature.
 * The new "namria" and "cad" sections are used by the watershed mode Spans chips.
 *
 * Usage: node preprocess_watersheds.js
 */

const fs = require('fs');
const turf = require('@turf/turf');

/* Slugify a name for use as a stable ID. Must match the slug convention
   used by preprocess-hierarchy.js (stripDiacritics + lowercase). */
function stripDiacritics(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function slugify(name) {
  return stripDiacritics(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* Test a geometry against an array of boundary features, collecting matching IDs */
function findIntersections(geom, boundaries) {
  const hits = new Set();
  boundaries.forEach(entry => {
    try {
      if (turf.booleanIntersects(geom, entry.feature)) {
        hits.add(entry.id);
      }
    } catch (_) {}
  });
  return hits;
}

function main() {
  console.log("Loading GeoJSON data...");

  // Load NAMRIA Provinces
  const namriaProvRaw = fs.readFileSync('main/geoJSON/CAR NAMRIA Provincial Boundary.geojson', 'utf8');
  const namriaProvData = JSON.parse(namriaProvRaw);

  // Load NAMRIA Municipalities
  const namriaMuniRaw = fs.readFileSync('main/geoJSON/CAR NAMRIA Municipal Boundary.geojson', 'utf8');
  const namriaMuniData = JSON.parse(namriaMuniRaw);

  // Load CAD Municipalities (CAD Provincial is identical per AGENTS.md)
  const cadMuniRaw = fs.readFileSync('main/geoJSON/CAR CAD Municipal Boundary.geojson', 'utf8');
  const cadMuniData = JSON.parse(cadMuniRaw);

  // Load Watersheds
  const wsRaw = fs.readFileSync('main/geoJSON/CAR Watersheds.geojson', 'utf8');
  const watershedsData = JSON.parse(wsRaw);

  /* Build NAMRIA boundary entries */
  const namriaProvinces = namriaProvData.features.map(f => ({
    id: f.properties._id,
    feature: f,
  }));
  const namriaMunicipalities = namriaMuniData.features.map(f => ({
    id: f.properties._id,
    feature: f,
  }));

  /* Build CAD boundary entries — derive province slug from Province property.
     Disputed-area features (e.g. "Baay-Licuan vs Lacub vs Lagangilang",
     "Ifugao vs Mt Province") are filtered out — they are not real LGUs. */
  const cadMunicipalities = cadMuniData.features
    .filter(f => {
      const p = f.properties || {};
      const muniName = p.Muni_City || '';
      const provName = p.Province || '';
      return !muniName.includes(' vs ') && !provName.includes(' vs ');
    })
    .map(f => {
      const p = f.properties || {};
      const provName = p.Province || '';
      const muniName = p.Muni_City || '';
      const muniId = slugify(provName) + ':' + slugify(muniName);
      return { id: muniId, provinceSlug: slugify(provName), feature: f };
    });

  /* Derive unique CAD provinces */
  const cadProvinceSlugs = new Set(cadMunicipalities.map(e => e.provinceSlug));

  /* Build watersheds array */
  const watersheds = watershedsData.features.map(f => ({
    name: f.properties.Name || f.properties.Old_Name,
    feature: f,
  })).filter(ws => ws.name);

  console.log(`Loaded ${namriaProvinces.length} NAMRIA provinces, ${namriaMunicipalities.length} NAMRIA municipalities, ${cadMunicipalities.length} CAD municipalities, and ${watersheds.length} watersheds.`);

  /* ── Backward-compatible mapping: boundaryId → watershed names ── */
  const intersections = {};

  const namriaBoundaries = [
    ...namriaProvinces.map(e => ({ id: e.id, feature: e.feature })),
    ...namriaMunicipalities.map(e => ({ id: e.id, feature: e.feature })),
  ];
  namriaBoundaries.forEach(boundary => {
    const intersectingWs = [];
    watersheds.forEach(ws => {
      try {
        if (turf.booleanIntersects(boundary.feature, ws.feature)) {
          intersectingWs.push(ws.name);
        }
      } catch (e) {
        console.error(`Error intersecting ${boundary.id} and ${ws.name}: ${e.message}`);
      }
    });
    intersections[boundary.id] = intersectingWs;
    console.log(`Boundary ${boundary.id} intersects with ${intersectingWs.length} watersheds.`);
  });

  /* ── New: NAMRIA per-watershed spans ── */
  const namriaSpans = {};
  watersheds.forEach(ws => {
    const provHits = findIntersections(ws.feature, namriaProvinces);
    const muniHits = findIntersections(ws.feature, namriaMunicipalities);
    namriaSpans[ws.name] = {
      provinces: [...provHits].sort(),
      municipalities: [...muniHits].sort(),
    };
  });

  /* ── New: CAD per-watershed spans ── */
  const cadSpans = {};
  watersheds.forEach(ws => {
    const muniHits = findIntersections(ws.feature, cadMunicipalities);
    /* Derive province hits from municipal hits */
    const provHits = new Set();
    muniHits.forEach(muniId => {
      const parts = muniId.split(':');
      if (parts[0]) provHits.add(parts[0]);
    });
    cadSpans[ws.name] = {
      provinces: [...provHits].sort(),
      municipalities: [...muniHits].sort(),
    };
  });

  /* Merge into output */
  const output = Object.assign({}, intersections, { namria: namriaSpans, cad: cadSpans });

  const outPath = 'main/geoJSON/watershed-intersections.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Successfully wrote intersections mapping to ${outPath}`);
}

main();
