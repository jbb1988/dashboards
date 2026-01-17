/**
 * API Route: /api/netsuite/diagnose-transactions
 * Diagnostic endpoint to discover what transaction types exist in NetSuite
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      tests: [],
    };

    // Test 1: Get all unique transaction types by scanning many transactions
    console.log('Test 1: Finding unique transaction types...');
    try {
      const typeQuery = `
        SELECT DISTINCT
          type
        FROM Transaction
        ORDER BY type
      `;

      const typeResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: typeQuery },
          params: { limit: '1000' },
        }
      );

      const types = (typeResponse.items || []).map(item => item.type);

      diagnostics.tests.push({
        name: 'Unique Transaction Types',
        success: true,
        types: types,
        totalTypes: types.length,
      });

      console.log('Transaction types found:', types.length);
      console.log('Types:', types);
    } catch (error) {
      diagnostics.tests.push({
        name: 'Unique Transaction Types',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Test 2: Get sample recent transactions with type
    console.log('Test 2: Getting sample recent transactions...');
    try {
      const sampleQuery = `
        SELECT
          id,
          tranid,
          type,
          trandate,
          status
        FROM Transaction
        WHERE trandate >= TO_DATE('2024-01-01', 'YYYY-MM-DD')
        ORDER BY trandate DESC
      `;

      const sampleResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: sampleQuery },
          params: { limit: '50' },
        }
      );

      diagnostics.tests.push({
        name: 'Recent Transactions Sample',
        success: true,
        results: sampleResponse.items || [],
        count: sampleResponse.items?.length || 0,
      });

      console.log('Sample transactions found:', sampleResponse.items?.length);
    } catch (error) {
      diagnostics.tests.push({
        name: 'Recent Transactions Sample',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Test 3: Check if 'WorkOrd' type exists
    console.log('Test 3: Checking for WorkOrd type specifically...');
    try {
      const workOrdQuery = `
        SELECT
          id,
          tranid,
          trandate,
          status
        FROM Transaction
        WHERE type = 'WorkOrd'
        ORDER BY trandate DESC
      `;

      const workOrdResponse = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: workOrdQuery },
          params: { limit: '10' },
        }
      );

      diagnostics.tests.push({
        name: 'WorkOrd Type Check',
        success: true,
        results: workOrdResponse.items || [],
        count: workOrdResponse.items?.length || 0,
        found: (workOrdResponse.items?.length || 0) > 0,
      });

      console.log('WorkOrd transactions found:', workOrdResponse.items?.length);
    } catch (error) {
      diagnostics.tests.push({
        name: 'WorkOrd Type Check',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Test 4: Try alternative work order type names
    console.log('Test 4: Trying alternative work order type names...');
    const alternativeTypes = [
      'Work Order',
      'WorkOrder',
      'WO',
      'Work_Order',
      'Build',
      'Build Assm',
      'Build Assem',
      'Assembly Build',
      'Assem Build',
      'AssmBuild',
    ];

    const foundTypes: any[] = [];

    for (const altType of alternativeTypes) {
      try {
        const altQuery = `
          SELECT
            id,
            tranid,
            trandate,
            status
          FROM Transaction
          WHERE type = '${altType.replace(/'/g, "''")}'
          ORDER BY trandate DESC
        `;

        const altResponse = await netsuiteRequest<{ items: any[] }>(
          '/services/rest/query/v1/suiteql',
          {
            method: 'POST',
            body: { q: altQuery },
            params: { limit: '5' },
          }
        );

        const count = altResponse.items?.length || 0;
        if (count > 0) {
          foundTypes.push({
            type: altType,
            count: count,
            samples: altResponse.items,
          });
          console.log(`Found ${count} transactions with type '${altType}'`);
        }
      } catch (error) {
        // Silently skip errors for alternative types
      }
    }

    diagnostics.tests.push({
      name: 'Alternative Work Order Types',
      success: true,
      foundTypes: foundTypes,
      totalAlternativesFound: foundTypes.length,
    });

    return NextResponse.json(diagnostics);
  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json(
      {
        error: 'Diagnostic failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
