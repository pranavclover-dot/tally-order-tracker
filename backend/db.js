const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_URL || 'file:orders.db',
  authToken: process.env.TURSO_TOKEN,
});

async function initDB() {
  await db.execute(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tally_id TEXT UNIQUE,
    order_number TEXT,
    customer_name TEXT,
    salesman_name TEXT,
    salesman_email TEXT,
    order_date TEXT,
    delivery_deadline TEXT,
    amount REAL,
    status TEXT DEFAULT 'pending',
    last_synced TEXT
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    salesman_name TEXT,
    salesman_email TEXT,
    message TEXT,
    type TEXT,
    days_before_deadline INTEGER,
    sent_at TEXT,
    is_read INTEGER DEFAULT 0
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS salesmen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    email TEXT,
    phone TEXT
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS reminder_config (
    id INTEGER PRIMARY KEY,
    days_before TEXT DEFAULT '7,3,1',
    email_enabled INTEGER DEFAULT 1,
    inapp_enabled INTEGER DEFAULT 1
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    amount REAL DEFAULT 0,
    delivery_deadline TEXT,
    status TEXT DEFAULT 'pending'
  )`);

  const result = await db.execute('SELECT id FROM reminder_config WHERE id = 1');
  if (result.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO reminder_config (id, days_before, email_enabled, inapp_enabled) VALUES (1, ?, 1, 1)',
      args: ['7,3,1'],
    });
  }
}

module.exports = { db, initDB };
