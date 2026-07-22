import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLOPE_DIR = join(__dirname, '../public/geoJSON/Slope');

/**
 * Match the server-side simplification from the DeployTool (upload-slope-lcm.py):
 * - Douglas-Peucker simplify with tolerance 0.0005
 * - Round coordinates to 4 decimal places (~11m precision)
 *
 * This produces the same geom_simplified that Supabase served.
 */

function dpSimplify(ring, tol) {
  if (ring.length < 3) return ring;
  let dmax = 0, idx = 0;
  const first = ring[0], last = ring[ring.length - 1];
  for (let i = 1; i < ring.length - 1; i++) {
    const d = perpDist(ring[i], first, last);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > tol) {
    const left = dpSimplify(ring.slice(0, idx + 1), tol);
    const right = dpSimplify(ring.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const px = a[0] + t * dx, py = a[1] + t * dy;
  return Math.sqrt((p[0] - px) ** 2 + (p[1] - py) ** 2);
}

function roundCoord(c) {
  return [Math.round(c[0] * 10000) / 10000, Math.round(c[1] * 10000) / 10000];
}

function simplifyGeometry(geom, tol) {
  if (!geom || !geom.type) return geom;
  const g = JSON.parse(JSON.stringify(geom));
  if (g.type === 'Polygon') {
    g.coordinates = g.coordinates.map(ring => dpSimplify(ring, tol).map(roundCoord));
  } else if (g.type === 'MultiPolygon') {
    g.coordinates = g.coordinates.map(poly =>
      poly.map(ring => dpSimplify(ring, tol).map(roundCoord))
    );
  }
  return g;
}

async function main() {
  const TOL = 0.0005; // Same as DeployTool default
  const files = readdirSync(SLOPE_DIR).filter(f => f.endsWith('.geojson'));
  console.log(`Optimizing ${files.length} slope files (tol=${TOL}, 4-decimal rounding)…`);

  for (const file of files) {
    const filePath = join(SLOPE_DIR, file);
    const rawSize = statSync(filePath).size;

    const fc = JSON.parse(readFileSync(filePath, 'utf8'));
    if (fc.type === 'FeatureCollection' && fc.features) {
      for (let i = 0; i < fc.features.length; i++) {
        const f = fc.features[i];
        if (f.geometry) {
          f.geometry = simplifyGeometry(f.geometry, TOL);
        }
      }
    }

    const out = JSON.stringify(fc);
    writeFileSync(filePath, out, 'utf8');
    const newSize = statSync(filePath).size;
    console.log(`  ${file}: ${(rawSize / 1024 / 1024).toFixed(1)} MB → ${(newSize / 1024 / 1024).toFixed(1)} MB (${((1 - newSize / rawSize) * 100).toFixed(1)}% reduction)`);
  }

  console.log('\nDone! Files match DeployTool geom_simplified quality.');
}

main().catch(console.error);
