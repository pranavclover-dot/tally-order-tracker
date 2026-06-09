const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', (req, res) => {
  const salesmen = db.prepare('SELECT * FROM salesmen ORDER BY name').all();
  const withCounts = salesmen.map((s) => {
    const active = db.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE salesman_name = ? AND status != 'completed'"
    ).get(s.name);
    return { ...s, activeOrders: active.count };
  });
  res.json(withCounts);
});

router.post('/', (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  try {
    const result = db.prepare('INSERT INTO salesmen (name, email, phone) VALUES (?, ?, ?)').run(name, email, phone || null);
    res.status(201).json(db.prepare('SELECT * FROM salesmen WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Salesman with this name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  db.prepare('UPDATE salesmen SET name = ?, email = ?, phone = ? WHERE id = ?').run(name, email, phone || null, req.params.id);
  const updated = db.prepare('SELECT * FROM salesmen WHERE id = ?').get(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Salesman not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM salesmen WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Salesman not found' });
  res.json({ success: true });
});

module.exports = router;
