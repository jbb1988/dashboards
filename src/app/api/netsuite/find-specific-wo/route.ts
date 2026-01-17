/**
 * API Route: /api/netsuite/find-specific-wo
 * Search for specific WO numbers we know exist
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const knownWOs = ['WO6902', 'WO6907', 'WO6922', 'WO6916', 'WO6917', 'WO6918', 'WO6920', 'WO6921'];
    const results: any = {
      timestamp: new Date().toISOString(),
      searches: [],
    };

    // Try each known WO number in Transaction table with ANY type
    console.log('Searching for known WO numbers in Transaction table...');
    for (const woNum of knownWOs.slice(0, 3)) {
      try {
        const query = `
          SELECT *
          FROM Transaction
          WHERE tranid = '${woNum}'
        `;

        const response = await netsuiteRequest<{ items: any[] }>(
          '/services/rest/query/v1/suiteql',
          {
            method: 'POST',
            body: { q: query },
            params: { limit: '1' },
          }
        );

        if (response.items && response.items.length > 0) {
          results.searches.push({
            table: 'Transaction',
            woNumber: woNum,
            found: true,
            record: response.items[0],
            allFields: Object.keys(response.items[0]).sort(),
          });
          console.log(`✓ Found ${woNum} in Transaction table, type: ${response.items[0].type}`);
        } else {
          results.searches.push({
            table: 'Transaction',
            woNumber: woNum,
            found: false,
          });
        }
      } catch (error) {
        results.searches.push({
          table: 'Transaction',
          woNumber: woNum,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Try searching in potential manufacturing tables
    const potentialTables = [
      'manufacturingoperationtask',
      'workorder',
      'assemblyitem',
      'assemblybuild',
    ];

    for (const tableName of potentialTables) {
      try {
        const query = `
          SELECT *
          FROM ${tableName}
          LIMIT 5
        `;

        const response = await netsuiteRequest<{ items: any[] }>(
          '/services/rest/query/v1/suiteql',
          {
            method: 'POST',
            body: { q: query },
            params: { limit: '5' },
          }
        );

        if (response.items && response.items.length > 0) {
          results.searches.push({
            table: tableName,
            found: true,
            sampleCount: response.items.length,
            samples: response.items,
            allFields: Object.keys(response.items[0]).sort(),
          });
          console.log(`✓ Found ${tableName} table with ${response.items.length} records`);
        }
      } catch (error) {
        // Table doesn't exist or not accessible
      }
    }

    // Try using REST API record endpoint directly
    console.log('Trying REST record API for work orders...');
    try {
      const recordResponse = await netsuiteRequest<any>(
        '/services/rest/record/v1/workOrder',
        {
          method: 'GET',
          params: { limit: '5' },
        }
      );

      results.searches.push({
        method: 'REST Record API',
        endpoint: '/services/rest/record/v1/workOrder',
        found: true,
        response: recordResponse,
      });
      console.log('✓ Found work orders via REST record API');
    } catch (error) {
      results.searches.push({
        method: 'REST Record API',
        endpoint: '/services/rest/record/v1/workOrder',
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
