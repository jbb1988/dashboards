import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';

config({ path: '.env.local' });

const NETSUITE_ACCOUNT_ID = process.env.NETSUITE_ACCOUNT_ID;
const NETSUITE_CONSUMER_KEY = process.env.NETSUITE_CONSUMER_KEY;
const NETSUITE_CONSUMER_SECRET = process.env.NETSUITE_CONSUMER_SECRET;
const NETSUITE_TOKEN_ID = process.env.NETSUITE_TOKEN_ID;
const NETSUITE_TOKEN_SECRET = process.env.NETSUITE_TOKEN_SECRET;

const baseUrl = `https://${NETSUITE_ACCOUNT_ID}.suitetalk.api.netsuite.com`;

const oauth = new OAuth({
  consumer: { key: NETSUITE_CONSUMER_KEY, secret: NETSUITE_CONSUMER_SECRET },
  signature_method: 'HMAC-SHA256',
  hash_function(base_string, key) {
    return crypto.createHmac('sha256', key).update(base_string).digest('base64');
  },
});

const token = { key: NETSUITE_TOKEN_ID, secret: NETSUITE_TOKEN_SECRET };

async function netsuiteRequest(path, options = {}) {
  const url = new URL(path, baseUrl);
  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const requestData = { url: url.toString(), method: options.method || 'GET' };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      ...authHeader,
      'Content-Type': 'application/json',
      'Prefer': 'transient',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NetSuite API error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function main() {
  // Get WO6721 netsuite_id first
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: wo } = await supabase
    .from('netsuite_work_orders')
    .select('netsuite_id, wo_number')
    .eq('wo_number', 'WO6721')
    .single();

  if (!wo) {
    console.log('WO6721 not found in database');
    return;
  }

  console.log(`\nChecking WO6721 (NetSuite ID: ${wo.netsuite_id})...\n`);

  // Query all available fields for WO lines
  const query = `
    SELECT
      tl.id,
      tl.linesequencenumber,
      tl.item,
      tl.itemtype,
      tl.quantity,
      tl.quantityshiprecv,
      tl.rate,
      tl.netamount,
      tl.amount,
      tl.creditforeignamount,
      tl.debitforeignamount,
      tl.estimatedcost,
      tl.costestimatetype,
      tl.costestimate,
      tl.expectedreceiptdate,
      tl.isclosed,
      i.itemid,
      i.displayname,
      i.description,
      i.cost,
      i.averagecost,
      i.lastpurchaseprice
    FROM transactionline tl
    LEFT JOIN item i ON i.id = tl.item
    WHERE tl.transaction = '${wo.netsuite_id}'
      AND tl.mainline = 'F'
      AND tl.item IS NOT NULL
    ORDER BY tl.linesequencenumber
  `;

  const response = await netsuiteRequest('/services/rest/query/v1/suiteql', {
    method: 'POST',
    body: { q: query },
    params: { limit: '100' },
  });

  console.log(`Found ${response.items?.length || 0} lines\n`);

  if (response.items && response.items.length > 0) {
    console.log('Sample line data (first 3 lines):');
    for (const line of response.items.slice(0, 3)) {
      console.log('\n---');
      console.log(`Line ${line.linesequencenumber}: ${line.itemid || line.displayname || 'No name'}`);
      console.log(`  quantity: ${line.quantity}`);
      console.log(`  rate: ${line.rate}`);
      console.log(`  netamount: ${line.netamount}`);
      console.log(`  amount: ${line.amount}`);
      console.log(`  estimatedcost: ${line.estimatedcost}`);
      console.log(`  costestimate: ${line.costestimate}`);
      console.log(`  item.cost: ${line.cost}`);
      console.log(`  item.averagecost: ${line.averagecost}`);
      console.log(`  item.lastpurchaseprice: ${line.lastpurchaseprice}`);
    }
  }
}

main().catch(console.error);
