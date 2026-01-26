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
    // Helper to normalize dates for comparison (ignoring time/timezone)
    const normalizeDate = (date: string | null | undefined): string | null => {
      if (!date) return null;
      // Extract just YYYY-MM-DD portion to ignore time/timezone differences
      return date.substring(0, 10);
    };

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
        // Check if Salesforce has different date values (normalize for comparison)
        const hasDateConflict =
          normalizeDate(localContract.award_date) !== normalizeDate(opp.awardDate || null) ||
          normalizeDate(localContract.contract_date) !== normalizeDate(opp.contractDate || null) ||
          normalizeDate(localContract.deliver_date) !== normalizeDate(opp.deliverDate || null) ||
          normalizeDate(localContract.install_date) !== normalizeDate(opp.installDate || null) ||
          normalizeDate(localContract.cash_date) !== normalizeDate(opp.cashDate || null);

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
    const updateDetails: any[] = [];

    const contracts = opportunities.map(opp => {
      const transformed = transformToContract(opp);
      const existing = existingContractsMap.get(transformed.salesforce_id);

      if (existing) {
        // Check if any fields actually changed (normalize dates for comparison)
        const awardDateChanged = normalizeDate(existing.award_date) !== normalizeDate(transformed.award_date);
        const contractDateChanged = normalizeDate(existing.contract_date) !== normalizeDate(transformed.contract_date);
        const deliverDateChanged = normalizeDate(existing.deliver_date) !== normalizeDate(transformed.deliver_date);
        const installDateChanged = normalizeDate(existing.install_date) !== normalizeDate(transformed.install_date);
        const cashDateChanged = normalizeDate(existing.cash_date) !== normalizeDate(transformed.cash_date);
        const valueChanged = existing.value !== transformed.value;
        // Only count status as changed if manual_status_override is NOT set
        const statusChanged = !existing.manual_status_override && existing.status !== transformed.status;

        const hasChanges =
          awardDateChanged ||
          contractDateChanged ||
          deliverDateChanged ||
          installDateChanged ||
          cashDateChanged ||
          valueChanged ||
          statusChanged;

        if (hasChanges) {
          updatedCount++;
          const changes: any = {
            salesforceId: transformed.salesforce_id,
            name: transformed.name,
            fields: {}
          };

          if (awardDateChanged) changes.fields.award_date = { from: normalizeDate(existing.award_date), to: normalizeDate(transformed.award_date) };
          if (contractDateChanged) changes.fields.contract_date = { from: normalizeDate(existing.contract_date), to: normalizeDate(transformed.contract_date) };
          if (deliverDateChanged) changes.fields.deliver_date = { from: normalizeDate(existing.deliver_date), to: normalizeDate(transformed.deliver_date) };
          if (installDateChanged) changes.fields.install_date = { from: normalizeDate(existing.install_date), to: normalizeDate(transformed.install_date) };
          if (cashDateChanged) changes.fields.cash_date = { from: normalizeDate(existing.cash_date), to: normalizeDate(transformed.cash_date) };
          if (valueChanged) changes.fields.value = { from: existing.value, to: transformed.value };
          if (statusChanged) changes.fields.status = { from: existing.status, to: transformed.status };

          updateDetails.push(changes);
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
      updateDetails: updateDetails.length > 0 ? updateDetails : undefined,
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
 * With ?preview=true, checks for changes without applying them (for polling/notifications)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    // Get current contracts from Supabase
    const contracts = await getContracts();
    const existingContractsMap = new Map<string, any>();
    contracts.forEach(contract => {
      if (contract.salesforce_id) {
        existingContractsMap.set(contract.salesforce_id, contract);
      }
    });

    // Get current Salesforce opportunities for comparison
    let salesforceCount = 0;
    let opportunities: any[] = [];
    try {
      opportunities = await getContractOpportunities();
      salesforceCount = opportunities.length;
    } catch (err) {
      console.error('Could not fetch Salesforce data:', err);
    }

    // If preview mode, check for changes and conflicts without applying
    if (isPreview && opportunities.length > 0) {
      const normalizeDate = (date: string | null | undefined): string | null => {
        if (!date) return null;
        return date.substring(0, 10);
      };

      let updatedCount = 0;
      let newCount = 0;
      const conflicts: ConflictInfo[] = [];

      for (const opp of opportunities) {
        const existing = existingContractsMap.get(opp.id);

        if (existing) {
          // Check for conflicts (pending local changes with different SF values)
          if (existing.sf_sync_status === 'pending') {
            const hasDateConflict =
              normalizeDate(existing.award_date) !== normalizeDate(opp.awardDate || null) ||
              normalizeDate(existing.contract_date) !== normalizeDate(opp.contractDate || null) ||
              normalizeDate(existing.deliver_date) !== normalizeDate(opp.deliverDate || null) ||
              normalizeDate(existing.install_date) !== normalizeDate(opp.installDate || null) ||
              normalizeDate(existing.cash_date) !== normalizeDate(opp.cashDate || null);

            if (hasDateConflict) {
              conflicts.push({
                contractId: existing.id,
                contractName: existing.name,
                salesforceId: opp.id,
                localValues: {
                  awardDate: existing.award_date,
                  contractDate: existing.contract_date,
                  deliverDate: existing.deliver_date,
                  installDate: existing.install_date,
                  cashDate: existing.cash_date,
                },
                salesforceValues: {
                  awardDate: opp.awardDate || null,
                  contractDate: opp.contractDate || null,
                  deliverDate: opp.deliverDate || null,
                  installDate: opp.installDate || null,
                  cashDate: opp.cashDate || null,
                },
                pendingFields: existing.sf_sync_pending_fields || {},
              });
            }
          }

          // Check for updates (any field changes from SF)
          const awardDateChanged = normalizeDate(existing.award_date) !== normalizeDate(opp.awardDate || null);
          const contractDateChanged = normalizeDate(existing.contract_date) !== normalizeDate(opp.contractDate || null);
          const deliverDateChanged = normalizeDate(existing.deliver_date) !== normalizeDate(opp.deliverDate || null);
          const installDateChanged = normalizeDate(existing.install_date) !== normalizeDate(opp.installDate || null);
          const cashDateChanged = normalizeDate(existing.cash_date) !== normalizeDate(opp.cashDate || null);
          const valueChanged = existing.value !== (opp.value || 0);
          const statusChanged = !existing.manual_status_override && existing.status !== opp.status;

          if (awardDateChanged || contractDateChanged || deliverDateChanged || installDateChanged || cashDateChanged || valueChanged || statusChanged) {
            updatedCount++;
          }
        } else {
          newCount++;
        }
      }

      return NextResponse.json({
        status: 'preview',
        updatedCount,
        newCount,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        supabaseContracts: contracts.length,
        salesforceOpportunities: salesforceCount,
      });
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
        preview: 'GET /api/contracts/sync?preview=true - Check for changes without applying',
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
