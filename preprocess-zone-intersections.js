/**
 * preprocess-zone-intersections.js
 *
 * Computes which NAMRIA and CADASTRE administrative boundaries
 * (provinces + municipalities) each sub-watershed zone intersects with.
 *
 * Output: main/geoJSON/zone-intersections.json
 *
 * Schema:
 * {
 *   "<basinCode>:<zoneGridcode>": {
 *     "namria_provinces": ["abra", "benguet", ...],
 *     "namria_municipalities": ["benguet:itogon", "benguet:tublay", ...],
 *     "cad_provinces": ["abra", "benguet", ...],
 *     "cad_municipalities": ["benguet:itogon", "benguet:tublay", ...]
 *   }
 * }
 *
 * Usage: node preprocess-zone-intersections.js
 */

const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const geoDir = path.join(__dirname, 'main', 'geoJSON');

/* Basin config mirrors APP.config.hydroBasinFolderMap */
const basins = {
  ABR: { folder: 'Abra Riverbasin', name: 'Abra River Watershed' },
  ABU: { folder: 'Apayao-Abulug Riverbasin', name: 'Abulug River Watershed' },
  AGN: { folder: 'Agno Riverbasin', name: 'Agno River Watershed' },
  AMB: { folder: 'Amburayan River', name: 'Bayogao River Watershed' },
  ARI: { folder: 'Aringay River', name: 'Aringay River Watershed' },
  BUD: { folder: 'Bued River', name: 'Bued River Watershed' },
  CAB: { folder: 'Cabicungan River', name: 'Cabicungan River Watershed' },
  MLG: { folder: 'Mallig River', name: 'Mallig River Watershed' },
  NAG: { folder: 'Naguilian River', name: 'Naguilian River Watershed' },
  SIF: { folder: 'Siffu River', name: 'Siffu River Watershed' },
  SMR: { folder: 'Santa Maria River (Silag)', name: 'Santa Maria River Watershed' },
  UCH: { folder: 'Upper Chico Riverbasin', name: 'Upper Chico River Watershed' },
  UMT: { folder: 'Upper Magat River', name: 'Upper Magat River Watershed' },
  ZUM: { folder: 'Zumigui-Ziwanan River', name: 'Zumigui-Ziwanan River Watershed' },
};

/* Slugify a name for use as a stable ID. Must match the slug convention
   used by preprocess-hierarchy.js (stripDiacritics + lowercase). */
function stripDiacritics(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function slugify(name) {
  return stripDiacritics(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* Test a zone geometry against an array of boundary features, collecting matching IDs */
function findIntersections(zoneGeom, boundaries) {
  const hits = new Set();
  boundaries.forEach(entry => {
    try {
      if (turf.booleanIntersects(zoneGeom, entry.feature)) {
        hits.add(entry.id);
      }
    } catch (_) {}
  });
  return hits;
}

function main() {
  console.log('Loading NAMRIA admin boundaries...');

  /* Load NAMRIA provinces (level 1) */
  const namriaProvRaw = JSON.parse(fs.readFileSync(path.join(geoDir, 'CAR NAMRIA Provincial Boundary.geojson'), 'utf8'));
  const namriaProvinces = namriaProvRaw.features.map(f => {
    const id = (f.properties || {})._id;
    return { id, feature: f };
  });
  console.log(`  ${namriaProvinces.length} NAMRIA provinces loaded`);

  /* Load NAMRIA municipalities (level 2) */
  const namriaMuniRaw = JSON.parse(fs.readFileSync(path.join(geoDir, 'CAR NAMRIA Municipal Boundary.geojson'), 'utf8'));
  const namriaMunicipalities = namriaMuniRaw.features.map(f => {
    const id = (f.properties || {})._id;
    return { id, feature: f };
  });
  console.log(`  ${namriaMunicipalities.length} NAMRIA municipalities loaded`);

  console.log('Loading CADASTRE admin boundaries...');

  /* Load CAD municipalities — use Province + Muni_City to derive province slugs.
     CAD Provincial Boundary is identical to Municipal (per AGENTS.md), so we skip it
     and derive province lists from the Province property on each municipal feature.
     Disputed-area features (e.g. "Baay-Licuan vs Lacub vs Lagangilang",
     "Ifugao vs Mt Province") are filtered out — they are not real LGUs. */
  const cadMuniRaw = JSON.parse(fs.readFileSync(path.join(geoDir, 'CAR CAD Municipal Boundary.geojson'), 'utf8'));
  const cadMunicipalities = cadMuniRaw.features
    .filter(f => {
      const p = f.properties || {};
      const muniName = p.Muni_City || '';
      const provName = p.Province || '';
      /* Drop any feature whose name contains " vs " — these are contested
         boundary placeholders, not actual municipalities/provinces. */
      return !muniName.includes(' vs ') && !provName.includes(' vs ');
    })
    .map(f => {
      const p = f.properties || {};
      const provName = p.Province || '';
      const muniName = p.Muni_City || '';
      const muniId = slugify(provName) + ':' + slugify(muniName);
      return { id: muniId, provinceSlug: slugify(provName), feature: f };
    });
  console.log(`  ${cadMunicipalities.length} CAD municipalities loaded (disputed areas filtered)`);

  /* Derive unique CAD provinces from municipal features */
  const cadProvinceMap = {};
  cadMunicipalities.forEach(entry => {
    cadProvinceMap[entry.provinceSlug] = true;
  });
  const cadProvinces = Object.keys(cadProvinceMap).map(slug => {
    /* Find a representative feature for geometry (first one matching this province) */
    const entry = cadMunicipalities.find(e => e.provinceSlug === slug);
    return { id: slug, feature: entry ? entry.feature : null };
  });
  console.log(`  ${cadProvinces.length} CAD provinces derived`);

  /* Build output */
  const output = {};
  let totalZones = 0;
  let skippedBasins = [];

  Object.entries(basins).forEach(([code, info]) => {
    const swPath = path.join(geoDir, 'Watersheds', info.folder, `${code}_SW.geojson`);
    if (!fs.existsSync(swPath)) {
      skippedBasins.push(`${code} (${info.folder})`);
      console.log(`  SKIP ${code}: no SW file`);
      return;
    }

    let swData;
    try {
      swData = JSON.parse(fs.readFileSync(swPath, 'utf8'));
    } catch (e) {
      console.error(`  ERROR ${code}: failed to parse ${swPath}`);
      return;
    }

    const zones = swData.features || [];
    console.log(`  ${code}: ${zones.length} zones`);

    zones.forEach((zoneFeature) => {
      const gridcode = (zoneFeature.properties || {}).gridcode;
      if (gridcode == null) return;

      const key = `${code}:${gridcode}`;

      /* Make zone geometry valid before intersection tests */
      let zoneGeom;
      try {
        zoneGeom = turf.buffer(zoneFeature, 0);
      } catch (_) {
        zoneGeom = zoneFeature;
      }

      /* NAMRIA intersections */
      const namriaProvHits = findIntersections(zoneGeom, namriaProvinces.filter(p => p.feature));
      const namriaMuniHits = findIntersections(zoneGeom, namriaMunicipalities);

      /* CAD intersections */
      const cadMuniHits = findIntersections(zoneGeom, cadMunicipalities);
      /* Derive CAD province hits from the municipal hits */
      const cadProvHits = new Set();
      cadMuniHits.forEach(muniId => {
        const parts = muniId.split(':');
        if (parts[0]) cadProvHits.add(parts[0]);
      });

      output[key] = {
        namria_provinces: [...namriaProvHits].sort(),
        namria_municipalities: [...namriaMuniHits].sort(),
        cad_provinces: [...cadProvHits].sort(),
        cad_municipalities: [...cadMuniHits].sort(),
      };
      totalZones++;
    });
  });

  /* Write output */
  const outPath = path.join(geoDir, 'zone-intersections.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nDone: ${totalZones} zone intersections written to ${outPath}`);
  if (skippedBasins.length) {
    console.log(`Skipped basins (no SW file): ${skippedBasins.join(', ')}`);
  }
}

main();
