const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { publicProfile } = require('./auth');

const router = express.Router();

function chatKey(a, b) { return [a, b].sort().join('__'); }

router.get('/', requireAuth, (req, res) => {
  const rows = db.messagesInvolving(req.userId);
  const seen = new Map();
  for (const m of rows) {
    const otherId = m.from_id === req.userId ? m.to_id : m.from_id;
    if (!seen.has(otherId)) seen.set(otherId, m);
  }

  const conversations = [];
  for (const [otherId, lastMsg] of seen) {
    const user = db.findUserById(otherId);
    if (!user) continue;
    conversations.push({
      profile: publicProfile(user),
      lastMessage: { text: lastMsg.text, ts: lastMsg.created_at, mine: lastMsg.from_id === req.userId }
    });
  }
  conversations.sort((a, b) => b.lastMessage.ts - a.lastMessage.ts);
  res.json({ conversations });
});

router.get('/:otherId', requireAuth, (req, res) => {
  const key = chatKey(req.userId, req.params.otherId);
  const rows = db.messagesByChatKey(key);
  const fromMe = rows.filter(r => r.from_id === req.userId).length;
  const fromOther = rows.filter(r => r.from_id === req.params.otherId).length;
  res.json({
    messages: rows.map(r => ({ from: r.from_id, text: r.text, ts: r.created_at })),
    canCall: fromMe >= 3 && fromOther >= 3,
  });
});

router.post('/:otherId', requireAuth, (req, res) => {
  const otherId = req.params.otherId;
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  if (text.length > 1000) return res.status(400).json({ error: 'Mensaje demasiado largo.' });

  const otherUser = db.findUserById(otherId);
  if (!otherUser) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (db.isBlockedEitherWay(req.userId, otherId)) return res.status(403).json({ error: 'No puedes escribirle a este usuario.' });

  const createdAt = Date.now();
  const msg = db.insertMessage({
    id: 'm_' + crypto.randomBytes(10).toString('hex'),
    chat_key: chatKey(req.userId, otherId),
    from_id: req.userId, to_id: otherId, text: text.trim(), created_at: createdAt,
  });

  res.json({ message: { from: msg.from_id, text: msg.text, ts: msg.created_at } });
});

module.exports = router;
