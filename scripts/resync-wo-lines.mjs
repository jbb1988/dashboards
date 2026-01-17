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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncWOLines(woNumber, netsuiteId, woDbId) {
  const query = `
    SELECT
      tl.id AS line_id,
      tl.linesequencenumber AS line_number,
      tl.item AS item_id,
      i.itemid AS item_name,
      i.displayname AS item_display_name,
      i.description AS item_description,
      tl.itemtype AS item_type,
      tl.quantity,
      tl.quantityshiprecv AS quantity_completed,
      tl.rate AS unit_cost,
      tl.netamount AS line_cost,
      tl.location AS location_id,
      tl.class AS class_id,
      tl.isclosed
    FROM transactionline tl
    LEFT JOIN item i ON i.id = tl.item
    WHERE tl.transaction = '${netsuiteId}'
      AND tl.mainline = 'F'
      AND tl.item IS NOT NULL
    ORDER BY tl.linesequencenumber
  `;

  const response = await netsuiteRequest('/services/rest/query/v1/suiteql', {
    method: 'POST',
    body: { q: query },
    params: { limit: '1000' },
  });

  const lines = response.items || [];
  console.log(`${woNumber}: Fetched ${lines.length} lines from NetSuite`);

  if (lines.length > 0) {
    const sampleLine = lines[0];
    console.log(`  Sample: ${sampleLine.item_name || 'no name'}, qty=${sampleLine.quantity}, unit_cost=${sampleLine.unit_cost}, line_cost=${sampleLine.line_cost}`);
  }

  // Insert lines
  for (const line of lines) {
    const lineRecord = {
      work_order_id: woDbId,
      netsuite_line_id: line.line_id || '',
      line_number: parseInt(line.line_number) || 0,
      item_id: line.item_id || null,
      item_name: line.item_name || line.item_display_name || null,
      item_description: line.item_description || null,
      item_type: line.item_type || null,
      quantity: parseFloat(line.quantity) || null,
      quantity_completed: parseFloat(line.quantity_completed) || null,
      unit_cost: parseFloat(line.unit_cost) || null,
      line_cost: parseFloat(line.line_cost) || null,
      class_id: line.class_id || null,
      location_id: line.location_id || null,
      is_closed: line.isclosed === 'T',
    };

    await supabase.from('netsuite_work_order_lines').insert(lineRecord);
  }

  return lines.length;
}

async function main() {
  const sarasotaWOs = ['WO5346', 'WO6721', 'WO6722', 'WO6723', 'WO6725', 'WO6783'];

  const { data: wos } = await supabase
    .from('netsuite_work_orders')
    .select('id, wo_number, netsuite_id')
    .in('wo_number', sarasotaWOs);

  console.log(`Found ${wos?.length} WOs to sync`);

  let totalLines = 0;
  for (const wo of wos || []) {
    try {
      const count = await syncWOLines(wo.wo_number, wo.netsuite_id, wo.id);
      totalLines += count;
    } catch (error) {
      console.error(`Error syncing ${wo.wo_number}:`, error.message);
    }
  }

  console.log(`\n✓ Total lines synced: ${totalLines}`);
}

main().catch(console.error);
