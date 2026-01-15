/**
 * API Route: /api/closeout/enrich
 * Enrich closeout work orders with NetSuite SO/WO line item details
 */

import { NextResponse } from 'next/server';
import { getWorkOrderByNumber, getSalesOrderWithLineItems } from '@/lib/netsuite';
import { getEnrichedWorkOrder, setEnrichedWorkOrder } from '@/lib/enrichment-cache';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { getExcelFromStorage } from '@/lib/supabase';

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

    // Enrich each work order from NetSuite
    const errors: string[] = [];
    let workOrdersProcessed = 0;
    let netsuiteCallsMade = 0;
    let lineItemsCached = 0;

    for (const woNumber of Array.from(woNumbers)) {
      try {
        // Check cache first
        const cachedData = getEnrichedWorkOrder(woNumber);
        if (cachedData) {
          console.log(`✓ Using cached data for WO ${woNumber}`);
          workOrdersProcessed++;
          lineItemsCached += cachedData.lineItems?.length || 0;
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

        // Cache the enriched data
        const enrichedData = {
          woNumber: woData.tranId,
          woId: woData.id,
          woDate: woData.tranDate,
          woStatus: woData.status,
          soNumber: woData.linkedSalesOrderNumber,
          soId: woData.linkedSalesOrderId,
          soStatus: soData?.status,
          soDate: soData?.tranDate,
          customerId: woData.customerId || soData?.customerId,
          customerName: woData.customerName || soData?.customerName,
          lineItems: soData?.lineItems || [],
        };

        setEnrichedWorkOrder(woNumber, enrichedData);

        workOrdersProcessed++;
        lineItemsCached += soData?.lineItems?.length || 0;
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
