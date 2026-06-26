# DENR CAR Watershed Monitoring Project
**Internship Roadmap & Learning Guide**

## 📌 Project Overview
* **Goal**: Build a static, responsive web app with an interactive map and dashboard for monitoring the 14 watersheds in the Cordillera Administrative Region (CAR).
* **Target Environment**: Static hosting (no backend server required).
* **Tech Stack**: 
  * Frontend: HTML, CSS (Tailwind/Bootstrap recommended), Vanilla JavaScript.
  * Mapping: **Leaflet.js** (for rendering maps and layers).
  * Data Format: **GeoJSON** (converted from ArcGIS Shapefiles).
  * Visualization: **Chart.js** or **Recharts** (for the dashboard).

---

## 🗺️ Project Architecture & Phases

### Phase 1: Data Preparation
* **Task**: Convert the provided ArcGIS Shapefiles (.shp, .shx, .dbf) into GeoJSON format.
* **Tools**: [Mapshaper.org](https://mapshaper.org/) (Web) or QGIS (Desktop).
* **Key Step**: Simplify the geometry to reduce file size (aim for under 5MB if possible) so the static site loads quickly without lagging. Ensure all attribute data (population, geology, exit points) is retained.

### Phase 2: UI/UX & Landing Page
* **Task**: Create the structural framework of the web app.
* **Requirements**: 
  * Landing page introducing the 14 CAR watersheds (similar to HydroHub).
  * A clear "See Map" button that routes to the separate mapping dashboard.
  * Fully responsive design for desktop and mobile viewing.

### Phase 3: Core Map Implementation (Leaflet)
* **Task**: Render the base map and the geographic data.
* **Requirements**:
  * Implement base maps (e.g., OpenStreetMap, Esri World Topo/Imagery).
  * Load the generated GeoJSON files using `L.geoJSON()`.
  * Add multiple layers: Watershed boundaries, sub-watersheds, major rivers, caves, contour lines, and specific geology.
  * Make boundaries **clickable**: Use Leaflet's `onEachFeature` to trigger highlighting and display data popups on click.

### Phase 4: Dashboard Integration
* **Task**: Connect the map interactions to visual data charts.
* **Requirements**:
  * Build a dashboard UI beside or over the map.
  * Write JavaScript event listeners so that clicking a specific watershed updates the dashboard charts (e.g., population graphs, geological breakdown) dynamically based on that specific feature's properties.

---

## 📺 YouTube Learning Plan (Search Queries)

Use these exact search terms to find the most relevant tutorials for your tech stack:

### 1. Leaflet Fundamentals
* *"Leaflet.js crash course"*
* *"Build a web map with Leaflet tutorial"*
* *"Leaflet JS beginners guide HTML CSS"*

### 2. Handling GeoJSON Data
* *"Leaflet GeoJSON tutorial"*
* *"Add GeoJSON to Leaflet map"*
* *"Leaflet styling GeoJSON polygons"*

### 3. Interactivity & Popups
* *"Leaflet interactive choropleth map"* (Crucial for learning how to highlight boundaries on hover/click).
* *"Leaflet onEachFeature tutorial"*
* *"Leaflet bindPopup GeoJSON properties"*

### 4. Dashboard Connection
* *"Leaflet map dashboard tutorial"*
* *"Connect Chart.js to Leaflet map"*
* *"Interactive map dashboard JavaScript"*

---

## 💡 Developer Tips
* **Start Small**: Don't try to load all 14 watersheds with rivers and contours on day one. Draw a single dummy polygon in Leaflet, make it clickable, and trigger an alert or a simple popup. Once the logic works, plug in the real DENR data.
* **Console.log is your friend**: When working with GeoJSON, always `console.log(feature.properties)` inside your Leaflet functions to see exactly what data is available to display.
