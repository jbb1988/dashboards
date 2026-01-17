#!/usr/bin/env node

/**
 * Test script for actual costs SuiteQL query
 * Run: node scripts/test-actual-costs-query.mjs
 */

import crypto from 'crypto';

// Load env
import { config } from 'dotenv';
config({ path: '.env.local' });

const nsConfig = {
  accountId: process.env.NETSUITE_ACCOUNT_ID || '',
  consumerKey: process.env.NETSUITE_CONSUMER_KEY || '',
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || '',
  tokenId: process.env.NETSUITE_TOKEN_ID || '',
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET || '',
};

function generateOAuthSignature(method, url, oauthParams) {
  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
    .join('&');

  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(nsConfig.consumerSecret)}&${encodeURIComponent(nsConfig.tokenSecret)}`;
  return crypto.createHmac('sha256', signingKey).update(signatureBaseString).digest('base64');
}

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
  oauthParams.oauth_signature = generateOAuthSignature(method, baseUrl, allParams);

  const authHeader = Object.keys(oauthParams)
    .map((key) => `${key}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth realm="${nsConfig.accountId}", ${authHeader}`;
}

async function suiteQL(query, limit = 100) {
  const baseUrl = `https://${nsConfig.accountId.toLowerCase()}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;
  const params = { limit: limit.toString() };
  const authHeader = generateAuthHeader('POST', baseUrl, params);

  const url = `${baseUrl}?limit=${limit}`;
  console.log('Executing query:', query.trim().substring(0, 200) + '...');
  console.log('URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'transient',
    },
    body: JSON.stringify({ q: query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NetSuite error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log('\n=== Testing Actual Costs Query ===\n');

  // Test 1: Simple query for a single known WO (WO6720 -> id 1161614)
  console.log('Test 1: Single WO actual costs (WO6720)');
  try {
    const singleWOQuery = `
      SELECT
        tl.item AS item_id,
        BUILTIN.DF(tl.item) AS item_name,
        SUM(ABS(COALESCE(tal.amount, 0))) AS actual_cost
      FROM TransactionLine tl
      INNER JOIN Transaction t ON t.id = tl.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = tl.id
      WHERE tl.createdfrom = '1161614'
        AND t.type IN ('WOCompl', 'WOIssue')
        AND tal.posting = 'T'
        AND tal.amount < 0
      GROUP BY tl.item
    `;
    const result1 = await suiteQL(singleWOQuery, 100);
    console.log(`  Found ${result1.items?.length || 0} items with actual costs`);
    if (result1.items?.length > 0) {
      console.log('  Sample:', JSON.stringify(result1.items.slice(0, 3), null, 2));
    }
  } catch (err) {
    console.error('  ERROR:', err.message);
  }

  // Test 2: Count how many WO completions exist
  console.log('\nTest 2: Count WO completions in 2025');
  try {
    const countQuery = `
      SELECT COUNT(*) AS cnt
      FROM Transaction t
      WHERE t.type IN ('WOCompl', 'WOIssue')
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
    `;
    const result2 = await suiteQL(countQuery, 10);
    console.log(`  WOCompl/WOIssue count:`, result2.items?.[0]?.cnt || 0);
  } catch (err) {
    console.error('  ERROR:', err.message);
  }

  // Test 3: Simpler batch query - just get WO IDs with completions
  console.log('\nTest 3: List WOs with completions (2025)');
  try {
    const batchQuery = `
      SELECT DISTINCT
        completionLine.createdfrom AS wo_id
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      WHERE t.type IN ('WOCompl', 'WOIssue')
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
        AND completionLine.createdfrom IS NOT NULL
    `;
    const result3 = await suiteQL(batchQuery, 100);
    console.log(`  Found ${result3.items?.length || 0} WOs with completions`);
    if (result3.items?.length > 0) {
      console.log('  Sample WO IDs:', result3.items.slice(0, 5).map(r => r.wo_id));
    }
  } catch (err) {
    console.error('  ERROR:', err.message);
  }

  // Test 4: Full batch query with all data
  console.log('\nTest 4: Full batch query (first 50 records)');
  try {
    const fullQuery = `
      SELECT
        completionLine.createdfrom AS wo_id,
        completionLine.item AS item_id,
        SUM(ABS(COALESCE(tal.amount, 0))) AS actual_cost
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id
        AND tal.transactionline = completionLine.id
      WHERE t.type IN ('WOCompl', 'WOIssue')
        AND tal.posting = 'T'
        AND tal.amount < 0
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
        AND completionLine.createdfrom IS NOT NULL
      GROUP BY completionLine.createdfrom, completionLine.item
    `;
    const result4 = await suiteQL(fullQuery, 50);
    console.log(`  Found ${result4.items?.length || 0} cost records`);
    if (result4.items?.length > 0) {
      console.log('  Sample:', JSON.stringify(result4.items.slice(0, 3), null, 2));
    }
  } catch (err) {
    console.error('  ERROR:', err.message);
  }

  console.log('\n=== Tests Complete ===\n');
}

main().catch(console.error);
