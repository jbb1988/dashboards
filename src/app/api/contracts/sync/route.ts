import { NextRequest, NextResponse } from 'next/server';
import { getContractOpportunities } from '@/lib/salesforce';
import { upsertContracts, getContracts, Contract } from '@/lib/supabase';

interface SyncResult {
  synced: number;
  total: number;
  errors: string[];
}

/**
 * Transform Salesforce opportunity to Supabase contract format
 */
function transformToContract(opp: any): Contract {
  return {
    salesforce_id: opp.id,
    name: opp.name,
    opportunity_name: opp.opportunityName || opp.name,
    account_name: opp.name,
    value: opp.value || 0,
    status: opp.status,
    status_group: opp.statusGroup,
    sales_stage: opp.salesStage || '',
    contract_type: opp.contractType || [],
    close_date: opp.closeDate || null,
    award_date: opp.awardDate || null,
    contract_date: opp.contractDate || null,
    deliver_date: opp.deliverDate || null,
    install_date: opp.installDate || null,
    cash_date: opp.cashDate || null,
    sales_rep: opp.salesRep || 'Unassigned',
    probability: opp.probability || 0,
    budgeted: opp.budgeted || false,
    manual_close_probability: opp.manualCloseProbability ?? null,
    is_closed: false,
    is_won: false,
  };
}

/**
 * POST - Sync Salesforce opportunities to Supabase contracts table
 */
export async function POST(request: NextRequest) {
  try {
    const result: SyncResult = {
      synced: 0,
      total: 0,
      errors: [],
    };

    // Step 1: Fetch opportunities from Salesforce
    const opportunities = await getContractOpportunities();
    result.total = opportunities.length;

    if (opportunities.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No opportunities found in Salesforce',
        result,
      });
    }

    // Step 2: Transform to Supabase contract format
    const contracts = opportunities.map(transformToContract);

    // Step 3: Upsert to Supabase
    const upsertResult = await upsertContracts(contracts);

    if (!upsertResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to sync contracts to Supabase',
        message: upsertResult.error,
        result,
      }, { status: 500 });
    }

    result.synced = upsertResult.count;

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.synced} contracts from Salesforce to Supabase`,
      result,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({
      success: false,
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET - Check sync status and return current contracts from Supabase
 */
export async function GET() {
  try {
    // Get current contracts from Supabase
    const contracts = await getContracts();

    // Get current Salesforce opportunities for comparison
    let salesforceCount = 0;
    try {
      const opportunities = await getContractOpportunities();
      salesforceCount = opportunities.length;
    } catch (err) {
      console.error('Could not fetch Salesforce data:', err);
    }

    return NextResponse.json({
      status: 'ready',
      supabaseContracts: contracts.length,
      salesforceOpportunities: salesforceCount,
      lastUpdated: contracts.length > 0
        ? contracts.reduce((latest, c) => {
            const updated = c.updated_at ? new Date(c.updated_at) : new Date(0);
            return updated > latest ? updated : latest;
          }, new Date(0)).toISOString()
        : null,
      actions: {
        sync: 'POST /api/contracts/sync - Sync Salesforce to Supabase',
      },
    });

  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json({
      error: 'Failed to check sync status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
