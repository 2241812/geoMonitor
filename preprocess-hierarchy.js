const fs = require('fs');
const path = require('path');

function stripDiacritics(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slug(s) {
  return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const dir = path.join(__dirname, 'main/geoJSON');

const files = [
  { level: 0, file: 'CAR NAMRIA Boundary.geojson' },
  { level: 1, file: 'CAR NAMRIA Provincial Boundary.geojson' },
  { level: 2, file: 'CAR NAMRIA Municipal Boundary.geojson' },
  { level: 3, file: 'CAR NAMRIA Barangay Boundary.geojson' },
];

const hierarchy = { parents: {}, children: {}, names: {} };
const lookup = []; // [{ id, nameUC, level, feature }]
const geoFiles = []; // [{ filePath, data }] — written after linking

files.forEach(({ level, file }) => {
  const filePath = path.join(dir, file);
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  data.features.forEach((feature) => {
    const p = feature.properties;
    let id, name;

    if (level === 0) {
      id = 'CAR';
      name = 'Cordillera Administrative Region';
    } else if (level === 1) {
      name = p.PROVINCE || '';
      id = slug(name);
    } else if (level === 2) {
      name = p.Municipali || '';
      const prov = p.Province || p.PROVINCE || '';
      id = slug(prov) + ':' + slug(name);
    } else {
      name = p.NAME_3 || p.Municipali || '';
      const prov = p.NAME_1 || p.Province || '';
      const mun = p.NAME_2 || p.Municipali || '';
      id = slug(prov) + ':' + slug(mun) + ':' + slug(name);
    }

    p._id = id;
    p._parentId = null;
    hierarchy.names[id] = name.trim();
    lookup.push({ id, nameUC: name.toUpperCase(), level, feature });
  });

  geoFiles.push({ filePath, data });
});

/* Build parent-child links */
hierarchy.children['CAR'] = [];

lookup.forEach(item => {
  if (item.level === 1) {
    item.feature.properties._parentId = 'CAR';
    hierarchy.parents[item.id] = 'CAR';
    hierarchy.children['CAR'].push(item.id);
  }
});

lookup.filter(l => l.level === 2).forEach(item => {
  const parentName = (item.feature.properties.Province || item.feature.properties.PROVINCE || '').toUpperCase();
  const parent = lookup.find(l => l.level === 1 && (l.nameUC === parentName || l.nameUC.includes(parentName) || parentName.includes(l.nameUC)));
  if (parent) {
    item.feature.properties._parentId = parent.id;
    hierarchy.parents[item.id] = parent.id;
    if (!hierarchy.children[parent.id]) hierarchy.children[parent.id] = [];
    hierarchy.children[parent.id].push(item.id);
  }
});

/* Normalize municipality names for cross-dataset matching */
const NAME_NORMALIZE = {
  'LANGIDEN': 'LAGIDEN',
  'LICUAN-BAAY': 'BAAY-LICUAN',
};

lookup.filter(l => l.level === 3).forEach(item => {
  const p = item.feature.properties;
  const munName = stripDiacritics((p.NAME_2 || p.Municipali || '').toUpperCase());
  const provName = stripDiacritics((p.NAME_1 || p.Province || p.PROVINCE || '').toUpperCase());
  const normMun = NAME_NORMALIZE[munName] || munName;
  const parent = lookup.find(l => l.level === 2 && (() => {
    const childMun = stripDiacritics((l.feature.properties.Municipali || '').toUpperCase());
    const childProv = stripDiacritics((l.feature.properties.Province || l.feature.properties.PROVINCE || '').toUpperCase());
    const normChild = NAME_NORMALIZE[childMun] || childMun;
    return childProv === provName && (normChild.includes(normMun) || normMun.includes(normChild));
  })());
  if (parent) {
    item.feature.properties._parentId = parent.id;
    hierarchy.parents[item.id] = parent.id;
    if (!hierarchy.children[parent.id]) hierarchy.children[parent.id] = [];
    hierarchy.children[parent.id].push(item.id);
  }
});

/* Write updated GeoJSON (with _id / _parentId populated) */
geoFiles.forEach(({ filePath, data }) => {
  fs.writeFileSync(filePath, JSON.stringify(data));
});

fs.writeFileSync(path.join(dir, 'hierarchy.json'), JSON.stringify(hierarchy));

const featureCount = Object.keys(hierarchy.names).length;
const parentCount = Object.keys(hierarchy.parents).length;
const childCount = Object.keys(hierarchy.children).length;
console.log(`Done: ${featureCount} features indexed, ${parentCount} parent links, ${childCount} child groups`);

/* Verify hierarchy integrity */
let orphans = 0;
lookup.forEach(item => {
  if (item.level > 0 && hierarchy.parents[item.id] === undefined) orphans++;
});
if (orphans > 0) console.log(`Warning: ${orphans} features have no parent`);
else console.log('All features properly linked');
