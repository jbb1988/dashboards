/**
 * Debug API to inspect Sales Order line items for Seattle vs Fairfax
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Get SO IDs for Seattle 2025 (SO7150) and Fairfax 2025 (SO3009)
    const seattleSOId = '341202'; // From Seattle profitability response
    const fairfaxSOId = '341203'; // From Fairfax profitability response

    console.log('Fetching line items for Seattle SO7150 and Fairfax SO3009...');

    // Query line items for both SOs
    const { data: seattleLines, error: seattleError } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*')
      .eq('so_id', seattleSOId)
      .order('line_number');

    const { data: fairfaxLines, error: fairfaxError } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*')
      .eq('so_id', fairfaxSOId)
      .order('line_number');

    if (seattleError) {
      console.error('Error fetching Seattle lines:', seattleError);
    }

    if (fairfaxError) {
      console.error('Error fetching Fairfax lines:', fairfaxError);
    }

    // Apply the same filtering logic used in profitability/route.ts
    const filterLineItems = (lines: any[]) => {
      return lines.map(line => {
        const itemName = line.item_name || '';
        const itemType = line.item_type || '';
        const accountNumber = line.account_number || '';

        // Check each filter condition
        const filters = {
          isSubtotalName: itemName === 'Subtotal',
          isComment: itemName === 'Comment',
          isNotTaxable: itemName.startsWith('-Not Taxable-'),
          isTaxGroup: itemType === 'TaxGroup',
          isSubtotalType: itemType === 'Subtotal',
          isDescription: itemType === 'Description',
          isSalesTax: accountNumber === '2050',
          noAccountNumber: !line.account_number,
        };

        const isFiltered = Object.values(filters).some(f => f);
        const filterReasons = Object.entries(filters)
          .filter(([_, value]) => value)
          .map(([key]) => key);

        return {
          line_number: line.line_number,
          item_name: itemName,
          item_type: itemType,
          account_number: accountNumber,
          account_name: line.account_name || '',
          amount: line.amount || 0,
          cost_estimate: line.cost_estimate || 0,
          isFiltered,
          filterReasons: filterReasons.length > 0 ? filterReasons : ['VALID - PASSES ALL FILTERS'],
        };
      });
    };

    const seattleAnalysis = filterLineItems(seattleLines || []);
    const fairfaxAnalysis = filterLineItems(fairfaxLines || []);

    const seattleValid = seattleAnalysis.filter(l => !l.isFiltered);
    const fairfaxValid = fairfaxAnalysis.filter(l => !l.isFiltered);

    return NextResponse.json({
      success: true,
      summary: {
        seattle: {
          soNumber: 'SO7150',
          netsuiteId: seattleSOId,
          totalLines: seattleLines?.length || 0,
          validLines: seattleValid.length,
          filteredLines: seattleAnalysis.length - seattleValid.length,
          totalRevenue: seattleValid.reduce((sum, l) => sum + Math.abs(l.amount), 0),
        },
        fairfax: {
          soNumber: 'SO3009',
          netsuiteId: fairfaxSOId,
          totalLines: fairfaxLines?.length || 0,
          validLines: fairfaxValid.length,
          filteredLines: fairfaxAnalysis.length - fairfaxValid.length,
          totalRevenue: fairfaxValid.reduce((sum, l) => sum + Math.abs(l.amount), 0),
        },
      },
      seattle: {
        allLines: seattleAnalysis,
        validLines: seattleValid,
      },
      fairfax: {
        allLines: fairfaxAnalysis,
        validLines: fairfaxValid,
      },
    });
  } catch (error) {
    console.error('Error in SO line items debug:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
