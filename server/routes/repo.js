const express        = require('express');
const router         = express.Router();
const { sendCommand } = require('../python_bridge');

// ── GET /api/repo/scan?path=... ────────────────────────────────────────────────
router.get('/scan', async (req, res) => {
  const repoPath = req.query.path;
  if (!repoPath) return res.status(400).json({ error: 'path query param required' });
  try {
    const data = await sendCommand({ cmd: 'scan', repo_path: repoPath });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/repo/index-exists?path=... ───────────────────────────────────────
router.get('/index-exists', async (req, res) => {
  const repoPath = req.query.path;
  if (!repoPath) return res.status(400).json({ error: 'path query param required' });
  try {
    const data = await sendCommand({ cmd: 'index_exists', repo_path: repoPath });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/repo/index  (SSE streaming) ─────────────────────────────────────
router.post('/index', async (req, res) => {
  const { repo_path, base_url, llm_model, embedding_model } = req.body;
  if (!repo_path) return res.status(400).json({ error: 'repo_path required' });

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const sseWrite = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const data = await sendCommand(
      { cmd: 'index', repo_path, base_url, llm_model, embedding_model },
      (message) => sseWrite({ type: 'progress', message }),
    );
    sseWrite({ type: 'done', data });
  } catch (err) {
    sseWrite({ type: 'error', message: err.message });
  }
  res.end();
});

// ── POST /api/repo/load ────────────────────────────────────────────────────────
router.post('/load', async (req, res) => {
  const { repo_path, base_url, llm_model, embedding_model } = req.body;
  if (!repo_path) return res.status(400).json({ error: 'repo_path required' });
  try {
    const data = await sendCommand({ cmd: 'load', repo_path, base_url, llm_model, embedding_model });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/repo/status ──────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const data = await sendCommand({ cmd: 'status' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/repo/browse ──────────────────────────────────────────────────────
router.get('/browse', (req, res) => {
  try {
    const { execSync } = require('child_process');
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$fbd = New-Object System.Windows.Forms.FolderBrowserDialog
$fbd.ShowNewFolderButton = $false
if ($fbd.ShowDialog() -eq 'OK') { $fbd.SelectedPath }
`;
    const result = execSync('powershell.exe -STA -NoProfile -Command -', { input: script, encoding: 'utf8' }).trim();
    res.json({ path: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
