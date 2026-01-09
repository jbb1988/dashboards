import { NextRequest, NextResponse } from 'next/server';
import { getContracts, getSupabaseAdmin, Contract } from '@/lib/supabase';

// Valid contract statuses
const VALID_STATUSES = [
  'Discussions Not Started',
  'Initial Agreement Development',
  'Review & Redlines',
  'Approval & Signature',
  'Agreement Submission',
  'PO Received',
];

interface DashboardContract {
  id: string;
  salesforceId: string;
  name: string;
  opportunityName: string;
  value: number;
  status: string;
  statusGroup: string;
  salesStage: string;
  contractType: string[];
  daysInStage: number;
  daysUntilDeadline: number;
  closeDate: string | null;
  awardDate: string | null;
  contractDate: string | null;
  statusChangeDate: string | null;
  progress: number;
  isOverdue: boolean;
  nextTask: string;
  salesRep: string;
  probability: number;
  budgeted: boolean;
  manualCloseProbability: number | null;
}

/**
 * Transform Supabase contract to dashboard format
 */
function transformToDashboardFormat(contract: Contract): DashboardContract {
  const closeDate = contract.close_date;
  const now = Date.now();

  // Calculate days until deadline
  const daysUntilDeadline = closeDate
    ? Math.floor((new Date(closeDate).getTime() - now) / (1000 * 60 * 60 * 24))
    : 0;

  // Calculate days in stage (using updated_at as proxy for last status change)
  const lastUpdate = contract.updated_at ? new Date(contract.updated_at).getTime() : now;
  const daysInStage = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));

  return {
    id: contract.id || contract.salesforce_id,
    salesforceId: contract.salesforce_id,
    name: contract.account_name || contract.name,
    opportunityName: contract.opportunity_name,
    value: contract.value,
    status: contract.status,
    statusGroup: contract.status_group,
    salesStage: contract.sales_stage,
    contractType: contract.contract_type || [],
    daysInStage,
    daysUntilDeadline,
    closeDate: contract.close_date,
    awardDate: contract.award_date,
    contractDate: contract.contract_date,
    statusChangeDate: contract.updated_at || null,
    progress: contract.probability,
    isOverdue: daysUntilDeadline < 0,
    nextTask: '',
    salesRep: contract.sales_rep,
    probability: contract.probability,
    budgeted: contract.budgeted,
    manualCloseProbability: contract.manual_close_probability,
  };
}

export async function GET() {
  try {
    // Fetch contracts from Supabase
    const contracts = await getContracts();

    // Filter to only active contracts (not closed)
    const activeContracts = contracts.filter(c => !c.is_closed);

    // Transform to dashboard format
    const dashboardContracts = activeContracts.map(transformToDashboardFormat);

    // Calculate KPIs
    const totalPipeline = dashboardContracts.reduce((sum, c) => sum + c.value, 0);
    const overdueContracts = dashboardContracts.filter(c => c.isOverdue);
    const overdueValue = overdueContracts.reduce((sum, c) => sum + c.value, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const dueNext30 = dashboardContracts.filter(c => {
      if (!c.closeDate) return false;
      const closeDate = new Date(c.closeDate);
      return closeDate <= thirtyDaysFromNow && closeDate >= new Date();
    });
    const dueNext30Value = dueNext30.reduce((sum, c) => sum + c.value, 0);

    // Group by status for funnel
    const statusCounts: Record<string, { count: number; value: number }> = {};
    dashboardContracts.forEach(c => {
      if (!statusCounts[c.status]) {
        statusCounts[c.status] = { count: 0, value: 0 };
      }
      statusCounts[c.status].count++;
      statusCounts[c.status].value += c.value;
    });

    return NextResponse.json({
      contracts: dashboardContracts,
      kpis: {
        totalPipeline,
        totalCount: dashboardContracts.length,
        overdueValue,
        overdueCount: overdueContracts.length,
        dueNext30Value,
        dueNext30Count: dueNext30.length,
      },
      statusBreakdown: statusCounts,
      lastUpdated: new Date().toISOString(),
      source: 'supabase',
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Update a contract in Supabase
 * Supports updating: status, value, contractDate, awardDate
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, salesforceId, field, value } = body;

    // Need either contractId or salesforceId
    const id = contractId || salesforceId;
    if (!id || !field) {
      return NextResponse.json({ error: 'Missing contractId/salesforceId or field' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Build the update object based on field
    let updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    switch (field) {
      case 'status':
        if (!VALID_STATUSES.includes(value)) {
          return NextResponse.json({
            error: 'Invalid status',
            validStatuses: VALID_STATUSES
          }, { status: 400 });
        }
        updateData.status = value;
        break;

      case 'value':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return NextResponse.json({ error: 'Invalid value - must be a number' }, { status: 400 });
        }
        updateData.value = numValue;
        break;

      case 'contractDate':
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
        }
        updateData.contract_date = value;
        break;

      case 'awardDate':
        const awardDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!awardDateRegex.test(value)) {
          return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
        }
        updateData.award_date = value;
        break;

      default:
        return NextResponse.json({ error: `Unknown field: ${field}` }, { status: 400 });
    }

    // Update using salesforce_id as the primary identifier
    const { error } = await admin
      .from('contracts')
      .update(updateData)
      .eq('salesforce_id', id);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({
        error: 'Failed to update contract',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      contractId: id,
      field,
      value,
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating contract:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
