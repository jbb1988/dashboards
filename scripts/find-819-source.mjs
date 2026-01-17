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
  console.log("=== Finding Source of $819 Expense Report ===\n");
  console.log("Target: $819 per WO (or $1,638 combined)\n");

  // 1. Check ALL expense report transactions for Miami/MCC in 2025
  console.log("1. All ExpRept transactions in 2025 mentioning Miami or MCC:");
  try {
    const query = `
      SELECT
        t.id, t.tranid, t.trandate,
        BUILTIN.DF(t.entity) as employee,
        t.memo,
        SUM(ABS(tl.amount)) as total
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'ExpRept'
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
        AND (t.memo LIKE '%Miami%' OR t.memo LIKE '%MCC%' OR t.memo LIKE '%5628%' OR t.memo LIKE '%5629%')
      GROUP BY t.id, t.tranid, t.trandate, t.entity, t.memo
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} expense reports`);
    let total = 0;
    result.items?.forEach(r => {
      const amt = parseFloat(r.total) || 0;
      total += amt;
      console.log(`   ${r.tranid} (${r.trandate}): ${r.employee} - $${amt.toFixed(2)} - ${r.memo}`);
    });
    console.log(`   TOTAL: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 2. Check expense reports by Job/Project
  console.log("\n2. Looking for Job/Project for Miami:");
  try {
    const query = `
      SELECT id, entityid, companyname
      FROM Job
      WHERE companyname LIKE '%Miami%' OR entityid LIKE '%Miami%'
    `;
    const result = await suiteQL(query, 20);
    console.log(`   Found ${result.items?.length || 0} jobs`);
    result.items?.forEach(r => {
      console.log(`   Job ${r.id}: ${r.entityid} - ${r.companyname}`);
    });

    // If we find a job, query expenses for it
    if (result.items?.length > 0) {
      const jobId = result.items[0].id;
      console.log(`\n   Checking expenses for job ${jobId}...`);
      const expQuery = `
        SELECT
          t.tranid, t.trandate, t.type,
          SUM(ABS(tl.amount)) as total
        FROM Transaction t
        JOIN TransactionLine tl ON tl.transaction = t.id
        WHERE tl.entity = ${jobId}
          AND t.type = 'ExpRept'
        GROUP BY t.tranid, t.trandate, t.type
      `;
      const expResult = await suiteQL(expQuery, 20);
      expResult.items?.forEach(r => {
        console.log(`   ${r.type} ${r.tranid}: $${parseFloat(r.total).toFixed(2)}`);
      });
    }
  } catch(e) { console.log("   Error:", e.message); }

  // 3. Check vendor bills for Miami/MCC
  console.log("\n3. Vendor Bills for Miami/MCC in 2025:");
  try {
    const query = `
      SELECT
        t.tranid, t.trandate,
        BUILTIN.DF(t.entity) as vendor,
        t.memo,
        SUM(ABS(tl.amount)) as total
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'VendBill'
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
        AND (t.memo LIKE '%Miami%' OR t.memo LIKE '%MCC%' OR t.memo LIKE '%5628%' OR t.memo LIKE '%5629%')
      GROUP BY t.tranid, t.trandate, t.entity, t.memo
    `;
    const result = await suiteQL(query, 30);
    console.log(`   Found ${result.items?.length || 0} vendor bills`);
    let total = 0;
    result.items?.forEach(r => {
      const amt = parseFloat(r.total) || 0;
      total += amt;
      console.log(`   ${r.tranid} (${r.trandate}): ${r.vendor} - $${amt.toFixed(2)} - ${r.memo}`);
    });
    console.log(`   TOTAL: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 4. Check the Sales Order linked to these WOs
  console.log("\n4. Sales Order SO6855 - looking for expense items:");
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
      WHERE t.tranid = 'SO6855'
        AND tl.mainline = 'F'
    `;
    const result = await suiteQL(query, 50);
    console.log(`   SO6855 line items:`);
    result.items?.forEach(r => {
      console.log(`   ${r.item_name}: qty=${r.quantity}, rate=${r.rate}, amt=${r.amount}, costEst=${r.costestimate}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 5. Look for ALL transactions with item 4332 (Test Bench Expense Report)
  console.log("\n5. ALL transactions with item 4332 in 2025:");
  try {
    const query = `
      SELECT
        t.type, t.tranid, t.trandate,
        tl.amount,
        tl.quantity
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE tl.item = 4332
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
        AND ABS(tl.amount) > 0
      ORDER BY t.trandate
    `;
    const result = await suiteQL(query, 100);
    const byType = {};
    result.items?.forEach(r => {
      if (!byType[r.type]) byType[r.type] = { count: 0, total: 0 };
      byType[r.type].count++;
      byType[r.type].total += Math.abs(parseFloat(r.amount) || 0);
    });
    console.log(`   Transactions by type:`);
    Object.keys(byType).forEach(type => {
      console.log(`   ${type}: ${byType[type].count} lines, total=$${byType[type].total.toFixed(2)}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 6. Check if $819 = $386.35 + something
  console.log("\n6. MATH: Looking for the missing $432.65");
  console.log("   $819 - $386.35 = $432.65");
  console.log("   $432.65 × 2 = $865.30 (close to combined difference)");

  // 7. Check WOClose transactions more carefully
  console.log("\n7. WOClose + WOIssue combined for expense item:");
  try {
    const query = `
      SELECT
        t.type,
        completionLine.createdfrom as wo_id,
        SUM(ABS(tal.amount)) as total
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom IN (1059131, 1059132)
        AND completionLine.item = 4332
        AND tal.posting = 'T'
      GROUP BY t.type, completionLine.createdfrom
    `;
    const result = await suiteQL(query, 20);
    let grandTotal = 0;
    result.items?.forEach(r => {
      const wo = r.wo_id == '1059131' ? 'WO5628' : 'WO5629';
      const amt = parseFloat(r.total) || 0;
      grandTotal += amt;
      console.log(`   ${r.type} ${wo}: $${amt.toFixed(2)}`);
    });
    console.log(`   Grand Total (all types): $${grandTotal.toFixed(2)}`);
    console.log(`   Per WO average: $${(grandTotal / 2).toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // 8. Check if there are POSITIVE amounts we're missing
  console.log("\n8. Check for POSITIVE expense amounts (credits):");
  try {
    const query = `
      SELECT
        t.type, t.tranid,
        tal.amount
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom IN (1059131, 1059132)
        AND completionLine.item = 4332
        AND tal.posting = 'T'
        AND tal.amount > 0
    `;
    const result = await suiteQL(query, 50);
    let total = 0;
    result.items?.forEach(r => {
      const amt = parseFloat(r.amount) || 0;
      total += amt;
      console.log(`   ${r.type} ${r.tranid}: $${amt.toFixed(2)}`);
    });
    console.log(`   Total positive amounts: $${total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  console.log("\n=== Done ===");
}

main().catch(console.error);
