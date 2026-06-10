function initDashboard() {
  document.getElementById('info-panel-close').addEventListener('click', function () {
    APP.closePanel();
  });
}

APP.openPanel = function (feature, level) {
  var panel = document.getElementById('info-panel');
  var content = document.getElementById('info-panel-content');
  if (!panel || !content) return;

  var name = APP._featureName(feature, level);
  var levelLabel = APP.config.levelNames[level];
  var props = feature.properties || {};

  var details = _resolveDetails(props, level, name);

  var html = '';

  html += '<div class="panel-hero">'
    + '<div class="panel-level-badge">' + APP._escHtml(levelLabel) + '</div>'
    + '<h2 class="panel-title">' + APP._escHtml(name) + '</h2>'
    + '<p class="panel-subtitle">' + APP._escHtml(APP._heroSubtitle(props, level)) + '</p>'
    + '</div>';

  if (level < 3) {
    var nextName = APP.config.levelNames[level + 1];
    html += '<div class="panel-drill-hint">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>'
      + 'Click a ' + nextName + ' on the map to drill in'
      + '</div>';
  }

  html += '<div class="panel-section"><div class="panel-section-title">Details</div>';

  var detailKeys = Object.keys(details);
  for (var d = 0; d < detailKeys.length; d++) {
    var k = detailKeys[d];
    var v = details[k];
    html += '<div class="panel-row">'
      + '<span class="panel-row-label">' + APP._escHtml(k) + '</span>'
      + '<span class="panel-row-value">' + APP._escHtml(v) + '</span>'
      + '</div>';
  }

  html += '</div>';

  var chartData = APP._resolveChartData(props);
  if (chartData.values.length > 0) {
    html += '<div class="panel-section">'
      + '<div class="panel-section-title">Measurements</div>'
      + '<div class="chart-wrap"><canvas id="panel-chart"></canvas></div>'
      + '</div>';
  }

  content.innerHTML = html;
  panel.classList.add('open');
  APP.state.panelOpen = true;

  if (chartData.values.length > 0) {
    var ctx = document.getElementById('panel-chart');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartData.labels,
          datasets: [{
            data: chartData.values,
            backgroundColor: ['#059669', '#0d9488', '#0891b2', '#7c3aed'],
            borderRadius: 5,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#6b7280' }, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { ticks: { font: { size: 10 }, color: '#6b7280' }, grid: { display: false } },
          },
        },
      });
    }
  }
};

APP.closePanel = function () {
  var panel = document.getElementById('info-panel');
  if (panel) panel.classList.remove('open');
  APP.state.panelOpen = false;
};

function _resolveDetails(props, level, name) {
  var d = {};
  if (level === 3) {
    d['Barangay'] = props.NAME_3 || name;
    if (props.NAME_2 || props.Municipali) d['Municipality'] = props.NAME_2 || props.Municipali;
    if (props.NAME_1 || props.PROVINCE) d['Province'] = props.NAME_1 || props.PROVINCE;
    if (props.TYPE_3) d['Type'] = props.TYPE_3;
  } else if (level === 2) {
    d['Municipality/City'] = props.Municipali || name;
    if (props.Province || props.PROVINCE) d['Province'] = props.Province || props.PROVINCE;
    if (props.PSGC) d['PSGC'] = props.PSGC;
  } else if (level === 1) {
    d['Province'] = props.PROVINCE || props.Province || name;
    if (props.PSGC_P) d['PSGC'] = props.PSGC_P;
  } else {
    d['Region'] = props.Region || 'Cordillera Administrative Region';
    if (props.PSGC) d['PSGC'] = props.PSGC;
  }
  var area = APP._resolveArea(props);
  if (area) d['Area'] = area;
  return d;
}
