require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB, db } = require('./db');
const { syncOrdersFromTally } = require('./tally');
const { startScheduler } = require('./scheduler');

const authRouter = require('./routes/auth');
const ordersRouter = require('./routes/orders');
const orderItemsRouter = require('./routes/orderItems');
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
app.use('/api/orders/:id/items', orderItemsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/salesmen', salesmenRouter);

app.get('/api/config/reminders', async (req, res) => {
  const result = await db.execute('SELECT * FROM reminder_config WHERE id = 1');
  res.json(result.rows[0] || { days_before: '7,3,1', email_enabled: 1, inapp_enabled: 1 });
});

app.put('/api/config/reminders', async (req, res) => {
  const { days_before, email_enabled, inapp_enabled } = req.body;
  await db.execute({
    sql: 'UPDATE reminder_config SET days_before=?, email_enabled=?, inapp_enabled=? WHERE id=1',
    args: [days_before, email_enabled ? 1 : 0, inapp_enabled ? 1 : 0],
  });
  const result = await db.execute('SELECT * FROM reminder_config WHERE id = 1');
  res.json(result.rows[0]);
});

// Send a test reminder email
app.post('/api/test-email', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Email address required' });
  try {
    const { sendReminderEmail } = require('./mailer');
    const fakeOrder = {
      order_number: 'TEST-001',
      customer_name: 'Test Customer',
      order_date: new Date().toISOString().split('T')[0],
      delivery_deadline: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      amount: 50000,
      status: 'pending',
    };
    await sendReminderEmail(to, 'Pranav', fakeOrder, 2);
    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Frontend is served separately on Vercel — no static serving needed here

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message });
});

async function startup() {
  await initDB();
  console.log('[DB] Database initialized');
  await syncOrdersFromTally();
  console.log('[Tally] Initial sync complete');
  startScheduler();
  console.log('[Scheduler] Started');
  app.listen(PORT, () => console.log(`[Server] http://localhost:${PORT}`));
}

startup().catch(console.error);
