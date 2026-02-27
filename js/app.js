// =====================================================================
// MAIN APPLICATION — state, theme, upload, tabs, reset, alerts, stats
// =====================================================================

// ── Theme ─────────────────────────────────────────────────────────────
let isDark = localStorage.getItem('theme') === 'dark';

function applyTheme() {
  document.body.classList.toggle('dark', isDark);
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  // Rebuild charts so they use the new text/grid colours
  if (Object.keys(chartInstances).length) rebuildCharts();
}

// ── Stats cards ───────────────────────────────────────────────────────
function updateStats() {
  const withDates  = filteredData.filter(r => r.hasAnyDate);
  const withBoth   = filteredData.filter(r => r.hasStart && r.hasDue);
  const projects   = unique(filteredData.map(r => r.project));
  const statuses   = unique(filteredData.map(r => r.status));

  const cards = [
    { value: rawData.length,       label: 'Total en CSV'           },
    { value: filteredData.length,  label: 'Filtradas'              },
    { value: withDates.length,     label: 'Con al menos 1 fecha'   },
    { value: withBoth.length,      label: 'Con inicio y fin'       },
    { value: projects.length,      label: 'Proyectos'              },
    { value: statuses.length,      label: 'Estados únicos'         },
  ];

  document.getElementById('statsGrid').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="value">${c.value}</div>
      <div class="label">${c.label}</div>
    </div>
  `).join('');
}

// ── Alert banner ──────────────────────────────────────────────────────
function updateAlerts() {
  const container = document.getElementById('alertsContainer');
  const alerts    = [];

  const noDates  = filteredData.filter(r => !r.hasAnyDate);
  const badStart = filteredData.filter(r => r.startInvalid);
  const badDue   = filteredData.filter(r => r.dueInvalid);
  const allBad   = [...new Set([...badStart, ...badDue])];
  const withDate = filteredData.filter(r => r.hasAnyDate);

  if (!columnMap.startDate) {
    alerts.push({ type: 'warning', msg: 'No se detectó columna de fecha inicio ("Start date" o equivalente) en el CSV.' });
  }
  if (!columnMap.dueDate) {
    alerts.push({ type: 'warning', msg: 'No se detectó columna de fecha de vencimiento en el CSV.' });
  }
  if (noDates.length) {
    alerts.push({ type: 'warning', msg: `${noDates.length} tarea(s) no tienen ninguna fecha y serán omitidas del export (según configuración).` });
  }
  if (allBad.length) {
    const sample = allBad.slice(0, 4).map(r => r.key).join(', ');
    alerts.push({ type: 'danger', msg: `${allBad.length} tarea(s) tienen fechas en un formato no reconocido: ${sample}${allBad.length > 4 ? '…' : ''}` });
  }
  if (withDate.length === 0 && filteredData.length > 0) {
    alerts.push({ type: 'danger', msg: 'Ninguna tarea filtrada tiene fechas válidas. No se generará ningún evento de calendario.' });
  }

  container.innerHTML = alerts.map(a => `
    <div class="alert alert-${a.type}">
      <span>${a.type === 'danger' ? '❌' : '⚠️'}</span>
      <span>${a.msg}</span>
    </div>
  `).join('');
}

/**
 * Show a one-off alert at the top of the results section
 * (also used before results are shown, e.g. for CSV validation errors).
 */
function showAlert(msg, type = 'warning') {
  const container = document.getElementById('alertsContainer');
  container.innerHTML = `
    <div class="alert alert-${type}">
      <span>${type === 'danger' ? '❌' : '⚠️'}</span>
      <span>${msg}</span>
    </div>
  `;
  // Make sure the results section is visible so the alert is readable
  document.getElementById('resultsSection').classList.remove('hidden');
}

// ── Tab navigation ────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${name}`));
  if (name === 'charts') rebuildCharts();
  if (name === 'export') renderExportPreview();
}

// ── File upload ───────────────────────────────────────────────────────
function initUpload() {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput  = document.getElementById('fileInput');

  uploadZone.addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') fileInput.click();
  });
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
}

function handleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showAlert('El archivo debe ser un CSV (.csv). Por favor selecciona un archivo exportado desde Jira.', 'danger');
    return;
  }

  showSpinner(true);

  // Defer to allow the spinner to paint before the synchronous CSV parse
  setTimeout(() => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(res) {
        showSpinner(false);
        if (!res.data || res.data.length === 0) {
          showAlert('El CSV está vacío o no tiene filas de datos válidas.', 'danger');
          return;
        }
        processCSV(res.data, res.meta.fields || []);
      },
      error(err) {
        showSpinner(false);
        showAlert('Error al leer el archivo CSV: ' + err.message, 'danger');
      },
    });
  }, 60);
}

// ── Reset ─────────────────────────────────────────────────────────────
function initReset() {
  document.getElementById('resetBtn').addEventListener('click', () => {
    // Clear state
    rawData      = [];
    filteredData = [];
    columnMap    = {};
    currentPage  = 0;

    // Destroy charts
    Object.values(chartInstances).forEach(c => c.destroy());
    chartInstances = {};

    // Reset DOM
    document.getElementById('alertsContainer').innerHTML  = '';
    document.getElementById('statsGrid').innerHTML        = '';
    document.getElementById('tableBody').innerHTML        = '';
    document.getElementById('tablePagination').innerHTML  = '';
    document.getElementById('tableWarn').innerHTML        = '';
    document.getElementById('ganttChart').innerHTML       = '';
    document.getElementById('exportPreview').innerHTML    = '';

    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('uploadSection').style.display = '';
    document.getElementById('resetBtn').style.display      = 'none';
    document.getElementById('fileInput').value             = '';

    switchTab('filters');
  });
}

// ── Initialisation ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme immediately
  applyTheme();

  document.getElementById('themeBtn').addEventListener('click', () => {
    isDark = !isDark;
    applyTheme();
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  initUpload();
  initReset();
});
