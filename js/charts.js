// =====================================================================
// CHART & TIMELINE RENDERING
// =====================================================================

/**
 * Destroy and rebuild all four Chart.js charts using current `filteredData`.
 * Respects the dark/light theme via CSS variables.
 */
function rebuildCharts() {
  const textColor = isDark ? '#8b949e' : '#586069';
  const gridColor = isDark ? '#30363d' : '#e1e4e8';

  /**
   * Build a base Chart.js options object.
   * @param {'pie'|'doughnut'|'bar'} type
   */
  function baseOptions(type) {
    const isPolar = type === 'pie' || type === 'doughnut';
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw}`,
          },
        },
      },
      ...(isPolar ? {} : {
        scales: {
          x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true },
        },
      }),
    };
  }

  /**
   * Destroy a previous chart (if any) and render a new one.
   */
  function rebuild(id, type, labels, data, colors) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    chartInstances[id] = new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors || COLORS,
          borderWidth: (type === 'pie' || type === 'doughnut') ? 2 : 0,
          borderColor: isDark ? '#161b22' : '#ffffff',
        }],
      },
      options: baseOptions(type),
    });
  }

  // ── Project distribution (doughnut) ──────────────────────────────
  const pMap = countBy(filteredData, 'project');
  rebuild('chartProject', 'doughnut', Object.keys(pMap), Object.values(pMap));

  // ── Status distribution (bar) ─────────────────────────────────────
  const sMap = countBy(filteredData, 'status');
  rebuild('chartStatus', 'bar', Object.keys(sMap), Object.values(sMap), COLORS);

  // ── Priority distribution (doughnut with semantic colors) ─────────
  const prMap = countBy(filteredData, 'priority');
  const prColors = Object.keys(prMap).map(p => {
    const lp = p.toLowerCase();
    if (lp.includes('críti') || lp.includes('criti') || lp.includes('blocker')) return '#de350b';
    if (lp.includes('alta')  || lp.includes('high')  || lp.includes('major'))   return '#ff8b00';
    if (lp.includes('media') || lp.includes('medium'))                           return '#0052cc';
    return '#8b949e';
  });
  rebuild('chartPriority', 'doughnut', Object.keys(prMap), Object.values(prMap), prColors);

  // ── Top-8 assignees (horizontal bar) ─────────────────────────────
  const aMap     = countBy(filteredData, 'assignee');
  const aEntries = Object.entries(aMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  rebuild('chartAssignee', 'bar', aEntries.map(e => e[0]), aEntries.map(e => e[1]), COLORS);

  // ── Gantt timeline ────────────────────────────────────────────────
  renderGantt();
}

/**
 * Render a simple CSS-based Gantt chart showing the first 40 tasks
 * that have at least one date.
 */
function renderGantt() {
  const el = document.getElementById('ganttChart');
  if (!el) return;

  const withDates = filteredData.filter(r => r.hasAnyDate).slice(0, 40);

  if (!withDates.length) {
    el.innerHTML = '<p style="color:var(--text2);font-size:.85rem;padding:10px;">No hay tareas con fechas para mostrar.</p>';
    return;
  }

  // Determine the visible date range
  const allDates = withDates.flatMap(r => [r.startDate, r.dueDate]).filter(Boolean);
  const minMs    = Math.min(...allDates.map(d => d.getTime()));
  const maxMs    = Math.max(...allDates.map(d => d.getTime()));
  const rangeMs  = Math.max(1, maxMs - minMs);

  const pctLeft  = d => d ? Math.max(0, (d.getTime() - minMs) / rangeMs * 100) : 0;
  const pctWidth = (s, e) => {
    const L = pctLeft(s || e);
    const R = pctLeft(e || s);
    return Math.max(0.5, R - L);
  };

  // Assign a color per project
  const projects     = unique(withDates.map(r => r.project));
  const projectColor = {};
  projects.forEach((p, i) => { projectColor[p] = COLORS[i % COLORS.length]; });

  const rows = withDates.map(r => {
    const L     = pctLeft(r.startDate || r.dueDate);
    const W     = pctWidth(r.startDate, r.dueDate);
    const color = projectColor[r.project] || COLORS[0];
    const label = W > 8 ? esc(r.summary.substring(0, 24)) : '';
    const title = `${esc(r.key)}: ${esc(r.summary)}\n${fmtDisplay(r.startDate)} → ${fmtDisplay(r.dueDate)}`;

    return `
      <div class="gantt-row">
        <div class="gantt-label" title="${esc(r.key)}: ${esc(r.summary)}">${esc(r.key)}</div>
        <div class="gantt-bar-wrap" title="${title}">
          <div class="gantt-bar" style="left:${L.toFixed(2)}%;width:${W.toFixed(2)}%;background:${color};">${label}</div>
        </div>
      </div>`;
  }).join('');

  const minDate = new Date(minMs);
  const maxDate = new Date(maxMs);
  const total   = filteredData.filter(r => r.hasAnyDate).length;

  el.innerHTML = `
    <div class="gantt">${rows}</div>
    <div class="gantt-axis">
      <span>${fmtDisplay(minDate)}</span>
      <span>${fmtDisplay(maxDate)}</span>
    </div>
    ${withDates.length < total
      ? `<p style="color:var(--text2);font-size:.78rem;margin-top:8px;">Mostrando ${withDates.length} de ${total} tareas con fechas.</p>`
      : ''}
  `;
}
