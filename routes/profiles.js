const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { publicProfile, DISTRITOS, GENEROS, INTERESES } = require('./auth');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, req.userId + '_' + Date.now() + ext);
    }
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo se permiten imágenes.'));
    cb(null, true);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.findUserById(req.userId);
  res.json({ profile: publicProfile(user) });
});

router.put('/me', requireAuth, (req, res) => {
  const { bio, district } = req.body || {};
  if (district && !DISTRITOS.includes(district)) return res.status(400).json({ error: 'Distrito inválido.' });
  const fields = {};
  if (typeof bio === 'string') fields.bio = bio;
  if (district) fields.district = district;
  const user = db.updateUser(req.userId, fields);
  res.json({ profile: publicProfile(user) });
});

// Usado por cuentas creadas con Facebook, que aún no tienen edad/distrito/género
router.put('/me/complete', requireAuth, (req, res) => {
  const { age, district, gender, interestedIn, bio } = req.body || {};
  const ageNum = parseInt(age, 10);
  if (!ageNum || isNaN(ageNum)) return res.status(400).json({ error: 'Ingresa tu edad.' });
  if (ageNum < 18) return res.status(400).json({ error: 'Debes ser mayor de 18 años para usar Cercanos.' });
  if (!district || !DISTRITOS.includes(district)) return res.status(400).json({ error: 'Selecciona un distrito válido.' });
  if (!gender || !GENEROS.includes(gender)) return res.status(400).json({ error: 'Selecciona tu género.' });
  const interest = INTERESES.includes(interestedIn) ? interestedIn : 'Todos';

  const user = db.updateUser(req.userId, {
    age: ageNum, district, gender, interested_in: interest,
    bio: typeof bio === 'string' ? bio.trim() : '',
    needs_profile: false,
  });
  res.json({ profile: publicProfile(user) });
});

router.post('/me/photo', requireAuth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  const user = db.updateUser(req.userId, { photo_path: req.file.filename });
  res.json({ profile: publicProfile(user) });
});

router.get('/', requireAuth, (req, res) => {
  const district = req.query.district;
  const gender = req.query.gender;
  const blockedByMe = db.blockedByUser(req.userId);
  const blockedMe = db.blockersOfUser(req.userId);
  const excluded = new Set([req.userId, ...blockedByMe, ...blockedMe]);

  let users = db.allActiveUsers().filter(u => !excluded.has(u.id) && !u.needs_profile);
  if (district && district !== 'todos') users = users.filter(u => u.district === district);
  if (gender && gender !== 'todos') users = users.filter(u => u.gender === gender);

  res.json({ profiles: users.map(publicProfile) });
});

module.exports = router;
