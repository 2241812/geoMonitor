let dashboardChart = null;

function initDashboard() {
  APP.events.addEventListener(EVENTS.FEATURE_SELECT, function (e) {
    updateDashboard(e.detail.feature);
  });
  APP.events.addEventListener(EVENTS.FEATURE_CLEAR, function () {
    clearDashboard();
  });
  showEmptyState();
}

function updateDashboard(feature) {
  var props = feature.properties;
  var panel = document.getElementById('dashboard-panel');

  var name = resolveName(props);
  var details = resolveDetails(props);

  var html = '';
  html += '<div class="p-4">';
  html += '  <h2 class="text-xl font-bold text-gray-800 mb-1" id="feature-name">' + escapeHtml(name) + '</h2>';
  html += '  <div class="space-y-1 mb-4">';

  for (var key in details) {
    if (details.hasOwnProperty(key)) {
      html += '    <div class="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">';
      html += '      <span class="text-gray-500">' + escapeHtml(key) + '</span>';
      html += '      <span class="font-medium text-gray-800 text-right">' + escapeHtml(details[key]) + '</span>';
      html += '    </div>';
    }
  }

  html += '  </div>';
  html += '  <div class="chart-container" style="position:relative; height:200px; width:100%;">';
  html += '    <canvas id="dashboard-chart"></canvas>';
  html += '  </div>';
  html += '</div>';

  panel.innerHTML = html;
  renderChart(feature);
}

function resolveName(props) {
  if (props.NAME_3) return props.NAME_3;
  if (props.Municipali) return props.Municipali;
  if (props.PROVINCE) return props.PROVINCE;
  if (props.Region) return props.Region;
  if (props.NAME_2) return props.NAME_2;
  if (props.NAME_1) return props.NAME_1;
  return 'Unknown';
}

function resolveDetails(props) {
  var details = {};
  if (props.NAME_3) {
    details['Barangay'] = props.NAME_3;
    details['Municipality'] = props.NAME_2 || '—';
    details['Province'] = props.NAME_1 || '—';
    if (props.TYPE_3) details['Type'] = props.TYPE_3;
  } else if (props.Municipali) {
    details['Municipality/City'] = props.Municipali;
    details['Province'] = props.Province || '—';
    if (props.PSGC) details['PSGC'] = props.PSGC;
  } else if (props.PROVINCE) {
    details['Province'] = props.PROVINCE;
    if (props.PSGC_P) details['PSGC'] = props.PSGC_P;
  } else if (props.Region) {
    details['Region'] = props.Region;
    if (props.PSGC) details['PSGC'] = props.PSGC;
  }

  var area = resolveArea(props);
  if (area !== null) {
    details['Area'] = area;
  }

  return details;
}

function resolveArea(props) {
  var candidates = ['Hectares', 'Area', 'AREA', 'Shape_Area', 'Shape_Length', 'PERIMETER'];
  for (var i = 0; i < candidates.length; i++) {
    var val = props[candidates[i]];
    if (val !== undefined && val !== null && val !== '') {
      var num = parseFloat(val);
      if (!isNaN(num)) {
        return num.toFixed(2);
      }
    }
  }
  return null;
}

function renderChart(feature) {
  var ctx = document.getElementById('dashboard-chart');
  if (!ctx) return;

  if (dashboardChart) {
    dashboardChart.destroy();
    dashboardChart = null;
  }

  var props = feature.properties;
  var labels = [];
  var values = [];
  var colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];

  var numericProps = ['Shape_Area', 'Shape_Length', 'AREA', 'Area', 'PERIMETER', 'Hectares'];
  for (var i = 0; i < numericProps.length; i++) {
    var p = numericProps[i];
    if (props[p] !== undefined && props[p] !== null && props[p] !== '') {
      var num = parseFloat(props[p]);
      if (!isNaN(num) && num > 0) {
        labels.push(p.replace(/_/g, ' '));
        values.push(num);
      }
    }
  }

  if (values.length === 0) {
    labels.push('No numeric data');
    values.push(0);
  }

  dashboardChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Value',
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.parsed.y.toFixed(2);
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        x: {
          ticks: { font: { size: 10 } },
          grid: { display: false },
        },
      },
    },
  });
}

function showEmptyState() {
  var panel = document.getElementById('dashboard-panel');
  panel.innerHTML = ''
    + '<div class="flex flex-col items-center justify-center h-full text-center p-8">'
    + '  <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">'
    + '    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />'
    + '  </svg>'
    + '  <p class="text-gray-500 text-sm">Click any polygon on the map<br>to explore its data</p>'
    + '</div>';
  if (dashboardChart) {
    dashboardChart.destroy();
    dashboardChart = null;
  }
}

function clearDashboard() {
  showEmptyState();
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
