const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FB_API_VERSION = 'v19.0';

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

function getRedirectUri(req) {
  return `${getBaseUrl(req)}/api/auth/facebook/callback`;
}

// Paso 1: el usuario hace click en "Continuar con Facebook" y lo mandamos al diálogo de login de Facebook
router.get('/facebook', (req, res) => {
  if (!FB_APP_ID) {
    return res.status(500).send('El login con Facebook no está configurado (falta FACEBOOK_APP_ID en el servidor).');
  }
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = encodeURIComponent(getRedirectUri(req));
  const url = `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${redirectUri}&state=${state}&scope=email,public_profile`;
  res.redirect(url);
});

// Paso 2: Facebook redirige aquí con un "code" que canjeamos por datos del usuario
router.get('/facebook/callback', async (req, res) => {
  try {
    if (!FB_APP_ID || !FB_APP_SECRET) {
      return res.status(500).send('El login con Facebook no está configurado en el servidor.');
    }
    const { code, error } = req.query;
    if (error || !code) {
      return res.redirect('/?fbError=1');
    }

    const redirectUri = getRedirectUri(req);
    const tokenUrl = `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${FB_APP_SECRET}&code=${code}`;
    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      console.error('Error obteniendo access_token de Facebook:', tokenData);
      return res.redirect('/?fbError=1');
    }

    const profileUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`;
    const profileResp = await fetch(profileUrl);
    const fbProfile = await profileResp.json();

    if (!fbProfile.id) {
      console.error('Error obteniendo perfil de Facebook:', fbProfile);
      return res.redirect('/?fbError=1');
    }

    let user = db.findUserByFacebookId(fbProfile.id);

    if (!user && fbProfile.email) {
      user = db.findUserByEmail(fbProfile.email.toLowerCase().trim());
      if (user) db.updateUser(user.id, { facebook_id: fbProfile.id });
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const id = 'u_' + crypto.randomBytes(12).toString('hex');
      user = db.insertUser({
        id,
        name: fbProfile.name || 'Usuario de Facebook',
        email: fbProfile.email ? fbProfile.email.toLowerCase().trim() : null,
        password_hash: null,
        facebook_id: fbProfile.id,
        age: null, district: null, gender: null, interested_in: 'Todos',
        bio: '', photo_path: null,
        photo_external_url: fbProfile.picture && fbProfile.picture.data ? fbProfile.picture.data.url : null,
        created_at: Date.now(), is_banned: false,
        needs_profile: true, // le falta completar edad/distrito/género antes de usar la app
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    const needsProfile = user.needs_profile ? '1' : '0';
    res.redirect(`/?fbToken=${token}&needsProfile=${needsProfile}`);
  } catch (e) {
    console.error('Error en el callback de Facebook:', e);
    res.redirect('/?fbError=1');
  }
});

module.exports = router;
