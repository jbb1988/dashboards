/**
 * API Route: /api/netsuite/find-work-orders
 * Search NetSuite for work order related tables and data
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

    // Search 1: Try WorkOrder table directly (NetSuite Manufacturing)
    console.log('Search 1: Checking WorkOrder table...');
    try {
      const woTableQuery = `
        SELECT *
        FROM WorkOrder
        WHERE trandate >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
        ORDER BY trandate DESC
      `;

      const woResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: woTableQuery },
          params: { limit: '10' },
        }
      );

      results.searches.push({
        name: 'WorkOrder Table',
        success: true,
        found: woResponse.items && woResponse.items.length > 0,
        count: woResponse.items?.length || 0,
        samples: woResponse.items || [],
        allFields: woResponse.items?.[0] ? Object.keys(woResponse.items[0]).sort() : [],
      });

      if (woResponse.items && woResponse.items.length > 0) {
        console.log(`✓ Found ${woResponse.items.length} work orders in WorkOrder table!`);
      }
    } catch (error) {
      results.searches.push({
        name: 'WorkOrder Table',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log('✗ WorkOrder table failed:', error);
    }

    // Search 2: Try ManufacturingOperationTask table
    console.log('Search 2: Checking ManufacturingOperationTask table...');
    try {
      const motQuery = `
        SELECT *
        FROM ManufacturingOperationTask
        WHERE created >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
        ORDER BY created DESC
      `;

      const motResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: motQuery },
          params: { limit: '10' },
        }
      );

      results.searches.push({
        name: 'ManufacturingOperationTask Table',
        success: true,
        found: motResponse.items && motResponse.items.length > 0,
        count: motResponse.items?.length || 0,
        samples: motResponse.items || [],
        allFields: motResponse.items?.[0] ? Object.keys(motResponse.items[0]).sort() : [],
      });

      if (motResponse.items && motResponse.items.length > 0) {
        console.log(`✓ Found ${motResponse.items.length} manufacturing tasks!`);
      }
    } catch (error) {
      results.searches.push({
        name: 'ManufacturingOperationTask Table',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log('✗ ManufacturingOperationTask table failed:', error);
    }

    // Search 3: Try Build/Assembly related tables
    console.log('Search 3: Checking Build/Assembly tables...');
    const buildTables = ['Build', 'AssemblyBuild', 'AssemblyItem'];

    for (const tableName of buildTables) {
      try {
        const buildQuery = `
          SELECT *
          FROM ${tableName}
          LIMIT 10
        `;

        const buildResponse = await netsuiteRequest<{ items: any[] }>(
          '/services/rest/query/v1/suiteql',
          {
            method: 'POST',
            body: { q: buildQuery },
            params: { limit: '10' },
          }
        );

        if (buildResponse.items && buildResponse.items.length > 0) {
          results.searches.push({
            name: `${tableName} Table`,
            success: true,
            found: true,
            count: buildResponse.items.length,
            samples: buildResponse.items,
            allFields: buildResponse.items[0] ? Object.keys(buildResponse.items[0]).sort() : [],
          });
          console.log(`✓ Found ${buildResponse.items.length} records in ${tableName} table!`);
        }
      } catch (error) {
        // Silently skip tables that don't exist
        console.log(`✗ ${tableName} table not accessible`);
      }
    }

    // Search 4: Check Transaction table for Build-related types
    console.log('Search 4: Checking for Build transaction types...');
    try {
      const buildTransQuery = `
        SELECT *
        FROM Transaction
        WHERE type LIKE '%Build%'
          OR type LIKE '%Assem%'
          OR type LIKE '%Work%'
        ORDER BY trandate DESC
      `;

      const buildTransResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: buildTransQuery },
          params: { limit: '10' },
        }
      );

      results.searches.push({
        name: 'Transaction Build Types',
        success: true,
        found: buildTransResponse.items && buildTransResponse.items.length > 0,
        count: buildTransResponse.items?.length || 0,
        samples: buildTransResponse.items || [],
      });
    } catch (error) {
      results.searches.push({
        name: 'Transaction Build Types',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Search 5: Look for recent transactions and see what types exist
    console.log('Search 5: Getting recent transaction type distribution...');
    try {
      const recentQuery = `
        SELECT DISTINCT type
        FROM Transaction
        WHERE trandate >= TO_DATE('2024-01-01', 'YYYY-MM-DD')
      `;

      const recentResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: recentQuery },
          params: { limit: '100' },
        }
      );

      results.searches.push({
        name: 'All Transaction Types (2024-2025)',
        success: true,
        types: (recentResponse.items || []).map(item => item.type).sort(),
      });
    } catch (error) {
      results.searches.push({
        name: 'All Transaction Types',
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
