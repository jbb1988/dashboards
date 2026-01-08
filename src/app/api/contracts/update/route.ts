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

/**
 * Find Notion page by Salesforce ID (preferred) or contract name and update it
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salesforceId, contractName, updates } = body;

    if ((!salesforceId && !contractName) || !updates) {
      return NextResponse.json({ error: 'Missing salesforceId/contractName or updates' }, { status: 400 });
    }

    let pageId: string | null = null;

    // PRIORITY 1: Find by Salesforce ID (exact 1:1 match)
    if (salesforceId) {
      const sfIdResponse = await fetch(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: {
              and: [
                { property: 'Archive', checkbox: { equals: false } },
                { property: 'Salesforce ID', rich_text: { equals: salesforceId } }
              ]
            }
          }),
        }
      );

      if (sfIdResponse.ok) {
        const sfIdData = await sfIdResponse.json();
        if (sfIdData.results.length > 0) {
          pageId = sfIdData.results[0].id;
        }
      }
    }

    // PRIORITY 2: Fall back to name matching if SF ID didn't find anything
    if (!pageId && contractName) {
      const searchResponse = await fetch(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: {
              property: 'Name',
              title: {
                equals: contractName
              }
            }
          }),
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.results.length > 0) {
          pageId = searchData.results[0].id;
        }
      }
    }

    if (!pageId) {
      return NextResponse.json({
        error: 'Contract not found in Notion',
        salesforceId,
        contractName,
        hint: 'Run /api/salesforce/sync to create the Notion entry first'
      }, { status: 404 });
    }

    // Build properties to update
    const properties: Record<string, any> = {};

    if (updates.status) {
      if (!VALID_STATUSES.includes(updates.status)) {
        return NextResponse.json({
          error: 'Invalid status',
          validStatuses: VALID_STATUSES
        }, { status: 400 });
      }
      properties['Contract Status'] = { status: { name: updates.status } };
      properties['Status Change Date'] = { date: { start: new Date().toISOString().split('T')[0] } };
    }

    if (updates.value !== undefined) {
      const numValue = parseFloat(updates.value);
      if (isNaN(numValue)) {
        return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
      }
      properties['Contract Value'] = { number: numValue };
    }

    if (updates.contractDate) {
      properties['Contract Date'] = { date: { start: updates.contractDate } };
    }

    if (updates.awardDate) {
      properties['Award Date'] = { date: { start: updates.awardDate } };
    }

    if (updates.salesStage) {
      properties['Sales Stage'] = { select: { name: updates.salesStage } };
    }

    // Update the Notion page
    const updateResponse = await fetch(
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

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      console.error('Notion update error:', error);
      return NextResponse.json({ error: 'Failed to update Notion' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      salesforceId,
      contractName,
      notionPageId: pageId,
      updates,
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating contract:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
