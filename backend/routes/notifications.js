const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', (req, res) => {
  const { filter } = req.query;
  let query = 'SELECT n.*, o.order_number FROM notifications n LEFT JOIN orders o ON n.order_id = o.id';
  if (filter === 'unread') query += ' WHERE n.is_read = 0';
  else if (filter === 'read') query += ' WHERE n.is_read = 1';
  query += ' ORDER BY n.is_read ASC, n.sent_at DESC';
  res.json(db.prepare(query).all());
});

router.get('/unread-count', (req, res) => {
  const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get();
  res.json({ count: result.count });
});

// Must be declared before /:id to avoid "read-all" being matched as an id
router.patch('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1').run();
  res.json({ success: true });
});

router.patch('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  const n = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  res.json(n);
});

module.exports = router;
