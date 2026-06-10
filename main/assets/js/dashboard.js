/**
 * dashboard.js
 * The floating info panel is now fully managed by APP.openPanel() in app.js.
 * This file is kept for compatibility with any external callers.
 */

function initDashboard() {
  /* No-op: panel is rendered by APP.openPanel() */
}

function updateDashboard(feature) {
  /* Delegate to APP */
  if (feature && APP) {
    APP.openPanel(feature, APP.state.currentLevel);
  }
}

function clearDashboard() {
  APP.closePanel();
}
