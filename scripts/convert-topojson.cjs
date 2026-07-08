const fs = require('fs');
const path = require('path');
const topojson = require('topojson-server');

const geoJsonDir = path.join(__dirname, '../public/geoJSON');

function convertDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      convertDir(fullPath);
    } else if (file.endsWith('.geojson')) {
      convertFile(fullPath);
    }
  }
}

function convertFile(filePath) {
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const geoJson = JSON.parse(rawData);
    
    // Skip empty or invalid feature collections
    if (!geoJson.features || geoJson.features.length === 0) return;

    // Convert GeoJSON to TopoJSON
    // Using a key 'collection' for the objects map.
    const topology = topojson.topology({ collection: geoJson });
    
    const outPath = filePath.replace(/\.geojson$/, '.topojson');
    fs.writeFileSync(outPath, JSON.stringify(topology));
    
    const origSize = fs.statSync(filePath).size;
    const newSize = fs.statSync(outPath).size;
    console.log(`Converted: ${path.basename(filePath)} | ${(origSize / 1024).toFixed(1)}KB -> ${(newSize / 1024).toFixed(1)}KB (-${((1 - newSize/origSize)*100).toFixed(1)}%)`);
    
    // Optionally remove original
    // fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`Error converting ${filePath}:`, err.message);
  }
}

console.log('Starting TopoJSON conversion...');
convertDir(geoJsonDir);
console.log('Done!');
