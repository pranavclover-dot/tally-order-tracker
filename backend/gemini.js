require('dotenv').config();
const Groq = require('groq-sdk');

const PROMPT = `You are reading a sales order document image, likely from an Indian business (Tally ERP format).

Extract the following fields and return ONLY a valid JSON object. No explanation, no markdown, no thinking.

{
  "order_number": "voucher number / order number / SO number (string)",
  "customer_name": "consignee / ship-to / buyer / party name (string)",
  "salesman_name": "salesman name — look for 'Salesman:' label (string, null if not found)",
  "order_date": "the document/voucher date in YYYY-MM-DD format",
  "delivery_deadline": "delivery date in YYYY-MM-DD format — see rules below",
  "amount": total invoice/order amount as a plain number no currency symbols or commas,
  "line_items": [
    {
      "product_name": "item/product name from line items table",
      "quantity": numeric quantity as a number,
      "amount": line item amount as a plain number,
      "delivery_deadline": "per-item delivery date in YYYY-MM-DD if shown, else null"
    }
  ]
}

LINE ITEMS RULES:
- Extract ALL product rows from the items/particulars table in the document.
- If no line items table exists, return line_items as an empty array [].
- quantity and amount must be plain numbers (not strings).
- Per-item delivery dates: look for a "Due on" or "Delivery" column in the line items table.

DELIVERY DATE RULES (for the top-level delivery_deadline, in priority order):
1. Look for a field called "Terms of Delivery" — it often contains a date like "DISPATCH-07-06-2026" or "DISPATCH 07/06/2026". Extract that date. Format "DISPATCH-DD-MM-YYYY" means day=DD, month=MM, year=YYYY → output as YYYY-MM-DD.
2. Look for any field labelled "Delivery Date", "Ship By", "Due Date", "Dispatch Date".
3. If per-item due dates exist, use the latest one as the overall deadline.
4. If absolutely no delivery date is found anywhere, set delivery_deadline to order_date + 12 days.

DATE FORMAT RULES:
- Indian format DD-MM-YYYY or DD/MM/YYYY: day first, then month, then year.
  e.g. "07-06-2026" → 2026-06-07, "31-May-26" → 2026-05-31
- Always output dates as YYYY-MM-DD.

AMOUNT RULES:
- Top-level amount: the final total (bottom right, often labeled "Total" or shown in words as "INR ... Only").
- Return plain numbers: 26387.00 not "₹26,387.00".

Return ONLY the JSON object. No other text whatsoever.`;

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function extractOrderFromImage(files) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set in environment');

  const groq = new Groq({ apiKey: key });

  // files is an array of {buffer, mimeType} — qwen supports up to 5 images
  const fileList = Array.isArray(files) ? files : [files];
  const imageContent = fileList.slice(0, 5).map(({ buffer, mimeType }) => ({
    type: 'image_url',
    image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}` },
  }));

  const response = await groq.chat.completions.create({
    model: 'qwen/qwen3.6-27b',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          ...imageContent,
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  console.log('[Groq] raw response (first 500):', raw.slice(0, 500));

  // Strip <think>...</think> blocks (qwen3 thinking mode)
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Could not parse order data from image. Model replied: ${raw.slice(0, 200)}`);

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
