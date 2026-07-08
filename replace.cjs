const fs = require('fs');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\.geojson'/g, ".topojson'");
  content = content.replace(/\.geojson"/g, '.topojson"');
  content = content.replace(/\.then\(r => r\.json\(\)\)/g, '.then(r => r.json()).then(window.decodeGeo)');
  content = content.replace(/await resp\.json\(\)/g, 'window.decodeGeo(await resp.json())');
  fs.writeFileSync(filePath, content);
}

processFile('geo-monitor-v2/src/lib/app.js');
processFile('geo-monitor-v2/src/lib/hydro-mode.js');
console.log('Done!');
