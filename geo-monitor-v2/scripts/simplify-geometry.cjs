// Build-time geometry simplification using Turf's Douglas-Peucker algorithm.
// Reduces polygon vertex count by ~50-70% while preserving shape quality.
// Tolerance: 0.001 degrees (~110 m) — sufficient for watershed/admin boundaries.
//
// Usage: node scripts/simplify-geometry.cjs
const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const topojsonServer = require('topojson-server');

const GEO_DIR = path.join(__dirname, '../public/geoJSON');
const TOLERANCE = 0.001;

// Dynamic import for ESM-only Turf v7
async function loadTurf() {
  const turf = await import('@turf/turf');
  return turf;
}

function walkTopoFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTopoFiles(fullPath));
    } else if (entry.name.endsWith('.topojson')) {
      files.push(fullPath);
    }
  }
  return files;
}

function countCoords(arcs) {
  let n = 0;
  for (const ring of arcs) {
    for (const pt of ring) {
      n += pt.length;
    }
  }
  return n;
}

async function main() {
  const turf = await loadTurf();
  const files = walkTopoFiles(GEO_DIR);
  console.log(`Simplifying ${files.length} topology files (tolerance=${TOLERANCE}°)`);

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    
    // Determine the named object key
    const objKey = Object.keys(data.objects)[0];
    if (!objKey) {
      console.log(`  ${path.basename(filePath)}: no objects, skipping`);
      continue;
    }

    // Count coordinates before
    const coordsBefore = countCoords(data.arcs);

    // Convert TopoJSON → GeoJSON
    const geojson = topojson.feature(data, data.objects[objKey]);
    
    // Simplify each feature
    if (geojson.type === 'FeatureCollection') {
      for (let i = 0; i < geojson.features.length; i++) {
        const f = geojson.features[i];
        if (f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon' || f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')) {
          try {
            geojson.features[i] = turf.simplify(f, { tolerance: TOLERANCE, highQuality: false });
          } catch (_) {
            // Skip features that fail simplification (e.g. empty geometries)
          }
        }
      }
    } else if (geojson.geometry && (geojson.geometry.type === 'Polygon' || geojson.geometry.type === 'MultiPolygon')) {
      try {
        const simplified = turf.simplify(geojson, { tolerance: TOLERANCE, highQuality: false });
        geojson.geometry = simplified.geometry;
      } catch (_) {}
    }

    // Convert GeoJSON → TopoJSON (quantized)
    const rebuilt = topojsonServer.topology({ [objKey]: geojson });
    
    // Copy over non-geometry properties (bbox, transform) from original
    if (data.bbox) rebuilt.bbox = data.bbox;
    if (data.transform) rebuilt.transform = data.transform;

    // Count coordinates after
    const coordsAfter = countCoords(rebuilt.arcs);
    const reduction = coordsBefore > 0 ? ((1 - coordsAfter / coordsBefore) * 100).toFixed(1) : '0';

    const out = JSON.stringify(rebuilt);
    const newSize = Buffer.byteLength(out, 'utf8');
    const oldSize = Buffer.byteLength(raw, 'utf8');
    const saved = ((1 - newSize / oldSize) * 100).toFixed(1);

    console.log(
      `  ${path.basename(filePath)}: ${coordsBefore}→${coordsAfter} coords (${reduction}%), ` +
      `${(oldSize / 1024).toFixed(0)}KB→${(newSize / 1024).toFixed(0)}KB (${saved}% saved)`
    );
    fs.writeFileSync(filePath, out, 'utf8');
  }

  console.log('Done.');
}

main().catch(console.error);
