import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseProjectType } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to investigate GPM > 100% issue
 * Examines SO7150 (Seattle) line items to find what's causing inflated GPM
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const soNumber = searchParams.get('so') || 'SO7150';

    const supabase = getSupabaseAdmin();

    // Get the sales order with all line items
    const { data: so, error } = await supabase
      .from('netsuite_sales_orders')
      .select('*')
      .eq('so_number', soNumber)
      .single();

    if (error || !so) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }

    // Get all line items
    const { data: lineItems } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*')
      .eq('sales_order_id', so.id)
      .order('line_number');

    if (!lineItems) {
      return NextResponse.json({ error: 'No line items found' }, { status: 404 });
    }

    // Analyze each line item
    const analysis = lineItems.map(li => {
      const revenue = Math.abs(li.amount || 0);
      const cost = Math.abs(li.cost_estimate || 0);
      const gp = revenue - cost;
      const gpm = revenue > 0 ? (gp / revenue) * 100 : 0;
      const productType = parseProjectType(li.item_class, li.account_number);

      return {
        lineNumber: li.line_number,
        itemName: li.item_name,
        itemType: li.item_type,
        itemClass: li.item_class,
        accountNumber: li.account_number,
        accountName: li.account_name,
        productType,
        quantity: li.quantity,
        rate: li.rate,
        revenue,
        cost,
        gp,
        gpm: gpm.toFixed(1) + '%',
        isClosed: li.is_closed,
        flags: {
          zeroCost: cost === 0,
          negativeCost: (li.cost_estimate || 0) < 0,
          gpmOver100: gpm > 100,
          gpmOver90: gpm > 90,
        },
      };
    });

    // Calculate totals
    const totals = {
      totalRevenue: analysis.reduce((sum, li) => sum + li.revenue, 0),
      totalCost: analysis.reduce((sum, li) => sum + li.cost, 0),
      totalGP: 0,
      totalGPM: 0,
      lineCount: analysis.length,
    };

    totals.totalGP = totals.totalRevenue - totals.totalCost;
    totals.totalGPM = totals.totalRevenue > 0 ? (totals.totalGP / totals.totalRevenue) * 100 : 0;

    // Group by product type
    const byProductType: Record<string, any> = {};
    for (const li of analysis) {
      if (!byProductType[li.productType]) {
        byProductType[li.productType] = {
          productType: li.productType,
          lineCount: 0,
          revenue: 0,
          cost: 0,
          gp: 0,
          gpm: 0,
        };
      }
      byProductType[li.productType].lineCount++;
      byProductType[li.productType].revenue += li.revenue;
      byProductType[li.productType].cost += li.cost;
    }

    // Calculate GP/GPM for each product type
    for (const type in byProductType) {
      const pt = byProductType[type];
      pt.gp = pt.revenue - pt.cost;
      pt.gpm = pt.revenue > 0 ? ((pt.gp / pt.revenue) * 100).toFixed(1) + '%' : '0%';
    }

    // Find problematic lines
    const problematicLines = analysis.filter(li =>
      li.flags.zeroCost || li.flags.negativeCost || li.flags.gpmOver100
    );

    return NextResponse.json({
      soNumber,
      soId: so.id,
      soDate: so.so_date,
      customerName: so.customer_name,
      totals,
      productTypeBreakdown: Object.values(byProductType),
      problematicLines,
      allLines: analysis,
      summary: {
        totalLines: analysis.length,
        zeroCostLines: analysis.filter(li => li.flags.zeroCost).length,
        negativeCostLines: analysis.filter(li => li.flags.negativeCost).length,
        gpmOver100Lines: analysis.filter(li => li.flags.gpmOver100).length,
        gpmOver90Lines: analysis.filter(li => li.flags.gpmOver90).length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
