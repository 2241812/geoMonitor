function initDashboard() {
}

function updateDashboard(feature) {
  if (feature && APP) {
    APP.openPanel(feature, APP.state.currentLevel);
  }
}

function clearDashboard() {
  APP.closePanel();
}
