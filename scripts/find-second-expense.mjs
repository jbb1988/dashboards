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
  console.log("=== Finding Second Expense Report ($432.72) ===\n");
  console.log("We have: $386.35 from WOCompl/WOIssue");
  console.log("Missing: $432.72 (second technician)\n");

  // 1. Look for ALL expense items (4332) linked to Sales Order SO6855
  console.log("1. All expense item (4332) entries linked to SO6855:");
  try {
    const query = `
      SELECT
        t.type, t.tranid, t.trandate,
        tl.amount,
        tl.createdfrom,
        BUILTIN.DF(tl.createdfrom) as from_name
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE tl.item = 4332
        AND (tl.createdfrom IN (
          SELECT tl2.transaction FROM TransactionLine tl2
          JOIN Transaction t2 ON t2.id = tl2.transaction
          WHERE t2.tranid = 'SO6855'
        ) OR t.tranid = 'SO6855')
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} entries`);
    result.items?.forEach(r => {
      console.log(`   ${r.type} ${r.tranid}: $${r.amount} (from: ${r.from_name})`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 2. Look for expense reports with amounts close to $432.72
  console.log("\n2. Expense amounts near $432.72 in item 4332 transactions:");
  try {
    const query = `
      SELECT
        t.type, t.tranid, t.trandate,
        completionLine.createdfrom,
        BUILTIN.DF(completionLine.createdfrom) as wo_name,
        ABS(tal.amount) as amount
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.item = 4332
        AND tal.posting = 'T'
        AND ABS(tal.amount) BETWEEN 400 AND 500
      ORDER BY ABS(tal.amount) DESC
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} entries between $400-$500:`);
    result.items?.forEach(r => {
      console.log(`   ${r.type} ${r.tranid} (${r.trandate}): $${parseFloat(r.amount).toFixed(2)} - ${r.wo_name}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 3. Check if there are OTHER work orders for this project
  console.log("\n3. All Work Orders linked to SO6855:");
  try {
    const query = `
      SELECT
        t.id, t.tranid, t.trandate, t.status,
        tl.createdfrom,
        BUILTIN.DF(tl.createdfrom) as so_name
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'WorkOrd'
        AND tl.createdfrom IN (
          SELECT id FROM Transaction WHERE tranid = 'SO6855'
        )
    `;
    const result = await suiteQL(query, 20);
    console.log(`   Found ${result.items?.length || 0} work orders`);
    const wos = new Set();
    result.items?.forEach(r => {
      if (!wos.has(r.tranid)) {
        wos.add(r.tranid);
        console.log(`   ${r.tranid} (ID: ${r.id}) - ${r.status}`);
      }
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 4. Get the SO6855 ID and find ALL related WOs
  console.log("\n4. Finding SO6855 ID and related transactions:");
  try {
    const soQuery = `SELECT id, tranid FROM Transaction WHERE tranid = 'SO6855'`;
    const soResult = await suiteQL(soQuery, 1);
    const soId = soResult.items?.[0]?.id;
    console.log(`   SO6855 ID: ${soId}`);

    if (soId) {
      const woQuery = `
        SELECT DISTINCT
          t.id, t.tranid, t.type
        FROM Transaction t
        JOIN TransactionLine tl ON tl.transaction = t.id
        WHERE tl.createdfrom = ${soId}
          AND t.type = 'WorkOrd'
      `;
      const woResult = await suiteQL(woQuery, 20);
      console.log(`   Work Orders from SO6855:`);
      woResult.items?.forEach(r => {
        console.log(`   ${r.tranid} (ID: ${r.id})`);
      });
    }
  } catch(e) { console.log("   Error:", e.message); }

  // 5. Look for ALL expense item costs across ALL WOs, find ones we might be missing
  console.log("\n5. All expense item (4332) costs by WO (looking for $432.72):");
  try {
    const query = `
      SELECT
        completionLine.createdfrom as wo_id,
        BUILTIN.DF(completionLine.createdfrom) as wo_name,
        SUM(CASE WHEN tal.amount < 0 THEN ABS(tal.amount) ELSE 0 END) as debit_total
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.item = 4332
        AND tal.posting = 'T'
        AND t.type IN ('WOCompl', 'WOIssue', 'WOClose')
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
      GROUP BY completionLine.createdfrom
      ORDER BY debit_total DESC
    `;
    const result = await suiteQL(query, 50);
    result.items?.forEach(r => {
      const amt = parseFloat(r.debit_total);
      const marker = (amt > 400 && amt < 450) ? ' *** POSSIBLE MATCH' : '';
      console.log(`   ${r.wo_name}: $${amt.toFixed(2)}${marker}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 6. Check for expense items with specific amounts $161, $225.35, or components of $432.72
  console.log("\n6. Breaking down $432.72 - looking for component amounts:");
  console.log("   $432.72 could be: $225.35 + $207.37, or $271.72 + $161, etc.");
  try {
    const query = `
      SELECT
        completionLine.createdfrom as wo_id,
        BUILTIN.DF(completionLine.createdfrom) as wo_name,
        ABS(tal.amount) as amount,
        t.type, t.tranid
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.item = 4332
        AND tal.posting = 'T'
        AND tal.amount < 0
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
        AND ABS(tal.amount) BETWEEN 200 AND 300
      ORDER BY ABS(tal.amount) DESC
    `;
    const result = await suiteQL(query, 100);
    console.log(`   Amounts between $200-$300:`);
    const seen = new Set();
    result.items?.forEach(r => {
      const key = `${r.wo_name}-${r.amount}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.log(`   ${r.wo_name}: $${parseFloat(r.amount).toFixed(2)}`);
      }
    });
  } catch(e) { console.log("   Error:", e.message); }

  console.log("\n=== Done ===");
}

main().catch(console.error);
