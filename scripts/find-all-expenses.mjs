#!/usr/bin/env node
import crypto from 'crypto';
import { config } from 'dotenv';
config({ path: '.env.local' });

const nsConfig = {
  accountId: process.env.NETSUITE_ACCOUNT_ID || '',
  consumerKey: process.env.NETSUITE_CONSUMER_KEY || '',
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || '',
  tokenId: process.env.NETSUITE_TOKEN_ID || '',
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET || '',
};

function generateAuthHeader(method, baseUrl, queryParams) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  const oauthParams = {
    oauth_consumer_key: nsConfig.consumerKey,
    oauth_token: nsConfig.tokenId,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0',
  };
  const allParams = { ...oauthParams, ...queryParams };
  const sortedParams = Object.keys(allParams).sort().map((key) =>
    `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`).join('&');
  const signatureBaseString = [method.toUpperCase(), encodeURIComponent(baseUrl), encodeURIComponent(sortedParams)].join('&');
  const signingKey = `${encodeURIComponent(nsConfig.consumerSecret)}&${encodeURIComponent(nsConfig.tokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac('sha256', signingKey).update(signatureBaseString).digest('base64');
  return `OAuth realm="${nsConfig.accountId}", ${Object.keys(oauthParams).map((key) => `${key}=\"${encodeURIComponent(oauthParams[key])}\"`).join(', ')}`;
}

async function suiteQL(query, limit = 100) {
  const baseUrl = `https://${nsConfig.accountId.toLowerCase()}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;
  const params = { limit: limit.toString() };
  const response = await fetch(`${baseUrl}?limit=${limit}`, {
    method: 'POST',
    headers: { Authorization: generateAuthHeader('POST', baseUrl, params), 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'transient' },
    body: JSON.stringify({ q: query }),
  });
  if (!response.ok) throw new Error(`NetSuite error: ${await response.text()}`);
  return response.json();
}

async function main() {
  console.log("=== Finding ALL Expense Data for WO5628/WO5629 ===\n");

  // 1. ALL lines on WO5628 (not just expense item)
  console.log("1. ALL line items on WO5628:");
  try {
    const query = `
      SELECT
        tl.item,
        BUILTIN.DF(tl.item) as item_name,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.linesequencenumber
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid = 'WO5628'
        AND tl.mainline = 'F'
      ORDER BY tl.linesequencenumber
    `;
    const result = await suiteQL(query, 50);
    let expenseTotal = 0;
    result.items?.forEach(r => {
      const isExpense = r.item_name?.includes('Expense');
      const qty = parseFloat(r.quantity) || 0;
      if (isExpense) expenseTotal += Math.abs(qty);
      console.log(`   ${r.linesequencenumber}: ${r.item_name} (${r.item}): qty=${r.quantity}${isExpense ? ' ***EXPENSE***' : ''}`);
    });
    console.log(`   Total expense qty: $${expenseTotal.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 2. Check for ExpRept transactions in Dec 2025
  console.log("\n2. ALL Expense Report (ExpRept) transactions in Dec 2025:");
  try {
    const query = `
      SELECT
        t.id, t.tranid, t.trandate,
        BUILTIN.DF(t.entity) as employee,
        t.memo
      FROM Transaction t
      WHERE t.type = 'ExpRept'
        AND t.trandate >= TO_DATE('12/01/2025', 'MM/DD/YYYY')
      ORDER BY t.trandate
    `;
    const result = await suiteQL(query, 100);
    console.log(`   Found ${result.items?.length || 0} expense reports`);
    result.items?.forEach(r => {
      console.log(`   ${r.tranid} (${r.trandate}): ${r.employee} - ${r.memo || 'no memo'}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 3. Check for expense amounts that add up to $432.72
  console.log("\n3. Looking for amounts that sum to $432.72:");
  console.log("   Known amounts: $161 + $225.35 = $386.35");
  console.log("   Missing: $819 - $386.35 = $432.65");
  console.log("   Possible pairs:");
  console.log("   - $271.65 + $161 = $432.65");
  console.log("   - $225.35 + $207.30 = $432.65");

  // 4. Check for vendor bills or other transactions with expense item
  console.log("\n4. Vendor Bills with expense item (4332):");
  try {
    const query = `
      SELECT
        t.tranid, t.trandate,
        BUILTIN.DF(t.entity) as vendor,
        tl.amount,
        t.memo
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'VendBill'
        AND tl.item = 4332
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
      ORDER BY t.trandate
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} vendor bill lines`);
    result.items?.forEach(r => {
      console.log(`   ${r.tranid} (${r.trandate}): ${r.vendor} - $${r.amount} - ${r.memo || ''}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 5. Check journal entries
  console.log("\n5. Journal Entries with expense item (4332):");
  try {
    const query = `
      SELECT
        t.tranid, t.trandate,
        tl.amount,
        t.memo
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'Journal'
        AND tl.item = 4332
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} journal entries`);
    result.items?.forEach(r => {
      console.log(`   ${r.tranid} (${r.trandate}): $${r.amount} - ${r.memo || ''}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 6. Check for expense line items on INVOICES
  console.log("\n6. Invoice INV7450 (for SO6855) - expense lines:");
  try {
    const query = `
      SELECT
        tl.item,
        BUILTIN.DF(tl.item) as item_name,
        tl.quantity,
        tl.rate,
        tl.amount
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid = 'INV7450'
        AND tl.item = 4332
    `;
    const result = await suiteQL(query, 20);
    result.items?.forEach(r => {
      console.log(`   ${r.item_name}: qty=${r.quantity}, rate=${r.rate}, amt=${r.amount}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 7. Look at the Sales Order expense lines more carefully
  console.log("\n7. SO6855 expense item lines (detailed):");
  try {
    const query = `
      SELECT
        tl.item,
        BUILTIN.DF(tl.item) as item_name,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.costestimate,
        tl.linesequencenumber
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid = 'SO6855'
        AND tl.item = 4332
    `;
    const result = await suiteQL(query, 20);
    let totalQty = 0;
    result.items?.forEach(r => {
      const qty = Math.abs(parseFloat(r.quantity) || 0);
      totalQty += qty;
      console.log(`   Line ${r.linesequencenumber}: qty=${r.quantity}, amt=${r.amount}, costEst=${r.costestimate}`);
    });
    console.log(`   Total expense qty on SO: ${totalQty}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 8. Maybe the expense is in a custom field or memo?
  console.log("\n8. Check WO memo and custom fields:");
  try {
    const query = `
      SELECT
        t.tranid,
        t.memo,
        t.custbody_expenses,
        t.custbody_total_expense
      FROM Transaction t
      WHERE t.tranid IN ('WO5628', 'WO5629')
    `;
    const result = await suiteQL(query, 10);
    result.items?.forEach(r => {
      console.log(`   ${r.tranid}: memo=${r.memo}`);
    });
  } catch(e) {
    // Try without custom fields
    try {
      const query = `
        SELECT tranid, memo
        FROM Transaction
        WHERE tranid IN ('WO5628', 'WO5629')
      `;
      const result = await suiteQL(query, 10);
      result.items?.forEach(r => {
        console.log(`   ${r.tranid}: memo=${r.memo}`);
      });
    } catch(e2) { console.log("   Error:", e2.message); }
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
