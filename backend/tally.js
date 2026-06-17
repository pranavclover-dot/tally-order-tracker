require('dotenv').config();
const axios = require('axios');
const xml2js = require('xml2js');
const { db } = require('./db');

const TALLY_URL = process.env.TALLY_URL || 'http://localhost:9000';

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function getMockOrders() {
  return [
    {
      tally_id: 'T001', order_number: 'ORD-2026-001',
      customer_name: 'Mahindra Logistics Ltd',
      salesman_name: 'Raj Sharma', salesman_email: 'raj.sharma@company.com',
      order_date: addDays(-38), delivery_deadline: addDays(-8),
      amount: 125000, status: 'pending'
    },
    {
      tally_id: 'T002', order_number: 'ORD-2026-002',
      customer_name: 'Tata Steel Industries',
      salesman_name: 'Priya Patel', salesman_email: 'priya.patel@company.com',
      order_date: addDays(-35), delivery_deadline: addDays(-5),
      amount: 350000, status: 'pending'
    },
    {
      tally_id: 'T003', order_number: 'ORD-2026-003',
      customer_name: 'Reliance Retail Pvt Ltd',
      salesman_name: 'Amit Verma', salesman_email: 'amit.verma@company.com',
      order_date: addDays(-32), delivery_deadline: addDays(-2),
      amount: 75000, status: 'pending'
    },
    {
      tally_id: 'T004', order_number: 'ORD-2026-004',
      customer_name: 'Infosys Business Solutions',
      salesman_name: 'Sunita Gupta', salesman_email: 'sunita.gupta@company.com',
      order_date: addDays(-30), delivery_deadline: addDays(0),
      amount: 220000, status: 'pending'
    },
    {
      tally_id: 'T005', order_number: 'ORD-2026-005',
      customer_name: 'Birla Manufacturing Co',
      salesman_name: 'Vikram Singh', salesman_email: 'vikram.singh@company.com',
      order_date: addDays(-29), delivery_deadline: addDays(0),
      amount: 98500, status: 'pending'
    },
    {
      tally_id: 'T006', order_number: 'ORD-2026-006',
      customer_name: 'HCL Technologies Ltd',
      salesman_name: 'Raj Sharma', salesman_email: 'raj.sharma@company.com',
      order_date: addDays(-29), delivery_deadline: addDays(1),
      amount: 180000, status: 'pending'
    },
    {
      tally_id: 'T007', order_number: 'ORD-2026-007',
      customer_name: 'Wipro Infrastructure Pvt Ltd',
      salesman_name: 'Priya Patel', salesman_email: 'priya.patel@company.com',
      order_date: addDays(-28), delivery_deadline: addDays(2),
      amount: 450000, status: 'pending'
    },
    {
      tally_id: 'T008', order_number: 'ORD-2026-008',
      customer_name: 'Bajaj Auto Components',
      salesman_name: 'Amit Verma', salesman_email: 'amit.verma@company.com',
      order_date: addDays(-28), delivery_deadline: addDays(2),
      amount: 65000, status: 'pending'
    },
    {
      tally_id: 'T009', order_number: 'ORD-2026-009',
      customer_name: 'Godrej Consumer Products Ltd',
      salesman_name: 'Sunita Gupta', salesman_email: 'sunita.gupta@company.com',
      order_date: addDays(-27), delivery_deadline: addDays(3),
      amount: 295000, status: 'pending'
    },
    {
      tally_id: 'T010', order_number: 'ORD-2026-010',
      customer_name: 'Larsen & Toubro Ltd',
      salesman_name: 'Vikram Singh', salesman_email: 'vikram.singh@company.com',
      order_date: addDays(-26), delivery_deadline: addDays(4),
      amount: 500000, status: 'pending'
    },
    {
      tally_id: 'T011', order_number: 'ORD-2026-011',
      customer_name: 'Hindustan Unilever Ltd',
      salesman_name: 'Raj Sharma', salesman_email: 'raj.sharma@company.com',
      order_date: addDays(-25), delivery_deadline: addDays(5),
      amount: 155000, status: 'pending'
    },
    {
      tally_id: 'T012', order_number: 'ORD-2026-012',
      customer_name: 'ITC Limited',
      salesman_name: 'Priya Patel', salesman_email: 'priya.patel@company.com',
      order_date: addDays(-23), delivery_deadline: addDays(7),
      amount: 325000, status: 'pending'
    },
    {
      tally_id: 'T013', order_number: 'ORD-2026-013',
      customer_name: 'Adani Enterprises Ltd',
      salesman_name: 'Amit Verma', salesman_email: 'amit.verma@company.com',
      order_date: addDays(-20), delivery_deadline: addDays(10),
      amount: 88000, status: 'pending'
    },
    {
      tally_id: 'T014', order_number: 'ORD-2026-014',
      customer_name: 'JSW Steel Ltd',
      salesman_name: 'Sunita Gupta', salesman_email: 'sunita.gupta@company.com',
      order_date: addDays(-45), delivery_deadline: addDays(-15),
      amount: 240000, status: 'completed'
    },
    {
      tally_id: 'T015', order_number: 'ORD-2026-015',
      customer_name: 'Sun Pharma Industries Ltd',
      salesman_name: 'Vikram Singh', salesman_email: 'vikram.singh@company.com',
      order_date: addDays(-50), delivery_deadline: addDays(-20),
      amount: 175000, status: 'completed'
    },
  ];
}

async function parseTallyXML(xmlData) {
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
  const result = await parser.parseStringPromise(xmlData);

  const orders = [];
  try {
    const body = result.ENVELOPE.BODY;
    const data = body.DATA || body.EXPORTDATA;
    const collection = data.COLLECTION;
    const rawOrders = collection.SALESORDER || collection.ORDER || [];
    const orderList = Array.isArray(rawOrders) ? rawOrders : [rawOrders];

    orderList.forEach((o, i) => {
      const dateStr = o.DATE || o.ORDERDATE || '';
      const dueDateStr = o.ORDERDUEDATEOFPAYMENT || o.DUEDATE || o.DELIVERYDATE || dateStr;

      const parseDate = (str) => {
        if (!str || str.length !== 8) return new Date().toISOString().split('T')[0];
        return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
      };

      orders.push({
        tally_id: `TALLY-${o.ORDERNUMBER || o.ORDERNO || i}`,
        order_number: o.ORDERNUMBER || o.ORDERNO || `ORD-${i + 1}`,
        customer_name: o.PARTYNAME || o.LEDGERNAME || 'Unknown',
        salesman_name: o.SALESMAN || o.SALESMANNAME || 'Unassigned',
        salesman_email: '',
        order_date: parseDate(dateStr),
        delivery_deadline: parseDate(dueDateStr),
        amount: parseFloat(o.AMOUNT || o.GROSSAMT || 0),
        status: 'pending',
      });
    });
  } catch (err) {
    console.error('[Tally] XML parse error:', err.message);
  }

  return orders;
}

async function upsertOrders(orders) {
  const now = new Date().toISOString();
  for (const o of orders) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO orders
        (tally_id, order_number, customer_name, salesman_name, salesman_email,
         order_date, delivery_deadline, amount, status, last_synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [o.tally_id, o.order_number, o.customer_name, o.salesman_name,
             o.salesman_email, o.order_date, o.delivery_deadline,
             o.amount, o.status, now],
    });
  }
}

async function syncOrdersFromTally() {
  if (process.env.MOCK_MODE === 'true') {
    console.log('[Tally] MOCK_MODE=true — using mock data');
    const orders = getMockOrders();
    await upsertOrders(orders);
    return orders.length;
  }

  const xmlRequest = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Sales Order Book</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const response = await axios.post(TALLY_URL, xmlRequest, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 5000,
    });
    const orders = await parseTallyXML(response.data);
    if (orders.length === 0) throw new Error('No orders parsed from Tally response');
    await upsertOrders(orders);
    console.log(`[Tally] Synced ${orders.length} orders from Tally`);
    return orders.length;
  } catch (err) {
    console.warn('[Tally] Unreachable — skipping sync:', err.message);
    return 0;
  }
}

module.exports = { syncOrdersFromTally };
