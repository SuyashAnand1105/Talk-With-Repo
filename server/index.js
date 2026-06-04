const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Importing this module immediately spawns the Python bridge process
require('./python_bridge');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/repo', require('./routes/repo'));
app.use('/api/chat', require('./routes/chat'));

// ── Production static build ────────────────────────────────────────────────────
const distPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] API running on http://localhost:${PORT}`);
});
