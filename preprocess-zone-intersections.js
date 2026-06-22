/**
 * preprocess-zone-intersections.js
 *
 * Computes which NAMRIA administrative boundaries (provinces + municipalities)
 * each sub-watershed zone intersects with.
 *
 * Output: main/geoJSON/zone-intersections.json
 *
 * Schema:
 * {
 *   "<basinCode>:<zoneGridcode>": {
 *     "provinces": ["abra", "benguet", ...],
 *     "municipalities": ["benguet:itogon", "benguet:tublay", ...]
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

function main() {
  console.log('Loading NAMRIA admin boundaries...');

  /* Load provinces (level 1) */
  const provRaw = JSON.parse(fs.readFileSync(path.join(geoDir, 'CAR NAMRIA Provincial Boundary.geojson'), 'utf8'));
  const provinces = provRaw.features.map(f => {
    const id = (f.properties || {})._id;
    const name = (f.properties || {}).PROVINCE || (f.properties || {}).Province || '';
    return { id, name, feature: f };
  });
  console.log(`  ${provinces.length} provinces loaded`);

  /* Load municipalities (level 2) */
  const muniRaw = JSON.parse(fs.readFileSync(path.join(geoDir, 'CAR NAMRIA Municipal Boundary.geojson'), 'utf8'));
  const municipalities = muniRaw.features.map(f => {
    const id = (f.properties || {})._id;
    const name = (f.properties || {}).Municipali || '';
    return { id, name, feature: f };
  });
  console.log(`  ${municipalities.length} municipalities loaded`);

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
      const hitProvinces = new Set();
      const hitMunicipalities = new Set();

      /* Make zone geometry valid before intersection tests */
      let zoneGeom;
      try {
        zoneGeom = turf.buffer(zoneFeature, 0); /* auto-fix invalid geometry */
      } catch (_) {
        zoneGeom = zoneFeature;
      }

      /* Test against provinces */
      provinces.forEach(prov => {
        try {
          if (turf.booleanIntersects(zoneGeom, prov.feature)) {
            hitProvinces.add(prov.id);
          }
        } catch (_) {}
      });

      /* Test against municipalities */
      municipalities.forEach(muni => {
        try {
          if (turf.booleanIntersects(zoneGeom, muni.feature)) {
            hitMunicipalities.add(muni.id);
          }
        } catch (_) {}
      });

      output[key] = {
        provinces: [...hitProvinces].sort(),
        municipalities: [...hitMunicipalities].sort(),
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
