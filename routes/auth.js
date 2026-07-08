const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const DISTRITOS = ["Miraflores","San Isidro","Barranco","Surco","San Borja","La Molina",
  "Jesús María","Lince","Magdalena","Pueblo Libre","San Miguel","Chorrillos",
  "Comas","Los Olivos","San Juan de Lurigancho","Ate","La Victoria","Rímac",
  "Callao","Villa El Salvador","Surquillo","Breña"];

const GENEROS = ["Hombre", "Mujer", "Otro"];
const INTERESES = ["Hombres", "Mujeres", "Todos"];

function publicProfile(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, age: u.age, district: u.district,
    bio: u.bio, gender: u.gender || null, interestedIn: u.interested_in || 'Todos',
    photo: u.photo_path ? `/uploads/${u.photo_path}` : (u.photo_external_url || null),
    needsProfile: !!u.needs_profile,
  };
}

router.post('/register', (req, res) => {
  const { name, email, password, age, district, gender, interestedIn, bio } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'Escribe tu nombre.' });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Ingresa un email válido.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  const ageNum = parseInt(age, 10);
  if (!ageNum || isNaN(ageNum)) return res.status(400).json({ error: 'Ingresa tu edad.' });
  if (ageNum < 18) return res.status(400).json({ error: 'Debes ser mayor de 18 años para usar Cercanos.' });
  if (!district || !DISTRITOS.includes(district)) return res.status(400).json({ error: 'Selecciona un distrito válido.' });
  if (!gender || !GENEROS.includes(gender)) return res.status(400).json({ error: 'Selecciona tu género.' });
  const interest = INTERESES.includes(interestedIn) ? interestedIn : 'Todos';

  const emailNorm = email.toLowerCase().trim();
  if (db.findUserByEmail(emailNorm)) return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });

  const id = 'u_' + crypto.randomBytes(12).toString('hex');
  const passwordHash = bcrypt.hashSync(password, 10);

  const user = db.insertUser({
    id, name: name.trim(), email: emailNorm, password_hash: passwordHash,
    age: ageNum, district, gender, interested_in: interest, bio: (bio || '').trim(), photo_path: null,
    created_at: Date.now(), is_banned: false, needs_profile: false,
  });

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, profile: publicProfile(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Ingresa tu email y contraseña.' });

  const user = db.findUserByEmail(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  if (user.is_banned) return res.status(403).json({ error: 'Esta cuenta fue suspendida.' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos.' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, profile: publicProfile(user) });
});

module.exports = router;
module.exports.publicProfile = publicProfile;
module.exports.DISTRITOS = DISTRITOS;
module.exports.GENEROS = GENEROS;
module.exports.INTERESES = INTERESES;
