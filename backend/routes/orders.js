const express = require('express');
const multer = require('multer');
const router = express.Router();
const { db } = require('../db');
const { syncOrdersFromTally } = require('../tally');
const { extractOrderFromImage } = require('../gemini');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

router.get('/', async (req, res) => {
  const { status, salesman, urgency } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const args = [];

  if (status && status !== 'all') { sql += ' AND status = ?'; args.push(status); }
  if (salesman) { sql += ' AND salesman_name LIKE ?'; args.push(`%${salesman}%`); }
  sql += ' ORDER BY delivery_deadline ASC';

  const result = await db.execute({ sql, args });
  let orders = attachDaysLeft(result.rows.map(r => ({ ...r })));
  if (urgency === 'overdue') orders = orders.filter((o) => o.daysLeft < 0);
  else if (urgency === 'today') orders = orders.filter((o) => o.daysLeft === 0);
  else if (urgency === 'week') orders = orders.filter((o) => o.daysLeft >= 0 && o.daysLeft <= 7);

  res.json(orders);
});

router.get('/:id', async (req, res) => {
  const result = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] });
  const order = result.rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...order, daysLeft: calcDaysLeft(order.delivery_deadline) });
});

router.post('/', async (req, res) => {
  const { order_number, customer_name, salesman_name, salesman_email,
          order_date, delivery_deadline, amount, status } = req.body;

  if (!customer_name || !delivery_deadline)
    return res.status(400).json({ error: 'Customer name and delivery deadline are required' });

  const tallyId = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const ins = await db.execute({
    sql: `INSERT INTO orders (tally_id, order_number, customer_name, salesman_name, salesman_email,
          order_date, delivery_deadline, amount, status, last_synced) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [
      tallyId,
      order_number || `ORD-${Date.now()}`,
      customer_name,
      salesman_name || '',
      salesman_email || '',
      order_date || new Date().toISOString().split('T')[0],
      delivery_deadline,
      parseFloat(amount) || 0,
      status || 'pending',
      now,
    ],
  });

  const orderId = Number(ins.lastInsertRowid);

  // Save line items if provided (from photo scan)
  const lineItems = Array.isArray(req.body.line_items) ? req.body.line_items : [];
  for (const item of lineItems) {
    if (!item.product_name) continue;
    await db.execute({
      sql: 'INSERT INTO order_items (order_id, product_name, quantity, amount, delivery_deadline, status) VALUES (?,?,?,?,?,?)',
      args: [
        orderId,
        String(item.product_name).trim(),
        parseFloat(item.quantity) || 1,
        parseFloat(item.amount) || 0,
        item.delivery_deadline || null,
        'pending',
      ],
    });
  }

  const created = (await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [orderId] })).rows[0];
  res.status(201).json({ ...created, daysLeft: calcDaysLeft(created.delivery_deadline) });
});

router.post('/sync', async (req, res) => {
  try {
    const count = await syncOrdersFromTally();
    res.json({ success: true, count, message: `Synced ${count} orders from Tally` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/extract', upload.any(), async (req, res) => {
  const files = req.files?.length ? req.files : [];
  if (!files.length) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const data = await extractOrderFromImage(files.map(f => ({ buffer: f.buffer, mimeType: f.mimetype })));
    res.json(data);
  } catch (err) {
    console.error('[Extract] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { order_number, customer_name, salesman_name, salesman_email,
          order_date, delivery_deadline, amount, status } = req.body;

  if (!customer_name || !delivery_deadline)
    return res.status(400).json({ error: 'Customer name and delivery deadline are required' });

  await db.execute({
    sql: `UPDATE orders SET order_number=?, customer_name=?, salesman_name=?, salesman_email=?,
          order_date=?, delivery_deadline=?, amount=?, status=? WHERE id=?`,
    args: [order_number, customer_name, salesman_name, salesman_email,
           order_date, delivery_deadline, parseFloat(amount) || 0, status, req.params.id],
  });

  const updated = (await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...updated, daysLeft: calcDaysLeft(updated.delivery_deadline) });
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'shipped', 'completed', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  await db.execute({ sql: 'UPDATE orders SET status = ? WHERE id = ?', args: [status, req.params.id] });
  const updated = (await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...updated, daysLeft: calcDaysLeft(updated.delivery_deadline) });
});

// PATCH /orders/:id/complete — mark completed with optional proof photos
router.patch('/:id/complete', upload.any(), async (req, res) => {
  const files = req.files || [];
  const proofImages = files.map(f => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`);
  const proofJson = proofImages.length ? JSON.stringify(proofImages) : null;

  await db.execute({
    sql: 'UPDATE orders SET status=?, proof_images=COALESCE(?,proof_images) WHERE id=?',
    args: ['completed', proofJson, req.params.id],
  });
  const updated = (await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...updated, daysLeft: calcDaysLeft(updated.delivery_deadline) });
});

// GET /orders/:id/proof/:index — serve one proof image
router.get('/:id/proof/:index', async (req, res) => {
  const result = await db.execute({ sql: 'SELECT proof_images FROM orders WHERE id=?', args: [req.params.id] });
  const row = result.rows[0];
  if (!row?.proof_images) return res.status(404).json({ error: 'No proof uploaded' });
  const images = JSON.parse(row.proof_images);
  const img = images[parseInt(req.params.index, 10)];
  if (!img) return res.status(404).json({ error: 'Image not found' });
  const [meta, data] = img.split(',');
  const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  res.set('Content-Type', mimeType);
  res.send(Buffer.from(data, 'base64'));
});

router.delete('/:id', async (req, res) => {
  const result = await db.execute({ sql: 'DELETE FROM orders WHERE id = ?', args: [req.params.id] });
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true });
});

module.exports = router;
