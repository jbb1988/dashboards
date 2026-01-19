/**
 * API Route: /api/netsuite/sync-expense-reports
 * Syncs expense report transactions from NetSuite for project cost tracking
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAllExpenseReports } from '@/lib/netsuite-expense-reports';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '5000');

    console.log('Starting expense reports sync...');
    console.log('Parameters:', { startDate, endDate, limit });

    // Fetch expense reports from NetSuite
    const { headers, linesByReportId } = await getAllExpenseReports({
      startDate,
      endDate,
      limit,
    });

    if (headers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expense reports found for the specified period',
        synced: 0,
      });
    }

    // Insert into Supabase
    const supabase = getSupabaseAdmin();
    let syncedCount = 0;
    let linesSynced = 0;

    for (const header of headers) {
      // Insert expense report header
      const { data: insertedReport, error: reportError } = await supabase
        .from('netsuite_expense_reports')
        .upsert({
          netsuite_id: header.id,
          tranid: header.tranid,
          trandate: header.trandate,
          posting_period: header.posting_period,
          status: header.status,
          memo: header.memo,
          employee_id: header.employee_id,
          employee_name: header.employee_name,
          customer_id: header.customer_id,
          customer_name: header.customer_name,
          class_id: header.class_id,
          class_name: header.class_name,
          total_amount: header.total_amount,
          subsidiary_id: header.subsidiary_id,
          subsidiary_name: header.subsidiary_name,
          location_id: header.location_id,
          location_name: header.location_name,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'netsuite_id',
        })
        .select()
        .single();

      if (reportError) {
        console.error(`Error syncing expense report ${header.tranid}:`, reportError);
        continue;
      }

      // Insert line items
      const reportLines = linesByReportId[header.id] || [];
      if (reportLines.length > 0) {
        const lineRecords = reportLines.map(line => ({
          expense_report_id: insertedReport.id,
          netsuite_line_id: line.line_id,
          line_number: line.line_number,
          expense_date: line.expense_date,
          category: line.category,
          expense_account: line.expense_account,
          expense_account_name: line.expense_account_name,
          item_id: line.item_id,
          item_name: line.item_name,
          memo: line.memo,
          amount: line.amount,
          customer_id: line.customer_id,
          customer_name: line.customer_name,
          class_id: line.class_id,
          class_name: line.class_name,
        }));

        const { error: linesError } = await supabase
          .from('netsuite_expense_report_lines')
          .upsert(lineRecords, {
            onConflict: 'expense_report_id,netsuite_line_id',
          });

        if (linesError) {
          console.error(`Error syncing lines for ${header.tranid}:`, linesError);
        } else {
          linesSynced += reportLines.length;
        }
      }

      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} expense reports with ${linesSynced} line items`,
      synced: syncedCount,
      linesSynced,
      period: { startDate, endDate },
    });

  } catch (error) {
    console.error('Expense report sync error:', error);
    return NextResponse.json({
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
