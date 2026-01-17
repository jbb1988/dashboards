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
  console.log("=== Checking WOClose and other transactions ===\n");

  // 1. Check WOClose for expense items
  console.log("1. WOClose transactions for WO5628/WO5629 - Expense Report items:");
  try {
    const query = `
      SELECT
        completionLine.createdfrom as wo_id,
        BUILTIN.DF(completionLine.createdfrom) as wo_name,
        completionLine.item,
        BUILTIN.DF(completionLine.item) as item_name,
        t.trandate,
        ABS(tal.amount) as cost
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom IN (1059131, 1059132)
        AND t.type = 'WOClose'
        AND tal.posting = 'T'
        AND completionLine.item = 4332
      ORDER BY wo_id
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} WOClose expense lines`);
    result.items?.forEach(r => {
      console.log(`   ${r.wo_name}: ${r.item_name} = $${parseFloat(r.cost).toFixed(2)}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 2. ALL items in WOClose for these WOs
  console.log("\n2. ALL WOClose line items for WO5628:");
  try {
    const query = `
      SELECT
        completionLine.item,
        BUILTIN.DF(completionLine.item) as item_name,
        ABS(tal.amount) as cost
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom = 1059131
        AND t.type = 'WOClose'
        AND tal.posting = 'T'
        AND tal.amount < 0
      ORDER BY ABS(tal.amount) DESC
    `;
    const result = await suiteQL(query, 50);
    let total = 0;
    result.items?.forEach(r => {
      const cost = parseFloat(r.cost);
      total += cost;
      console.log(`   ${r.item_name} (${r.item}): $${cost.toFixed(2)}`);
    });
    console.log(`   Total WOClose cost: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 3. Check if there's a variance being posted
  console.log("\n3. Check for variance entries:");
  try {
    const query = `
      SELECT
        t.type,
        t.tranid,
        completionLine.item,
        BUILTIN.DF(completionLine.item) as item_name,
        tal.amount
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom IN (1059131, 1059132)
        AND completionLine.item = 4332
        AND tal.posting = 'T'
      ORDER BY t.type, ABS(tal.amount) DESC
    `;
    const result = await suiteQL(query, 50);
    console.log(`   All expense report GL postings:`);
    result.items?.forEach(r => {
      console.log(`   ${r.type} (${r.tranid}): ${r.item_name} = $${r.amount}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 4. Let me check the ACTUAL costs by looking at different GL amounts
  console.log("\n4. Sum ALL expense report (4332) costs by transaction type:");
  try {
    const query = `
      SELECT
        t.type,
        completionLine.createdfrom as wo_id,
        SUM(ABS(tal.amount)) as total_cost
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom IN (1059131, 1059132)
        AND completionLine.item = 4332
        AND tal.posting = 'T'
        AND tal.amount < 0
      GROUP BY t.type, completionLine.createdfrom
    `;
    const result = await suiteQL(query, 50);
    result.items?.forEach(r => {
      const woName = r.wo_id == '1059131' ? 'WO5628' : 'WO5629';
      console.log(`   ${r.type} for ${woName}: $${parseFloat(r.total_cost).toFixed(2)}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 5. Check WO header for any cost fields
  console.log("\n5. WO Header cost fields:");
  try {
    const query = `
      SELECT
        t.tranid,
        t.totalcostestimate,
        t.estgrossprofit,
        t.memo
      FROM Transaction t
      WHERE t.tranid IN ('WO5628', 'WO5629')
    `;
    const result = await suiteQL(query, 10);
    result.items?.forEach(r => {
      console.log(`   ${r.tranid}: totalCostEst=${r.totalcostestimate}, estGrossProfit=${r.estgrossprofit}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 6. Look at the raw WO line quantities again
  console.log("\n6. WO Line items with COSTS (qty might be cost amount):");
  try {
    const query = `
      SELECT
        t.tranid as wo,
        tl.item,
        BUILTIN.DF(tl.item) as item_name,
        tl.quantity
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid IN ('WO5628', 'WO5629')
        AND tl.item = 4332
    `;
    const result = await suiteQL(query, 20);
    let total5628 = 0;
    let total5629 = 0;
    result.items?.forEach(r => {
      const qty = Math.abs(parseFloat(r.quantity) || 0);
      console.log(`   ${r.wo}: ${r.item_name} qty=${r.quantity}`);
      if (r.wo == 'WO5628') total5628 += qty;
      else total5629 += qty;
    });
    console.log(`\n   Sum of expense qtys for WO5628: $${total5628.toFixed(2)}`);
    console.log(`   Sum of expense qtys for WO5629: $${total5629.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 7. Check for related purchase orders or vendor bills
  console.log("\n7. Purchase Orders and Vendor Bills linked to WOs:");
  try {
    const query = `
      SELECT
        t.type,
        t.tranid,
        t.trandate,
        tl.createdfrom,
        BUILTIN.DF(tl.createdfrom) as from_name,
        tl.amount
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type IN ('PurchOrd', 'VendBill', 'VendCred')
        AND (tl.createdfrom IN (1059131, 1059132)
             OR t.memo LIKE '%5628%' OR t.memo LIKE '%5629%')
    `;
    const result = await suiteQL(query, 30);
    console.log(`   Found ${result.items?.length || 0} PO/VB lines`);
    result.items?.slice(0, 10).forEach(r => {
      console.log(`   ${r.type} ${r.tranid}: ${r.from_name} = $${r.amount}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  console.log("\n=== Analysis Complete ===");
}

main().catch(console.error);
