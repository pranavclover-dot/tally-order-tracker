const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../db');

// GET all items for an order
router.get('/', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
    args: [req.params.id],
  });
  res.json(result.rows.map(r => ({ ...r })));
});

// POST add item to order
router.post('/', async (req, res) => {
  const { product_name, quantity, amount, delivery_deadline } = req.body;
  if (!product_name) return res.status(400).json({ error: 'Product name is required' });

  const ins = await db.execute({
    sql: 'INSERT INTO order_items (order_id, product_name, quantity, amount, delivery_deadline, status) VALUES (?,?,?,?,?,?)',
    args: [req.params.id, product_name, parseFloat(quantity) || 1, parseFloat(amount) || 0, delivery_deadline || null, 'pending'],
  });
  const created = (await db.execute({ sql: 'SELECT * FROM order_items WHERE id = ?', args: [Number(ins.lastInsertRowid)] })).rows[0];
  res.status(201).json({ ...created });
});

// PATCH update item status
router.patch('/:itemId/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'shipped', 'completed'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  await db.execute({
    sql: 'UPDATE order_items SET status = ? WHERE id = ? AND order_id = ?',
    args: [status, req.params.itemId, req.params.id],
  });
  const updated = (await db.execute({ sql: 'SELECT * FROM order_items WHERE id = ?', args: [req.params.itemId] })).rows[0];
  if (!updated) return res.status(404).json({ error: 'Item not found' });
  res.json({ ...updated });
});

// PUT update item
router.put('/:itemId', async (req, res) => {
  const { product_name, quantity, amount, delivery_deadline } = req.body;
  if (!product_name) return res.status(400).json({ error: 'Product name is required' });

  await db.execute({
    sql: 'UPDATE order_items SET product_name=?, quantity=?, amount=?, delivery_deadline=? WHERE id=? AND order_id=?',
    args: [product_name, parseFloat(quantity) || 1, parseFloat(amount) || 0, delivery_deadline || null, req.params.itemId, req.params.id],
  });
  const updated = (await db.execute({ sql: 'SELECT * FROM order_items WHERE id = ?', args: [req.params.itemId] })).rows[0];
  res.json({ ...updated });
});

// DELETE item
router.delete('/:itemId', async (req, res) => {
  const result = await db.execute({
    sql: 'DELETE FROM order_items WHERE id = ? AND order_id = ?',
    args: [req.params.itemId, req.params.id],
  });
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

module.exports = router;
