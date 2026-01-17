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
  return `OAuth realm="${nsConfig.accountId}", ${Object.keys(oauthParams).map((key) => `${key}="${encodeURIComponent(oauthParams[key])}\"`).join(', ')}`;
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
  console.log("=== Finding Expense Report Source for $819 ===\n");

  // 1. Check all expense report item entries for both WOs
  console.log("1. All Expense Report (item 4332) entries in WOCompl/WOIssue:");
  try {
    const query = `
      SELECT
        completionLine.createdfrom as wo_id,
        BUILTIN.DF(completionLine.createdfrom) as wo_name,
        t.tranid as completion_tranid,
        t.trandate,
        ABS(tal.amount) as cost
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom IN (1059131, 1059132)
        AND t.type IN ('WOCompl', 'WOIssue')
        AND tal.posting = 'T'
        AND tal.amount < 0
        AND completionLine.item = 4332
      ORDER BY wo_id, t.trandate
    `;
    const result = await suiteQL(query, 50);
    let total5628 = 0;
    let total5629 = 0;
    console.log("   Detail:");
    result.items?.forEach(r => {
      const cost = parseFloat(r.cost);
      console.log(`   ${r.wo_name}: ${r.completion_tranid} on ${r.trandate} = $${cost.toFixed(2)}`);
      if (r.wo_id == '1059131') total5628 += cost;
      else total5629 += cost;
    });
    console.log(`   WO5628 Expense Report total: $${total5628.toFixed(2)}`);
    console.log(`   WO5629 Expense Report total: $${total5629.toFixed(2)}`);
    console.log(`   Combined: $${(total5628 + total5629).toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 2. Check if there are expense reports (type ExpRept) linked to WOs
  console.log("\n2. Expense Reports (ExpRept transactions) for these WOs:");
  try {
    const query = `
      SELECT
        t.id, t.tranid, t.trandate, t.type,
        tl.createdfrom,
        BUILTIN.DF(tl.createdfrom) as created_from_name,
        ABS(tl.amount) as amount
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'ExpRept'
        AND tl.createdfrom IN (1059131, 1059132)
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} expense report lines`);
    result.items?.forEach(r => {
      console.log(`   ${r.tranid} (${r.trandate}): ${r.created_from_name} = $${r.amount}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 3. Check WO line items for expense report costs (estimated)
  console.log("\n3. Expense Report item (4332) on WO line items:");
  try {
    const query = `
      SELECT
        t.tranid as wo_number,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.costestimate
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid IN ('WO5628', 'WO5629')
        AND tl.item = 4332
    `;
    const result = await suiteQL(query, 20);
    result.items?.forEach(r => {
      console.log(`   ${r.wo_number}: qty=${r.quantity}, rate=${r.rate}, amt=${r.amount}, costEst=${r.costestimate}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 4. Check the Sales Order for expense allocation
  console.log("\n4. Sales Order SO6855 - Check for expense-related items:");
  try {
    const query = `
      SELECT
        tl.item,
        BUILTIN.DF(tl.item) as item_name,
        tl.quantity,
        tl.amount,
        tl.costestimate
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid = 'SO6855'
        AND tl.mainline = 'F'
        AND BUILTIN.DF(tl.item) LIKE '%Expense%'
    `;
    const result = await suiteQL(query, 20);
    console.log(`   Expense-related items on SO6855:`);
    result.items?.forEach(r => {
      console.log(`   ${r.item_name}: qty=${r.quantity}, amt=${r.amount}, costEst=${r.costestimate}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 5. Calculate what $819 could be
  console.log("\n5. MATH CHECK:");
  console.log("   If Exp Rpts from WOCompl is $386.35 per WO");
  console.log("   Then combined for both WOs: $" + (386.35 * 2).toFixed(2));
  console.log("   Excel shows $819 per WO");
  console.log("   Ratio: " + (819 / 386.35).toFixed(2));

  // 6. Look for other transactions that might contain expense data
  console.log("\n6. All transaction types linked to WO5628/WO5629:");
  try {
    const query = `
      SELECT
        t.type,
        COUNT(*) as cnt,
        SUM(ABS(tl.amount)) as total_amount
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE tl.createdfrom IN (1059131, 1059132)
      GROUP BY t.type
    `;
    const result = await suiteQL(query, 20);
    result.items?.forEach(r => {
      console.log(`   ${r.type}: ${r.cnt} lines, total=$${parseFloat(r.total_amount || 0).toFixed(2)}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  console.log("\n=== Done ===");
}

main().catch(console.error);
