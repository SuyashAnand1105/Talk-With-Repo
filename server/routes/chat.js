const express        = require('express');
const router         = express.Router();
const { sendCommand } = require('../python_bridge');

// ── POST /api/chat/query ───────────────────────────────────────────────────────
router.post('/query', async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'question required' });
  try {
    const data = await sendCommand({ cmd: 'query', question });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
