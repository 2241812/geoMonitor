// Quantize all .topojson coordinate precision from ~14 decimal places to 6
// 6 decimal places = ~0.11 m resolution — sufficient for mapping
const fs = require('fs');
const path = require('path');
const GEO_DIR = path.join(__dirname, '../public/geoJSON');

function quantizeCoords(obj, decimals) {
  const factor = Math.pow(10, decimals);
  if (Array.isArray(obj)) {
    return obj.map((item) => quantizeCoords(item, decimals));
  }
  if (obj && typeof obj === 'object') {
    const quantized = {};
    for (const [k, v] of Object.entries(obj)) {
      quantized[k] = quantizeCoords(v, decimals);
    }
    return quantized;
  }
  if (typeof obj === 'number' && !Number.isInteger(obj)) {
    return Math.round(obj * factor) / factor;
  }
  return obj;
}

function processFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const oldSize = Buffer.byteLength(raw, 'utf8');

  // Quantize arcs (the coordinate arrays)
  data.arcs = quantizeCoords(data.arcs, 6);
  // Quantize bbox if present
  if (data.bbox) data.bbox = quantizeCoords(data.bbox, 6);
  // Preserve transform scale precision (it's a scaling factor, keep high precision)
  if (data.transform) {
    if (data.transform.scale)
      data.transform.scale = quantizeCoords(data.transform.scale, 12);
    if (data.transform.translate)
      data.transform.translate = quantizeCoords(data.transform.translate, 6);
  }

  const out = JSON.stringify(data);
  const newSize = Buffer.byteLength(out, 'utf8');
  const saved = ((1 - newSize / oldSize) * 100).toFixed(1);
  console.log(
    `  ${path.basename(filePath)}: ${(oldSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (${saved}% saved)`
  );
  fs.writeFileSync(filePath, out, 'utf8');
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.topojson')) {
      processFile(fullPath);
    }
  }
}

console.log('Quantizing TopoJSON coordinates to 6 decimal places...');
walkDir(GEO_DIR);
console.log('Done.');
