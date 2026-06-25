import json
import os
from shapely.geometry import shape

def main():
    print("Loading GeoJSON data...")
    
    # Load Provinces
    with open('main/geoJSON/CAR NAMRIA Provincial Boundary.geojson', 'r') as f:
        provinces_data = json.load(f)
        
    # Load Watersheds
    with open('main/geoJSON/CAR Watersheds.geojson', 'r') as f:
        watersheds_data = json.load(f)
        
    # Parse province geometries
    provinces = {}
    for feature in provinces_data['features']:
        prov_id = feature['properties'].get('_id')
        if not prov_id: continue
        geom = shape(feature['geometry'])
        provinces[prov_id] = {
            'name': feature['properties'].get('PROVINCE'),
            'geom': geom
        }
        
    # Parse watershed geometries
    watersheds = []
    for feature in watersheds_data['features']:
        name = feature['properties'].get('Name') or feature['properties'].get('Old_Name')
        if not name: continue
        geom = shape(feature['geometry'])
        watersheds.append({
            'name': name,
            'geom': geom
        })
        
    print(f"Loaded {len(provinces)} provinces and {len(watersheds)} watersheds.")
    
    # Calculate Intersections
    # A watershed belongs to a province if their geometries intersect
    intersections = {}
    for prov_id, prov in provinces.items():
        intersecting_ws = []
        for ws in watersheds:
            try:
                # To be safe, adding a tiny buffer to avoid invalid geometry errors
                if prov['geom'].buffer(0).intersects(ws['geom'].buffer(0)):
                    intersecting_ws.append(ws['name'])
            except Exception as e:
                print(f"Error intersecting {prov['name']} and {ws['name']}: {e}")
        
        intersections[prov_id] = intersecting_ws
        print(f"Province {prov['name']} intersects with {len(intersecting_ws)} watersheds.")
        
    # Save the mapping
    out_path = 'main/geoJSON/watershed-intersections.json'
    with open(out_path, 'w') as f:
        json.dump(intersections, f, indent=2)
        
    print(f"Successfully wrote intersections mapping to {out_path}")

if __name__ == '__main__':
    main()
