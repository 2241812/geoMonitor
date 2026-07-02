# Landing Page Refactoring Guide: CAR Watershed Monitoring
**Instructions for OpenCode AI to update `index.html` and `style.css`**

## 🎯 Design Philosophy & References
* **Vibe:** Immersive, professional government portal, nature-focused, storytelling scroll.
* **References:** HydroHub (full-screen hero, top-corner logos), PCAARRD (clean informational sections), The Watershed Project (bold typography over nature photography).
* **Framework:** Use standard HTML5 and CSS (or Tailwind CSS if already initialized in the project). 

## 🏗️ Structural Blueprint (Top to Bottom)

### 1. Hero Section (The Hook)
* **Design:** 100vh (full-screen) background image. Use one of the local assets (e.g., `assets/img/agno-basin.jpg` or `forest.jpg`). Add a dark overlay (`rgba(0,0,0,0.5)`) for text readability.
* **Header/Nav:** * Top Left: DENR Logo & Text ("Republic of the Philippines | Department of Environment and Natural Resources").
  * Top Right: SLU Logo & Text ("In collaboration with Saint Louis University").
* **Center Content:**
  * **H1:** "CAR Watershed Monitoring" (Large, clean font, white text).
  * **Subtitle:** "Tracking administrative boundaries, geological data, and environmental metrics across the Cordilleras."
* **Action:** NO "See Map" button here. Instead, add a subtle "Scroll Down" indicator (like a bouncing arrow) at the bottom center.

### 2. Information Section: "What is a Watershed?" & "DENR's Mandate"
* **Design:** Clean white (`#ffffff`) or very light gray (`#f8f9fa`) background. Ample padding (`padding: 5rem 2rem`).
* **Layout:** Two-column grid (Text on the left, an image on the right).
* **Content:**
  * **Heading:** "Protecting Our Lifelines"
  * **Text:** Briefly explain what a watershed is and why monitoring the Cordillera Administrative Region (CAR) is critical (e.g., "The Cordillera serves as the watershed cradle of Northern Philippines, supplying vital water resources to the lowlands. DENR's mandate is to monitor, protect, and sustain these ecological boundaries.")

### 3. The 14 Watersheds Overview
* **Design:** Soft earthy background color (e.g., a very pale sage green `#eef2f0`).
* **Layout:** A clean, responsive CSS Grid.
* **Content:** * **Heading:** "14 Major Watersheds of CAR"
  * **Elements:** Create simple, elegant cards or pill-shaped lists (inspired by PCAARRD) for the watersheds. *Note for OpenCode: Just generate 3-4 placeholder cards for now (e.g., Agno River Basin, Chico River Basin, Abra River Basin), the user will fill in the rest.*

### 4. Call to Action (The Gateway to the Map)
* **Design:** Strong visual impact. Use a different background image (e.g., `assets/img/rivers.jpg`) with a dark overlay.
* **Content:**
  * **Heading:** "Interactive Geographic Dashboard"
  * **Text:** "Dive into the data. Explore sub-watersheds, major river networks, contour lines, and geological profiles."
* **Action:** **THIS IS WHERE THE BUTTON GOES.** * Create a large, prominent button: `<a href="map.html" class="btn-primary">Explore the Map</a>`. 
  * Add hover effects (e.g., slight scale up, color change) to make it inviting.

## 🛠️ Technical Implementation Notes for OpenCode
* Ensure `box-sizing: border-box`, remove default body margins.
* Use CSS Flexbox/Grid for layout to ensure the page is fully responsive on mobile.
* Keep the CSS clean and modular. If writing raw CSS, group styles by section (e.g., `/* Hero Section */`, `/* Info Section */`).
