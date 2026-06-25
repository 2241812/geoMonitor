/**
 * dashboard.js
 * The floating info panel is fully managed by APP.openPanel() in app.js.
 * This file is kept for compatibility with any external callers.
 */

function initDashboard() {
  /* No-op: panel is rendered by APP.openPanel() */
}

function updateDashboard(feature) {
  /* Delegate to APP */
  if (feature && APP) {
    if (APP.state.viewMode === 'boundaries') { APP._openAdminPanel(feature, APP.state.currentLevel); } else { APP._openWatershedPanel(feature); }
  }
}

function clearDashboard() {
  APP.closePanel();
}
