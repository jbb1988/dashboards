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

    // Use .select() to get the updated row and verify it exists
    const { data, error } = await admin
      .from('contracts')
      .update(updateData)
      .eq('salesforce_id', salesforceId)
      .select('salesforce_id, status, award_date, contract_date, deliver_date, install_date, cash_date');

    if (error) {
      console.error('[UPDATE] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update contract', details: error.message },
        { status: 500 }
      );
    }

    // Check if any rows were actually updated
    if (!data || data.length === 0) {
      console.error(`[UPDATE] No contract found with salesforce_id: ${salesforceId}`);
      return NextResponse.json(
        { error: `Contract not found with ID: ${salesforceId}` },
        { status: 404 }
      );
    }

    console.log(`[UPDATE] Successfully updated ${salesforceId}`);

    return NextResponse.json({
      success: true,
      salesforceId,
      updates: updateData,
      updatedAt: new Date().toISOString(),
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
