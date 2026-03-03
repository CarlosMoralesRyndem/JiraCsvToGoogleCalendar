// =====================================================================
// FILTER LOGIC
// =====================================================================

/** Return an array of the currently selected option values in a <select>. */
function getSelectedOptions(el) {
  if (!el) return [];
  return Array.from(el.selectedOptions).map(o => o.value);
}

/**
 * Build all filter controls from the unique values present in `rawData`.
 * Renders them into #filtersGrid.
 */
function buildFilters() {
  const projects   = unique(rawData.map(r => r.project));
  const statuses   = unique(rawData.map(r => r.status));
  const assignees  = unique(rawData.map(r => r.assignee));
  const priorities = unique(rawData.map(r => r.priority));

  const opt = (v) => `<option value="${esc(v)}">${esc(v)}</option>`;

  document.getElementById('filtersGrid').innerHTML = `
    <div class="filter-section">
      <div class="filter-section-head">🔍 Búsqueda rápida</div>
      <div class="filter-search-row">
        <div class="filter-group">
          <label>Buscar en clave / resumen</label>
          <input type="text" id="fSearch" placeholder="Texto a buscar...">
        </div>
        <div class="filter-group">
          <label>Solo con fechas</label>
          <select id="fHasDates">
            <option value="any">Todas las tareas</option>
            <option value="both">Con inicio Y fin</option>
            <option value="any_date">Con al menos una fecha</option>
            <option value="start_only">Solo con fecha inicio</option>
            <option value="due_only">Solo con fecha fin</option>
            <option value="none">Sin ninguna fecha</option>
          </select>
        </div>
      </div>
    </div>

    <div class="filter-section">
      <div class="filter-section-head">📋 Categorías</div>
      <div class="filters-grid">
        <div class="filter-group">
          <label>Proyecto(s)</label>
          <select id="fProject" multiple>${projects.map(opt).join('')}</select>
        </div>
        <div class="filter-group">
          <label>Estado(s)</label>
          <select id="fStatus" multiple>${statuses.map(opt).join('')}</select>
        </div>
        <div class="filter-group">
          <label>Persona asignada</label>
          <select id="fAssignee" multiple>${assignees.map(opt).join('')}</select>
        </div>
        <div class="filter-group">
          <label>Prioridad</label>
          <select id="fPriority" multiple>${priorities.map(opt).join('')}</select>
        </div>
      </div>
    </div>

    <div class="filter-section filter-section-last">
      <div class="filter-section-head">📅 Rango de fechas</div>
      <div class="filters-grid">
        <div class="filter-group">
          <label>Inicio desde</label>
          <input type="date" id="fStartFrom">
        </div>
        <div class="filter-group">
          <label>Inicio hasta</label>
          <input type="date" id="fStartTo">
        </div>
        <div class="filter-group">
          <label>Fin desde</label>
          <input type="date" id="fDueFrom">
        </div>
        <div class="filter-group">
          <label>Fin hasta</label>
          <input type="date" id="fDueTo">
        </div>
      </div>
    </div>
  `;

  document.getElementById('applyFiltersBtn').onclick = () => {
    currentPage = 0;
    applyFilters();
    saveFilters();
  };
  document.getElementById('clearFiltersBtn').onclick = clearFilters;
}

/**
 * Read current filter values and populate `filteredData`,
 * then refresh all dependent UI sections.
 */
function applyFilters() {
  const fProject  = getSelectedOptions(document.getElementById('fProject'));
  const fStatus   = getSelectedOptions(document.getElementById('fStatus'));
  const fAssignee = getSelectedOptions(document.getElementById('fAssignee'));
  const fPriority = getSelectedOptions(document.getElementById('fPriority'));
  const fStartFrom = document.getElementById('fStartFrom')?.value;
  const fStartTo   = document.getElementById('fStartTo')?.value;
  const fDueFrom   = document.getElementById('fDueFrom')?.value;
  const fDueTo     = document.getElementById('fDueTo')?.value;
  const fHasDates  = document.getElementById('fHasDates')?.value || 'any';
  const fSearch    = (document.getElementById('fSearch')?.value || '').toLowerCase();

  filteredData = rawData.filter(r => {
    if (fProject.length  && !fProject.includes(r.project))   return false;
    if (fStatus.length   && !fStatus.includes(r.status))     return false;
    if (fAssignee.length && !fAssignee.includes(r.assignee)) return false;
    if (fPriority.length && !fPriority.includes(r.priority)) return false;

    if (fSearch && !r.key.toLowerCase().includes(fSearch) && !r.summary.toLowerCase().includes(fSearch)) return false;

    switch (fHasDates) {
      case 'both':       if (!(r.hasStart && r.hasDue))  return false; break;
      case 'any_date':   if (!r.hasAnyDate)               return false; break;
      case 'start_only': if (!r.hasStart)                 return false; break;
      case 'due_only':   if (!r.hasDue)                   return false; break;
      case 'none':       if (r.hasAnyDate)                return false; break;
    }

    const toD = s => s ? new Date(s + 'T00:00:00') : null;
    if (fStartFrom && r.startDate && r.startDate < toD(fStartFrom)) return false;
    if (fStartTo   && r.startDate && r.startDate > new Date(fStartTo + 'T23:59:59')) return false;
    if (fDueFrom   && r.dueDate   && r.dueDate   < toD(fDueFrom))   return false;
    if (fDueTo     && r.dueDate   && r.dueDate   > new Date(fDueTo + 'T23:59:59'))   return false;

    return true;
  });

  updateStats();
  updateAlerts();
  renderTable();
  rebuildCharts();
  renderExportPreview();
}

/** Reset all filter controls to their default (unselected) state. */
function clearFilters() {
  ['fProject', 'fStatus', 'fAssignee', 'fPriority'].forEach(id => {
    const el = document.getElementById(id);
    if (el) Array.from(el.options).forEach(o => (o.selected = false));
  });
  ['fStartFrom', 'fStartTo', 'fDueFrom', 'fDueTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const hd = document.getElementById('fHasDates');
  if (hd) hd.value = 'any';
  const fs = document.getElementById('fSearch');
  if (fs) fs.value = '';

  currentPage = 0;
  applyFilters();
  saveFilters();
}

/** Persist current filter state to localStorage. */
function saveFilters() {
  const state = {
    project:  getSelectedOptions(document.getElementById('fProject')),
    status:   getSelectedOptions(document.getElementById('fStatus')),
    assignee: getSelectedOptions(document.getElementById('fAssignee')),
    priority: getSelectedOptions(document.getElementById('fPriority')),
    startFrom: document.getElementById('fStartFrom')?.value,
    startTo:   document.getElementById('fStartTo')?.value,
    dueFrom:   document.getElementById('fDueFrom')?.value,
    dueTo:     document.getElementById('fDueTo')?.value,
    hasDates:  document.getElementById('fHasDates')?.value,
    search:    document.getElementById('fSearch')?.value,
  };
  localStorage.setItem('jira_gcal_filters', JSON.stringify(state));
}

/**
 * Restore a previously saved filter state from localStorage,
 * then call applyFilters if any state was found.
 */
function restoreFilters() {
  let state;
  try {
    state = JSON.parse(localStorage.getItem('jira_gcal_filters') || 'null');
  } catch (e) {
    state = null;
  }

  if (!state) {
    // No saved state: just apply empty filters (shows all data)
    applyFilters();
    return;
  }

  const setMulti = (id, vals) => {
    const el = document.getElementById(id);
    if (!el || !Array.isArray(vals)) return;
    Array.from(el.options).forEach(o => (o.selected = vals.includes(o.value)));
  };

  setMulti('fProject',  state.project);
  setMulti('fStatus',   state.status);
  setMulti('fAssignee', state.assignee);
  setMulti('fPriority', state.priority);

  const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  setVal('fStartFrom', state.startFrom);
  setVal('fStartTo',   state.startTo);
  setVal('fDueFrom',   state.dueFrom);
  setVal('fDueTo',     state.dueTo);
  setVal('fHasDates',  state.hasDates);
  setVal('fSearch',    state.search);

  applyFilters();
}
