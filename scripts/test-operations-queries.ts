/**
 * Test script for Operations Command Center NetSuite queries
 * Run with: npx tsx scripts/test-operations-queries.ts
 */

// Load env vars FIRST before any other imports
import { config } from 'dotenv';
const result = config({ path: '.env.local' });
console.log('Dotenv loaded:', result.parsed ? Object.keys(result.parsed).length + ' vars' : 'FAILED');
console.log('NETSUITE_ACCOUNT_ID:', process.env.NETSUITE_ACCOUNT_ID);

// Now import the module that uses env vars
import { netsuiteRequest } from '../src/lib/netsuite';

async function testSalesOrderQuery() {
  console.log('\n=== Testing Sales Order Aging Query ===\n');

  const query = `
    SELECT
      so.id,
      so.tranid,
      so.trandate,
      so.status,
      so.entity AS customer_id,
      BUILTIN.DF(so.entity) AS customer_name,
      so.total AS total_amount,
      ROUND(SYSDATE - so.trandate) AS days_open
    FROM Transaction so
    WHERE so.type = 'SalesOrd'
      AND so.status NOT IN ('Closed', 'Cancelled', 'Billed', 'H', 'G')
    ORDER BY so.trandate
  `;

  try {
    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '10' },
      }
    );

    console.log('Response:', JSON.stringify(response, null, 2));
    console.log(`\nFound ${response.items?.length || 0} sales orders`);

    if (response.items?.length > 0) {
      console.log('\nFirst order:', response.items[0]);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testInventoryQuery() {
  console.log('\n=== Testing Full Inventory Query ===\n');

  // Use itemtype (not type) and all validated fields
  const query = `
    SELECT
      item.id,
      item.itemid,
      item.displayname,
      item.itemtype AS item_type,
      COALESCE(item.quantityonhand, 0) AS quantity_on_hand,
      COALESCE(item.quantityavailable, 0) AS quantity_available,
      COALESCE(item.quantitybackordered, 0) AS quantity_backordered,
      COALESCE(item.averagecost, item.lastpurchaseprice, item.cost, 0) AS unit_cost,
      item.reorderpoint,
      item.preferredstocklevel,
      item.location AS location_id,
      BUILTIN.DF(item.location) AS location_name
    FROM Item item
    WHERE item.isinactive = 'F'
      AND item.itemtype IN ('InvtPart', 'Assembly')
    ORDER BY item.itemid
  `;

  try {
    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '10' },
      }
    );

    console.log('Response:', JSON.stringify(response, null, 2));
    console.log(`\nFound ${response.items?.length || 0} inventory items`);

    if (response.items?.length > 0) {
      console.log('\nFirst item:', response.items[0]);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testSimpleQuery() {
  console.log('\n=== Testing Simple Transaction Query ===\n');

  // Start with a very simple query to verify connection
  const query = `
    SELECT id, tranid, type, status
    FROM Transaction
    WHERE type = 'SalesOrd'
    ORDER BY id DESC
  `;

  try {
    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '5' },
      }
    );

    console.log('Response:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testItemFields() {
  console.log('\n=== Testing Item Fields Available ===\n');

  // Try different fields to see which ones exist
  const fieldsToTest = [
    'quantityonhand',
    'quantityavailable',
    'quantitybackordered',
    'averagecost',
    'lastpurchaseprice',
    'cost',
    'reorderpoint',
    'preferredstocklevel',
    'location',
  ];

  for (const field of fieldsToTest) {
    const query = `
      SELECT item.id, item.itemid, item.${field}
      FROM Item item
      WHERE item.isinactive = 'F'
        AND item.itemtype = 'InvtPart'
      ORDER BY item.id
    `;

    try {
      const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '3' },
        }
      );
      console.log(`✓ ${field}: exists - sample:`, response.items?.[0]?.[field]);
    } catch (error: any) {
      console.log(`✗ ${field}: NOT AVAILABLE`);
    }
  }
}

async function testSalesOrderStatuses() {
  console.log('\n=== Testing Sales Order Statuses ===\n');

  const query = `
    SELECT DISTINCT so.status, COUNT(*) as count
    FROM Transaction so
    WHERE so.type = 'SalesOrd'
    GROUP BY so.status
    ORDER BY count DESC
  `;

  try {
    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '20' },
      }
    );

    console.log('Sales Order statuses:', JSON.stringify(response.items, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testFulfillmentQuery() {
  console.log('\n=== Testing Fulfillment Query ===\n');

  const query = `
    SELECT
      if.id,
      if.tranid,
      if.trandate,
      if.shipdate AS ship_date,
      if.status,
      BUILTIN.DF(if.entity) AS customer_name
    FROM Transaction if
    WHERE if.type = 'ItemShip'
      AND if.trandate >= SYSDATE - 90
    ORDER BY if.trandate DESC
  `;

  try {
    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '5' },
      }
    );

    console.log('Response:', JSON.stringify(response, null, 2));
    console.log(`\nFound ${response.items?.length || 0} fulfillments (${response.totalResults} total)`);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testLibraryFunctions() {
  console.log('\n=== Testing Library Functions ===\n');

  // Import the actual library functions
  const { getOrderMetrics } = await import('../src/lib/netsuite-order-metrics');
  const { getInventoryMetrics } = await import('../src/lib/netsuite-inventory-metrics');

  console.log('Testing getOrderMetrics...');
  try {
    const orderMetrics = await getOrderMetrics();
    console.log('Order Metrics Summary:');
    console.log('  Total Open Orders:', orderMetrics.totalOpenOrders);
    console.log('  Total Backlog Value:', orderMetrics.totalBacklogValue);
    console.log('  Revenue at Risk:', orderMetrics.revenueAtRisk);
    console.log('  On-Time Delivery %:', orderMetrics.onTimeDeliveryPct);
    console.log('  Aging 90+:', orderMetrics.aging90Plus.count, 'orders, $', orderMetrics.aging90Plus.value);
  } catch (error: any) {
    console.error('getOrderMetrics failed:', error.message);
  }

  console.log('\nTesting getInventoryMetrics...');
  try {
    const inventoryMetrics = await getInventoryMetrics();
    console.log('Inventory Metrics Summary:');
    console.log('  Total Inventory Value:', inventoryMetrics.totalInventoryValue);
    console.log('  Total Items On Hand:', inventoryMetrics.totalItemsOnHand);
    console.log('  Low Stock Items:', inventoryMetrics.lowStockItemCount);
    console.log('  Backordered Items:', inventoryMetrics.totalBackorderedItems);
  } catch (error: any) {
    console.error('getInventoryMetrics failed:', error.message);
  }
}

async function main() {
  console.log('Testing Operations Command Center NetSuite Queries...\n');

  // Test in order of complexity
  await testSimpleQuery();
  await testSalesOrderQuery();
  await testFulfillmentQuery();
  await testItemFields();
  await testInventoryQuery();

  // Test the actual library functions
  await testLibraryFunctions();
}

main().catch(console.error);
