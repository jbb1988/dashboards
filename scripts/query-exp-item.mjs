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
  console.log("=== Analyzing Expense Report Item (4332) ===\n");

  // Check the item details for 4332 "Test Bench Expense Report"
  console.log("1. Item 4332 Details:");
  const itemQuery = `
    SELECT id, itemid, displayname, description, itemtype, averagecost, lastpurchaseprice
    FROM Item WHERE id = '4332'
  `;
  try {
    const result = await suiteQL(itemQuery, 1);
    console.log("   ", JSON.stringify(result.items?.[0], null, 2));
  } catch(e) { console.log("   Error:", e.message); }

  // Look for cost of item 4332 in WO completions for our WOs
  console.log("\n2. Item 4332 costs in WO5628/WO5629:");
  const costQuery = `
    SELECT
      completionLine.createdfrom as wo_id,
      BUILTIN.DF(completionLine.createdfrom) as wo_name,
      SUM(ABS(tal.amount)) as actual_cost
    FROM TransactionLine completionLine
    INNER JOIN Transaction t ON t.id = completionLine.transaction
    INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
    WHERE completionLine.createdfrom IN (1059131, 1059132)
      AND t.type IN ('WOCompl', 'WOIssue')
      AND completionLine.item = 4332
      AND tal.posting = 'T'
      AND tal.amount < 0
    GROUP BY completionLine.createdfrom
  `;
  try {
    const result = await suiteQL(costQuery, 20);
    console.log("   Test Bench Expense Report item costs:");
    result.items?.forEach(r => {
      console.log(`   ${r.wo_name}: $${r.actual_cost}`);
    });
    const total = result.items?.reduce((sum, r) => sum + parseFloat(r.actual_cost), 0) || 0;
    console.log(`   TOTAL: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // Break down ALL costs by item for both WOs
  console.log("\n3. Full breakdown by item for WO5628:");
  const wo5628Query = `
    SELECT
      completionLine.item as item_id,
      BUILTIN.DF(completionLine.item) as item_name,
      i.itemtype,
      SUM(ABS(tal.amount)) as actual_cost
    FROM TransactionLine completionLine
    INNER JOIN Transaction t ON t.id = completionLine.transaction
    INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
    LEFT JOIN Item i ON i.id = completionLine.item
    WHERE completionLine.createdfrom = 1059131
      AND t.type IN ('WOCompl', 'WOIssue')
      AND tal.posting = 'T'
      AND tal.amount < 0
    GROUP BY completionLine.item, i.itemtype
    ORDER BY actual_cost DESC
  `;
  try {
    const result = await suiteQL(wo5628Query, 50);
    let total = 0;
    result.items?.forEach(r => {
      console.log(`   ${r.item_name} (${r.itemtype}): $${r.actual_cost}`);
      total += parseFloat(r.actual_cost);
    });
    console.log(`   TOTAL: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  console.log("\n4. Full breakdown by item for WO5629:");
  const wo5629Query = `
    SELECT
      completionLine.item as item_id,
      BUILTIN.DF(completionLine.item) as item_name,
      i.itemtype,
      SUM(ABS(tal.amount)) as actual_cost
    FROM TransactionLine completionLine
    INNER JOIN Transaction t ON t.id = completionLine.transaction
    INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
    LEFT JOIN Item i ON i.id = completionLine.item
    WHERE completionLine.createdfrom = 1059132
      AND t.type IN ('WOCompl', 'WOIssue')
      AND tal.posting = 'T'
      AND tal.amount < 0
    GROUP BY completionLine.item, i.itemtype
    ORDER BY actual_cost DESC
  `;
  try {
    const result = await suiteQL(wo5629Query, 50);
    let total = 0;
    result.items?.forEach(r => {
      console.log(`   ${r.item_name} (${r.itemtype}): $${r.actual_cost}`);
      total += parseFloat(r.actual_cost);
    });
    console.log(`   TOTAL: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // Check for Labor items (4277, 4278)
  console.log("\n5. Labor items detail (4277=MCC Labor, 4278=MCC Overhead):");
  const laborQuery = `
    SELECT id, itemid, displayname, itemtype FROM Item WHERE id IN (4277, 4278, 4207, 4210)
  `;
  try {
    const result = await suiteQL(laborQuery, 10);
    result.items?.forEach(r => {
      console.log(`   ${r.id}: ${r.itemid} - ${r.displayname} (${r.itemtype})`);
    });
  } catch(e) { console.log("   Error:", e.message); }
}

main().catch(console.error);
