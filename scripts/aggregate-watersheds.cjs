const fs = require('fs');
const path = require('path');

const zoneFile = path.join(__dirname, '../public/geoJSON/zone-intersections.json');
const watershedFile = path.join(__dirname, '../public/geoJSON/watershed-intersections.json');

const zoneData = JSON.parse(fs.readFileSync(zoneFile, 'utf8'));

// Basin code to Name mapping — must match GeoJSON feature.Name and hydroBasinFolderMap keys
const basinMapping = {
  "ABR": "Abra River Watershed",
  "ABU": "Abulug River Watershed",
  "AGN": "Agno River Watershed",
  "AMB": "Bayogao River Watershed",
  "ARI": "Aringay River Watershed",
  "BUD": "Bued River Watershed",
  "MLG": "Mallig River Watershed",
  "NAG": "Naguilian River Watershed",
  "SIF": "Siffu River Watershed",
  "SMR": "Santa Maria River Watershed",
  "UCH": "Upper Chico River Watershed",
  "UMT": "Upper Magat River Watershed",
  "ZUM": "Zumigui-Ziwanan River Watershed"
};

const result = { namria: {}, cad: {} };

Object.keys(basinMapping).forEach(code => {
  const name = basinMapping[code];
  result.namria[name] = { provinces: new Set(), municipalities: new Set() };
  result.cad[name] = { provinces: new Set(), municipalities: new Set() };
});

for (const [zoneId, entry] of Object.entries(zoneData)) {
  const basinCode = zoneId.split(':')[0];
  const basinName = basinMapping[basinCode];
  if (!basinName) continue;

  if (entry.namria_provinces) entry.namria_provinces.forEach(p => result.namria[basinName].provinces.add(p));
  if (entry.namria_municipalities) entry.namria_municipalities.forEach(m => result.namria[basinName].municipalities.add(m));
  
  if (entry.cad_provinces) entry.cad_provinces.forEach(p => result.cad[basinName].provinces.add(p));
  if (entry.cad_municipalities) entry.cad_municipalities.forEach(m => result.cad[basinName].municipalities.add(m));
}

// Convert Sets to Arrays
Object.keys(result.namria).forEach(name => {
  result.namria[name].provinces = Array.from(result.namria[name].provinces).sort();
  result.namria[name].municipalities = Array.from(result.namria[name].municipalities).sort();
});

Object.keys(result.cad).forEach(name => {
  result.cad[name].provinces = Array.from(result.cad[name].provinces).sort();
  result.cad[name].municipalities = Array.from(result.cad[name].municipalities).sort();
});

fs.writeFileSync(watershedFile, JSON.stringify(result, null, 2));
console.log('Successfully updated watershed-intersections.json');
