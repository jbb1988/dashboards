import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tranid = searchParams.get('tranid') || 'SO3009';
  const netsuiteId = searchParams.get('netsuiteId');

  try {
    // Check by tranid
    const { data: soByTranid, error: tranidError } = await supabase
      .from('netsuite_sales_orders')
      .select('id, netsuite_id, tranid, trandate, status, total')
      .eq('tranid', tranid)
      .maybeSingle();

    let soByNetsuiteId = null;
    if (netsuiteId) {
      const { data, error } = await supabase
        .from('netsuite_sales_orders')
        .select('id, netsuite_id, tranid, trandate, status, total')
        .eq('netsuite_id', netsuiteId)
        .maybeSingle();
      soByNetsuiteId = data;
    }

    let lineItems = null;
    let lineCount = 0;

    const soHeader = soByTranid || soByNetsuiteId;
    if (soHeader) {
      const { data: lines, count } = await supabase
        .from('netsuite_sales_order_lines')
        .select('*', { count: 'exact' })
        .eq('sales_order_id', soHeader.id);

      lineItems = lines;
      lineCount = count || 0;
    }

    return NextResponse.json({
      tranid,
      netsuiteId,
      soByTranid,
      soByNetsuiteId,
      lineCount,
      lineItems: lineItems?.slice(0, 5) || [],
      summary: soHeader
        ? `SO ${tranid} found with ${lineCount} line items`
        : `SO ${tranid} NOT FOUND in database`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
