require('dotenv').config();
const express = require('express');
const router = express.Router();
const { getToken } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.APP_USERNAME || 'admin';
  const expectedPass = process.env.APP_PASSWORD || 'admin123';

  if (username === expectedUser && password === expectedPass) {
    res.json({ token: getToken(), username });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

module.exports = router;
