// =====================================================================
// TABLE RENDERING
// =====================================================================

/** Return a badge CSS class based on the priority label. */
function priorityBadge(p) {
  const lp = (p || '').toLowerCase();
  if (lp.includes('críti') || lp.includes('criti') || lp.includes('blocker')) return 'badge-red';
  if (lp.includes('alta') || lp.includes('high') || lp.includes('major')) return 'badge-orange';
  if (lp.includes('media') || lp.includes('medium')) return 'badge-blue';
  return 'badge-gray';
}

/** Return a badge CSS class based on the status label. */
function statusBadge(s) {
  const ls = (s || '').toLowerCase();
  if (
    ls.includes('done') || ls.includes('hecho') || ls.includes('cerrado') ||
    ls.includes('closed') || ls.includes('resolved') || ls.includes('resuelto')
  ) return 'badge-green';
  if (ls.includes('progreso') || ls.includes('progress') || ls.includes('in progress') || ls.includes('curso'))
    return 'badge-blue';
  if (ls.includes('bloqu') || ls.includes('block')) return 'badge-red';
  return 'badge-gray';
}

/**
 * Render the current page of `filteredData` into #summaryTable.
 */
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const warnEl = document.getElementById('tableWarn');
  const start = currentPage * PAGE_SIZE;
  const page = filteredData.slice(start, start + PAGE_SIZE);

  // Warning about tasks without any dates
  const noDates = filteredData.filter(r => !r.hasAnyDate);
  if (noDates.length) {
    warnEl.innerHTML = `<div class="alert alert-warning">
      <i class="fa-solid fa-triangle-exclamation"></i> ${noDates.length} tarea(s) no tienen fechas y aparecen en la tabla pero no se incluirán en el export por defecto.
    </div>`;
  } else {
    warnEl.innerHTML = '';
  }

  tbody.innerHTML = page.map(r => {
    const startCell = r.startDate
      ? fmtDisplay(r.startDate)
      : r.startRaw
        ? `<span style="color:var(--danger)" title="Formato no reconocido: ${esc(r.startRaw)}"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(r.startRaw)}</span>`
        : '<span style="color:var(--text2)">—</span>';

    const dueCell = r.dueDate
      ? fmtDisplay(r.dueDate)
      : r.dueRaw
        ? `<span style="color:var(--danger)" title="Formato no reconocido: ${esc(r.dueRaw)}"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(r.dueRaw)}</span>`
        : '<span style="color:var(--text2)">—</span>';

    return `<tr>
      <td><a href="${JIRA_URL_BASE}${esc(r.key)}" target="_blank" style="font-weight:700">${esc(r.key)}</a></td>
      <td><span class="truncate" title="${esc(r.summary)}">${esc(r.summary)}</span></td>
      <td style="white-space:nowrap">${startCell}</td>
      <td style="white-space:nowrap">${dueCell}</td>
      <td><span class="badge ${statusBadge(r.status)}">${esc(r.status)}</span></td>
      <td><span class="badge ${priorityBadge(r.priority)}">${esc(r.priority)}</span></td>
      <td><span class="truncate" title="${esc(r.project)}">${esc(r.project)}</span></td>
      <td><span class="truncate" title="${esc(r.assignee)}">${esc(r.assignee)}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text2)">
    No hay tareas que mostrar con los filtros actuales.
  </td></tr>`;

  renderPagination();
}

/** Render the pagination controls below the table. */
function renderPagination() {
  const total = filteredData.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const el = document.getElementById('tablePagination');

  if (pages <= 1) {
    el.innerHTML = `<span style="color:var(--text2);font-size:.85rem">${total} tarea(s) en total</span>`;
    return;
  }

  el.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="goPage(${currentPage - 1})" ${currentPage === 0 ? 'disabled' : ''}><i class="fa-solid fa-angle-left"></i> Anterior</button>
    <span style="font-size:.85rem;color:var(--text2)">Página ${currentPage + 1} / ${pages} · ${total} tareas</span>
    <button class="btn btn-secondary btn-sm" onclick="goPage(${currentPage + 1})" ${currentPage >= pages - 1 ? 'disabled' : ''}>Siguiente <i class="fa-solid fa-angle-right"></i></button>
  `;
}

/** Navigate to a specific table page. Exposed globally for inline onclick. */
function goPage(p) {
  currentPage = p;
  renderTable();
}
// Make accessible from inline onclick handlers in innerHTML
window.goPage = goPage;
