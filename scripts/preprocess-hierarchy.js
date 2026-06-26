const fs = require('fs');
const path = require('path');

function stripDiacritics(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slug(s) {
  return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const dir = path.join(__dirname, '..', 'main', 'geoJSON');

const sources = [
  {
    name: 'namria',
    files: [
      { level: 0, file: 'CAR NAMRIA Boundary.geojson' },
      { level: 1, file: 'CAR NAMRIA Provincial Boundary.geojson' },
      { level: 2, file: 'CAR NAMRIA Municipal Boundary.geojson' },
    ],
    nameProps: {
      0: () => 'Cordillera Administrative Region',
      1: (p) => `${p.PROVINCE || ''}`,
      2: (p) => `${p.Municipali || ''}`,
    },
    parentMatch: {
      1: { id: () => 'CAR' },
      2: { id: (p) => slug(p.Province || p.PROVINCE || '') },
    },
    normalizeNames: {},
  },
  {
    name: 'cad',
    files: [
      { level: 0, file: 'CAR CAD Boundary.geojson' },
      { level: 1, file: 'CAR CAD Provincial Boundary (Dissolved).geojson' },
      { level: 2, file: 'CAR CAD Municipal Boundary.geojson' },
    ],
    nameProps: {
      0: () => 'Cordillera Administrative Region',
      1: (p) => `${p.Province || ''}`,
      2: (p) => `${p.Muni_City || ''}`,
    },
    parentMatch: {
      1: { id: () => 'CAR' },
      2: { id: (p) => slug(p.Province || '') },
    },
    normalizeNames: {},
  },
];

sources.forEach((source) => {
  const hierarchy = { parents: {}, children: {}, names: {} };
  const lookup = [];
  const geoDatas = [];

  // Read + index features
  source.files.forEach(({ level, file }) => {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    data.features.forEach((feature) => {
      const p = feature.properties;
      const name = (source.nameProps[level](p) || '').trim();
      let id;

      if (level === 0) {
        id = 'CAR';
      } else if (level === 1) {
        id = slug(name);
      } else {
        const provId = source.parentMatch[level]
          ? stripDiacritics(source.parentMatch[level].id(p) || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          : '';
        id = provId ? provId + ':' + slug(name) : slug(name);
      }

      p._id = id;
      p._parentId = null;
      hierarchy.names[id] = name;
      lookup.push({ id, nameUC: name.toUpperCase(), level, feature });
    });

    geoDatas.push({ filePath, data });
  });

  // Build parent-child links
  hierarchy.children['CAR'] = [];

  source.files.forEach(({ level }) => {
    if (level === 0) return;
    const match = source.parentMatch[level];
    if (!match) return;

    lookup.filter((l) => l.level === level).forEach((item) => {
      let parentId = match.id(item.feature.properties);
      if (!parentId || parentId === 'CAR') {
        parentId = 'CAR';
      }

      item.feature.properties._parentId = parentId;
      hierarchy.parents[item.id] = parentId;
      if (!hierarchy.children[parentId]) hierarchy.children[parentId] = [];
      hierarchy.children[parentId].push(item.id);
    });
  });

  // Write updated GeoJSON + hierarchy
  geoDatas.forEach(({ filePath, data }) => {
    fs.writeFileSync(filePath, JSON.stringify(data));
  });

  const outFile = path.join(dir, 'hierarchy-' + source.name + '.json');
  fs.writeFileSync(outFile, JSON.stringify(hierarchy));

  const featureCount = Object.keys(hierarchy.names).length;
  const parentCount = Object.keys(hierarchy.parents).length;
  console.log(`${source.name}: ${featureCount} features, ${parentCount} parent links`);

  // Verify
  let orphans = 0;
  lookup.forEach((item) => {
    if (item.level > 0 && hierarchy.parents[item.id] === undefined) orphans++;
  });
  if (orphans > 0) console.log(`  WARNING: ${orphans} orphans`);
  else console.log(`  All features properly linked`);
});
