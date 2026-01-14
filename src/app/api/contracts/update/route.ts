import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { CONTRACT_STATUSES } from '@/lib/validations';

/**
 * POST - Update a contract's fields
 *
 * Body format:
 * {
 *   salesforceId: string,
 *   contractName?: string,  // for logging
 *   updates: {
 *     status?: string,
 *     awardDate?: string,      // YYYY-MM-DD - syncs to Salesforce
 *     contractDate?: string,   // YYYY-MM-DD - syncs to Salesforce
 *     deliverDate?: string,    // YYYY-MM-DD - syncs to Salesforce
 *     installDate?: string,    // YYYY-MM-DD - syncs to Salesforce
 *     cashDate?: string        // YYYY-MM-DD - syncs to Salesforce
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salesforceId, contractName, updates } = body;

    if (!salesforceId) {
      return NextResponse.json(
        { error: 'salesforceId is required' },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'updates object is required with at least one field' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and add status if provided
    if (updates.status) {
      if (!CONTRACT_STATUSES.includes(updates.status as typeof CONTRACT_STATUSES[number])) {
        return NextResponse.json(
          { error: `Invalid status. Valid: ${CONTRACT_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = updates.status;
    }

    // Validate and add date fields if provided
    const dateFields = ['awardDate', 'contractDate', 'deliverDate', 'installDate', 'cashDate'];
    const dbFieldMap: Record<string, string> = {
      awardDate: 'award_date',
      contractDate: 'contract_date',
      deliverDate: 'deliver_date',
      installDate: 'install_date',
      cashDate: 'cash_date',
    };

    for (const field of dateFields) {
      if (updates[field] !== undefined) {
        const value = updates[field];
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return NextResponse.json(
            { error: `${field} must be in YYYY-MM-DD format` },
            { status: 400 }
          );
        }
        updateData[dbFieldMap[field]] = value || null;
      }
    }

    console.log(`[UPDATE] Updating contract ${salesforceId} (${contractName || 'unknown'}):`, updateData);

    const admin = getSupabaseAdmin();

    // First, get the internal contract ID and check if it's part of a bundle
    const { data: contractData, error: contractError } = await admin
      .from('contracts')
      .select('id, salesforce_id')
      .eq('salesforce_id', salesforceId)
      .single();

    if (contractError || !contractData) {
      console.error(`[UPDATE] No contract found with salesforce_id: ${salesforceId}`, contractError);
      return NextResponse.json(
        { error: `Contract not found with ID: ${salesforceId}` },
        { status: 404 }
      );
    }

    const contractId = contractData.id;

    // Check if this contract is part of a bundle
    const { data: bundleData, error: bundleError } = await admin
      .from('bundle_contracts')
      .select('bundle_id')
      .eq('contract_id', contractId)
      .maybeSingle();

    if (bundleError && bundleError.code !== 'PGRST116') {
      console.error('[UPDATE] Error checking bundle membership:', bundleError);
    }

    let contractsToUpdate: { id: string; salesforce_id: string }[] = [
      { id: contractId, salesforce_id: salesforceId }
    ];
    let bundleInfo: { bundleId: string; contractCount: number } | null = null;

    // If part of a bundle, get all contracts in that bundle
    if (bundleData?.bundle_id) {
      console.log(`[UPDATE] Contract is part of bundle ${bundleData.bundle_id}, updating all contracts in bundle`);

      const { data: bundleContracts, error: bundleContractsError } = await admin
        .from('bundle_contracts')
        .select(`
          contract_id,
          contracts!inner (
            id,
            salesforce_id
          )
        `)
        .eq('bundle_id', bundleData.bundle_id);

      if (bundleContractsError) {
        console.error('[UPDATE] Error fetching bundle contracts:', bundleContractsError);
      } else if (bundleContracts && bundleContracts.length > 0) {
        contractsToUpdate = bundleContracts.map((bc: any) => ({
          id: bc.contracts.id,
          salesforce_id: bc.contracts.salesforce_id
        }));
        bundleInfo = {
          bundleId: bundleData.bundle_id,
          contractCount: contractsToUpdate.length
        };
        console.log(`[UPDATE] Updating ${contractsToUpdate.length} contracts in bundle`);
      }
    }

    // Update all contracts (single or bundled)
    let updateResults = [];
    for (const contract of contractsToUpdate) {
      const { data, error } = await admin
        .from('contracts')
        .update(updateData)
        .eq('id', contract.id)
        .select('salesforce_id, status, award_date, contract_date, deliver_date, install_date, cash_date');

      if (error) {
        console.error(`[UPDATE] Error updating contract ${contract.salesforce_id}:`, error);
        updateResults.push({ salesforce_id: contract.salesforce_id, success: false, error: error.message });
      } else {
        console.log(`[UPDATE] Successfully updated ${contract.salesforce_id}`);
        updateResults.push({ salesforce_id: contract.salesforce_id, success: true, data: data[0] });
      }
    }

    // Check if any updates failed
    const failedUpdates = updateResults.filter(r => !r.success);
    const successfulUpdates = updateResults.filter(r => r.success);

    if (failedUpdates.length > 0 && successfulUpdates.length === 0) {
      return NextResponse.json(
        { error: 'All contract updates failed', details: failedUpdates },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      salesforceId,
      updates: updateData,
      updatedAt: new Date().toISOString(),
      bundleInfo,
      updateResults: {
        total: updateResults.length,
        successful: successfulUpdates.length,
        failed: failedUpdates.length,
        details: updateResults
      }
    });

  } catch (error) {
    console.error('[UPDATE] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Update failed: ${message}` },
      { status: 500 }
    );
  }
}
