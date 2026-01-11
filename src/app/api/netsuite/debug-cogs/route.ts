import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

// Debug endpoint to find where COGS data lives in NetSuite
export async function GET() {
  try {
    const results: Record<string, any> = {};

    // Query 1: Check InventoryCosting table
    console.log('Query 1: InventoryCosting...');
    try {
      const q1 = `SELECT * FROM InventoryCosting WHERE ROWNUM <= 5`;
      const r1 = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        { method: 'POST', body: { q: q1 }, params: { limit: '5' } }
      );
      results.inventoryCosting = r1.items || [];
    } catch (e: any) {
      results.inventoryCosting = `Error: ${e.message}`;
    }

    // Query 2: Check InventoryAssignment
    console.log('Query 2: InventoryAssignment...');
    try {
      const q2 = `SELECT * FROM InventoryAssignment WHERE ROWNUM <= 5`;
      const r2 = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        { method: 'POST', body: { q: q2 }, params: { limit: '5' } }
      );
      results.inventoryAssignment = r2.items || [];
    } catch (e: any) {
      results.inventoryAssignment = `Error: ${e.message}`;
    }

    // Query 3: Check ItemCostHistory
    console.log('Query 3: ItemCostHistory...');
    try {
      const q3 = `SELECT * FROM ItemCostHistory WHERE ROWNUM <= 5`;
      const r3 = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        { method: 'POST', body: { q: q3 }, params: { limit: '5' } }
      );
      results.itemCostHistory = r3.items || [];
    } catch (e: any) {
      results.itemCostHistory = `Error: ${e.message}`;
    }

    // Query 4: Check what tables exist - list some common ones
    console.log('Query 4: Try various COGS-related queries...');

    // Try to find Item Fulfillments which trigger COGS
    try {
      const q4 = `
        SELECT
          t.tranid,
          t.type,
          t.trandate,
          BUILTIN.DF(t.entity) AS customer_name,
          tl.item,
          BUILTIN.DF(tl.item) AS item_name,
          tl.quantity,
          tl.netamount,
          tl.amount
        FROM Transaction t
        INNER JOIN TransactionLine tl ON tl.transaction = t.id
        WHERE t.type = 'ItemShip'
        ORDER BY t.trandate DESC
      `;
      const r4 = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        { method: 'POST', body: { q: q4 }, params: { limit: '20' } }
      );
      results.itemFulfillments = r4.items || [];
    } catch (e: any) {
      results.itemFulfillments = `Error: ${e.message}`;
    }

    // Query 5: Check GL Impact table
    console.log('Query 5: TransactionAccountingLine totals by account...');
    try {
      const q5 = `
        SELECT
          a.acctnumber,
          a.fullname,
          SUM(tal.debit) AS total_debit,
          SUM(tal.credit) AS total_credit
        FROM TransactionAccountingLine tal
        INNER JOIN Account a ON a.id = tal.account
        WHERE a.acctnumber LIKE '5%'
        GROUP BY a.acctnumber, a.fullname
        ORDER BY total_debit DESC
      `;
      const r5 = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        { method: 'POST', body: { q: q5 }, params: { limit: '50' } }
      );
      results.glAccountTotals = r5.items || [];
    } catch (e: any) {
      results.glAccountTotals = `Error: ${e.message}`;
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Debug COGS error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
