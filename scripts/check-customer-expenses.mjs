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
  console.log("=== Checking Customer/Entity-linked Expenses ===\n");

  // 1. Find the customer for SO6855
  console.log("1. Finding customer for SO6855:");
  try {
    const query = `
      SELECT
        t.id, t.tranid,
        t.entity,
        BUILTIN.DF(t.entity) as customer_name
      FROM Transaction t
      WHERE t.tranid = 'SO6855'
    `;
    const result = await suiteQL(query, 1);
    const custId = result.items?.[0]?.entity;
    const custName = result.items?.[0]?.customer_name;
    console.log(`   Customer: ${custName} (ID: ${custId})`);

    if (custId) {
      // Check for expense reports linked to this customer
      console.log(`\n2. Expense Reports for customer ${custId}:`);
      const expQuery = `
        SELECT
          t.tranid, t.trandate,
          BUILTIN.DF(t.entity) as employee,
          tl.amount,
          tl.memo
        FROM Transaction t
        JOIN TransactionLine tl ON tl.transaction = t.id
        WHERE t.type = 'ExpRept'
          AND tl.entity = ${custId}
        ORDER BY t.trandate DESC
      `;
      const expResult = await suiteQL(expQuery, 50);
      console.log(`   Found ${expResult.items?.length || 0} expense lines for this customer`);
      let total = 0;
      expResult.items?.forEach(r => {
        const amt = Math.abs(parseFloat(r.amount) || 0);
        total += amt;
        console.log(`   ${r.tranid} (${r.trandate}): ${r.employee} - $${amt.toFixed(2)} - ${r.memo || ''}`);
      });
      console.log(`   Total: $${total.toFixed(2)}`);
    }
  } catch(e) { console.log("   Error:", e.message); }

  // 3. Look for expense reports that have line items linked to our WOs or SO
  console.log("\n3. Expense report lines with createdfrom linking to SO/WO:");
  try {
    const query = `
      SELECT
        t.tranid as exp_report,
        t.trandate,
        BUILTIN.DF(t.entity) as employee,
        tl.createdfrom,
        BUILTIN.DF(tl.createdfrom) as linked_to,
        ABS(tl.amount) as amount
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'ExpRept'
        AND tl.createdfrom IN (1059130, 1059131, 1059132)
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} linked expense lines`);
    result.items?.forEach(r => {
      console.log(`   ${r.exp_report} (${r.trandate}): ${r.employee} → ${r.linked_to} = $${r.amount}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 4. Check for expense reports with class = MCC or Test Bench
  console.log("\n4. Expense reports with Test Bench class (class=1):");
  try {
    const query = `
      SELECT
        t.tranid, t.trandate,
        BUILTIN.DF(t.entity) as employee,
        SUM(ABS(tl.amount)) as total
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'ExpRept'
        AND tl.class = 1
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
      GROUP BY t.tranid, t.trandate, t.entity
      ORDER BY t.trandate DESC
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} expense reports`);
    result.items?.slice(0, 20).forEach(r => {
      console.log(`   ${r.tranid} (${r.trandate}): ${r.employee} - $${parseFloat(r.total).toFixed(2)}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 5. Check for expense reports in Dec 2025 with amounts near our targets
  console.log("\n5. ALL expense reports Nov-Dec 2025 (any amount):");
  try {
    const query = `
      SELECT
        t.tranid, t.trandate,
        BUILTIN.DF(t.entity) as employee,
        t.memo
      FROM Transaction t
      WHERE t.type = 'ExpRept'
        AND t.trandate >= TO_DATE('11/01/2025', 'MM/DD/YYYY')
      ORDER BY t.trandate
    `;
    const result = await suiteQL(query, 50);
    console.log(`   Found ${result.items?.length || 0} expense reports`);
    result.items?.forEach(r => {
      console.log(`   ${r.tranid} (${r.trandate}): ${r.employee} - ${r.memo || 'no memo'}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 6. Check Item Receipt or other transactions
  console.log("\n6. Item Receipts for expense item (4332):");
  try {
    const query = `
      SELECT
        t.type, t.tranid, t.trandate,
        tl.amount
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE tl.item = 4332
        AND t.type = 'ItemRcpt'
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
    `;
    const result = await suiteQL(query, 20);
    console.log(`   Found ${result.items?.length || 0} item receipts`);
    result.items?.forEach(r => {
      console.log(`   ${r.tranid} (${r.trandate}): $${r.amount}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // 7. Summary of what we know
  console.log("\n=== SUMMARY ===");
  console.log("WO5628/WO5629 expense from WOCompl/WOIssue: $386.35 each");
  console.log("Excel shows: $819 each");
  console.log("Difference: $432.65 each");
  console.log("\nThe second expense report may be:");
  console.log("- Linked via different mechanism (project/class)");
  console.log("- In a different transaction type");
  console.log("- Calculated via a saved search formula");

  console.log("\n=== Done ===");
}

main().catch(console.error);
