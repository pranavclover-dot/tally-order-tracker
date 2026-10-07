const cron = require('node-cron');
const { db } = require('./db');
const { syncOrdersFromTally } = require('./tally');
const { sendReminderEmail, sendManagerOverdueEmail, sendNtfy, salesmanNtfyTopic, sendPushToAll, sendPushToSalesman } = require('./mailer');

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

            // ntfy to salesman's personal topic (e.g. clover-ankita)
            const ntfyTopic = salesmanNtfyTopic(order.salesman_name);
            if (ntfyTopic) sendNtfy(ntfyTopic, 'Order Tracker Alert', message);

            // Ashish gets notified when order is overdue by more than 3 days
            if (daysLeft < -3) sendNtfy('clover-ashish', '⚠ Order Overdue 3+ Days', message);

            // Web push — salesman-targeted, falls back to all
            sendPushToSalesman(
              order.salesman_name,
              `Order Tracker — ${daysLeft <= 0 ? 'OVERDUE' : `${daysLeft}d left`}`,
              message
            ).catch(() => {});
          }
        }
      }
    }
  }
}

async function checkManagerOverdue() {
  const ordersResult = await db.execute("SELECT * FROM orders WHERE status = 'pending'");
  for (const order of ordersResult.rows) {
    const daysLeft = getDaysLeft(order.delivery_deadline);

    // Due today
    if (daysLeft === 0) {
      const exists = (await db.execute({
        sql: "SELECT id FROM notifications WHERE order_id=? AND type='manager-due-today'",
        args: [order.id],
      })).rows[0];
      if (!exists) {
        const message = `DUE TODAY: Order ${order.order_number} for ${order.customer_name} — Salesman: ${order.salesman_name}`;
        await db.execute({
          sql: `INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,'manager-due-today',0,?,0)`,
          args: [order.id, 'Manager', process.env.MANAGER_EMAIL || '', message, new Date().toISOString()],
        });
        sendManagerOverdueEmail(order, 0)
          .then(() => console.log(`[Scheduler] Manager due-today email: ${order.order_number}`))
          .catch(err => console.error(`[Scheduler] Manager due-today email failed ${order.order_number}:`, err.message));
        if (process.env.NTFY_TOPIC) sendNtfy(process.env.NTFY_TOPIC, '📦 Order Due TODAY', message);
        sendPushToSalesman(order.salesman_name, '📦 Order Due TODAY', `Order ${order.order_number} for ${order.customer_name} is due today`).catch(() => {});
      }
    }

    // Overdue
    if (daysLeft < 0) {
      const daysOverdue = Math.abs(daysLeft);
      const exists = (await db.execute({
        sql: "SELECT id FROM notifications WHERE order_id=? AND type='manager-overdue'",
        args: [order.id],
      })).rows[0];
      if (!exists) {
        const message = `OVERDUE: Order ${order.order_number} for ${order.customer_name} is ${daysOverdue} day(s) overdue`;
        await db.execute({
          sql: `INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,'manager-overdue',0,?,0)`,
          args: [order.id, 'Manager', process.env.MANAGER_EMAIL || '', message, new Date().toISOString()],
        });
        sendManagerOverdueEmail(order, daysOverdue)
          .then(() => console.log(`[Scheduler] Manager overdue email: ${order.order_number}`))
          .catch(err => console.error(`[Scheduler] Manager email failed ${order.order_number}:`, err.message));
        if (process.env.NTFY_TOPIC) sendNtfy(process.env.NTFY_TOPIC, '⚠ OVERDUE Order', `Order ${order.order_number} for ${order.customer_name} is ${daysOverdue} day(s) overdue — Salesman: ${order.salesman_name}`);
      }
    }
  }
}

async function checkSalesManagerReminders() {
  // Anoop and Shani get notified 1 day before AND on the day of deadline
  const managersResult = await db.execute(
    "SELECT name, email FROM salesmen WHERE (name LIKE '%Anoop%' OR name LIKE '%Shani%') AND email IS NOT NULL AND email != ''"
  );
  const managers = managersResult.rows;
  if (managers.length === 0) return;

  const ordersResult = await db.execute("SELECT * FROM orders WHERE status = 'pending'");
  for (const order of ordersResult.rows) {
    const daysLeft = getDaysLeft(order.delivery_deadline);
    if (daysLeft !== 1 && daysLeft !== 0) continue;

    const type = daysLeft === 0 ? 'sales-mgr-today' : 'sales-mgr-1day';
    const daysLabel = daysLeft === 0 ? 'due TODAY' : 'due tomorrow';
    const ntfyTitle = daysLeft === 0 ? 'Order Due TODAY' : 'Order Due Tomorrow';

    for (const mgr of managers) {
      const exists = (await db.execute({
        sql: 'SELECT id FROM notifications WHERE order_id=? AND type=? AND salesman_email=?',
        args: [order.id, type, mgr.email],
      })).rows[0];

      if (!exists) {
        const message = `Order ${order.order_number} for ${order.customer_name} is ${daysLabel} — Salesman: ${order.salesman_name}`;
        await db.execute({
          sql: `INSERT INTO notifications (order_id,salesman_name,salesman_email,message,type,days_before_deadline,sent_at,is_read) VALUES (?,?,?,?,?,?,?,0)`,
          args: [order.id, mgr.name, mgr.email, message, type, daysLeft, new Date().toISOString()],
        });
        sendReminderEmail(mgr.email, mgr.name, order, daysLeft)
          .then(() => console.log(`[Scheduler] Sales mgr ${type} email: ${order.order_number} → ${mgr.email}`))
          .catch(err => console.error(`[Scheduler] Sales mgr email failed ${order.order_number}:`, err.message));
        sendNtfy(salesmanNtfyTopic(mgr.name), ntfyTitle, message);
        sendPushToSalesman(mgr.name, ntfyTitle, message).catch(() => {});
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
  cron.schedule('30 11 * * *', async () => {
    console.log('[Scheduler] Daily 11:30 AM run');
    await syncOrdersFromTally();
    await checkDeadlines();
    await checkManagerOverdue();
    await checkSalesManagerReminders();
    await checkFollowUpReminders();
  }, { timezone: 'Asia/Kolkata' });

  setTimeout(async () => {
    console.log('[Scheduler] Initial check...');
    await checkDeadlines();
    await checkManagerOverdue();
    await checkSalesManagerReminders();
    await checkFollowUpReminders();
  }, 2000);
}

async function runNow() {
  console.log('[Scheduler] Manual trigger — running all checks now');
  await checkDeadlines();
  await checkManagerOverdue();
  await checkSalesManagerReminders();
}

module.exports = { startScheduler, runNow };
