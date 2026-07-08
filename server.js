require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const db = require('./db');

if (!process.env.JWT_SECRET) {
  console.error('ERROR: falta JWT_SECRET en las variables de entorno. Revisa el archivo .env');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api/', limiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth/', authLimiter);

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/facebookAuth'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api', require('./routes/reports'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Servidor HTTP + Socket.IO (señalización de llamadas WebRTC) ----------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

function chatKey(a, b) { return [a, b].sort().join('__'); }

// ¿Ambas personas ya se escribieron al menos 3 mensajes cada una en esta conversación?
function canCall(userA, userB) {
  const msgs = db.messagesByChatKey(chatKey(userA, userB));
  const fromA = msgs.filter(m => m.from_id === userA).length;
  const fromB = msgs.filter(m => m.from_id === userB).length;
  return fromA >= 3 && fromB >= 3;
}

// userId -> socket.id de la conexión activa (para saber si alguien está en línea)
const onlineUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('No autenticado.'));
    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = payload.userId;
    next();
  } catch (e) {
    next(new Error('Sesión inválida.'));
  }
});

io.on('connection', (socket) => {
  onlineUsers.set(socket.userId, socket.id);

  socket.on('call-user', ({ to, offer }) => {
    if (!to || !offer) return;
    if (!canCall(socket.userId, to)) {
      socket.emit('call-error', { message: 'Todavía no pueden llamarse: hace falta que ambos escriban al menos 3 mensajes.' });
      return;
    }
    const targetSocketId = onlineUsers.get(to);
    if (!targetSocketId) {
      socket.emit('call-error', { message: 'Esa persona no está conectada en este momento.' });
      return;
    }
    const caller = db.findUserById(socket.userId);
    io.to(targetSocketId).emit('incoming-call', {
      from: socket.userId,
      offer,
      fromName: caller ? caller.name : 'Alguien',
      fromPhoto: caller && caller.photo_path ? `/uploads/${caller.photo_path}` : (caller && caller.photo_external_url) || null,
    });
  });

  socket.on('answer-call', ({ to, answer }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) io.to(targetSocketId).emit('call-answered', { answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) io.to(targetSocketId).emit('ice-candidate', { candidate, from: socket.userId });
  });

  socket.on('reject-call', ({ to }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) io.to(targetSocketId).emit('call-rejected');
  });

  socket.on('end-call', ({ to }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) io.to(targetSocketId).emit('call-ended');
  });

  socket.on('disconnect', () => {
    if (onlineUsers.get(socket.userId) === socket.id) onlineUsers.delete(socket.userId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Cercanos corriendo en el puerto ${PORT}`));
