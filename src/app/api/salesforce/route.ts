import { NextResponse } from 'next/server';
import { getContractOpportunities } from '@/lib/salesforce';
import { getOAuthToken } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Status color mapping
const statusColors: Record<string, string> = {
  'Discussions Not Started': 'gray',
  'Initial Agreement Development': 'blue',
  'Review & Redlines': 'orange',
  'Approval & Signature': 'green',
  'Agreement Submission': 'purple',
  'PO Received': 'green',
};

export async function GET() {
  try {
    // Check if Salesforce OAuth is configured
    const hasClientCreds = !!(
      process.env.SALESFORCE_CLIENT_ID &&
      process.env.SALESFORCE_CLIENT_SECRET
    );

    if (!hasClientCreds) {
      return NextResponse.json({
        error: 'Salesforce not configured',
        message: 'Add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET to environment variables',
        configured: false,
      }, { status: 503 });
    }

    // Check if we have stored tokens in Supabase
    const storedToken = await getOAuthToken('salesforce');

    if (!storedToken) {
      return NextResponse.json({
        error: 'Salesforce not connected',
        message: 'Click "Connect Salesforce" to authenticate',
        authUrl: '/api/salesforce/auth',
        needsAuth: true,
        configured: true,
      }, { status: 401 });
    }

    // Fetch contracts from Salesforce
    const salesforceContracts = await getContractOpportunities();

    // Transform contracts with status info
    const contracts = salesforceContracts.map(contract => {
      // Determine if this is a renewal based on opportunity name
      const isRenewal = contract.opportunityName?.toLowerCase().includes('renewal') || false;
      const statusGroup = statusColors[contract.status] || 'gray';

      return {
        ...contract,
        salesforceId: contract.id,
        statusGroup,
        isRenewal,
      };
    });

    // Calculate KPIs
    const totalPipeline = contracts.reduce((sum, c) => sum + c.value, 0);
    const overdueContracts = contracts.filter(c => c.isOverdue);
    const overdueValue = overdueContracts.reduce((sum, c) => sum + c.value, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const dueNext30 = contracts.filter(c => {
      if (!c.closeDate) return false;
      const closeDate = new Date(c.closeDate);
      return closeDate <= thirtyDaysFromNow && closeDate >= new Date();
    });
    const dueNext30Value = dueNext30.reduce((sum, c) => sum + c.value, 0);

    // Group by status for funnel
    const statusCounts: Record<string, { count: number; value: number }> = {};
    contracts.forEach(c => {
      if (!statusCounts[c.status]) {
        statusCounts[c.status] = { count: 0, value: 0 };
      }
      statusCounts[c.status].count++;
      statusCounts[c.status].value += c.value;
    });

    return NextResponse.json({
      contracts,
      kpis: {
        totalPipeline,
        totalCount: contracts.length,
        overdueValue,
        overdueCount: overdueContracts.length,
        dueNext30Value,
        dueNext30Count: dueNext30.length,
      },
      statusBreakdown: statusCounts,
      lastUpdated: new Date().toISOString(),
      source: 'salesforce',
    });
  } catch (error) {
    console.error('Salesforce API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch from Salesforce',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
