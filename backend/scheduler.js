const cron = require('node-cron');
const { db } = require('./db');
const { syncOrdersFromTally } = require('./tally');
const { sendReminderEmail } = require('./mailer');

function getDaysLeft(deadlineStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(deadlineStr); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

function getDaysSince(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((today - d) / 86400000);
}

function buildMessage(order, daysLeft) {
  if (daysLeft < 0) return `OVERDUE: Order ${order.order_number} for ${order.customer_name} was due ${Math.abs(daysLeft)} day(s) ago`;
  if (daysLeft === 0) return `URGENT: Order ${order.order_number} for ${order.customer_name} is due TODAY`;
  return `Reminder: Order ${order.order_number} for ${order.customer_name} is due in ${daysLeft} day(s)`;
}

async function checkDeadlines() {
  const configResult = await db.execute('SELECT * FROM reminder_config WHERE id = 1');
  const config = configResult.rows[0];
  if (!config) return;

  const thresholds = String(config.days_before)
    .split(',').map(d => parseInt(d.trim(), 10))
    .filter(d => !isNaN(d) && d >= 0)
    .sort((a, b) => b - a);

  const ordersResult = await db.execute("SELECT * FROM orders WHERE status = 'pending'");

  for (const order of ordersResult.rows) {
    const daysLeft = getDaysLeft(order.delivery_deadline);
    const message = buildMessage(order, daysLeft);

    for (const threshold of thresholds) {
      if (daysLeft <= threshold) {
        if (config.inapp_enabled) {
          const exists = (await db.execute({
            sql: "SELECT id FROM notifications WHERE order_id=? AND days_before_deadline=? AND type='in-app'",
            args: [order.id, threshold],
          })).rows[0];
          if (!exists) {
            await db.execute({
              sql: `INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,'in-app',?,?,0)`,
              args: [order.id, order.salesman_name, order.salesman_email, message, threshold, new Date().toISOString()],
            });
            console.log(`[Scheduler] In-app: ${order.order_number} (≤${threshold}d)`);
          }
        }
        if (config.email_enabled) {
          const exists = (await db.execute({
            sql: "SELECT id FROM notifications WHERE order_id=? AND days_before_deadline=? AND type='email'",
            args: [order.id, threshold],
          })).rows[0];
          if (!exists) {
            sendReminderEmail(order.salesman_email, order.salesman_name, order, daysLeft)
              .then(async () => {
                await db.execute({
                  sql: `INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,'email',?,?,0)`,
                  args: [order.id, order.salesman_name, order.salesman_email, message, threshold, new Date().toISOString()],
                });
                console.log(`[Scheduler] Email: ${order.order_number} → ${order.salesman_email}`);
              })
              .catch(err => console.error(`[Scheduler] Email failed ${order.order_number}:`, err.message));
          }
        }
      }
    }
  }
}

async function checkFollowUpReminders() {
  const ordersResult = await db.execute("SELECT * FROM orders WHERE status = 'pending'");

  for (const order of ordersResult.rows) {
    const daysSince = getDaysSince(order.order_date);
    if (daysSince < 7) continue;

    const exists = (await db.execute({
      sql: "SELECT id FROM notifications WHERE order_id=? AND type='follow-up'",
      args: [order.id],
    })).rows[0];

    if (!exists) {
      const message = `Follow-up: Check with ${order.customer_name} on Order ${order.order_number} — placed ${daysSince} day(s) ago`;
      await db.execute({
        sql: `INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,'follow-up',7,?,0)`,
        args: [order.id, order.salesman_name, order.salesman_email, message, new Date().toISOString()],
      });
      console.log(`[Scheduler] Follow-up: ${order.order_number} (${daysSince}d since order)`);
    }
  }
}

function startScheduler() {
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Hourly run');
    await syncOrdersFromTally();
    await checkDeadlines();
    await checkFollowUpReminders();
  });

  setTimeout(async () => {
    console.log('[Scheduler] Initial check...');
    await checkDeadlines();
    await checkFollowUpReminders();
  }, 2000);
}

module.exports = { startScheduler };
