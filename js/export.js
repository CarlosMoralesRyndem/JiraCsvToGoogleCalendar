// =====================================================================
// GOOGLE CALENDAR CSV EXPORT
// =====================================================================

/** Read all user-selected export options from the Options tab. */
function getOptions() {
  const titleFormat = document.querySelector('input[name="titleFormat"]:checked')?.value || 'key_summary';
  const eventType   = document.querySelector('input[name="eventType"]:checked')?.value   || 'allday';
  const missingDate = document.querySelector('input[name="missingDate"]:checked')?.value  || 'skip';
  return {
    includeDesc:     document.getElementById('optIncludeDesc')?.checked     ?? true,
    includeLink:     document.getElementById('optIncludeLink')?.checked     ?? true,
    includeStatus:   document.getElementById('optIncludeStatus')?.checked   ?? true,
    includePriority: document.getElementById('optIncludePriority')?.checked ?? true,
    includeAssignee: document.getElementById('optIncludeAssignee')?.checked ?? true,
    titleFormat,
    eventType,
    missingDate,
  };
}

/** Build the event title string according to the chosen format option. */
function buildTitle(r, opts) {
  switch (opts.titleFormat) {
    case 'key_summary':         return `[${r.key}] ${r.summary}`;
    case 'summary_only':        return r.summary;
    case 'project_key_summary': return `[${r.project} - ${r.key}] ${r.summary}`;
    case 'key_only':            return r.key;
    default:                    return `[${r.key}] ${r.summary}`;
  }
}

/** Build the event description string according to the chosen content options. */
function buildDescription(r, opts) {
  const parts = [];
  if (opts.includeLink)     parts.push(`🔗 Jira: ${JIRA_URL_BASE}${r.key}`);
  if (opts.includeStatus)   parts.push(`📌 Estado: ${r.status}`);
  if (opts.includePriority) parts.push(`⚡ Prioridad: ${r.priority}`);
  if (opts.includeAssignee) parts.push(`👤 Asignado a: ${r.assignee}`);
  if (opts.includeDesc && r.description) {
    parts.push(`\n📝 Descripción:\n${r.description}`);
  }
  return parts.join('\n');
}

/**
 * Convert a subset of `filteredData` into an array of Google Calendar row objects.
 * Tasks without dates are handled according to the `missingDate` option.
 *
 * @param {Object[]} data - Subset of filteredData to convert.
 * @param {Object}   opts - Options from getOptions().
 * @returns {Object[]} Array of GCal row objects.
 */
function buildGCalRows(data, opts) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = [];

  for (const r of data) {
    let startDate = r.startDate;
    let endDate   = r.dueDate;

    // ── Handle missing dates ────────────────────────────────────────
    if (!startDate && !endDate) {
      if (opts.missingDate === 'skip')  continue;
      if (opts.missingDate === 'today') { startDate = today; endDate = today; }
      // 'same' doesn't apply when both are missing
    }
    if (!startDate) {
      if (opts.missingDate === 'skip')  continue;
      if (opts.missingDate === 'same')  startDate = endDate;
      if (opts.missingDate === 'today') startDate = today;
    }
    if (!endDate) {
      if (opts.missingDate === 'skip')  continue;
      if (opts.missingDate === 'same')  endDate = startDate;
      if (opts.missingDate === 'today') endDate = today;
    }
    if (!startDate || !endDate) continue;

    // Ensure start ≤ end
    if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

    // Google Calendar all-day events: end date is EXCLUSIVE → add 1 day
    const endDateGCal = new Date(endDate);
    endDateGCal.setDate(endDateGCal.getDate() + 1);

    rows.push({
      'Subject':       buildTitle(r, opts),
      'Start Date':    fmtGCal(startDate),
      'Start Time':    '',
      'End Date':      fmtGCal(endDateGCal),
      'End Time':      '',
      'All Day Event': 'True',
      'Description':   buildDescription(r, opts),
      'Location':      r.project,
      'Private':       'False',
    });
  }

  return rows;
}

/**
 * Convert an array of row objects to a CSV string.
 * @param {Object[]} rows
 * @returns {string}
 */
function rowsToCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines   = [headers.map(csvEsc).join(',')];
  rows.forEach(r => lines.push(headers.map(h => csvEsc(r[h] || '')).join(',')));
  return lines.join('\r\n');
}

/**
 * Update the export preview panel with a count of events that will be generated.
 */
function renderExportPreview() {
  const el = document.getElementById('exportPreview');
  if (!el) return;
  const opts     = getOptions();
  const rows     = buildGCalRows(filteredData, opts);
  const withDate = filteredData.filter(r => r.hasAnyDate).length;
  const skipped  = filteredData.length - withDate;

  el.innerHTML = `
    <div class="alert alert-info">
      ℹ️ Con la configuración actual se generarán <strong>${rows.length} evento(s)</strong>
      de ${filteredData.length} tarea(s) filtradas
      (${withDate} tienen al menos una fecha${skipped ? `, ${skipped} sin fechas serán omitidas` : ''}).
    </div>
  `;
}

// ── Export button handlers ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('exportAllBtn').addEventListener('click', () => {
    const opts = getOptions();
    const rows = buildGCalRows(filteredData, opts);
    if (!rows.length) { alert('No hay eventos para exportar. Revisa los filtros y las fechas disponibles.'); return; }
    downloadCSV(rowsToCSV(rows), 'jira_google_calendar.csv');
  });

  document.getElementById('exportByProjectBtn').addEventListener('click', () => {
    const opts  = getOptions();
    const projs = unique(filteredData.map(r => r.project));
    const files = projs.flatMap(p => {
      const rows = buildGCalRows(filteredData.filter(r => r.project === p), opts);
      if (!rows.length) return [];
      const safe = p.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 40);
      return [{ name: `jira_gcal_proyecto_${safe}.csv`, content: rowsToCSV(rows) }];
    });
    downloadMultiple(files);
  });

  document.getElementById('exportByStatusBtn').addEventListener('click', () => {
    const opts     = getOptions();
    const statuses = unique(filteredData.map(r => r.status));
    const files = statuses.flatMap(s => {
      const rows = buildGCalRows(filteredData.filter(r => r.status === s), opts);
      if (!rows.length) return [];
      const safe = s.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 40);
      return [{ name: `jira_gcal_estado_${safe}.csv`, content: rowsToCSV(rows) }];
    });
    downloadMultiple(files);
  });

  // Refresh preview whenever any option changes
  ['optIncludeDesc','optIncludeLink','optIncludeStatus','optIncludePriority','optIncludeAssignee'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderExportPreview);
  });
  document.querySelectorAll('input[name="titleFormat"], input[name="eventType"], input[name="missingDate"]')
    .forEach(el => el.addEventListener('change', renderExportPreview));

});
