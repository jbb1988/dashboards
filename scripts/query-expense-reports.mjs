#!/usr/bin/env node

/**
 * Query NetSuite for Expense Reports linked to Work Orders
 */

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
  const woNumbers = ['WO5628', 'WO5629'];
  const woIds = ['1059131', '1059132']; // NetSuite IDs for WO5628 and WO5629

  console.log('=== Querying NetSuite for Expense Reports ===\n');

  // Query 1: Find expense report transaction types
  console.log('1. Checking expense report transaction types...');
  try {
    const typeQuery = `
      SELECT DISTINCT type, COUNT(*) as cnt
      FROM Transaction
      WHERE type LIKE '%Exp%'
      GROUP BY type
    `;
    const result = await suiteQL(typeQuery, 20);
    console.log('   Expense-related transaction types:', result.items);
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Query 2: Look for expense reports with createdfrom linking to our WOs
  console.log('\n2. Expense reports created from WO5628/WO5629...');
  try {
    const linkedQuery = `
      SELECT
        t.id,
        t.tranid,
        t.trandate,
        t.type,
        tl.createdfrom,
        tl.amount,
        BUILTIN.DF(tl.createdfrom) as created_from_name
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE tl.createdfrom IN (1059131, 1059132)
        AND t.type != 'WorkOrd'
      ORDER BY t.trandate
    `;
    const result = await suiteQL(linkedQuery, 50);
    console.log(`   Found ${result.items?.length || 0} linked transactions`);
    if (result.items?.length > 0) {
      console.log('   Sample:', JSON.stringify(result.items.slice(0, 5), null, 2));
    }
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Query 3: Look for expense reports by date range and class (MCC class)
  console.log('\n3. Expense reports in 2025 for MCC class...');
  try {
    const classQuery = `
      SELECT
        t.id,
        t.tranid,
        t.trandate,
        t.type,
        t.memo,
        BUILTIN.DF(t.entity) as employee,
        tl.amount,
        tl.memo as line_memo,
        BUILTIN.DF(tl.class) as class_name
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'ExpRept'
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
        AND tl.class = 1
      ORDER BY t.trandate DESC
    `;
    const result = await suiteQL(classQuery, 50);
    console.log(`   Found ${result.items?.length || 0} expense report lines for Test Bench class`);
    if (result.items?.length > 0) {
      console.log('   Sample:', JSON.stringify(result.items.slice(0, 5), null, 2));
    }
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Query 4: Check if there's a custom field linking expenses to WOs
  console.log('\n4. Looking for expense reports with WO reference in memo...');
  try {
    const memoQuery = `
      SELECT
        t.id,
        t.tranid,
        t.trandate,
        t.memo,
        BUILTIN.DF(t.entity) as employee,
        SUM(ABS(tl.amount)) as total_amount
      FROM Transaction t
      JOIN TransactionLine tl ON tl.transaction = t.id
      WHERE t.type = 'ExpRept'
        AND (t.memo LIKE '%5628%' OR t.memo LIKE '%5629%' OR t.memo LIKE '%Miami%')
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
      GROUP BY t.id, t.tranid, t.trandate, t.memo, t.entity
    `;
    const result = await suiteQL(memoQuery, 50);
    console.log(`   Found ${result.items?.length || 0} expense reports mentioning WO or Miami`);
    if (result.items?.length > 0) {
      console.log('   Results:', JSON.stringify(result.items, null, 2));
    }
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Query 5: Check for custom fields on expense reports
  console.log('\n5. Checking expense report custom fields...');
  try {
    const customQuery = `
      SELECT TOP 5
        t.id,
        t.tranid,
        t.type,
        t.custbody*
      FROM Transaction t
      WHERE t.type = 'ExpRept'
        AND t.trandate >= TO_DATE('06/01/2025', 'MM/DD/YYYY')
    `;
    const result = await suiteQL(customQuery, 5);
    console.log(`   Sample expense reports with custom fields:`, result.items);
  } catch (err) {
    // Custom field query might fail, try simpler
    console.log('   Custom field query failed, trying to list available fields...');
  }

  // Query 6: Get all expense reports for Miami customer
  console.log('\n6. Expense reports for Miami Dade Water & Sewer (entity lookup)...');
  try {
    // First find the customer ID
    const custQuery = `
      SELECT id, entityid, companyname
      FROM Customer
      WHERE companyname LIKE '%Miami%'
    `;
    const custResult = await suiteQL(custQuery, 10);
    console.log('   Miami customers:', custResult.items);

    if (custResult.items?.length > 0) {
      const custId = custResult.items[0].id;

      // Now find expense reports - but expenses are usually by employee, not customer
      // Let's check if there's a job/project field
    }
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Query 7: Look at Sales Order lines for the linked SO (SO6855)
  console.log('\n7. Checking SO6855 for expense-related data...');
  try {
    const soQuery = `
      SELECT
        tl.id as line_id,
        tl.item,
        BUILTIN.DF(tl.item) as item_name,
        tl.amount,
        tl.costestimate,
        tl.quantity
      FROM TransactionLine tl
      JOIN Transaction t ON t.id = tl.transaction
      WHERE t.tranid = 'SO6855'
        AND tl.mainline = 'F'
    `;
    const result = await suiteQL(soQuery, 50);
    console.log(`   SO6855 has ${result.items?.length || 0} line items`);
    if (result.items?.length > 0) {
      console.log('   Lines:', JSON.stringify(result.items, null, 2));
    }
  } catch (err) {
    console.error('   Error:', err.message);
  }

  console.log('\n=== Query Complete ===');
}

main().catch(console.error);
