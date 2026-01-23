import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { netsuiteRequest } from '@/lib/netsuite';

export async function POST() {
  const supabase = getSupabaseAdmin();

  try {
    // Get SO3009's database ID
    const { data: so } = await supabase
      .from('netsuite_sales_orders')
      .select('id')
      .eq('netsuite_id', '341203')
      .single();

    if (!so) {
      return NextResponse.json({ error: 'SO3009 not found in database' }, { status: 404 });
    }

    // Fetch line items from NetSuite
    const query = `
      SELECT
        tl.id AS line_id,
        tl.linesequencenumber AS line_number,
        tl.item AS item_id,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        COALESCE(i.displayname, BUILTIN.DF(tl.item)) AS item_description,
        tl.itemtype AS item_type,
        tl.class AS class_id,
        BUILTIN.DF(tl.class) AS class_name,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.costestimate,
        tl.location AS location_id,
        tl.isclosed,
        BUILTIN.DF(tl.account) AS account_number
      FROM transactionline tl
      LEFT JOIN item i ON i.id = tl.item
      WHERE tl.transaction = 341203
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: query } }
    );

    const lines = response.items || [];

    // Delete existing lines first
    await supabase
      .from('netsuite_sales_order_lines')
      .delete()
      .eq('sales_order_id', so.id);

    // Insert all lines
    let inserted = 0;
    const errors = [];

    for (const line of lines) {
      try {
        const { error } = await supabase
          .from('netsuite_sales_order_lines')
          .insert({
            sales_order_id: so.id,
            netsuite_line_id: line.line_id?.toString(),
            line_number: parseInt(line.line_number) || 0,
            item_id: line.item_id?.toString(),
            item_name: line.item_name,
            item_description: line.item_description,
            item_type: line.item_type,
            class_id: line.class_id?.toString(),
            class_name: line.class_name,
            quantity: parseFloat(line.quantity) || null,
            rate: parseFloat(line.rate) || null,
            amount: parseFloat(line.amount) || null,
            cost_estimate: parseFloat(line.costestimate) || null,
            location_id: line.location_id?.toString(),
            is_closed: line.isclosed === 'T',
            account_number: line.account_number,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          errors.push(`Line ${line.line_number}: ${error.message}`);
        } else {
          inserted++;
        }
      } catch (err) {
        errors.push(`Line ${line.line_number}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Inserted ${inserted}/${lines.length} line items for SO3009`,
      stats: { linesFromNetSuite: lines.length, inserted, errors: errors.slice(0, 10) },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
