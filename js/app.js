// =====================================================================
// MAIN APPLICATION — state, theme, upload, mode selector, tabs, reset
// =====================================================================

// ── Theme ─────────────────────────────────────────────────────────────
let isDark = localStorage.getItem('theme') === 'dark';

function applyTheme() {
  document.body.classList.toggle('dark', isDark);
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  if (Object.keys(chartInstances).length) rebuildCharts();
}

// ── Mode selector ─────────────────────────────────────────────────────
/**
 * Switch between the three "entry" views:
 *   null  → show mode selector (home)
 *   'csv' → show CSV upload section
 *   'api' → show Jira API section
 */
function selectMode(mode) {
  const selector = document.getElementById('modeSelectorSection');
  const csvSec   = document.getElementById('uploadSection');
  const apiSec   = document.getElementById('jiraSection');

  selector.classList.toggle('hidden', mode !== null);
  csvSec.classList.toggle('hidden',   mode !== 'csv');
  apiSec.classList.toggle('hidden',   mode !== 'api');
}
window.selectMode = selectMode; // needed for inline onclick in HTML

// ── Token visibility toggle ───────────────────────────────────────────
function toggleTokenVisibility() {
  const input = document.getElementById('jiraToken');
  const btn   = document.getElementById('tokenToggleBtn');
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type  = isHidden ? 'text'     : 'password';
  btn.textContent = isHidden ? 'Ocultar' : 'Mostrar';
}
window.toggleTokenVisibility = toggleTokenVisibility;

// ── Stats cards ───────────────────────────────────────────────────────
function updateStats() {
  const withDates = filteredData.filter(r => r.hasAnyDate);
  const withBoth  = filteredData.filter(r => r.hasStart && r.hasDue);
  const projects  = unique(filteredData.map(r => r.project));
  const statuses  = unique(filteredData.map(r => r.status));

  const label0 = columnMap._source === 'api' ? 'Total desde Jira' : 'Total en CSV';

  const cards = [
    { value: rawData.length,      label: label0              },
    { value: filteredData.length, label: 'Filtradas'         },
    { value: withDates.length,    label: 'Con al menos 1 fecha' },
    { value: withBoth.length,     label: 'Con inicio y fin'  },
    { value: projects.length,     label: 'Proyectos'         },
    { value: statuses.length,     label: 'Estados únicos'    },
  ];

  document.getElementById('statsGrid').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="value">${c.value}</div>
      <div class="label">${c.label}</div>
    </div>
  `).join('');
}

// ── Alert banners ─────────────────────────────────────────────────────
function updateAlerts() {
  const container = document.getElementById('alertsContainer');
  const alerts    = [];
  const isApi     = columnMap._source === 'api';

  const noDates = filteredData.filter(r => !r.hasAnyDate);
  const allBad  = filteredData.filter(r => r.startInvalid || r.dueInvalid);
  const withDate = filteredData.filter(r => r.hasAnyDate);

  if (!isApi) {
    if (!columnMap.startDate) alerts.push({ type: 'warning', msg: 'No se detectó columna de fecha inicio ("Start date" o equivalente) en el CSV.' });
    if (!columnMap.dueDate)   alerts.push({ type: 'warning', msg: 'No se detectó columna de fecha de vencimiento en el CSV.' });
  }
  if (noDates.length) {
    alerts.push({ type: 'warning', msg: `${noDates.length} tarea(s) no tienen ninguna fecha y serán omitidas del export (según configuración).` });
  }
  if (allBad.length) {
    const sample = allBad.slice(0, 4).map(r => r.key).join(', ');
    alerts.push({ type: 'danger', msg: `${allBad.length} tarea(s) tienen fechas en formato no reconocido: ${sample}${allBad.length > 4 ? '…' : ''}` });
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

/** One-off alert (e.g. validation errors before results are shown). */
function showAlert(msg, type = 'warning') {
  const container = document.getElementById('alertsContainer');
  container.innerHTML = `
    <div class="alert alert-${type}">
      <span>${type === 'danger' ? '❌' : '⚠️'}</span>
      <span>${msg}</span>
    </div>
  `;
  document.getElementById('resultsSection').classList.remove('hidden');
}

// ── Tab navigation ────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${name}`));
  if (name === 'charts') rebuildCharts();
  if (name === 'export') renderExportPreview();
}

// ── File upload (CSV mode) ────────────────────────────────────────────
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
    rawData      = [];
    filteredData = [];
    columnMap    = {};
    currentPage  = 0;

    Object.values(chartInstances).forEach(c => c.destroy());
    chartInstances = {};

    ['alertsContainer','statsGrid','tableBody','tablePagination',
     'tableWarn','ganttChart','exportPreview'].forEach(id => {
      document.getElementById(id).innerHTML = '';
    });

    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('resetBtn').style.display = 'none';
    document.getElementById('fileInput').value        = '';

    // Clear Jira form status
    const status = document.getElementById('jiraConnectStatus');
    if (status) { status.classList.add('hidden'); status.textContent = ''; }
    const progress = document.getElementById('jiraProgress');
    if (progress) progress.classList.add('hidden');

    // Go back to mode selector
    selectMode(null);
    switchTab('filters');
  });
}

// ── Initialisation ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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
