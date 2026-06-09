require('dotenv').config();
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass || user === 'your@gmail.com') {
    console.warn('[Mailer] Gmail credentials not configured — email notifications disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return transporter;
}

function getUrgencyColor(daysLeft) {
  if (daysLeft <= 0) return '#dc2626';
  if (daysLeft <= 1) return '#dc2626';
  if (daysLeft <= 3) return '#ea580c';
  return '#ca8a04';
}

function getUrgencyLabel(daysLeft) {
  if (daysLeft < 0) return `OVERDUE by ${Math.abs(daysLeft)} day(s)`;
  if (daysLeft === 0) return 'DUE TODAY';
  if (daysLeft === 1) return 'DUE TOMORROW';
  return `Due in ${daysLeft} days`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildEmailHTML(salesmanName, order, daysLeft) {
  const color = getUrgencyColor(daysLeft);
  const label = getUrgencyLabel(daysLeft);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Order Deadline Reminder</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${color};padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
              ⚠ Order Deadline Reminder
            </h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">${label}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#374151;">
              Dear <strong>${salesmanName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
              This is a reminder that the following order requires your immediate attention:
            </p>
            <!-- Order Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="6" cellspacing="0">
                    <tr>
                      <td style="color:#6b7280;font-size:13px;width:40%;">Order Number</td>
                      <td style="color:#111827;font-size:14px;font-weight:600;">${order.order_number}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;">Customer</td>
                      <td style="color:#111827;font-size:14px;font-weight:600;">${order.customer_name}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;">Order Date</td>
                      <td style="color:#111827;font-size:14px;">${formatDate(order.order_date)}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;">Delivery Deadline</td>
                      <td style="color:${color};font-size:14px;font-weight:700;">${formatDate(order.delivery_deadline)}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;">Order Amount</td>
                      <td style="color:#111827;font-size:14px;font-weight:600;">${formatINR(order.amount)}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;">Status</td>
                      <td style="color:#111827;font-size:14px;text-transform:capitalize;">${order.status}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- CTA -->
            <div style="background:${color};border-radius:6px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;color:#ffffff;font-size:15px;font-weight:600;">
                📦 Please initiate the shipping process immediately to ensure on-time delivery.
              </p>
            </div>
            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
              If this order has already been processed, please update its status in the Order Tracker system.
            </p>
            <p style="margin:0;font-size:14px;color:#6b7280;">
              For any queries, please contact your manager.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              This is an automated reminder from the Order Tracker system. Please do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendReminderEmail(to, salesmanName, order, daysLeft) {
  const t = getTransporter();
  if (!t) return;

  const label = getUrgencyLabel(daysLeft);
  const subject = `[Order Tracker] ${label} — ${order.order_number} | ${order.customer_name}`;

  await t.sendMail({
    from: `"Order Tracker" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html: buildEmailHTML(salesmanName, order, daysLeft),
  });
}

module.exports = { sendReminderEmail };
