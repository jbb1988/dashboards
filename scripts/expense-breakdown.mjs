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
  console.log("=== Detailed Expense Breakdown for WO5628/WO5629 ===\n");

  // Get EVERY expense item transaction line with full detail
  console.log("1. Every expense item (4332) GL posting:");
  try {
    const query = `
      SELECT
        t.type,
        t.tranid,
        t.trandate,
        completionLine.createdfrom as wo_id,
        tal.amount,
        tal.account,
        BUILTIN.DF(tal.account) as account_name
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = completionLine.id
      WHERE completionLine.createdfrom IN (1059131, 1059132)
        AND completionLine.item = 4332
        AND tal.posting = 'T'
      ORDER BY completionLine.createdfrom, t.type, tal.amount
    `;
    const result = await suiteQL(query, 100);

    let wo5628_negative = 0;
    let wo5628_positive = 0;
    let wo5629_negative = 0;
    let wo5629_positive = 0;

    console.log("\n   WO5628 entries:");
    result.items?.filter(r => r.wo_id == '1059131').forEach(r => {
      const amt = parseFloat(r.amount);
      console.log(`   ${r.type} ${r.tranid} (${r.trandate}): $${amt.toFixed(2)} → ${r.account_name}`);
      if (amt < 0) wo5628_negative += Math.abs(amt);
      else wo5628_positive += amt;
    });

    console.log("\n   WO5629 entries:");
    result.items?.filter(r => r.wo_id == '1059132').forEach(r => {
      const amt = parseFloat(r.amount);
      console.log(`   ${r.type} ${r.tranid} (${r.trandate}): $${amt.toFixed(2)} → ${r.account_name}`);
      if (amt < 0) wo5629_negative += Math.abs(amt);
      else wo5629_positive += amt;
    });

    console.log("\n   SUMMARY:");
    console.log(`   WO5628: Debits=$${wo5628_negative.toFixed(2)}, Credits=$${wo5628_positive.toFixed(2)}, Net=$${(wo5628_negative - wo5628_positive).toFixed(2)}`);
    console.log(`   WO5629: Debits=$${wo5629_negative.toFixed(2)}, Credits=$${wo5629_positive.toFixed(2)}, Net=$${(wo5629_negative - wo5629_positive).toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  // Check WO line items for expense - maybe quantity is the key
  console.log("\n2. WO Line items - expense qty breakdown:");
  try {
    const query = `
      SELECT
        t.tranid as wo,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.costestimate,
        tl.linesequencenumber
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid IN ('WO5628', 'WO5629')
        AND tl.item = 4332
      ORDER BY t.tranid, tl.linesequencenumber
    `;
    const result = await suiteQL(query, 20);
    console.log("\n   WO5628 expense lines:");
    result.items?.filter(r => r.wo == 'WO5628').forEach(r => {
      console.log(`   Line ${r.linesequencenumber}: qty=${r.quantity}, rate=${r.rate}, amt=${r.amount}, costEst=${r.costestimate}`);
    });
    console.log("\n   WO5629 expense lines:");
    result.items?.filter(r => r.wo == 'WO5629').forEach(r => {
      console.log(`   Line ${r.linesequencenumber}: qty=${r.quantity}, rate=${r.rate}, amt=${r.amount}, costEst=${r.costestimate}`);
    });
  } catch(e) { console.log("   Error:", e.message); }

  // Check if $819 relates to the COMBINED expense for both WOs
  console.log("\n3. Possible calculations:");
  const wo_expense = 386.35;
  console.log(`   Single WO expense (WOClose or WOIssue debits): $${wo_expense}`);
  console.log(`   Combined both WOs: $${(wo_expense * 2).toFixed(2)}`);
  console.log(`   WOClose + WOIssue debits per WO: $${(wo_expense * 2).toFixed(2)}`);
  console.log(`   Target Excel value: $819`);
  console.log(`   Ratio: ${(819 / wo_expense).toFixed(4)}`);
  console.log(`   $386.35 × 2.12 = $${(386.35 * 2.12).toFixed(2)}`);

  // Maybe they're using transaction line amounts, not TAL
  console.log("\n4. Transaction Line amounts (not accounting lines):");
  try {
    const query = `
      SELECT
        t.type,
        t.tranid,
        completionLine.createdfrom as wo_id,
        completionLine.amount as line_amount
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      WHERE completionLine.createdfrom IN (1059131, 1059132)
        AND completionLine.item = 4332
        AND t.type IN ('WOClose', 'WOIssue', 'WOCompl')
      ORDER BY wo_id, t.type
    `;
    const result = await suiteQL(query, 50);
    let wo5628_total = 0;
    let wo5629_total = 0;
    result.items?.forEach(r => {
      const amt = Math.abs(parseFloat(r.line_amount) || 0);
      console.log(`   ${r.type} ${r.tranid} (WO${r.wo_id == '1059131' ? '5628' : '5629'}): $${amt.toFixed(2)}`);
      if (r.wo_id == '1059131') wo5628_total += amt;
      else wo5629_total += amt;
    });
    console.log(`\n   WO5628 line amount total: $${wo5628_total.toFixed(2)}`);
    console.log(`   WO5629 line amount total: $${wo5629_total.toFixed(2)}`);
  } catch(e) { console.log("   Error:", e.message); }

  console.log("\n=== Done ===");
}

main().catch(console.error);
