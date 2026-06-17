const fs = require('fs');
const turf = require('@turf/turf');

function main() {
    console.log("Loading GeoJSON data...");
    
    // Load Provinces
    const provRaw = fs.readFileSync('main/geoJSON/CAR NAMRIA Provincial Boundary.geojson', 'utf8');
    const provincesData = JSON.parse(provRaw);
    
    // Load Municipalities
    const muniRaw = fs.readFileSync('main/geoJSON/CAR NAMRIA Municipal Boundary.geojson', 'utf8');
    const muniData = JSON.parse(muniRaw);
    
    // Load Watersheds
    const wsRaw = fs.readFileSync('main/geoJSON/CAR Watersheds.geojson', 'utf8');
    const watershedsData = JSON.parse(wsRaw);
    
    const boundaries = {};
    
    // Add Provinces
    provincesData.features.forEach(f => {
        const id = f.properties._id;
        if (!id) return;
        boundaries[id] = {
            name: f.properties.PROVINCE,
            geom: f
        };
    });
    
    // Add Municipalities
    muniData.features.forEach(f => {
        const id = f.properties._id;
        if (!id) return;
        boundaries[id] = {
            name: f.properties.Municipali,
            geom: f
        };
    });
    
    const watersheds = [];
    watershedsData.features.forEach(f => {
        const name = f.properties.Name || f.properties.Old_Name;
        if (!name) return;
        watersheds.push({
            name: name,
            geom: f
        });
    });
    
    console.log(`Loaded ${Object.keys(boundaries).length} boundaries and ${watersheds.length} watersheds.`);
    
    const intersections = {};
    for (const [id, boundary] of Object.entries(boundaries)) {
        const intersectingWs = [];
        for (const ws of watersheds) {
            try {
                if (turf.booleanIntersects(boundary.geom, ws.geom)) {
                    intersectingWs.push(ws.name);
                }
            } catch (e) {
                console.error(`Error intersecting ${boundary.name} and ${ws.name}: ${e.message}`);
            }
        }
        intersections[id] = intersectingWs;
        console.log(`Boundary ${id} intersects with ${intersectingWs.length} watersheds.`);
    }
    
    const outPath = 'main/geoJSON/watershed-intersections.json';
    fs.writeFileSync(outPath, JSON.stringify(intersections, null, 2));
    console.log(`Successfully wrote intersections mapping to ${outPath}`);
}

main();
