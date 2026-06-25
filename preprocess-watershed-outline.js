/**
 * preprocess-watershed-outline.js
 *
 * Dissolves the 14 individual CAR watershed polygons into a single
 * merged outline FeatureCollection, written to
 *   main/geoJSON/CAR Watersheds Outline.geojson
 *
 * The output is a one-feature collection used as the Watersheds-mode
 * "level 0" outline (analogous to the CAR administrative boundary
 * outline shown at level 0 of Boundary mode).
 *
 * Uses JSTS (already in node_modules) for topology-safe unary union.
 *
 *   node preprocess-watershed-outline.js
 */

const fs = require('fs');
const path = require('path');
const jsts = require('jsts/dist/jsts.min.js');

const inputFile = path.join(__dirname, 'main/geoJSON/CAR Watersheds.geojson');
const outputFile = path.join(__dirname, 'main/geoJSON/CAR Watersheds Outline.geojson');

const raw = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
if (!raw.features || !raw.features.length) {
  console.error('No features found in', inputFile);
  process.exit(1);
}

const reader = new jsts.io.GeoJSONReader();
const writer = new jsts.io.GeoJSONWriter();

/* Read each feature geometry, clean its topology with buffer(0), and
   collect into an array. Some source polygons have near-zero
   self-intersections (non-noded edges) that break union; buffer(0)
   cleans the topology without changing the visible shape. */
const geoms = [];
raw.features.forEach((f, i) => {
  if (!f.geometry) return;
  try {
    const g = reader.read(f.geometry).buffer(0);
    geoms.push(g);
  } catch (e) {
    console.warn(`Skipping feature ${i} (${f.properties && f.properties.Name}): ${e.message}`);
  }
});

if (!geoms.length) {
  console.error('No valid geometries to union.');
  process.exit(1);
}

/* Unary union of all cleaned geometries. UnaryUnionOp.union expects a
   JSTS GeometryCollection; disjoint inputs (14 separate watersheds)
   yield a MultiPolygon. */
let merged;
try {
  const factory = geoms[0].getFactory();
  const gc = factory.createGeometryCollection(geoms);
  merged = jsts.operation.union.UnaryUnionOp.union(gc);
} catch (e) {
  console.error('Unary union failed:', e.message);
  process.exit(1);
}

/* Simplify the merged outline to reduce file size while preserving shape.
   Tolerance 0.002 ≈ 200 m at this latitude — visually identical. */
const Simplifier = jsts.simplify.DouglasPeuckerSimplifier;
merged = Simplifier.simplify(merged, 0.002);

/* GeoJSONWriter returns a plain { type, coordinates } geometry object. */
const mergedGeom = writer.write(merged);

const out = {
  type: 'FeatureCollection',
  name: 'CAR_Watersheds_Outline',
  crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
  features: [{
    type: 'Feature',
    properties: {
      Name: 'Cordillera Administrative Region Watersheds',
      Region: 'Cordillera Administrative Region',
    },
    geometry: mergedGeom,
  }],
};

fs.writeFileSync(outputFile, JSON.stringify(out));
console.log(`Wrote merged outline (${out.features.length} feature) → ${outputFile}`);
