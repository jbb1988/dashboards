import { NextRequest, NextResponse } from 'next/server';
import { getContractOpportunities } from '@/lib/salesforce';
import { upsertContracts, getContracts, Contract } from '@/lib/supabase';

interface SyncResult {
  synced: number;
  total: number;
  errors: string[];
  updatedCount?: number;
  newCount?: number;
  conflicts?: ConflictInfo[];
}

interface ConflictInfo {
  contractId: string;
  contractName: string;
  salesforceId: string;
  localValues: {
    awardDate: string | null;
    contractDate: string | null;
    deliverDate: string | null;
    installDate: string | null;
    cashDate: string | null;
  };
  salesforceValues: {
    awardDate: string | null;
    contractDate: string | null;
    deliverDate: string | null;
    installDate: string | null;
    cashDate: string | null;
  };
  pendingFields: Record<string, any>;
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
    current_situation: opp.currentSituation || null,
    next_steps: opp.nextSteps || null,
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
 * IMPORTANT: Preserves manual status overrides - does not overwrite user's manual status updates
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

    // Step 2: Get existing contracts to check for manual status overrides and conflicts
    const existingContracts = await getContracts();
    const manualOverrideMap = new Map<string, { status: string }>();
    const existingContractsMap = new Map<string, any>();

    existingContracts.forEach(contract => {
      if (contract.salesforce_id) {
        existingContractsMap.set(contract.salesforce_id, contract);

        if (contract.manual_status_override) {
          manualOverrideMap.set(contract.salesforce_id, {
            status: contract.status,
          });
        }
      }
    });

    // Step 3: Detect conflicts - check for contracts with pending changes that also have different SF values
    const conflicts: ConflictInfo[] = [];

    for (const opp of opportunities) {
      const localContract = existingContractsMap.get(opp.id);

      if (localContract && localContract.sf_sync_status === 'pending') {
        // Check if Salesforce has different date values
        const hasDateConflict =
          localContract.award_date !== (opp.awardDate || null) ||
          localContract.contract_date !== (opp.contractDate || null) ||
          localContract.deliver_date !== (opp.deliverDate || null) ||
          localContract.install_date !== (opp.installDate || null) ||
          localContract.cash_date !== (opp.cashDate || null);

        if (hasDateConflict) {
          conflicts.push({
            contractId: localContract.id,
            contractName: localContract.name,
            salesforceId: opp.id,
            localValues: {
              awardDate: localContract.award_date,
              contractDate: localContract.contract_date,
              deliverDate: localContract.deliver_date,
              installDate: localContract.install_date,
              cashDate: localContract.cash_date,
            },
            salesforceValues: {
              awardDate: opp.awardDate || null,
              contractDate: opp.contractDate || null,
              deliverDate: opp.deliverDate || null,
              installDate: opp.installDate || null,
              cashDate: opp.cashDate || null,
            },
            pendingFields: localContract.sf_sync_pending_fields || {},
          });
        }
      }
    }

    // If conflicts detected, return them without syncing
    if (conflicts.length > 0) {
      return NextResponse.json({
        success: false,
        conflicts: conflicts,
        message: `Found ${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}. Please resolve before syncing.`,
      });
    }

    // Step 4: Transform to Supabase contract format
    let updatedCount = 0;
    let newCount = 0;

    const contracts = opportunities.map(opp => {
      const transformed = transformToContract(opp);
      const existing = existingContractsMap.get(transformed.salesforce_id);

      if (existing) {
        // Check if any date fields changed
        const hasChanges =
          existing.award_date !== transformed.award_date ||
          existing.contract_date !== transformed.contract_date ||
          existing.deliver_date !== transformed.deliver_date ||
          existing.install_date !== transformed.install_date ||
          existing.cash_date !== transformed.cash_date ||
          existing.value !== transformed.value ||
          existing.status !== transformed.status;

        if (hasChanges) {
          updatedCount++;
        }
      } else {
        newCount++;
      }

      // Preserve manual status override if exists
      const manualOverride = manualOverrideMap.get(transformed.salesforce_id);
      if (manualOverride) {
        transformed.status = manualOverride.status;
        (transformed as any).manual_status_override = true; // Keep the flag
      }

      return transformed;
    });

    // Step 5: Upsert to Supabase
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
    result.updatedCount = updatedCount;
    result.newCount = newCount;

    const preservedCount = manualOverrideMap.size;

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.synced} contracts from Salesforce to Supabase`,
      result,
      preservedManualStatuses: preservedCount,
      updatedCount,
      newCount,
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
