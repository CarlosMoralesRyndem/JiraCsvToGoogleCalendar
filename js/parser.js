// =====================================================================
// CSV PARSING & COLUMN DETECTION
// =====================================================================

/**
 * Find the first CSV header that matches any of the given aliases.
 * Two-pass: exact match first, then case-insensitive substring match.
 *
 * @param {string[]} headers - Actual CSV header names.
 * @param {string[]} aliases - Ordered list of candidate names to look for.
 * @returns {string|null} The matched header or null.
 */
function detectColumn(headers, aliases) {
  // Pass 1: exact, case-insensitive match
  for (const alias of aliases) {
    const found = headers.find(h => h.trim().toLowerCase() === alias.toLowerCase());
    if (found) return found;
  }
  // Pass 2: substring match (e.g. "Campo personalizado (Start date)" contains "Start date")
  for (const alias of aliases) {
    const found = headers.find(h => h.trim().toLowerCase().includes(alias.toLowerCase()));
    if (found) return found;
  }
  return null;
}

/**
 * Build a field-key → CSV-header mapping for all known fields.
 *
 * @param {string[]} headers
 * @returns {Object}
 */
function buildColumnMap(headers) {
  const map = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    map[field] = detectColumn(headers, aliases);
  }
  return map;
}

/**
 * Read a field value from a raw CSV row, trimmed.
 *
 * @param {Object} row        - PapaParse row object (header → value).
 * @param {string} field      - Logical field key (from COL_ALIASES).
 * @returns {string}
 */
function getVal(row, field) {
  const col = columnMap[field];
  return col ? (row[col] || '').trim() : '';
}

/**
 * Process parsed CSV data: build column map, validate required columns,
 * parse dates, and populate the shared `rawData` array.
 * Then triggers filter/UI build.
 *
 * @param {Object[]} data     - Array of row objects from PapaParse.
 * @param {string[]} headers  - CSV header names.
 */
function processCSV(data, headers) {
  columnMap = buildColumnMap(headers);
  columnMap._source = 'csv';

  // ── Validate required columns ─────────────────────────────────────
  const missing = [];
  if (!columnMap.key)     missing.push('Clave de incidencia');
  if (!columnMap.summary) missing.push('Resumen');

  if (missing.length) {
    showAlert(
      `No se encontraron las columnas requeridas: <strong>${missing.join(', ')}</strong>.<br>
       Verifica que el archivo sea un CSV exportado desde Jira.`,
      'danger'
    );
    showSpinner(false);
    return;
  }

  // ── Map each row to a normalized record ───────────────────────────
  rawData = data.map((row, i) => {
    const startRaw = getVal(row, 'startDate');
    const dueRaw   = getVal(row, 'dueDate');
    const startDate = parseDate(startRaw);
    const dueDate   = parseDate(dueRaw);

    return {
      _idx: i,
      key:         getVal(row, 'key'),
      summary:     getVal(row, 'summary'),
      status:      getVal(row, 'status')      || 'Sin estado',
      priority:    getVal(row, 'priority')    || 'Sin prioridad',
      assignee:    getVal(row, 'assignee')    || 'Sin asignar',
      description: getVal(row, 'description'),
      project:     getVal(row, 'project')     || 'Sin proyecto',
      // Raw strings for display / debugging
      startRaw,
      dueRaw,
      // Parsed Date objects (or null)
      startDate,
      dueDate,
      // Convenience flags
      hasStart:      !!startDate,
      hasDue:        !!dueDate,
      hasAnyDate:    !!(startDate || dueDate),
      // Flags for date-format warnings
      startInvalid:  !!(startRaw && !startDate),
      dueInvalid:    !!(dueRaw   && !dueDate),
    };
  });

  // ── Build UI ──────────────────────────────────────────────────────
  loadRawData(rawData);
}

/**
 * Shared entry point used by BOTH the CSV parser and the Jira API mode.
 * Takes an already-mapped rows array, populates rawData, and builds the UI.
 *
 * @param {Object[]} rows - Normalized row objects.
 */
function loadRawData(rows) {
  rawData = rows;
  ganttHiddenProjects = new Set(); // reset visibility on new data source

  buildFilters();
  restoreFilters(); // applies filters and renders table/charts

  document.getElementById('modeSelectorSection').classList.add('hidden');
  document.getElementById('uploadSection').classList.add('hidden');
  document.getElementById('jiraSection').classList.add('hidden');
  document.getElementById('resultsSection').classList.remove('hidden');
  document.getElementById('resetBtn').style.display = '';

  // Show/populate the JQL query bar when source is API
  const queryPanel = document.getElementById('jiraQueryPanel');
  const queryInput = document.getElementById('jiraQueryInput');
  if (queryPanel) {
    if (columnMap._source === 'api') {
      if (queryInput) queryInput.value = document.getElementById('jiraJql')?.value || '';
      queryPanel.classList.remove('hidden');
    } else {
      queryPanel.classList.add('hidden');
    }
  }
}
