const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAdminKey(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: 'El panel de administrador no está configurado (falta ADMIN_KEY en el servidor).' });
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave de administrador incorrecta.' });
  }
  next();
}

router.get('/users', requireAdminKey, (req, res) => {
  const users = db.allUsersRaw().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    age: u.age,
    district: u.district,
    gender: u.gender,
    hasPhoto: !!u.photo_path,
    signupMethod: u.password_hash ? 'Email' : 'Facebook',
    needsProfile: !!u.needs_profile,
    isBanned: !!u.is_banned,
    createdAt: u.created_at,
  })).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ users });
});

router.get('/reports', requireAdminKey, (req, res) => {
  res.json({ reports: db.allReportsRaw() });
});

router.post('/ban', requireAdminKey, (req, res) => {
  const { userId, banned } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Falta el userId.' });
  const user = db.updateUser(userId, { is_banned: !!banned });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
