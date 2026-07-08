const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.json');

let state = { users: [], messages: [], blocks: [], reports: [] };

function load() {
  if (fs.existsSync(DB_PATH)) {
    try {
      state = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      state.users = state.users || [];
      state.messages = state.messages || [];
      state.blocks = state.blocks || [];
      state.reports = state.reports || [];
    } catch (e) {
      console.error('No se pudo leer la base de datos, se inicia una nueva.', e.message);
    }
  }
}

let saveScheduled = false;
function save() {
  if (saveScheduled) return;
  saveScheduled = true;
  setImmediate(() => {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
    saveScheduled = false;
  });
}

load();

module.exports = {
  findUserByEmail(email) {
    return state.users.find(u => u.email === email) || null;
  },
  findUserById(id) {
    return state.users.find(u => u.id === id) || null;
  },
  findUserByFacebookId(facebookId) {
    return state.users.find(u => u.facebook_id === facebookId) || null;
  },
  insertUser(user) {
    state.users.push(user);
    save();
    return user;
  },
  updateUser(id, fields) {
    const u = state.users.find(x => x.id === id);
    if (!u) return null;
    Object.assign(u, fields);
    save();
    return u;
  },
  allActiveUsers() {
    return state.users.filter(u => !u.is_banned);
  },

  insertMessage(msg) {
    state.messages.push(msg);
    save();
    return msg;
  },
  messagesByChatKey(chatKey) {
    return state.messages.filter(m => m.chat_key === chatKey).sort((a, b) => a.created_at - b.created_at);
  },
  messagesInvolving(userId) {
    return state.messages
      .filter(m => m.from_id === userId || m.to_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
  },

  addBlock(blockerId, blockedId) {
    const exists = state.blocks.find(b => b.blocker_id === blockerId && b.blocked_id === blockedId);
    if (!exists) { state.blocks.push({ blocker_id: blockerId, blocked_id: blockedId, created_at: Date.now() }); save(); }
  },
  removeBlock(blockerId, blockedId) {
    state.blocks = state.blocks.filter(b => !(b.blocker_id === blockerId && b.blocked_id === blockedId));
    save();
  },
  blockedByUser(userId) {
    return state.blocks.filter(b => b.blocker_id === userId).map(b => b.blocked_id);
  },
  blockersOfUser(userId) {
    return state.blocks.filter(b => b.blocked_id === userId).map(b => b.blocker_id);
  },
  isBlockedEitherWay(userA, userB) {
    return state.blocks.some(b =>
      (b.blocker_id === userA && b.blocked_id === userB) ||
      (b.blocker_id === userB && b.blocked_id === userA)
    );
  },
  listBlockedProfiles(userId) {
    const ids = this.blockedByUser(userId);
    return state.users.filter(u => ids.includes(u.id)).map(u => ({ id: u.id, name: u.name }));
  },

  insertReport(report) {
    state.reports.push(report);
    save();
    return report;
  },
  distinctReporterCount(reportedId) {
    const reporters = new Set(state.reports.filter(r => r.reported_id === reportedId).map(r => r.reporter_id));
    return reporters.size;
  },
};
