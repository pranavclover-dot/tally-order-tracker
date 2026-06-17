const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', async (req, res) => {
  const { filter } = req.query;
  let sql = 'SELECT n.*, o.order_number FROM notifications n LEFT JOIN orders o ON n.order_id = o.id';
  if (filter === 'unread') sql += ' WHERE n.is_read = 0';
  else if (filter === 'read') sql += ' WHERE n.is_read = 1';
  sql += ' ORDER BY n.is_read ASC, n.sent_at DESC';
  const result = await db.execute(sql);
  res.json(result.rows.map(r => ({ ...r })));
});

router.get('/unread-count', async (req, res) => {
  const result = await db.execute('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');
  res.json({ count: Number(result.rows[0].count) });
});

router.patch('/read-all', async (req, res) => {
  await db.execute('UPDATE notifications SET is_read = 1');
  res.json({ success: true });
});

router.patch('/:id/read', async (req, res) => {
  await db.execute({ sql: 'UPDATE notifications SET is_read = 1 WHERE id = ?', args: [req.params.id] });
  const result = await db.execute({ sql: 'SELECT * FROM notifications WHERE id = ?', args: [req.params.id] });
  const n = result.rows[0];
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  res.json({ ...n });
});

module.exports = router;
