import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Search for any MCC items with deferred or contract in the name
    const { data: soLines, error } = await supabase
      .from('netsuite_sales_order_lines')
      .select('item_name, item_description, account_number, account_name')
      .or('item_name.ilike.%deferred%mcc%,item_name.ilike.%mcc%deferred%,item_description.ilike.%deferred%mcc%,item_description.ilike.%mcc%deferred%,account_name.ilike.%deferred%mcc%,account_name.ilike.%mcc%deferred%')
      .limit(50);

    if (error) throw error;

    // Also search for contracted MCC items
    const { data: contractedMCC, error: error2 } = await supabase
      .from('netsuite_sales_order_lines')
      .select('item_name, item_description, account_number, account_name')
      .ilike('item_description', '%MCC%contract%')
      .limit(50);

    if (error2) throw error2;

    // Get unique account numbers for MCC
    const { data: mccAccounts, error: error3 } = await supabase
      .from('netsuite_sales_order_lines')
      .select('account_number, account_name')
      .or('account_name.ilike.%mcc%,account_name.ilike.%maintenance%,account_name.ilike.%calibration%')
      .order('account_number')
      .limit(100);

    if (error3) throw error3;

    const uniqueAccounts = Array.from(
      new Map(
        (mccAccounts || []).map(item => [item.account_number, item])
      ).values()
    );

    return NextResponse.json({
      deferredMCC: soLines || [],
      contractedMCC: contractedMCC || [],
      allMCCAccounts: uniqueAccounts,
      note: 'Looking for DRMCC account number similar to DRM3 (4081/5081)',
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
