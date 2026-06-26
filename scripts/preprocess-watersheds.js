const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '..', 'main', 'geoJSON', 'Watersheds');
const outputFile = path.join(__dirname, '..', 'main', 'geoJSON', 'CAR Watersheds.geojson');

const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.geojson'));

const mergedFeatureCollection = {
  type: "FeatureCollection",
  name: "CAR_Watersheds",
  crs: { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
  features: []
};

files.forEach(file => {
  const filePath = path.join(inputDir, file);
  const rawData = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(rawData);
  
  if (data.features && data.features.length > 0) {
    // Add all features from this file into the merged collection
    data.features.forEach(feature => {
      mergedFeatureCollection.features.push(feature);
    });
  }
});

fs.writeFileSync(outputFile, JSON.stringify(mergedFeatureCollection));

console.log(`Successfully merged ${files.length} watershed files into ${outputFile}`);
console.log(`Total features: ${mergedFeatureCollection.features.length}`);
