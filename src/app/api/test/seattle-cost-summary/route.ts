import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: soData } = await supabase
    .from('netsuite_sales_orders')
    .select(`
      so_number,
      total_amount,
      netsuite_sales_order_lines (
        line_number,
        item_name,
        amount,
        cost_estimate,
        account_number,
        account_name
      )
    `)
    .eq('so_number', 'SO7150');

  if (!soData || soData.length === 0) {
    return NextResponse.json({ error: 'SO not found' }, { status: 404 });
  }

  const so = soData[0];
  const lines = so.netsuite_sales_order_lines || [];

  // Filter to revenue lines only (exclude tax, subtotals, etc)
  const revenueLines = lines.filter((line: any) => {
    if (!line.account_number) return false;
    if (line.account_number === '2050') return false; // Tax
    return true;
  });

  const totalRevenue = Math.abs(revenueLines.reduce((sum: number, line: any) => sum + (line.amount || 0), 0));
  const totalCostEstimate = Math.abs(revenueLines.reduce((sum: number, line: any) => sum + (line.cost_estimate || 0), 0));

  // Group by account
  const byAccount: any = {};
  revenueLines.forEach((line: any) => {
    const acct = line.account_number;
    if (!byAccount[acct]) {
      byAccount[acct] = {
        account: acct,
        accountName: line.account_name,
        lineCount: 0,
        revenue: 0,
        costEstimate: 0,
      };
    }
    byAccount[acct].lineCount++;
    byAccount[acct].revenue += Math.abs(line.amount || 0);
    byAccount[acct].costEstimate += Math.abs(line.cost_estimate || 0);
  });

  return NextResponse.json({
    soNumber: so.so_number,
    totalAmount: so.total_amount,
    totalRevenue,
    totalCostEstimate,
    grossProfit: totalRevenue - totalCostEstimate,
    grossMarginPct: totalRevenue > 0 ? ((totalRevenue - totalCostEstimate) / totalRevenue) * 100 : 0,
    lineCount: revenueLines.length,
    byAccount: Object.values(byAccount),
  });
}
