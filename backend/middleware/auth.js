require('dotenv').config();

function getToken() {
  const user = process.env.APP_USERNAME || 'admin';
  const pass = process.env.APP_PASSWORD || 'admin123';
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (header.slice(7) !== getToken()) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  next();
}

module.exports = { authMiddleware, getToken };
