import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { netsuiteRequest } from '@/lib/netsuite';

export async function POST() {
  const supabase = getSupabaseAdmin();

  try {
    // Query NetSuite for SO3009 header details
    const query = `
      SELECT
        t.id AS netsuite_id,
        t.tranid AS tranid,
        t.trandate AS trandate,
        t.postingperiod AS posting_period,
        t.status,
        t.memo,
        t.entity AS customer_id,
        e.companyname AS customer_name,
        t.subtotal,
        t.discounttotal AS discount_total,
        t.taxtotal AS tax_total,
        t.total,
        t.terms,
        t.shipmethod AS ship_method,
        t.shipdate AS ship_date,
        t.expectedshipdate AS expected_ship_date,
        t.subsidiary AS subsidiary_id,
        t.location AS location_id,
        t.class AS class_id,
        t.department AS department_id,
        t.salesrep AS sales_rep_id
      FROM Transaction t
      LEFT JOIN Entity e ON e.id = t.entity
      WHERE t.id = 341203
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
      }
    );

    if (!response.items || response.items.length === 0) {
      return NextResponse.json(
        { error: 'SO3009 not found in NetSuite' },
        { status: 404 }
      );
    }

    const soData = response.items[0];

    // Insert/update SO header in database
    const { data: upserted, error } = await supabase
      .from('netsuite_sales_orders')
      .upsert(
        {
          netsuite_id: soData.netsuite_id.toString(),
          so_number: soData.tranid,
          tranid: soData.tranid,
          so_date: soData.trandate,
          posting_period: soData.posting_period,
          status: soData.status,
          memo: soData.memo,
          customer_id: soData.customer_id?.toString(),
          customer_name: soData.customer_name,
          subtotal: soData.subtotal || 0,
          discount_total: soData.discount_total || 0,
          tax_total: soData.tax_total || 0,
          total_amount: soData.total || 0,
          terms: soData.terms?.toString(),
          ship_method: soData.ship_method?.toString(),
          ship_date: soData.ship_date,
          expected_ship_date: soData.expected_ship_date,
          subsidiary_id: soData.subsidiary_id?.toString(),
          location_id: soData.location_id?.toString(),
          class_id: soData.class_id?.toString(),
          department_id: soData.department_id?.toString(),
          sales_rep_id: soData.sales_rep_id?.toString(),
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'netsuite_id' }
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'SO3009 header created/updated',
      soData,
      dbRecord: upserted,
      nextStep: 'Run bulk-sync-lines to sync line items',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
