require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const messageRoutes = require('./routes/messages');
const conversationRoutes = require('./routes/conversations');
const moderationRoutes = require('./routes/moderation');
const friendRoutes = require('./routes/friends');
const userRoutes = require('./routes/users');
const { router: uploadRoutes, UPLOAD_DIR } = require('./routes/uploads');
const scheduledRoutes = require('./routes/scheduled');
const pollRoutes = require('./routes/polls');
const bookmarkRoutes = require('./routes/bookmarks');
const { initSocket } = require('./socket');
const { startScheduler } = require('./scheduler');
const express2 = require('express');

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/scheduled', scheduledRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
// Serve uploaded files statically.
app.use('/uploads', express2.static(UPLOAD_DIR));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });
initSocket(io);
startScheduler(io);

server.listen(PORT, () => {
  console.log(`Helppy API listening on :${PORT}`);
});
