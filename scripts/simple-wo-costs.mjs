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
  return `OAuth realm="${nsConfig.accountId}", ${Object.keys(oauthParams).map((key) => `${key}="${encodeURIComponent(oauthParams[key])}"`).join(', ')}`;
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
  console.log("=== WO5628 & WO5629 Cost Analysis ===\n");

  // 1. Get actual costs from WOCompl/WOIssue for WO5628 (ID: 1059131)
  console.log("1. ACTUAL COSTS from WO Completions/Issues for WO5628 (ID: 1059131):");
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
        AND t.type IN ('WOCompl', 'WOIssue')
        AND tal.posting = 'T'
        AND tal.amount < 0
      ORDER BY ABS(tal.amount) DESC
    `;
    const result = await suiteQL(query, 100);
    let total = 0;
    let laborOH = 0;
    let material = 0;
    let expRpt = 0;
    result.items?.forEach(r => {
      const cost = parseFloat(r.cost);
      total += cost;
      // Item 4277 = MCC Labor, 4278 = MCC Overhead
      if (r.item == 4277 || r.item == 4278) laborOH += cost;
      // Item 4332 = Expense Report
      else if (r.item == 4332) expRpt += cost;
      // Otherwise material
      else material += cost;
      console.log(`   ${r.item_name} (${r.item}): $${cost.toFixed(2)}`);
    });
    console.log(`   ---`);
    console.log(`   Labor/OH: $${laborOH.toFixed(2)}`);
    console.log(`   Expense Report: $${expRpt.toFixed(2)}`);
    console.log(`   Material: $${material.toFixed(2)}`);
    console.log(`   TOTAL: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 2. Same for WO5629 (ID: 1059132)
  console.log("\n2. ACTUAL COSTS from WO Completions/Issues for WO5629 (ID: 1059132):");
  try {
    const query = `
      SELECT
        completionLine.item,
        BUILTIN.DF(completionLine.item) as item_name,
        ABS(tal.amount) as cost
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom = 1059132
        AND t.type IN ('WOCompl', 'WOIssue')
        AND tal.posting = 'T'
        AND tal.amount < 0
      ORDER BY ABS(tal.amount) DESC
    `;
    const result = await suiteQL(query, 100);
    let total = 0;
    let laborOH = 0;
    let material = 0;
    let expRpt = 0;
    result.items?.forEach(r => {
      const cost = parseFloat(r.cost);
      total += cost;
      if (r.item == 4277 || r.item == 4278) laborOH += cost;
      else if (r.item == 4332) expRpt += cost;
      else material += cost;
      console.log(`   ${r.item_name} (${r.item}): $${cost.toFixed(2)}`);
    });
    console.log(`   ---`);
    console.log(`   Labor/OH: $${laborOH.toFixed(2)}`);
    console.log(`   Expense Report: $${expRpt.toFixed(2)}`);
    console.log(`   Material: $${material.toFixed(2)}`);
    console.log(`   TOTAL: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 3. Get WO line items (ESTIMATED costs from WO itself)
  console.log("\n3. ESTIMATED COSTS from WO5628 line items (qty × rate):");
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
      WHERE t.tranid = 'WO5628'
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
    `;
    const result = await suiteQL(query, 50);
    let total = 0;
    let laborOH = 0;
    result.items?.forEach(r => {
      const amt = parseFloat(r.amount) || (parseFloat(r.quantity || 0) * parseFloat(r.rate || 0));
      total += amt;
      if (r.item == 4277 || r.item == 4278) laborOH += amt;
      console.log(`   ${r.item_name}: qty=${r.quantity}, rate=${r.rate}, amt=${r.amount}`);
    });
    console.log(`   ---`);
    console.log(`   Labor/OH from WO lines: $${laborOH.toFixed(2)}`);
    console.log(`   Total from WO lines: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 4. Get WO line items for WO5629
  console.log("\n4. ESTIMATED COSTS from WO5629 line items (qty × rate):");
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
      WHERE t.tranid = 'WO5629'
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
    `;
    const result = await suiteQL(query, 50);
    let total = 0;
    let laborOH = 0;
    result.items?.forEach(r => {
      const amt = parseFloat(r.amount) || (parseFloat(r.quantity || 0) * parseFloat(r.rate || 0));
      total += amt;
      if (r.item == 4277 || r.item == 4278) laborOH += amt;
      console.log(`   ${r.item_name}: qty=${r.quantity}, rate=${r.rate}, amt=${r.amount}`);
    });
    console.log(`   ---`);
    console.log(`   Labor/OH from WO lines: $${laborOH.toFixed(2)}`);
    console.log(`   Total from WO lines: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 5. Compare to Excel
  console.log("\n=== COMPARISON TO EXCEL ===");
  console.log("Excel WO5628: Labor/OH=$933?, Exp Rpts=$819, Material=$495, Total=$2,247");
  console.log("Excel WO5629: Labor/OH=$933?, Exp Rpts=$819, Material=$202, Total=$1,954");

  console.log("\n=== Done ===");
}

main().catch(console.error);
