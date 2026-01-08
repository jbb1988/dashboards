import { NextRequest, NextResponse } from 'next/server';

const NOTION_TOKEN = process.env.NOTION_API_KEY || '';
const DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc';

// Valid contract statuses in Notion
const VALID_STATUSES = [
  'Discussions Not Started',
  'Initial Agreement Development',
  'Review & Redlines',
  'Approval & Signature',
  'Agreement Submission',
  'PO Received',
];

interface NotionContract {
  id: string;
  name: string;
  value: number;
  status: string;
  statusGroup: string;
  contractType: string[];
  daysInStage: number;
  daysUntilDeadline: number;
  closeDate: string | null;
  statusChangeDate: string | null;
  progress: number;
  isOverdue: boolean;
  nextTask: string;
  redlines: string;
  lastRedlineDate: string | null;
}

export async function GET() {
  try {
    // Query all contracts from Notion
    const response = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_size: 100,
          filter: {
            property: 'Archive',
            checkbox: {
              equals: false,
            },
          },
          sorts: [
            {
              property: 'Name',
              direction: 'ascending',
            },
          ],
        }),
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Notion API error:', error);
      return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
    }

    const data = await response.json();

    // Transform Notion data to our format
    const contracts: NotionContract[] = data.results.map((page: any) => {
      const props = page.properties;

      // Extract status from status property
      const statusObj = props['Contract Status']?.status;
      const status = statusObj?.name || 'Unknown';
      const statusGroup = statusObj?.color || 'default';

      // Extract contract types
      const contractTypes = props['Contract Type']?.multi_select?.map((t: any) => t.name) || [];

      // Extract dates
      const closeDate = props['Contract Date']?.date?.start || null;
      const statusChangeDate = props['Status Change Date']?.date?.start || null;

      // Extract formula values
      const daysInStage = props['Days In Stage']?.formula?.number || 0;
      const daysUntilDeadline = props['Days Until Deadline']?.formula?.number || 0;
      const progressStr = props['Progress Indicator']?.formula?.string || '0%';
      const progress = parseInt(progressStr.replace('%', '')) || 0;
      const isOverdue = props['Red Flag Overdue']?.formula?.boolean || false;
      const nextTask = props['Next Task']?.formula?.string || '';

      // Extract redlines
      const redlines = props['Redlines']?.rich_text?.[0]?.plain_text || '';
      const lastRedlineDate = props['Last Redline Date']?.date?.start || null;

      return {
        id: page.id,
        name: props.Name?.title?.[0]?.plain_text || 'Unnamed',
        value: props['Contract Value']?.number || 0,
        status,
        statusGroup,
        contractType: contractTypes,
        daysInStage,
        daysUntilDeadline,
        closeDate,
        statusChangeDate,
        progress,
        isOverdue,
        nextTask,
        redlines,
        lastRedlineDate,
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
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Update a contract in Notion
 * Supports updating: status, value, contractDate
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId, field, value } = body;

    if (!pageId || !field) {
      return NextResponse.json({ error: 'Missing pageId or field' }, { status: 400 });
    }

    // Build the properties update based on field
    let properties: Record<string, any> = {};

    switch (field) {
      case 'status':
        if (!VALID_STATUSES.includes(value)) {
          return NextResponse.json({
            error: 'Invalid status',
            validStatuses: VALID_STATUSES
          }, { status: 400 });
        }
        properties['Contract Status'] = {
          status: { name: value }
        };
        // Also update Status Change Date to now
        properties['Status Change Date'] = {
          date: { start: new Date().toISOString().split('T')[0] }
        };
        break;

      case 'value':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return NextResponse.json({ error: 'Invalid value - must be a number' }, { status: 400 });
        }
        properties['Contract Value'] = {
          number: numValue
        };
        break;

      case 'contractDate':
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
        }
        properties['Contract Date'] = {
          date: { start: value }
        };
        break;

      case 'awardDate':
        const awardDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!awardDateRegex.test(value)) {
          return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
        }
        properties['Award Date'] = {
          date: { start: value }
        };
        break;

      default:
        return NextResponse.json({ error: `Unknown field: ${field}` }, { status: 400 });
    }

    // Update the Notion page
    const response = await fetch(
      `https://api.notion.com/v1/pages/${pageId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Notion update error:', error);
      return NextResponse.json({
        error: 'Failed to update contract in Notion',
        details: error
      }, { status: 500 });
    }

    const updatedPage = await response.json();

    return NextResponse.json({
      success: true,
      pageId,
      field,
      value,
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating contract:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
