# OpenCode Refactoring Instructions: Landing Page Transformation
**Project**: CAR Watershed Monitoring Platform (DENR-CAR & SLU Interns)
**Target Files**: `index.html`, `style.css`, `script.js`

---

## 1. Sticky Navigation Header
* **Goal**: Keep the header containing the DENR and SLU logos visible at the top of the viewport at all times during scrolling.
* **Implementation Details**:
  * Set the header position to `fixed` or `sticky`.
  * Pin it to the top (`top: 0`, `left: 0`) and span the full width (`width: 100%`).
  * Apply a high `z-index` (e.g., `z-index: 100`) so it stays above all section backgrounds and images.
  * **Visual Polish**: Add a clean semi-transparent background with a blur filter for a modern glassmorphism effect:
    ```
```text?code_stdout&code_event_index=2
File built successfully.

```css
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    ```
  * *Important*: Ensure the subsequent hero section has appropriate top padding or margin adjustments so the top of the hero text isn't obscured by the fixed header.

---

## 2. 13 River Basins Section: Expanding Responsive Grid (Option A)
* **Goal**: Replace the horizontal infinite carousel with a cleaner, user-friendly expanding grid layout.
* **Layout Structure**:
  * Set up a responsive CSS Grid or Flexbox container for the cards. On desktop, this should be a balanced grid (e.g., 2 columns or 4 columns depending on card size), collapsing to a single column on mobile.
  * **Default State**: Only render or display the **top 4 major river basins** (e.g., Agno River Basin, Chico River Basin, Abra River Basin, Abulog River Basin).
  * **Expansion Button**: Center a stylish action button directly underneath the first 4 cards. Label it **"View All 13 River Basins"**.
  * **Interactivity**: Add a lightweight JavaScript click event listener to this button. When clicked:
    * Smoothly reveal the remaining 9 river basins (unhide or expand the container height).
    * Dynamically transition or fade the new cards into view.
    * Optionally hide the button or change its text to "Show Less" once fully expanded.

---

## 3. Image Assets & Source Optimization
* **Goal**: Structure clean image references that can be easily mapped to local directories.
* **Implementation Details**:
  * Group assets logically using standard relative paths (e.g., `assets/img/hero-agno.jpg`, `assets/img/forest-bg.jpg`, etc.).
  * For all grid card images, ensure the CSS uses `object-fit: cover;` combined with explicit width and height constraints so varying photo orientations don't break the uniform grid layout.

---

## 4. Institutional Government Footer
* **Goal**: Add a formal government footer module at the very bottom of the document matching institutional standards.
* **HTML Structure**:
  ```html
  <footer class="denr-footer" style="background-color: #1a202c; color: #edf2f7; padding: 3rem 2rem; font-family: sans-serif;">
      <div class="footer-container" style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2rem;">
          
          <div class="footer-brand" style="flex: 1; min-width: 250px;">
              <h3 style="color: #ffffff; margin-bottom: 1rem; font-size: 1.2rem;">DENR-CAR Watershed Monitoring</h3>
              <p style="font-size: 0.9rem; line-height: 1.6; color: #a0aec0;">
                  Department of Environment and Natural Resources<br>
                  Cordillera Administrative Region
              </p>
              <p style="font-size: 0.9rem; margin-top: 0.5rem; color: #a0aec0;">
                  DENR Compound, Gibraltar Road,<br>
                  Baguio City, Benguet, 2600
              </p>
          </div>

          <div class="footer-contact" style="flex: 1; min-width: 250px;">
              <h4 style="color: #ffffff; margin-bottom: 1rem; font-size: 1.1rem;">Directory & Contact</h4>
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem; line-height: 1.8; color: #a0aec0;">
                  <li>📞 <strong>Trunkline:</strong> (074) 665-2905</li>
                  <li>📞 <strong>Telefax:</strong> (074) 442-4531</li>
                  <li>📧 <strong>Email:</strong> car@denr.gov.ph</li>
                  <li>🌐 <strong>Official Website:</strong> car.denr.gov.ph</li>
              </ul>
          </div>

      </div>

      <div class="footer-credits" style="max-width: 1200px; margin: 2rem auto 0 auto; padding-top: 1.5rem; border-top: 1px solid #2d3748; text-align: center; font-size: 0.85rem; color: #718096;">
          <p>&copy; 2026 Department of Environment and Natural Resources - CAR & Saint Louis University Computer Science. All Rights Reserved.</p>
      </div>
  </footer>