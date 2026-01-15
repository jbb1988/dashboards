/**
 * API Route: /api/closeout/enrich
 * Enrich closeout work orders with NetSuite SO/WO line item details
 * Stores results in Supabase database for persistence across serverless invocations
 */

import { NextResponse } from 'next/server';
import { getWorkOrderByNumber, getSalesOrderWithLineItems } from '@/lib/netsuite';
import { getSupabaseAdmin, getExcelFromStorage } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log('Starting NetSuite enrichment from Excel WO numbers...');

    // Get Excel file
    let fileBuffer: Buffer | null = null;
    fileBuffer = await getExcelFromStorage('closeout-data.xlsx');

    if (!fileBuffer) {
      const localPath = path.join(process.cwd(), 'data', 'closeout-data.xlsx');
      if (fs.existsSync(localPath)) {
        fileBuffer = fs.readFileSync(localPath);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({
        error: 'Excel file not found',
        message: 'closeout-data.xlsx not found in storage or data folder',
      }, { status: 404 });
    }

    // Parse Excel to get WO numbers
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const costAuditSheet = workbook.Sheets['TB & MCC Cost Audit 2020-Curren'];
    const costAuditRaw = XLSX.utils.sheet_to_json(costAuditSheet, { header: 1 }) as any[][];

    // Extract unique WO numbers from Column Q (row[16])
    const woNumbers = new Set<string>();
    for (let i = 4; i < costAuditRaw.length; i++) {
      const row = costAuditRaw[i];
      if (!row[0] || row[0] === 'Open') continue;

      const woNumber = row[16]?.toString()?.trim();
      if (woNumber) {
        woNumbers.add(woNumber);
      }
    }

    console.log(`Found ${woNumbers.size} unique WO numbers in Excel`);

    if (woNumbers.size === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          workOrdersProcessed: 0,
          netsuiteCallsMade: 0,
          lineItemsCached: 0,
          errors: [],
        },
        message: 'No work orders found in Excel Column Q',
      });
    }

    // Get Supabase client
    const supabase = getSupabaseAdmin();

    // Enrich each work order from NetSuite and store in database
    const errors: string[] = [];
    let workOrdersProcessed = 0;
    let netsuiteCallsMade = 0;
    let lineItemsCached = 0;

    for (const woNumber of Array.from(woNumbers)) {
      try {
        // Check if already enriched in database
        const { data: existingWO } = await supabase
          .from('closeout_work_orders')
          .select('netsuite_enriched, netsuite_enriched_at')
          .eq('wo_number', woNumber)
          .eq('netsuite_enriched', true)
          .single();

        if (existingWO) {
          console.log(`✓ WO ${woNumber} already enriched in database`);
          workOrdersProcessed++;
          continue;
        }

        // Query NetSuite for Work Order
        console.log(`Querying NetSuite for WO ${woNumber}...`);
        const woData = await getWorkOrderByNumber(woNumber);
        netsuiteCallsMade++;

        if (!woData) {
          errors.push(`WO ${woNumber}: Not found in NetSuite`);
          console.warn(`✗ WO ${woNumber} not found in NetSuite`);
          continue;
        }

        // Get linked Sales Order if available
        let soData = null;
        if (woData.linkedSalesOrderId) {
          console.log(`Fetching SO ${woData.linkedSalesOrderNumber} for WO ${woNumber}...`);
          soData = await getSalesOrderWithLineItems(woData.linkedSalesOrderId);
          netsuiteCallsMade++;
        }

        // Update work order with enrichment status
        const { error: updateError } = await supabase
          .from('closeout_work_orders')
          .update({
            netsuite_enriched: true,
            netsuite_wo_id: woData.id,
            netsuite_so_id: woData.linkedSalesOrderId || null,
            netsuite_so_number: woData.linkedSalesOrderNumber || null,
            netsuite_enriched_at: new Date().toISOString(),
          })
          .eq('wo_number', woNumber);

        if (updateError) {
          console.error(`Error updating WO ${woNumber}:`, updateError);
          errors.push(`WO ${woNumber}: Database update failed - ${updateError.message}`);
          continue;
        }

        // Store line items in database
        if (soData && soData.lineItems && soData.lineItems.length > 0) {
          // Get the closeout_wo_id for this work order
          const { data: woRecord } = await supabase
            .from('closeout_work_orders')
            .select('id')
            .eq('wo_number', woNumber)
            .single();

          if (woRecord) {
            const lineItemRecords = soData.lineItems.map(item => ({
              closeout_wo_id: woRecord.id,
              wo_id: woData.id,
              wo_number: woData.tranId,
              wo_status: woData.status,
              wo_date: woData.tranDate || null,
              so_id: soData.id,
              so_number: soData.tranId,
              so_status: soData.status,
              so_date: soData.tranDate || null,
              customer_id: woData.customerId || soData.customerId,
              customer_name: woData.customerName || soData.customerName,
              line_id: item.lineId,
              item_id: item.itemId,
              item_name: item.itemName,
              item_description: item.itemDescription,
              item_type: item.itemType,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              line_amount: item.lineAmount,
              cost_estimate: item.costEstimate,
              source_type: 'sales_order',
            }));

            const { error: insertError } = await supabase
              .from('netsuite_work_order_details')
              .upsert(lineItemRecords, {
                onConflict: 'wo_number,line_id',
                ignoreDuplicates: false,
              });

            if (insertError) {
              console.error(`Error inserting line items for WO ${woNumber}:`, insertError);
              errors.push(`WO ${woNumber}: Line items insert failed - ${insertError.message}`);
            } else {
              lineItemsCached += soData.lineItems.length;
            }
          }
        }

        workOrdersProcessed++;
        console.log(`✓ Enriched WO ${woNumber} → SO ${woData.linkedSalesOrderNumber} with ${soData?.lineItems?.length || 0} line items`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`WO ${woNumber}: ${errorMsg}`);
        console.error(`✗ Error enriching WO ${woNumber}:`, error);
      }
    }

    return NextResponse.json({
      success: workOrdersProcessed > 0,
      stats: {
        workOrdersProcessed,
        netsuiteCallsMade,
        lineItemsCached,
        errors,
      },
      message: `Successfully enriched ${workOrdersProcessed} of ${woNumbers.size} work orders with ${lineItemsCached} total line items`,
    });
  } catch (error) {
    console.error('Error in enrichment process:', error);
    return NextResponse.json(
      {
        error: 'Enrichment failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
