require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB, db } = require('./db');
const { syncOrdersFromTally } = require('./tally');
const { startScheduler } = require('./scheduler');

const authRouter = require('./routes/auth');
const ordersRouter = require('./routes/orders');
const notificationsRouter = require('./routes/notifications');
const salesmenRouter = require('./routes/salesmen');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Auth route kept for future use (login disabled)
app.use('/api/auth', authRouter);

// API routes — no auth required
app.use('/api/orders', ordersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/salesmen', salesmenRouter);

app.get('/api/config/reminders', (req, res) => {
  const config = db.prepare('SELECT * FROM reminder_config WHERE id = 1').get();
  res.json(config || { days_before: '7,3,1', email_enabled: 1, inapp_enabled: 1 });
});

app.put('/api/config/reminders', (req, res) => {
  const { days_before, email_enabled, inapp_enabled } = req.body;
  db.prepare(`UPDATE reminder_config SET days_before=?, email_enabled=?, inapp_enabled=? WHERE id=1`)
    .run(days_before, email_enabled ? 1 : 0, inapp_enabled ? 1 : 0);
  res.json(db.prepare('SELECT * FROM reminder_config WHERE id = 1').get());
});

// Serve built React frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message });
});

async function startup() {
  initDB();
  console.log('[DB] Database initialized');
  await syncOrdersFromTally();
  console.log('[Tally] Initial sync complete');
  startScheduler();
  console.log('[Scheduler] Started');
  app.listen(PORT, () => console.log(`[Server] http://localhost:${PORT}`));
}

startup().catch(console.error);
