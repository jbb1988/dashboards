import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ContractBundle {
  id: string;
  name: string;
  account_name: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BundleContract {
  id: string;
  bundle_id: string;
  contract_id: string;
  is_primary: boolean;
  added_at: string;
}

export interface BundleWithContracts extends ContractBundle {
  contracts: {
    contract_id: string;
    is_primary: boolean;
    contract?: {
      id: string;
      name: string;
      salesforce_id?: string;
      value: number;
      status: string;
      contract_type: string[];
    };
  }[];
}

// ============================================================================
// GET - List all bundles or get bundle for a specific contract
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const accountName = searchParams.get('accountName');
    const bundleId = searchParams.get('bundleId');

    const supabase = getSupabaseAdmin();

    // Get a specific bundle by ID
    if (bundleId) {
      const { data: bundle, error: bundleError } = await supabase
        .from('contract_bundles')
        .select('*')
        .eq('id', bundleId)
        .single();

      if (bundleError) {
        console.error('[BUNDLES] Error fetching bundle:', bundleError);
        return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
      }

      // Get contracts in this bundle
      const { data: bundleContracts, error: contractsError } = await supabase
        .from('bundle_contracts')
        .select(`
          contract_id,
          is_primary,
          contracts (
            id,
            name,
            salesforce_id,
            value,
            status,
            contract_type
          )
        `)
        .eq('bundle_id', bundleId);

      if (contractsError) {
        console.error('[BUNDLES] Error fetching bundle contracts:', contractsError);
      }

      return NextResponse.json({
        ...bundle,
        contracts: bundleContracts || [],
      });
    }

    // Get bundle for a specific contract
    if (contractId) {
      const { data: bundleContract, error } = await supabase
        .from('bundle_contracts')
        .select(`
          bundle_id,
          is_primary,
          contract_bundles (
            id,
            name,
            account_name,
            description
          )
        `)
        .eq('contract_id', contractId)
        .single();

      if (error || !bundleContract) {
        return NextResponse.json({ bundle: null });
      }

      // Get all contracts in this bundle
      const { data: bundleContracts } = await supabase
        .from('bundle_contracts')
        .select(`
          contract_id,
          is_primary,
          contracts (
            id,
            name,
            salesforce_id,
            value,
            status,
            contract_type
          )
        `)
        .eq('bundle_id', bundleContract.bundle_id);

      return NextResponse.json({
        bundle: bundleContract.contract_bundles,
        is_primary: bundleContract.is_primary,
        contracts: bundleContracts || [],
      });
    }

    // List all bundles, optionally filtered by account
    let query = supabase
      .from('contract_bundles')
      .select('*')
      .order('created_at', { ascending: false });

    if (accountName) {
      query = query.eq('account_name', accountName);
    }

    const { data: bundles, error } = await query;

    if (error) {
      console.error('[BUNDLES] Error fetching bundles:', error);
      return NextResponse.json({ error: 'Failed to fetch bundles' }, { status: 500 });
    }

    // Get contract counts for each bundle
    const bundleIds = bundles?.map(b => b.id) || [];
    const { data: contractCounts } = await supabase
      .from('bundle_contracts')
      .select('bundle_id')
      .in('bundle_id', bundleIds);

    const countMap = new Map<string, number>();
    contractCounts?.forEach(bc => {
      countMap.set(bc.bundle_id, (countMap.get(bc.bundle_id) || 0) + 1);
    });

    const bundlesWithCounts = bundles?.map(b => ({
      ...b,
      contract_count: countMap.get(b.id) || 0,
    }));

    return NextResponse.json({ bundles: bundlesWithCounts });

  } catch (error) {
    console.error('[BUNDLES] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch bundles' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create a new bundle
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, account_name, description, contract_ids, primary_contract_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Bundle name is required' }, { status: 400 });
    }

    if (!contract_ids || contract_ids.length < 2) {
      return NextResponse.json({ error: 'At least 2 contracts are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Create the bundle
    const { data: bundle, error: bundleError } = await supabase
      .from('contract_bundles')
      .insert({
        name,
        account_name: account_name || null,
        description: description || null,
      })
      .select()
      .single();

    if (bundleError || !bundle) {
      console.error('[BUNDLES] Error creating bundle:', bundleError);
      // Check if it's a table not found error
      if (bundleError?.code === '42P01' || bundleError?.message?.includes('does not exist')) {
        return NextResponse.json({
          error: 'Bundle tables not set up. Run the migration: supabase/migrations/004_create_bundles_table.sql',
          details: bundleError?.message
        }, { status: 500 });
      }
      return NextResponse.json({
        error: 'Failed to create bundle',
        details: bundleError?.message || 'Unknown error'
      }, { status: 500 });
    }

    // Add contracts to the bundle
    const bundleContracts = contract_ids.map((contractId: string) => ({
      bundle_id: bundle.id,
      contract_id: contractId,
      is_primary: contractId === primary_contract_id,
    }));

    const { error: linkError } = await supabase
      .from('bundle_contracts')
      .insert(bundleContracts);

    if (linkError) {
      console.error('[BUNDLES] Error linking contracts:', linkError);
      // Clean up the bundle if linking fails
      await supabase.from('contract_bundles').delete().eq('id', bundle.id);
      return NextResponse.json({ error: 'Failed to link contracts to bundle' }, { status: 500 });
    }

    console.log('[BUNDLES] Created bundle:', bundle.name, 'with', contract_ids.length, 'contracts');

    return NextResponse.json({
      success: true,
      bundle,
      message: `Bundle "${bundle.name}" created with ${contract_ids.length} contracts`,
    });

  } catch (error) {
    console.error('[BUNDLES] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create bundle' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update a bundle (add/remove contracts, update metadata)
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { bundle_id, name, description, add_contracts, remove_contracts, set_primary } = body;

    if (!bundle_id) {
      return NextResponse.json({ error: 'Bundle ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Update bundle metadata if provided
    if (name || description !== undefined) {
      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;

      const { error: updateError } = await supabase
        .from('contract_bundles')
        .update(updates)
        .eq('id', bundle_id);

      if (updateError) {
        console.error('[BUNDLES] Error updating bundle:', updateError);
        return NextResponse.json({ error: 'Failed to update bundle' }, { status: 500 });
      }
    }

    // Add contracts to bundle
    if (add_contracts && add_contracts.length > 0) {
      const newContracts = add_contracts.map((contractId: string) => ({
        bundle_id,
        contract_id: contractId,
        is_primary: false,
      }));

      const { error: addError } = await supabase
        .from('bundle_contracts')
        .upsert(newContracts, { onConflict: 'bundle_id,contract_id' });

      if (addError) {
        console.error('[BUNDLES] Error adding contracts:', addError);
        return NextResponse.json({ error: 'Failed to add contracts' }, { status: 500 });
      }
    }

    // Remove contracts from bundle
    if (remove_contracts && remove_contracts.length > 0) {
      // First, try to resolve any salesforce_ids to database UUIDs
      const { data: contractsData } = await supabase
        .from('contracts')
        .select('id, salesforce_id')
        .or(remove_contracts.map((id: string) => `id.eq.${id},salesforce_id.eq.${id}`).join(','));

      // Get the actual database UUIDs
      const dbIds = contractsData?.map(c => c.id) || remove_contracts;

      const { error: removeError } = await supabase
        .from('bundle_contracts')
        .delete()
        .eq('bundle_id', bundle_id)
        .in('contract_id', dbIds);

      if (removeError) {
        console.error('[BUNDLES] Error removing contracts:', removeError);
        return NextResponse.json({ error: 'Failed to remove contracts' }, { status: 500 });
      }
    }

    // Set primary contract
    if (set_primary) {
      // First, unset all primary flags
      await supabase
        .from('bundle_contracts')
        .update({ is_primary: false })
        .eq('bundle_id', bundle_id);

      // Then set the new primary
      await supabase
        .from('bundle_contracts')
        .update({ is_primary: true })
        .eq('bundle_id', bundle_id)
        .eq('contract_id', set_primary);
    }

    return NextResponse.json({ success: true, message: 'Bundle updated' });

  } catch (error) {
    console.error('[BUNDLES] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update bundle' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete a bundle
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get('bundleId');

    if (!bundleId) {
      return NextResponse.json({ error: 'Bundle ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Delete the bundle (cascade will remove bundle_contracts entries)
    const { error } = await supabase
      .from('contract_bundles')
      .delete()
      .eq('id', bundleId);

    if (error) {
      console.error('[BUNDLES] Error deleting bundle:', error);
      return NextResponse.json({ error: 'Failed to delete bundle' }, { status: 500 });
    }

    console.log('[BUNDLES] Deleted bundle:', bundleId);

    return NextResponse.json({ success: true, message: 'Bundle deleted' });

  } catch (error) {
    console.error('[BUNDLES] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete bundle' },
      { status: 500 }
    );
  }
}
