const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'orders.db'));

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
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
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      salesman_name TEXT,
      salesman_email TEXT,
      message TEXT,
      type TEXT,
      days_before_deadline INTEGER,
      sent_at TEXT,
      is_read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS salesmen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      email TEXT,
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS reminder_config (
      id INTEGER PRIMARY KEY,
      days_before TEXT DEFAULT '7,3,1',
      email_enabled INTEGER DEFAULT 1,
      inapp_enabled INTEGER DEFAULT 1
    );
  `);

  const config = db.prepare('SELECT id FROM reminder_config WHERE id = 1').get();
  if (!config) {
    db.prepare('INSERT INTO reminder_config (id, days_before, email_enabled, inapp_enabled) VALUES (1, ?, 1, 1)')
      .run('7,3,1');
  }
}

module.exports = { db, initDB };
