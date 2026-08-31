require('dotenv').config();
const Groq = require('groq-sdk');

const PROMPT = `You are reading a sales order document image, likely from an Indian business (Tally ERP format).

Extract the following fields and return ONLY a valid JSON object. No explanation, no markdown.

{
  "order_number": "voucher number / order number / SO number (string)",
  "customer_name": "consignee / ship-to / buyer / party name (string)",
  "salesman_name": "salesman name — look for 'Salesman:' label (string, null if not found)",
  "order_date": "the document/voucher date in YYYY-MM-DD format",
  "delivery_deadline": "delivery date in YYYY-MM-DD format — see rules below",
  "amount": total invoice/order amount as a plain number, no currency symbols or commas
}

DELIVERY DATE RULES (in priority order):
1. Look for a field called "Terms of Delivery" — it often contains a date like "DISPATCH-07-06-2026" or "DISPATCH 07/06/2026". Extract that date. Format "DISPATCH-DD-MM-YYYY" means day=DD, month=MM, year=YYYY → output as YYYY-MM-DD.
2. Look for any field labelled "Delivery Date", "Ship By", "Due Date", "Dispatch Date".
3. In line items, look for a "Due on" column with a date.
4. If absolutely no delivery date is found anywhere, set delivery_deadline to order_date + 12 days.

DATE FORMAT RULES:
- Indian format DD-MM-YYYY or DD/MM/YYYY: day first, then month, then year.
  e.g. "07-06-2026" → 2026-06-07, "31-May-26" → 2026-05-31
- Always output dates as YYYY-MM-DD.

AMOUNT RULES:
- Use the final total (bottom right, often labeled "Total" or shown in words as "INR ... Only").
- Return a plain number: 26387.00 not "₹26,387.00".

Return ONLY the JSON object. No other text whatsoever.`;

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function extractOrderFromImage(imageBuffer, mimeType) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set in environment');

  const groq = new Groq({ apiKey: key });

  const base64Image = imageBuffer.toString('base64');
  const imageUrl = `data:${mimeType || 'image/jpeg'};base64,${base64Image}`;

  const response = await groq.chat.completions.create({
    model: 'qwen/qwen3.6-27b',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 512,
    temperature: 0,
  });

  const text = response.choices[0]?.message?.content?.trim() || '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse order data from image');

  const data = JSON.parse(match[0]);

  // Default delivery_deadline to order_date + 12 days if missing
  if (!data.delivery_deadline && data.order_date) {
    data.delivery_deadline = addDays(data.order_date, 12);
  } else if (!data.delivery_deadline) {
    data.delivery_deadline = addDays(new Date().toISOString().split('T')[0], 12);
  }

  return data;
}

module.exports = { extractOrderFromImage };
