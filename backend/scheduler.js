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

// ── Deadline reminders ───────────────────────────────────────────────────────
function checkDeadlines() {
  const config = db.prepare('SELECT * FROM reminder_config WHERE id = 1').get();
  if (!config) return;

  const thresholds = config.days_before
    .split(',').map(d => parseInt(d.trim(), 10))
    .filter(d => !isNaN(d) && d >= 0)
    .sort((a, b) => b - a);

  const orders = db.prepare("SELECT * FROM orders WHERE status = 'pending'").all();

  for (const order of orders) {
    const daysLeft = getDaysLeft(order.delivery_deadline);
    const message = buildMessage(order, daysLeft);

    for (const threshold of thresholds) {
      if (daysLeft <= threshold) {
        if (config.inapp_enabled) {
          const exists = db.prepare(
            "SELECT id FROM notifications WHERE order_id=? AND days_before_deadline=? AND type='in-app'"
          ).get(order.id, threshold);
          if (!exists) {
            db.prepare(`INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,'in-app',?,?,0)`)
              .run(order.id, order.salesman_name, order.salesman_email, message, threshold, new Date().toISOString());
            console.log(`[Scheduler] In-app deadline: ${order.order_number} (≤${threshold}d, ${daysLeft}d left)`);
          }
        }
        if (config.email_enabled) {
          const exists = db.prepare(
            "SELECT id FROM notifications WHERE order_id=? AND days_before_deadline=? AND type='email'"
          ).get(order.id, threshold);
          if (!exists) {
            sendReminderEmail(order.salesman_email, order.salesman_name, order, daysLeft)
              .then(() => {
                db.prepare(`INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,'email',?,?,0)`)
                  .run(order.id, order.salesman_name, order.salesman_email, message, threshold, new Date().toISOString());
                console.log(`[Scheduler] Email: ${order.order_number} → ${order.salesman_email}`);
              })
              .catch(err => console.error(`[Scheduler] Email failed ${order.order_number}:`, err.message));
          }
        }
      }
    }
  }
}

// ── 7-day customer follow-up reminders ──────────────────────────────────────
function checkFollowUpReminders() {
  // Pending orders placed 7+ days ago with no follow-up notification yet
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'pending'").all();

  for (const order of orders) {
    const daysSince = getDaysSince(order.order_date);
    if (daysSince < 7) continue;

    const exists = db.prepare(
      "SELECT id FROM notifications WHERE order_id=? AND type='follow-up'"
    ).get(order.id);

    if (!exists) {
      const message = `Follow-up: Check with ${order.customer_name} on Order ${order.order_number} — placed ${daysSince} day(s) ago, no update yet`;
      db.prepare(`INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,'follow-up',7,?,0)`)
        .run(order.id, order.salesman_name, order.salesman_email, message, new Date().toISOString());
      console.log(`[Scheduler] Follow-up reminder: ${order.order_number} (${daysSince}d since order)`);
    }
  }
}

function startScheduler() {
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Hourly run');
    await syncOrdersFromTally();
    checkDeadlines();
    checkFollowUpReminders();
  });

  setTimeout(() => {
    console.log('[Scheduler] Initial check...');
    checkDeadlines();
    checkFollowUpReminders();
  }, 2000);
}

module.exports = { startScheduler };
