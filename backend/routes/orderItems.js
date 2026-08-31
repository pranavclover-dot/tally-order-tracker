const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const { db } = require('../db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.get('/', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
    args: [req.params.id],
  });
  // Don't send full base64 in list — just indicate if proof exists
  const rows = result.rows.map(r => ({
    ...r,
    has_proof: !!r.proof_image,
    proof_image: undefined,
  }));
  res.json(rows);
});

// GET proof image for a specific item
router.get('/:itemId/proof', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT proof_image FROM order_items WHERE id = ? AND order_id = ?',
    args: [req.params.itemId, req.params.id],
  });
  const item = result.rows[0];
  if (!item?.proof_image) return res.status(404).json({ error: 'No proof uploaded' });
  const [meta, data] = item.proof_image.split(',');
  const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  res.set('Content-Type', mimeType);
  res.send(Buffer.from(data, 'base64'));
});

router.post('/', async (req, res) => {
  const { product_name, quantity, amount, delivery_deadline } = req.body;
  if (!product_name) return res.status(400).json({ error: 'Product name is required' });

  const ins = await db.execute({
    sql: 'INSERT INTO order_items (order_id, product_name, quantity, amount, delivery_deadline, status) VALUES (?,?,?,?,?,?)',
    args: [req.params.id, product_name, parseFloat(quantity) || 1, parseFloat(amount) || 0, delivery_deadline || null, 'pending'],
  });
  const created = (await db.execute({ sql: 'SELECT id,order_id,product_name,quantity,amount,delivery_deadline,status,dispatched_at FROM order_items WHERE id = ?', args: [Number(ins.lastInsertRowid)] })).rows[0];
  res.status(201).json({ ...created, has_proof: false });
});

// PATCH mark dispatched with optional proof photo
router.patch('/:itemId/dispatch', upload.single('proof'), async (req, res) => {
  let proofData = null;
  if (req.file) {
    const b64 = req.file.buffer.toString('base64');
    proofData = `data:${req.file.mimetype};base64,${b64}`;
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE order_items SET status=?, dispatched_at=?, proof_image=COALESCE(?,proof_image) WHERE id=? AND order_id=?',
    args: ['dispatched', now, proofData, req.params.itemId, req.params.id],
  });

  const updated = (await db.execute({
    sql: 'SELECT id,order_id,product_name,quantity,amount,delivery_deadline,status,dispatched_at FROM order_items WHERE id=?',
    args: [req.params.itemId],
  })).rows[0];
  if (!updated) return res.status(404).json({ error: 'Item not found' });
  res.json({ ...updated, has_proof: !!proofData });
});

// PATCH revert to pending
router.patch('/:itemId/revert', async (req, res) => {
  await db.execute({
    sql: 'UPDATE order_items SET status=?, dispatched_at=NULL, proof_image=NULL WHERE id=? AND order_id=?',
    args: ['pending', req.params.itemId, req.params.id],
  });
  const updated = (await db.execute({
    sql: 'SELECT id,order_id,product_name,quantity,amount,delivery_deadline,status,dispatched_at FROM order_items WHERE id=?',
    args: [req.params.itemId],
  })).rows[0];
  res.json({ ...updated, has_proof: false });
});

router.put('/:itemId', async (req, res) => {
  const { product_name, quantity, amount, delivery_deadline } = req.body;
  if (!product_name) return res.status(400).json({ error: 'Product name is required' });

  await db.execute({
    sql: 'UPDATE order_items SET product_name=?, quantity=?, amount=?, delivery_deadline=? WHERE id=? AND order_id=?',
    args: [product_name, parseFloat(quantity) || 1, parseFloat(amount) || 0, delivery_deadline || null, req.params.itemId, req.params.id],
  });
  const updated = (await db.execute({ sql: 'SELECT * FROM order_items WHERE id=?', args: [req.params.itemId] })).rows[0];
  res.json({ ...updated, has_proof: !!updated.proof_image, proof_image: undefined });
});

router.delete('/:itemId', async (req, res) => {
  const result = await db.execute({
    sql: 'DELETE FROM order_items WHERE id = ? AND order_id = ?',
    args: [req.params.itemId, req.params.id],
  });
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

module.exports = router;
