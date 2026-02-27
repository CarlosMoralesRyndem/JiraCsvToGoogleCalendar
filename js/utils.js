// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

/** Spanish month abbreviations used in Jira's Spanish locale export. */
const SPANISH_MONTHS = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

/** English month abbreviations (fallback). */
const ENGLISH_MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a date string from a Jira CSV export.
 *
 * Handles (among others):
 *   - "25/feb/26 12:00 AM"   → Jira Spanish locale  (DD/MMM/YY h:mm A)
 *   - "03/Mar/2026"          → Jira English locale   (DD/MMM/YYYY)
 *   - "2026-03-25"           → ISO 8601
 *   - "25/03/2026"           → DD/MM/YYYY
 *   - "03/25/2026"           → MM/DD/YYYY (US)
 *   - "25-03-2026"           → DD-MM-YYYY
 *
 * @param {string} str - Raw date string from the CSV cell.
 * @returns {Date|null}
 */
function parseDate(str) {
  if (!str || !str.trim()) return null;
  str = str.trim();

  // ── 1. DD/MMM/YY[YY] [time] — Jira Spanish & English locale ──────
  //    Examples: "25/feb/26 12:00 AM", "03/Mar/2026", "16/abr/26 12:00 AM"
  const mJira = str.match(/^(\d{1,2})\/([a-záéíóúüñ]+)\/(\d{2,4})/i);
  if (mJira) {
    const day    = parseInt(mJira[1], 10);
    const monStr = mJira[2].toLowerCase();
    const mon    = SPANISH_MONTHS[monStr] ?? ENGLISH_MONTHS[monStr];
    let   year   = parseInt(mJira[3], 10);
    if (year < 100) year += 2000;
    if (mon !== undefined) {
      const d = new Date(year, mon, day);
      if (!isNaN(d)) return d;
    }
  }

  // ── 2. YYYY-MM-DD (ISO) ───────────────────────────────────────────
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str.substring(0, 10) + 'T00:00:00');
    if (!isNaN(d)) return d;
  }

  // ── 3. DD/MM/YYYY ────────────────────────────────────────────────
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    // Distinguish DD/MM vs MM/DD: if first part > 12 it must be day
    const [a, b, y] = parts.map(Number);
    let d;
    if (a > 12) {
      d = new Date(y, b - 1, a); // definitely DD/MM/YYYY
    } else {
      // Ambiguous — treat as DD/MM/YYYY (European / Jira default)
      d = new Date(y, b - 1, a);
    }
    if (!isNaN(d)) return d;
  }

  // ── 4. DD/MM/YYYY HH:MM (with time part after space) ─────────────
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s/.test(str)) {
    const datePart = str.split(' ')[0];
    const [a, b, y] = datePart.split('/').map(Number);
    const d = new Date(y, b - 1, a);
    if (!isNaN(d)) return d;
  }

  // ── 5. DD-MM-YYYY ────────────────────────────────────────────────
  if (/^\d{2}-\d{2}-\d{4}/.test(str)) {
    const [a, b, y] = str.substring(0, 10).split('-').map(Number);
    const d = new Date(y, b - 1, a);
    if (!isNaN(d)) return d;
  }

  // ── 6. Native Date fallback ───────────────────────────────────────
  const fallback = new Date(str);
  return isNaN(fallback) ? null : fallback;
}

/**
 * Format a Date for the Google Calendar CSV: MM/DD/YYYY
 */
function fmtGCal(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}/${date.getFullYear()}`;
}

/**
 * Human-readable date in Spanish for the UI table.
 */
function fmtDisplay(date) {
  if (!date) return '—';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Escape HTML special characters. */
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape a value for CSV output (RFC 4180). */
function csvEsc(v) {
  v = String(v);
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

/** Return a sorted, de-duplicated array without empty strings. */
function unique(arr) {
  return [...new Set(arr)].filter(Boolean).sort();
}

/** Count occurrences of each value of `key` across the array. */
function countBy(data, key) {
  const map = {};
  data.forEach(r => { map[r[key]] = (map[r[key]] || 0) + 1; });
  return map;
}

// ── DOM helpers ───────────────────────────────────────────────────────

function showSpinner(visible) {
  document.getElementById('spinnerOverlay').classList.toggle('active', visible);
}

/**
 * Trigger a CSV file download with UTF-8 BOM for Excel compatibility.
 */
function downloadCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download multiple CSV files with a small delay between each to avoid
 * browser popup blockers.
 */
function downloadMultiple(files) {
  if (!files.length) { alert('No hay eventos para exportar.'); return; }
  files.forEach((f, i) => setTimeout(() => downloadCSV(f.content, f.name), i * 350));
}
