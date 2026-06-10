async function initLayers() {
  await APP._showLevel(0, null, null);
  await APP._showLevel(1, null, null);
  APP._updateBreadcrumb();
}
