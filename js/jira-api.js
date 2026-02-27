// =====================================================================
// JIRA API MODE
// Requires the local Node.js proxy server (server.js) to be running.
// =====================================================================

// ── ADF (Atlassian Document Format) → plain text ──────────────────────
/**
 * Recursively extract plain text from an Atlassian Document Format node.
 * Jira API v3 returns descriptions as ADF JSON objects.
 */
function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text')      return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'rule')      return '\n---\n';
  if (node.type === 'mention')   return `@${node.attrs?.text || ''}`;
  if (node.type === 'inlineCard' || node.type === 'blockCard') {
    return node.attrs?.url || '';
  }
  if (node.content) {
    const sep = node.type === 'paragraph' || node.type === 'heading' ? '\n' : '';
    return node.content.map(adfToText).join('') + sep;
  }
  return '';
}

// ── Field detection ───────────────────────────────────────────────────
const START_DATE_ALIASES = [
  'start date', 'fecha de inicio', 'fecha inicio', 'planned start',
  'begin date', 'start_date', 'fecha inicio replanificada',
];

/**
 * From the list of all Jira fields, find the ID of the "Start date" custom field.
 * Returns the field ID (e.g. "customfield_10015") or null if not found.
 */
function findStartDateFieldId(fields) {
  for (const f of fields) {
    const name = (f.name || '').toLowerCase();
    if (START_DATE_ALIASES.some(a => name === a || name.includes(a))) {
      return f.id;
    }
  }
  return null;
}

// ── Issue mapping ─────────────────────────────────────────────────────
/**
 * Convert raw Jira API issue objects into the same normalized format
 * used by the CSV parser, so all downstream logic (filters, table,
 * charts, export) works identically for both data sources.
 *
 * @param {Object[]} issues        - Raw issues from Jira API.
 * @param {string|null} startFieldId - Custom field ID for "Start date".
 * @returns {Object[]}
 */
function mapIssuesToRawData(issues, startFieldId) {
  return issues.map((issue, i) => {
    const f = issue.fields || {};

    const startRaw = startFieldId ? (f[startFieldId] || '') : '';
    const dueRaw   = f.duedate || '';
    const startDate = parseDate(startRaw);
    const dueDate   = parseDate(dueRaw);

    let description = '';
    if (f.description) {
      description = typeof f.description === 'string'
        ? f.description
        : adfToText(f.description).trim();
    }

    return {
      _idx:        i,
      key:         issue.key            || '',
      summary:     f.summary            || '',
      status:      f.status?.name       || 'Sin estado',
      priority:    f.priority?.name     || 'Sin prioridad',
      assignee:    f.assignee?.displayName || 'Sin asignar',
      description,
      project:     f.project?.name      || 'Sin proyecto',
      startRaw,
      dueRaw,
      startDate,
      dueDate,
      hasStart:     !!startDate,
      hasDue:       !!dueDate,
      hasAnyDate:   !!(startDate || dueDate),
      startInvalid: !!(startRaw && !startDate),
      dueInvalid:   !!(dueRaw   && !dueDate),
    };
  });
}

// ── API calls (through the local proxy) ───────────────────────────────
function getJiraConfig() {
  return {
    baseUrl:  document.getElementById('jiraBaseUrl').value.trim().replace(/\/$/, ''),
    email:    document.getElementById('jiraEmail').value.trim(),
    apiToken: document.getElementById('jiraToken').value.trim(),
  };
}

async function apiPost(endpoint, body) {
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.errorMessages?.join(', ') || data.message || data.error || `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── Progress UI ───────────────────────────────────────────────────────
function setJiraProgress(current, total, msg) {
  const pct     = total > 0 ? Math.round(current / total * 100) : 0;
  const barEl   = document.getElementById('jiraProgressBar');
  const textEl  = document.getElementById('jiraProgressText');
  const countEl = document.getElementById('jiraProgressCount');

  if (barEl)   barEl.style.width = `${pct}%`;
  if (textEl)  textEl.textContent = msg || 'Cargando...';
  if (countEl) countEl.textContent = total > 0 ? `${current} / ${total}` : '';
}

function showJiraProgress(visible) {
  document.getElementById('jiraProgress')?.classList.toggle('hidden', !visible);
}

function setConnectStatus(msg, type = 'info') {
  const el = document.getElementById('jiraConnectStatus');
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── Main connect flow ─────────────────────────────────────────────────
async function connectToJira() {
  const config  = getJiraConfig();
  const jql     = document.getElementById('jiraJql').value.trim();
  const btn     = document.getElementById('jiraConnectBtn');

  // Basic validation
  if (!config.baseUrl || !config.email || !config.apiToken) {
    setConnectStatus('Por favor completa la URL de Jira, email y API Token.', 'warning');
    return;
  }
  if (!jql) {
    setConnectStatus('Por favor ingresa una consulta JQL.', 'warning');
    return;
  }

  btn.disabled = true;
  document.getElementById('jiraConnectStatus')?.classList.add('hidden');
  showJiraProgress(false);
  setJiraProgress(0, 0, 'Verificando conexión...');

  try {
    // ── 1. Test connection ────────────────────────────────────────────
    setConnectStatus('🔗 Verificando conexión...', 'info');
    const me = await apiPost('/api/jira/test', config);
    setConnectStatus(`✅ Conectado como ${me.displayName || me.emailAddress}`, 'info');

    // ── 2. Fetch fields to find "Start date" custom field ─────────────
    setConnectStatus('🔍 Detectando campos personalizados...', 'info');
    const fields      = await apiPost('/api/jira/fields', config);
    const startFieldId = findStartDateFieldId(fields);

    const fieldsToFetch = [
      'summary', 'status', 'priority', 'assignee',
      'description', 'project', 'duedate',
      ...(startFieldId ? [startFieldId] : []),
    ];

    // ── 3. Paginate through all matching issues ───────────────────────
    showJiraProgress(true);
    setJiraProgress(0, 0, 'Consultando Jira...');

    const MAX_PER_PAGE = 100;
    let startAt    = 0;
    let total      = Infinity;
    const allIssues = [];

    while (startAt < total) {
      const page = await apiPost('/api/jira/search', {
        ...config,
        jql,
        fields:     fieldsToFetch,
        maxResults: MAX_PER_PAGE,
        startAt,
      });

      if (total === Infinity) total = page.total;
      allIssues.push(...(page.issues || []));
      startAt += (page.issues || []).length;

      setJiraProgress(allIssues.length, total, 'Descargando tareas...');

      // Safety: stop if Jira returns 0 issues to avoid infinite loop
      if (!page.issues?.length) break;
    }

    if (!allIssues.length) {
      setConnectStatus(`⚠️ La consulta JQL no devolvió ninguna tarea. Revisa el JQL e intenta de nuevo.`, 'warning');
      showJiraProgress(false);
      btn.disabled = false;
      return;
    }

    // ── 4. Map to rawData format and load ─────────────────────────────
    setJiraProgress(allIssues.length, total, 'Procesando tareas...');
    const mapped = mapIssuesToRawData(allIssues, startFieldId);

    // Fake columnMap so updateAlerts() knows dates were detected
    columnMap = {
      key: 'key', summary: 'summary', status: 'status',
      priority: 'priority', assignee: 'assignee',
      description: 'description', project: 'project',
      startDate: startFieldId || null,
      dueDate: 'duedate',
    };

    // Load into the shared pipeline
    loadRawData(mapped);

    setConnectStatus(
      `✅ ${allIssues.length} tarea(s) cargadas desde Jira${startFieldId ? '' : ' (campo Start date no detectado)'}`,
      'info'
    );
    showJiraProgress(false);

  } catch (err) {
    console.error('Jira API error:', err);
    setConnectStatus(`❌ Error: ${err.message}`, 'danger');
    showJiraProgress(false);
  } finally {
    btn.disabled = false;
  }
}

// ── Server health check ───────────────────────────────────────────────
/**
 * Ping /api/health to detect whether server.js is running.
 * Updates the status bar in the UI accordingly.
 */
async function checkServerStatus() {
  const dot       = document.getElementById('serverStatusDot');
  const text      = document.getElementById('serverStatusText');
  const offlineEl = document.getElementById('serverOfflineAlert');
  const connectBtn = document.getElementById('jiraConnectBtn');

  // Reset to "checking" state
  if (dot)  { dot.className  = 'server-status-dot checking'; }
  if (text) { text.textContent = 'Verificando servidor...'; }

  try {
    const res  = await fetch('/api/health', { cache: 'no-store' });
    const data = await res.json();

    if (data.ok) {
      // ✅ Running
      if (dot)       dot.className   = 'server-status-dot online';
      if (text)      text.textContent = `Servidor activo (v${data.version})`;
      if (offlineEl) offlineEl.classList.add('hidden');
      if (connectBtn) connectBtn.disabled = false;
    } else {
      throw new Error('unexpected response');
    }
  } catch {
    // ❌ Not running (fetch failed = server offline or running as file://)
    if (dot)       dot.className   = 'server-status-dot offline';
    if (text)      text.textContent = 'Servidor no detectado';
    if (offlineEl) offlineEl.classList.remove('hidden');
    if (connectBtn) connectBtn.disabled = true;
  }
}

/** Copy the start command to clipboard and briefly confirm. */
function copyServerCommand() {
  const cmd = 'npm install && node server.js';
  navigator.clipboard?.writeText(cmd).then(() => {
    const btn = document.getElementById('copyServerCmd');
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = '✅ Copiado';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
}
window.copyServerCommand = copyServerCommand;

// ── JQL example chips ─────────────────────────────────────────────────
function insertJql(fragment) {
  const el = document.getElementById('jiraJql');
  if (!el) return;
  el.value = fragment;
  el.focus();
}
window.insertJql = insertJql;

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('jiraConnectBtn')
    ?.addEventListener('click', connectToJira);

  document.getElementById('checkServerBtn')
    ?.addEventListener('click', checkServerStatus);

  // Allow Enter key on any field to trigger connect
  ['jiraBaseUrl', 'jiraEmail', 'jiraToken', 'jiraJql'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') connectToJira();
    });
  });
});

// Expose so app.js can call it when the user selects API mode
window.checkServerStatus = checkServerStatus;
