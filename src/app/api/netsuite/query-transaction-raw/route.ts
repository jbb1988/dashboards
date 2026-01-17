/**
 * API Route: /api/netsuite/query-transaction-raw
 * Query Transaction table directly with SuiteQL using lowercase 'transaction'
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      queries: [],
    };

    // Query 1: Get recent transactions from lowercase 'transaction' table
    console.log('Query 1: Recent transactions from lowercase table...');
    try {
      const query = `
        SELECT
          id,
          tranid,
          type,
          trandate,
          entity,
          memo
        FROM transaction
        WHERE trandate >= TO_DATE('2026-01-01', 'YYYY-MM-DD')
        ORDER BY trandate DESC
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '20' },
        }
      );

      results.queries.push({
        name: 'Recent transactions (lowercase)',
        success: true,
        count: response.items?.length || 0,
        samples: response.items || [],
        types: [...new Set((response.items || []).map((item: any) => item.type))].sort(),
      });

      console.log(`Found ${response.items?.length || 0} transactions`);
    } catch (error) {
      results.queries.push({
        name: 'Recent transactions (lowercase)',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Query 2: Try with TransactionLine join to get mainline
    console.log('Query 2: With TransactionLine join...');
    try {
      const query = `
        SELECT
          t.id,
          t.tranid,
          t.type,
          t.trandate,
          tl.id as line_id
        FROM transaction t
        INNER JOIN transactionline tl ON tl.transaction = t.id
        WHERE t.trandate >= TO_DATE('2026-01-01', 'YYYY-MM-DD')
          AND tl.mainline = 'T'
        ORDER BY t.trandate DESC
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '20' },
        }
      );

      results.queries.push({
        name: 'With TransactionLine mainline=T',
        success: true,
        count: response.items?.length || 0,
        samples: response.items || [],
        types: [...new Set((response.items || []).map((item: any) => item.type))].sort(),
      });

      console.log(`Found ${response.items?.length || 0} transactions with mainline`);
    } catch (error) {
      results.queries.push({
        name: 'With TransactionLine mainline=T',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Query 3: Search for WO5346 specifically (needed for Sarasota MCC 2025)
    console.log('Query 3: Searching for WO5346...');
    try {
      const query = `
        SELECT
          t.id,
          t.tranid,
          t.type,
          t.trandate,
          t.entity,
          t.memo,
          t.status
        FROM transaction t
        WHERE t.tranid = 'WO5346'
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '10' },
        }
      );

      results.queries.push({
        name: 'Search for WO5346',
        success: true,
        found: (response.items?.length || 0) > 0,
        count: response.items?.length || 0,
        samples: response.items || [],
      });

      if (response.items && response.items.length > 0) {
        console.log(`✓✓✓ FOUND WO5346: type=${response.items[0].type}, id=${response.items[0].id}`);
      } else {
        console.log('✗ WO5346 NOT FOUND in NetSuite');
      }
    } catch (error) {
      results.queries.push({
        name: 'Search for WO6922',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error querying transactions:', error);
    return NextResponse.json(
      {
        error: 'Query failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
