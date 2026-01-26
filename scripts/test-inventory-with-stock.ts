/**
 * Quick test to check if any items have stock
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { netsuiteRequest } from '../src/lib/netsuite';

async function main() {
  console.log('Checking inventory fields...\n');

  // First, check what quantityonhand values look like
  const sampleQuery = `
    SELECT
      item.id,
      item.itemid,
      item.quantityonhand,
      item.quantityavailable,
      item.quantitycommitted,
      item.quantitybackordered
    FROM Item item
    WHERE item.isinactive = 'F'
      AND item.itemtype = 'InvtPart'
    ORDER BY item.id
  `;

  console.log('Sample inventory values:');
  const sampleResponse = await netsuiteRequest<{ items: any[] }>(
    '/services/rest/query/v1/suiteql',
    { method: 'POST', body: { q: sampleQuery }, params: { limit: '10' } }
  );
  console.log(JSON.stringify(sampleResponse.items, null, 2));

  // Check if there's an InventoryBalance table instead
  console.log('\n\nChecking InventoryBalance table...');
  const balanceQuery = `
    SELECT TOP 10
      ib.item,
      ib.quantityonhand,
      ib.quantityavailable,
      ib.location
    FROM InventoryBalance ib
  `;

  try {
    const balanceResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: balanceQuery }, params: { limit: '10' } }
    );
    console.log('InventoryBalance data:', JSON.stringify(balanceResponse.items, null, 2));
  } catch (error: any) {
    console.log('InventoryBalance table error:', error.message);
  }

  // Check aggregated inventory balance
  console.log('\n\nChecking aggregated inventory...');
  const aggQuery = `
    SELECT
      item.id,
      item.itemid,
      item.displayname,
      item.quantityonhand AS qty_on_hand,
      item.quantityavailable AS qty_available,
      COALESCE(item.averagecost, 0) AS unit_cost
    FROM Item item
    WHERE item.isinactive = 'F'
      AND item.itemtype IN ('InvtPart', 'Assembly')
      AND item.quantityonhand > 0
    ORDER BY item.quantityonhand DESC
  `;

  const response = await netsuiteRequest<{ items: any[]; totalResults: number }>(
    '/services/rest/query/v1/suiteql',
    {
      method: 'POST',
      body: { q: aggQuery },
      params: { limit: '20' },
    }
  );

  console.log(`Found ${response.totalResults} items with stock\n`);

  if (response.items?.length > 0) {
    console.log('Top items with stock:');
    for (const item of response.items) {
      const value = (parseFloat(item.qty_on_hand) || 0) * (parseFloat(item.unit_cost) || 0);
      console.log(`  ${item.itemid}: ${item.qty_on_hand} on hand @ $${item.unit_cost} = $${value.toFixed(2)}`);
    }
  }
}

main().catch(console.error);
