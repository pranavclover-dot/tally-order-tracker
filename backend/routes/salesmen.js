const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', async (req, res) => {
  const result = await db.execute('SELECT * FROM salesmen ORDER BY name');
  const withCounts = await Promise.all(result.rows.map(async (s) => {
    const active = await db.execute({
      sql: "SELECT COUNT(*) as count FROM orders WHERE salesman_name = ? AND status != 'completed'",
      args: [s.name],
    });
    return { ...s, activeOrders: Number(active.rows[0].count) };
  }));
  res.json(withCounts);
});

router.post('/', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  try {
    const ins = await db.execute({
      sql: 'INSERT INTO salesmen (name, email, phone) VALUES (?, ?, ?)',
      args: [name, email, phone || null],
    });
    const created = (await db.execute({ sql: 'SELECT * FROM salesmen WHERE id = ?', args: [Number(ins.lastInsertRowid)] })).rows[0];
    res.status(201).json({ ...created });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Salesman with this name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  await db.execute({ sql: 'UPDATE salesmen SET name = ?, email = ?, phone = ? WHERE id = ?', args: [name, email, phone || null, req.params.id] });
  const updated = (await db.execute({ sql: 'SELECT * FROM salesmen WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!updated) return res.status(404).json({ error: 'Salesman not found' });
  res.json({ ...updated });
});

router.delete('/:id', async (req, res) => {
  const result = await db.execute({ sql: 'DELETE FROM salesmen WHERE id = ?', args: [req.params.id] });
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Salesman not found' });
  res.json({ success: true });
});

module.exports = router;
