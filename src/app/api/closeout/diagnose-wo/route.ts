/**
 * API Route: /api/closeout/diagnose-wo
 * Diagnostic endpoint to check sample WO numbers and cross-check with NetSuite
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Get sample WO numbers from closeout data
    const { data: workOrders, error } = await supabase
      .from('closeout_work_orders')
      .select('wo_number, project_name, project_year')
      .order('project_year', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      sampleWorkOrders: workOrders,
      netsuiteChecks: [],
    };

    // For each WO number, check if it exists in NetSuite as ANY transaction type
    if (workOrders && workOrders.length > 0) {
      for (let i = 0; i < Math.min(5, workOrders.length); i++) {
        const wo = workOrders[i];
        try {
          // Try to find this transaction in NetSuite
          const query = `
            SELECT id, tranid, type, status, trandate
            FROM Transaction
            WHERE tranid = '${wo.wo_number.replace(/'/g, "''")}'
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
            diagnostics.netsuiteChecks.push({
              wo_number: wo.wo_number,
              found: true,
              netsuite_type: response.items[0].type,
              netsuite_id: response.items[0].id,
              status: response.items[0].status,
              trandate: response.items[0].trandate,
            });
          } else {
            diagnostics.netsuiteChecks.push({
              wo_number: wo.wo_number,
              found: false,
              tried_exact_match: true,
            });
          }
        } catch (error) {
          diagnostics.netsuiteChecks.push({
            wo_number: wo.wo_number,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

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
