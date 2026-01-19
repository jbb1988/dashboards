import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const woNumbers = ['WO5967', 'WO5968', 'WO5969', 'WO5970', 'WO5971', 'WO5973', 'WO5974', 'WO6583'];

    // Get all line items for these WOs from our database
    const { data: lines, error } = await supabase
      .from('netsuite_work_order_lines')
      .select('*')
      .in('wo_number', woNumbers)
      .order('wo_number', { ascending: true })
      .order('line_sequence', { ascending: true });

    if (error) throw error;

    // Group by WO and calculate totals
    const byWO: any = {};
    const byType: any = {
      material: { lines: [], total: 0 },
      labor: { lines: [], total: 0 },
      expense: { lines: [], total: 0 },
      shipping: { lines: [], total: 0 },
      other: { lines: [], total: 0 },
    };

    for (const line of lines || []) {
      if (!byWO[line.wo_number]) {
        byWO[line.wo_number] = {
          wo_number: line.wo_number,
          lines: [],
          totalLineCost: 0,
        };
      }

      const lineCost = Math.abs(parseFloat(line.line_cost as any) || 0);
      byWO[line.wo_number].lines.push({
        item: line.item_name,
        quantity: line.quantity,
        lineCost: lineCost,
        itemType: line.item_type,
      });
      byWO[line.wo_number].totalLineCost += lineCost;

      // Categorize by type based on item name/type
      const itemName = (line.item_name || '').toLowerCase();
      const itemType = line.item_type || '';

      let category = 'other';
      if (itemName.includes('labor') || itemName.includes('installation') || itemType === 'Service') {
        category = 'labor';
      } else if (itemName.includes('shipping') || itemName.includes('freight')) {
        category = 'shipping';
      } else if (itemName.includes('expense') || itemName.includes('travel')) {
        category = 'expense';
      } else if (itemType === 'InvtPart' || itemType === 'Assembly' || itemType === 'NonInvtPart') {
        category = 'material';
      }

      byType[category].lines.push({
        wo: line.wo_number,
        item: line.item_name,
        cost: lineCost,
      });
      byType[category].total += lineCost;
    }

    const grandTotal = Object.values(byWO).reduce((sum: number, wo: any) => sum + wo.totalLineCost, 0);

    return NextResponse.json({
      byWorkOrder: Object.values(byWO),
      byType,
      grandTotal,
      totalLines: (lines || []).length,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
