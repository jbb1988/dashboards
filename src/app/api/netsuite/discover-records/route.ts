/**
 * API Route: /api/netsuite/discover-records
 * Discover what record types and metadata exist
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      discoveries: [],
    };

    // Discovery 1: Get all unique recordtype values from Transaction
    console.log('Discovery 1: Finding all record types in Transaction table...');
    try {
      const query = `
        SELECT DISTINCT recordtype
        FROM Transaction
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '100' },
        }
      );

      results.discoveries.push({
        name: 'Transaction Record Types',
        success: true,
        recordTypes: (response.items || []).map(item => item.recordtype).sort(),
      });
    } catch (error) {
      results.discoveries.push({
        name: 'Transaction Record Types',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Discovery 2: Get all unique customform values (shows what forms/types exist)
    console.log('Discovery 2: Finding all custom forms...');
    try {
      const query = `
        SELECT DISTINCT customform, type
        FROM Transaction
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '100' },
        }
      );

      results.discoveries.push({
        name: 'Custom Forms by Type',
        success: true,
        forms: response.items || [],
      });
    } catch (error) {
      results.discoveries.push({
        name: 'Custom Forms',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Discovery 3: Check metadata endpoint for available record types
    console.log('Discovery 3: Checking metadata catalog...');
    try {
      const response = await netsuiteRequest<any>(
        '/services/rest/record/v1/metadata-catalog',
        {
          method: 'GET',
        }
      );

      results.discoveries.push({
        name: 'Metadata Catalog',
        success: true,
        catalog: response,
      });
    } catch (error) {
      results.discoveries.push({
        name: 'Metadata Catalog',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Discovery 4: Try to get work order metadata specifically
    console.log('Discovery 4: Getting work order metadata...');
    try {
      const response = await netsuiteRequest<any>(
        '/services/rest/record/v1/metadata-catalog/workOrder',
        {
          method: 'GET',
        }
      );

      results.discoveries.push({
        name: 'Work Order Metadata',
        success: true,
        metadata: response,
      });
    } catch (error) {
      results.discoveries.push({
        name: 'Work Order Metadata',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Discovery 5: Search for transactions with 'WO' in tranid
    console.log('Discovery 5: Searching for transactions with WO prefix...');
    try {
      const query = `
        SELECT *
        FROM Transaction
        WHERE tranid LIKE 'WO%'
          AND trandate >= TO_DATE('2026-01-01', 'YYYY-MM-DD')
        ORDER BY trandate DESC
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '10' },
        }
      );

      if (response.items && response.items.length > 0) {
        results.discoveries.push({
          name: 'Transactions with WO prefix',
          success: true,
          found: true,
          count: response.items.length,
          samples: response.items,
          allFields: Object.keys(response.items[0]).sort(),
        });
        console.log(`✓✓✓ FOUND ${response.items.length} transactions with WO prefix!`);
      } else {
        results.discoveries.push({
          name: 'Transactions with WO prefix',
          success: true,
          found: false,
          count: 0,
        });
      }
    } catch (error) {
      results.discoveries.push({
        name: 'Transactions with WO prefix',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      {
        error: 'Discovery failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
