const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');
const topojsonClient = require('topojson-client');
const topojsonServer = require('topojson-server');

const watershedsDir = path.join(__dirname, '../public/geoJSON/Watersheds');

function processBasins() {
  const folders = fs.readdirSync(watershedsDir);
  for (const folder of folders) {
    const dirPath = path.join(watershedsDir, folder);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    
    const files = fs.readdirSync(dirPath);
    const swFile = files.find(f => f.endsWith('_SW.topojson'));
    const streamFile = files.find(f => f.endsWith('_StreamOrder.topojson'));
    
    if (swFile && streamFile) {
      console.log(`Processing basin: ${folder}...`);
      
      const swData = JSON.parse(fs.readFileSync(path.join(dirPath, swFile), 'utf8'));
      const streamData = JSON.parse(fs.readFileSync(path.join(dirPath, streamFile), 'utf8'));
      
      const swKey = Object.keys(swData.objects)[0];
      const swGeo = topojsonClient.feature(swData, swData.objects[swKey]);
      
      const streamKey = Object.keys(streamData.objects)[0];
      const streamGeo = topojsonClient.feature(streamData, streamData.objects[streamKey]);
      
      let matched = 0;
      for (const streamFeature of streamGeo.features) {
        if (!streamFeature.geometry) continue;
        
        let pt;
        if (streamFeature.geometry.type === 'LineString') {
          const coords = streamFeature.geometry.coordinates;
          pt = turf.point(coords[Math.floor(coords.length / 2)]);
        } else if (streamFeature.geometry.type === 'MultiLineString') {
          const coords = streamFeature.geometry.coordinates[0];
          pt = turf.point(coords[Math.floor(coords.length / 2)]);
        }
        
        if (pt) {
          for (const subW of swGeo.features) {
            if (!subW.geometry) continue;
            try {
              if (turf.booleanPointInPolygon(pt, subW)) {
                streamFeature.properties.ZoneID = subW.properties.ID;
                matched++;
                break;
              }
            } catch (e) {
              // Ignore invalid topology
            }
          }
        }
      }
      
      const newTopology = topojsonServer.topology({ collection: streamGeo });
      const outPath = path.join(dirPath, streamFile);
      fs.writeFileSync(outPath, JSON.stringify(newTopology));
      console.log(`  Updated ${streamFile}: ${matched}/${streamGeo.features.length} stream lines assigned to a SubWatershed Zone.`);
    }
  }
}

processBasins();
