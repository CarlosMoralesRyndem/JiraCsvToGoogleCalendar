/**
 * server.js — Local proxy for Jira REST API
 *
 * Solves CORS: the browser can't call Jira directly, so all API
 * requests go through this Express server running on localhost.
 *
 * Usage:
 *   npm install
 *   node server.js      →  http://localhost:3000
 */

'use strict';

const express = require('express');
const path    = require('path');
const app     = express();

// ── Middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname)));   // serve index.html + assets

// ── Jira helper ───────────────────────────────────────────────────────
/**
 * Make an authenticated request to the Jira REST API.
 *
 * @param {string} baseUrl   - e.g. "https://company.atlassian.net"
 * @param {string} email     - Atlassian account email
 * @param {string} apiToken  - Atlassian API token
 * @param {string} endpoint  - Path, e.g. "/rest/api/3/myself"
 * @param {Object} params    - Query-string parameters
 * @param {string} method    - HTTP method (default GET)
 * @param {Object} body      - Request body for POST/PUT
 */
async function jiraRequest(baseUrl, email, apiToken, endpoint, params = {}, method = 'GET', body = null) {
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const url  = new URL(`${baseUrl}${endpoint}`);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const options = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept':        'application/json',
      'Content-Type':  'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res  = await fetch(url.toString(), options);
  const text = await res.text();

  let data;
  try   { data = JSON.parse(text); }
  catch { data = { raw: text };    }

  return { ok: res.ok, status: res.status, data };
}

// ── Routes ────────────────────────────────────────────────────────────

/** Health check — used by the frontend to detect if this server is running */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', message: 'Servidor activo' });
});

/** Test connectivity — returns current user info */
app.post('/api/jira/test', async (req, res) => {
  const { baseUrl, email, apiToken } = req.body;
  try {
    const { ok, status, data } = await jiraRequest(baseUrl, email, apiToken, '/rest/api/3/myself');
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Return all available fields (used to detect the "Start date" custom field ID) */
app.post('/api/jira/fields', async (req, res) => {
  const { baseUrl, email, apiToken } = req.body;
  try {
    const { ok, status, data } = await jiraRequest(baseUrl, email, apiToken, '/rest/api/3/field');
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Search issues via JQL with pagination */
app.post('/api/jira/search', async (req, res) => {
  const { baseUrl, email, apiToken, jql, fields = [], maxResults = 100, startAt = 0 } = req.body;
  try {
    const { ok, status, data } = await jiraRequest(
      baseUrl, email, apiToken,
      '/rest/api/3/search',
      { jql, fields: fields.join(','), maxResults, startAt, expand: 'names' }
    );
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** List all accessible projects */
app.post('/api/jira/projects', async (req, res) => {
  const { baseUrl, email, apiToken } = req.body;
  try {
    const { ok, status, data } = await jiraRequest(
      baseUrl, email, apiToken,
      '/rest/api/3/project/search',
      { maxResults: 100 }
    );
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Jira → Google Calendar  |  Servidor local      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n  ✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log('  Abre esa URL en tu navegador para usar la herramienta.\n');
});
