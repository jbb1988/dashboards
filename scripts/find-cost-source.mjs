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
  console.log("=== Finding Cost Sources for WO5628/WO5629 ===\n");

  // 1. Check ALL transactions linked to these WOs
  console.log("1. ALL transactions linked to WO5628 (ID: 1059131):");
  try {
    const query = `
      SELECT DISTINCT
        t.id, t.tranid, t.type, t.trandate,
        tl.amount
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE tl.createdfrom = 1059131
      ORDER BY t.type, t.trandate
    `;
    const result = await suiteQL(query, 100);
    const byType = {};
    result.items?.forEach(r => {
      if (!byType[r.type]) byType[r.type] = [];
      byType[r.type].push(r);
    });
    Object.keys(byType).forEach(type => {
      console.log(`   ${type}: ${byType[type].length} transactions`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 2. Check time entries
  console.log("\n2. Time entries for Miami/MCC in 2025:");
  try {
    const query = `
      SELECT
        t.id, t.trandate,
        BUILTIN.DF(t.employee) as employee,
        t.hours,
        t.memo,
        BUILTIN.DF(t.casetaskevent) as task
      FROM TimeBill t
      WHERE t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
        AND (t.memo LIKE '%Miami%' OR t.memo LIKE '%5628%' OR t.memo LIKE '%5629%')
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} time entries`);
    result.items?.slice(0,5).forEach(r => console.log(`   ${r.trandate}: ${r.employee} - ${r.hours}hrs - ${r.memo}`));
  } catch(e) { console.log("   Error:", e.message); }

  // 3. Check Work Order line items directly (not completions)
  console.log("\n3. WO5628 line items (from Work Order itself):");
  try {
    const query = `
      SELECT
        tl.item,
        BUILTIN.DF(tl.item) as item_name,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.costestimate
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid = 'WO5628'
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
    `;
    const result = await suiteQL(query, 50);
    console.log(`   ${result.items?.length || 0} line items on WO5628:`);
    result.items?.forEach(r => {
      console.log(`   ${r.item_name}: qty=${r.quantity}, rate=${r.rate}, amt=${r.amount}, costEst=${r.costestimate}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 4. Check Sales Order cost estimates
  console.log("\n4. SO6855 cost estimates for MCC items:");
  try {
    const query = `
      SELECT
        tl.item,
        BUILTIN.DF(tl.item) as item_name,
        tl.quantity,
        tl.amount,
        tl.costestimate,
        tl.costestimatetype
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid = 'SO6855'
        AND tl.mainline = 'F'
        AND tl.item IN (4277, 4278, 4332, 5078, 2521)
      ORDER BY tl.linesequencenumber
    `;
    const result = await suiteQL(query, 50);
    console.log(`   MCC-related items on SO6855:`);
    result.items?.forEach(r => {
      console.log(`   ${r.item_name}: qty=${r.quantity}, amt=${r.amount}, costEst=${r.costestimate}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 5. Check for item receipts or vendor bills
  console.log("\n5. Looking for vendor bills/item receipts linked to WOs:");
  try {
    const query = `
      SELECT DISTINCT t.type, COUNT(*) as cnt
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE tl.createdfrom IN (1059131, 1059132)
      GROUP BY t.type
    `;
    const result = await suiteQL(query, 20);
    console.log("   Transaction types linked to WO5628/WO5629:");
    result.items?.forEach(r => console.log(`   ${r.type}: ${r.cnt}`));
  } catch(e) { console.log("   Error:", e.message); }

  // 6. Check if there's a Job/Project record
  console.log("\n6. Looking for Job/Project records for Miami:");
  try {
    const query = `
      SELECT id, entityid, companyname, custentity_project_type
      FROM Job
      WHERE companyname LIKE '%Miami%'
    `;
    const result = await suiteQL(query, 20);
    console.log(`   Found ${result.items?.length || 0} jobs`);
    result.items?.forEach(r => console.log(`   ${r.id}: ${r.companyname}`));
  } catch(e) { console.log("   Error:", e.message); }

  // 7. Check for any saved search data
  console.log("\n7. Check WO5628 header fields:");
  try {
    const query = `
      SELECT
        t.id, t.tranid, t.status,
        t.estgrossprofit,
        t.totalcostestimate,
        t.memo
      FROM Transaction t
      WHERE t.tranid = 'WO5628'
    `;
    const result = await suiteQL(query, 1);
    console.log("   WO5628 header:", JSON.stringify(result.items?.[0], null, 2));
  } catch(e) { console.log("   Error:", e.message); }

  console.log("\n=== Done ===");
}

main().catch(console.error);
