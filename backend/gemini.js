require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const PROMPT = `You are reading a sales order document image from an Indian business (Tally ERP format).

Extract the following fields and return ONLY a valid JSON object. No explanation, no markdown.

{
  "order_number": "voucher/order/SO number (string)",
  "customer_name": "consignee / ship-to / buyer / party name (string)",
  "salesman_name": "salesman name from 'Salesman:' label (string, null if not found)",
  "order_date": "document date in YYYY-MM-DD",
  "delivery_deadline": "delivery date in YYYY-MM-DD (see rules below)",
  "amount": total order amount as a plain number,
  "line_items": [
    {
      "product_name": "item name",
      "quantity": numeric quantity,
      "amount": line item amount as plain number,
      "delivery_deadline": "per-item date YYYY-MM-DD or null"
    }
  ]
}

DELIVERY DATE RULES (priority order):
1. "Terms of Delivery" field — often "DISPATCH-07-06-2026" or "DISPATCH 07/06/2026". Format DISPATCH-DD-MM-YYYY → YYYY-MM-DD.
2. Any field labelled "Delivery Date", "Ship By", "Due Date", "Dispatch Date".
3. "Due on" column in line items table — use latest date as overall deadline.
4. If no date found, set delivery_deadline = order_date + 12 days.

DATE FORMAT: Indian DD-MM-YYYY or DD/MM/YYYY (day first). e.g. "07-06-2026" → 2026-06-07.

AMOUNT: Final total (bottom right, "Total" or "INR ... Only"). Plain number: 26387 not "₹26,387".

LINE ITEMS: Extract all product rows. Empty array [] if no table exists.

Return ONLY the JSON object. No other text.`;

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function extractOrderFromImage(files) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set in environment');

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const fileList = Array.isArray(files) ? files : [files];
  const imageParts = fileList.slice(0, 5).map(({ buffer, mimeType }) => ({
    inlineData: {
      data: buffer.toString('base64'),
      mimeType: mimeType || 'image/jpeg',
    },
  }));

  const result = await model.generateContent([PROMPT, ...imageParts]);
  const raw = result.response.text().trim();
  console.log('[Gemini] raw response (first 300):', raw.slice(0, 300));

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Could not parse order data from image. Model replied: ${raw.slice(0, 200)}`);

  const data = JSON.parse(match[0]);

  if (!data.delivery_deadline && data.order_date) {
    data.delivery_deadline = addDays(data.order_date, 12);
  } else if (!data.delivery_deadline) {
    data.delivery_deadline = addDays(new Date().toISOString().split('T')[0], 12);
  }

  return data;
}

module.exports = { extractOrderFromImage };
