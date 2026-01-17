/**
 * API Route: /api/netsuite/try-manufacturing-tables
 * Try different manufacturing table names and cases
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      attempts: [],
    };

    // Try various table name variations
    const tableVariations = [
      'ManufacturingOperationTask',
      'manufacturingoperationtask',
      'MANUFACTURINGOPERATIONTASK',
      'WorkOrder',
      'workorder',
      'WORKORDER',
      'workOrder',
      'AssemblyBuild',
      'assemblybuild',
    ];

    for (const tableName of tableVariations) {
      try {
        const query = `
          SELECT *
          FROM ${tableName}
          WHERE created >= TO_DATE('2026-01-01', 'YYYY-MM-DD')
          ORDER BY created DESC
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
          results.attempts.push({
            table: tableName,
            success: true,
            count: response.items.length,
            samples: response.items,
            allFields: Object.keys(response.items[0]).sort(),
          });
          console.log(`✓✓✓ FOUND: ${tableName} with ${response.items.length} records`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        // Only log if it's not a "not found" error
        if (!errMsg.includes('was not found')) {
          results.attempts.push({
            table: tableName,
            success: false,
            error: errMsg,
          });
        }
      }
    }

    // Try searching Transaction with ALL possible type values
    console.log('Trying all transaction types that might be work orders...');
    const typeVariations = [
      'WorkOrd',
      'Work Order',
      'WorkOrder',
      'WO',
      'Build',
      'AssemblyBuild',
      'Assem Build',
      'AssmBuild',
    ];

    for (const type of typeVariations) {
      try {
        const query = `
          SELECT *
          FROM Transaction
          WHERE type = '${type.replace(/'/g, "''")}'
            AND trandate >= TO_DATE('2026-01-01', 'YYYY-MM-DD')
          ORDER BY trandate DESC
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
          results.attempts.push({
            method: 'Transaction type',
            type: type,
            success: true,
            count: response.items.length,
            samples: response.items,
          });
          console.log(`✓✓✓ FOUND: Transaction type '${type}' with ${response.items.length} records`);
        }
      } catch (error) {
        // Silently skip
      }
    }

    // Try REST Record API with different endpoints
    const restEndpoints = [
      'workOrder',
      'WorkOrder',
      'work-order',
      'manufacturingOperationTask',
      'assemblyBuild',
    ];

    for (const endpoint of restEndpoints) {
      try {
        const response = await netsuiteRequest<any>(
          `/services/rest/record/v1/${endpoint}`,
          {
            method: 'GET',
            params: { limit: '10', offset: '0' },
          }
        );

        if (response.items && response.items.length > 0) {
          results.attempts.push({
            method: 'REST Record API',
            endpoint: endpoint,
            success: true,
            count: response.items.length,
            samples: response.items,
          });
          console.log(`✓✓✓ FOUND: REST endpoint '${endpoint}' with ${response.items.length} records`);
        }
      } catch (error) {
        // Silently skip
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
