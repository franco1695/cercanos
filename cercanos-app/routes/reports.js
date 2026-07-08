const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/report', requireAuth, (req, res) => {
  const { reportedId, reason } = req.body || {};
  if (!reportedId || !reason || !reason.trim()) return res.status(400).json({ error: 'Falta el motivo del reporte.' });

  const target = db.findUserById(reportedId);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  db.insertReport({
    id: 'r_' + crypto.randomBytes(10).toString('hex'),
    reporter_id: req.userId, reported_id: reportedId, reason: reason.trim(),
    created_at: Date.now(), reviewed: false,
  });

  // Auto-suspensión simple: si acumula reportes de 3+ personas distintas, se banea para revisión manual
  if (db.distinctReporterCount(reportedId) >= 3) {
    db.updateUser(reportedId, { is_banned: true });
  }

  res.json({ ok: true });
});

router.post('/block', requireAuth, (req, res) => {
  const { blockedId } = req.body || {};
  if (!blockedId) return res.status(400).json({ error: 'Falta el usuario a bloquear.' });
  db.addBlock(req.userId, blockedId);
  res.json({ ok: true });
});

router.post('/unblock', requireAuth, (req, res) => {
  const { blockedId } = req.body || {};
  db.removeBlock(req.userId, blockedId);
  res.json({ ok: true });
});

router.get('/blocked', requireAuth, (req, res) => {
  res.json({ blocked: db.listBlockedProfiles(req.userId) });
});

module.exports = router;
