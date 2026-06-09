const express = require('express');
const multer = require('multer');
const router = express.Router();
const { db } = require('../db');
const { syncOrdersFromTally } = require('../tally');
const { extractOrderFromImage } = require('../gemini');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

function calcDaysLeft(deadlineStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline - today) / (1000 * 60 * 60 * 24));
}

function attachDaysLeft(orders) {
  return orders.map((o) => ({ ...o, daysLeft: calcDaysLeft(o.delivery_deadline) }));
}

// ── GET all orders ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status, salesman, urgency } = req.query;
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status && status !== 'all') { query += ' AND status = ?'; params.push(status); }
  if (salesman) { query += ' AND salesman_name LIKE ?'; params.push(`%${salesman}%`); }
  query += ' ORDER BY delivery_deadline ASC';

  let orders = attachDaysLeft(db.prepare(query).all(...params));
  if (urgency === 'overdue') orders = orders.filter((o) => o.daysLeft < 0);
  else if (urgency === 'today') orders = orders.filter((o) => o.daysLeft === 0);
  else if (urgency === 'week') orders = orders.filter((o) => o.daysLeft >= 0 && o.daysLeft <= 7);

  res.json(orders);
});

// ── GET single order ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...order, daysLeft: calcDaysLeft(order.delivery_deadline) });
});

// ── POST create order manually ──────────────────────────────────────────────
router.post('/', (req, res) => {
  const { order_number, customer_name, salesman_name, salesman_email,
          order_date, delivery_deadline, amount, status } = req.body;

  if (!customer_name || !delivery_deadline) {
    return res.status(400).json({ error: 'Customer name and delivery deadline are required' });
  }

  const tallyId = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO orders
      (tally_id, order_number, customer_name, salesman_name, salesman_email,
       order_date, delivery_deadline, amount, status, last_synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tallyId,
    order_number || `ORD-${Date.now()}`,
    customer_name,
    salesman_name || '',
    salesman_email || '',
    order_date || new Date().toISOString().split('T')[0],
    delivery_deadline,
    parseFloat(amount) || 0,
    status || 'pending',
    now
  );

  const created = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...created, daysLeft: calcDaysLeft(created.delivery_deadline) });
});

// ── POST sync from Tally ────────────────────────────────────────────────────
router.post('/sync', async (req, res) => {
  try {
    const count = await syncOrdersFromTally();
    res.json({ success: true, count, message: `Synced ${count} orders from Tally` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST extract order from image ───────────────────────────────────────────
router.post('/extract', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    const data = await extractOrderFromImage(req.file.buffer, req.file.mimetype);
    res.json(data);
  } catch (err) {
    console.error('[Gemini] Extract error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT update order ────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const { order_number, customer_name, salesman_name, salesman_email,
          order_date, delivery_deadline, amount, status } = req.body;

  if (!customer_name || !delivery_deadline) {
    return res.status(400).json({ error: 'Customer name and delivery deadline are required' });
  }

  db.prepare(`
    UPDATE orders SET
      order_number = ?, customer_name = ?, salesman_name = ?, salesman_email = ?,
      order_date = ?, delivery_deadline = ?, amount = ?, status = ?
    WHERE id = ?
  `).run(order_number, customer_name, salesman_name, salesman_email,
         order_date, delivery_deadline, parseFloat(amount) || 0, status, req.params.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...updated, daysLeft: calcDaysLeft(updated.delivery_deadline) });
});

// ── PATCH update status ─────────────────────────────────────────────────────
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'shipped', 'completed', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...updated, daysLeft: calcDaysLeft(updated.delivery_deadline) });
});

// ── DELETE order ────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true });
});

module.exports = router;
