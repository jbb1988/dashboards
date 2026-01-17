/**
 * API Route: /api/netsuite/find-wo-from-so
 * Find work orders by searching for transactions created from a sales order
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      searches: [],
    };

    // Search 1: Find SO8212 first
    console.log('Search 1: Finding SO8212...');
    try {
      const soQuery = `
        SELECT
          id,
          tranid,
          type,
          trandate,
          entity,
          status
        FROM transaction
        WHERE tranid = 'SO8212'
      `;

      const soResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: soQuery },
          params: { limit: '5' },
        }
      );

      results.searches.push({
        name: 'Find SO8212',
        success: true,
        found: (soResponse.items?.length || 0) > 0,
        salesOrder: soResponse.items?.[0] || null,
      });

      // Search 2: Find transactions created FROM SO8212
      if (soResponse.items && soResponse.items.length > 0) {
        const soId = soResponse.items[0].id;
        console.log(`Found SO8212 with ID: ${soId}, searching for child transactions...`);

        const childQuery = `
          SELECT
            t.id,
            t.tranid,
            t.type,
            t.trandate,
            t.status,
            t.entity,
            t.memo,
            tl.createdfrom
          FROM transaction t
          INNER JOIN transactionline tl ON tl.transaction = t.id AND tl.mainline = 'T'
          WHERE tl.createdfrom = '${soId}'
        `;

        const childResponse = await netsuiteRequest<{ items: any[] }>(
          '/services/rest/query/v1/suiteql',
          {
            method: 'POST',
            body: { q: childQuery },
            params: { limit: '50' },
          }
        );

        results.searches.push({
          name: 'Transactions created from SO8212',
          success: true,
          count: childResponse.items?.length || 0,
          transactions: childResponse.items || [],
          types: [...new Set((childResponse.items || []).map((item: any) => item.type))].sort(),
        });

        console.log(`Found ${childResponse.items?.length || 0} transactions created from SO8212`);
      }
    } catch (error) {
      results.searches.push({
        name: 'Find transactions from SO8212',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Search 3: Try searching by tranid pattern WO* directly
    console.log('Search 3: Searching for tranid starting with WO...');
    try {
      const woQuery = `
        SELECT
          t.id,
          t.tranid,
          t.type,
          t.trandate,
          t.status,
          t.entity,
          tl.createdfrom
        FROM transaction t
        INNER JOIN transactionline tl ON tl.transaction = t.id AND tl.mainline = 'T'
        WHERE t.tranid LIKE 'WO%'
          AND t.trandate >= TO_DATE('2026-01-01', 'YYYY-MM-DD')
        ORDER BY t.trandate DESC
      `;

      const woResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: woQuery },
          params: { limit: '10' },
        }
      );

      results.searches.push({
        name: 'Recent transactions with WO prefix',
        success: true,
        count: woResponse.items?.length || 0,
        samples: woResponse.items || [],
        types: [...new Set((woResponse.items || []).map((item: any) => item.type))].sort(),
      });

      console.log(`Found ${woResponse.items?.length || 0} transactions with WO prefix`);
    } catch (error) {
      results.searches.push({
        name: 'Recent WO prefix transactions',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching for work orders:', error);
    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
