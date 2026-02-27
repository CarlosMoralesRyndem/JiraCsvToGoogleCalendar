// =====================================================================
// CONSTANTS & SHARED STATE
// =====================================================================

const JIRA_URL_BASE = 'https://newryndem.atlassian.net/browse/';
const PAGE_SIZE = 50;

const COLORS = [
  '#0052cc','#00875a','#ff8b00','#de350b','#6554c0',
  '#00b8d9','#ff5630','#36b37e','#172b4d','#ffab00',
  '#8777d9','#57d9a3','#2684ff','#ffd700','#ff6b6b',
];

/**
 * Column name aliases, ordered by priority (most specific first).
 * Supports both Spanish and English Jira exports.
 */
const COL_ALIASES = {
  key: [
    'Clave de incidencia', 'Issue Key', 'Key', 'Clave', 'Issue id',
  ],
  summary: [
    'Resumen', 'Summary', 'Título', 'Title',
  ],
  status: [
    'Estado', 'Status',
  ],
  priority: [
    'Prioridad', 'Priority',
  ],
  assignee: [
    'Persona asignada', 'Assignee', 'Asignado a', 'Assigned To',
  ],
  description: [
    'Descripción', 'Description', 'Desc',
  ],
  project: [
    'Nombre del proyecto', 'Project Name', 'Proyecto', 'Project',
    'Clave del proyecto',
  ],
  startDate: [
    // Exact Jira custom field names (Spanish export)
    'Campo personalizado (Start date)',
    'Campo personalizado (Planned start)',
    'Campo personalizado (Target start)',
    'Campo personalizado (Begin Date)',
    'Campo personalizado (Actual start)',
    'Campo personalizado (Fecha de Liberación)',
    // Generic fallbacks
    'Start date', 'Start Date', 'Fecha de inicio', 'Fecha inicio',
    'Fecha Inicio', 'start_date',
  ],
  dueDate: [
    // Exact Jira built-in columns
    'Fecha de vencimiento', 'Due Date', 'Due date',
    // Jira custom field names
    'Campo personalizado (Planned end)',
    'Campo personalizado (Target end)',
    'Campo personalizado (End Date)',
    'Campo personalizado (Actual end)',
    'Campo personalizado (Fecha Fin Replanificada)',
    // Generic fallbacks
    'fecha_vencimiento', 'Vencimiento', 'End Date', 'Fecha Fin',
  ],
  startTime: ['Start Time', 'Hora inicio', 'Hora de inicio'],
  endTime:   ['End Time',   'Hora fin',    'Hora de fin'],
};

// ── Shared mutable state (written by app.js / parser.js) ─────────────
let rawData       = [];   // All rows parsed from the CSV
let filteredData  = [];   // Rows after applying user filters
let chartInstances = {};  // Active Chart.js instances (for destroy/rebuild)
let currentPage   = 0;    // Current table page index
let columnMap     = {};   // Maps field keys → actual CSV header strings
