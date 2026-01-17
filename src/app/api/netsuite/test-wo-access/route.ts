/**
 * API Route: /api/netsuite/test-wo-access
 * Test work order access using methods from user guidance
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: [],
    };

    // Test 1: Get DISTINCT transaction types (exactly as user specified)
    console.log('Test 1: Getting distinct transaction types...');
    try {
      const query = `
        SELECT DISTINCT type
        FROM transaction
        ORDER BY type
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '100' },
        }
      );

      const types = (response.items || []).map(item => item.type);
      results.tests.push({
        name: 'DISTINCT transaction types',
        success: true,
        types: types,
        hasWorkOrd: types.includes('WorkOrd'),
      });
      console.log('Transaction types:', types);
    } catch (error) {
      results.tests.push({
        name: 'DISTINCT transaction types',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Test 2: Query Transaction table for WorkOrd (no mainline filter)
    console.log('Test 2: Querying WorkOrd without mainline filter...');
    try {
      const query = `
        SELECT id, tranid, type, status
        FROM transaction
        WHERE type = 'WorkOrd'
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '10' },
        }
      );

      results.tests.push({
        name: 'WorkOrd query (no mainline)',
        success: true,
        count: response.items?.length || 0,
        samples: response.items || [],
      });
      console.log(`Found ${response.items?.length || 0} WorkOrd records`);
    } catch (error) {
      results.tests.push({
        name: 'WorkOrd query (no mainline)',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Test 3: Query Transaction table for WorkOrd WITH mainline='T' for headers
    console.log('Test 3: Querying WorkOrd with mainline=T...');
    try {
      const query = `
        SELECT id, tranid, type, status, trandate
        FROM transaction
        WHERE type = 'WorkOrd' AND mainline = 'T'
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

      results.tests.push({
        name: 'WorkOrd query (mainline=T)',
        success: true,
        count: response.items?.length || 0,
        samples: response.items || [],
      });
      console.log(`Found ${response.items?.length || 0} WorkOrd header records`);
    } catch (error) {
      results.tests.push({
        name: 'WorkOrd query (mainline=T)',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Test 4: REST Record API for workOrder (exactly as user specified)
    console.log('Test 4: REST Record API /workOrder...');
    try {
      const response = await netsuiteRequest<any>(
        '/services/rest/record/v1/workOrder',
        {
          method: 'GET',
          params: { limit: '5' },
        }
      );

      results.tests.push({
        name: 'REST Record API /workOrder',
        success: true,
        count: response.items?.length || 0,
        totalResults: response.totalResults || 0,
        samples: response.items || [],
        allFields: response.items?.[0] ? Object.keys(response.items[0]).sort() : [],
      });
      console.log(`REST API returned ${response.items?.length || 0} work orders`);
    } catch (error) {
      results.tests.push({
        name: 'REST Record API /workOrder',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error testing work order access:', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
