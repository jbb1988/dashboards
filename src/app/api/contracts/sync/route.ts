import { NextRequest, NextResponse } from 'next/server';

const NOTION_TOKEN = process.env.NOTION_API_KEY || '';
const DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc';

interface SyncResult {
  updated: { name: string; changes: string[] }[];
  created: { name: string }[];
  errors: { name: string; error: string }[];
  skipped: { name: string; reason: string }[];
}

/**
 * Fetch all Notion contracts
 */
async function getAllNotionContracts(): Promise<Map<string, { id: string; name: string; value: number; contractDate: string | null; awardDate: string | null; salesStage: string | null; contractType: string[] }>> {
  const contracts = new Map();
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
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
          start_cursor: startCursor,
          filter: {
            property: 'Archive',
            checkbox: { equals: false },
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Notion fetch error:', await response.text());
      break;
    }

    const data = await response.json();

    for (const page of data.results) {
      const props = page.properties;
      const name = props.Name?.title?.[0]?.plain_text || '';
      if (name) {
        contracts.set(name.toLowerCase(), {
          id: page.id,
          name,
          value: props['Contract Value']?.number || 0,
          contractDate: props['Contract Date']?.date?.start || null,
          awardDate: props['Award Date']?.date?.start || null,
          salesStage: props['Sales Stage']?.select?.name || null,
          contractType: props['Contract Type']?.multi_select?.map((s: any) => s.name) || [],
        });
      }
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return contracts;
}

/**
 * Update a Notion page with new data
 */
async function updateNotionPage(pageId: string, properties: Record<string, any>): Promise<boolean> {
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

  return response.ok;
}

/**
 * Create a new Notion page
 */
async function createNotionPage(properties: Record<string, any>): Promise<boolean> {
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: DATABASE_ID },
      properties,
    }),
  });

  return response.ok;
}

/**
 * POST - Run full sync from Salesforce to Notion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // Fetch Salesforce data
    const sfResponse = await fetch(`${request.nextUrl.origin}/api/salesforce`);
    if (!sfResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch Salesforce data' }, { status: 500 });
    }
    const sfData = await sfResponse.json();
    const sfContracts = sfData.contracts || [];

    // Fetch all Notion contracts
    const notionContracts = await getAllNotionContracts();

    const result: SyncResult = {
      updated: [],
      created: [],
      errors: [],
      skipped: [],
    };

    // Process each Salesforce contract
    for (const sf of sfContracts) {
      const sfNameLower = sf.name.toLowerCase();
      const notionMatch = notionContracts.get(sfNameLower);

      if (notionMatch) {
        // Contract exists in Notion - check for updates needed
        const changes: string[] = [];
        const properties: Record<string, any> = {};

        // Check Contract Value
        if (sf.value !== notionMatch.value) {
          changes.push(`Value: $${notionMatch.value?.toLocaleString() || 0} → $${sf.value?.toLocaleString() || 0}`);
          properties['Contract Value'] = { number: sf.value || 0 };
        }

        // Check Contract Date
        const sfContractDate = sf.contractDate?.split('T')[0] || null;
        if (sfContractDate !== notionMatch.contractDate) {
          changes.push(`Contract Date: ${notionMatch.contractDate || 'none'} → ${sfContractDate || 'none'}`);
          if (sfContractDate) {
            properties['Contract Date'] = { date: { start: sfContractDate } };
          }
        }

        // Check Award Date
        const sfAwardDate = sf.awardDate?.split('T')[0] || null;
        if (sfAwardDate !== notionMatch.awardDate) {
          changes.push(`Award Date: ${notionMatch.awardDate || 'none'} → ${sfAwardDate || 'none'}`);
          if (sfAwardDate) {
            properties['Award Date'] = { date: { start: sfAwardDate } };
          }
        }

        // Check Sales Stage
        if (sf.salesStage && sf.salesStage !== notionMatch.salesStage) {
          changes.push(`Sales Stage: ${notionMatch.salesStage || 'none'} → ${sf.salesStage}`);
          properties['Sales Stage'] = { select: { name: sf.salesStage } };
        }

        // Check Contract Type (Opportunity Type from SF)
        const sfContractType = sf.contractType?.[0] || null;
        const notionContractType = notionMatch.contractType?.[0] || null;
        if (sfContractType && sfContractType !== notionContractType) {
          changes.push(`Contract Type: ${notionContractType || 'none'} → ${sfContractType}`);
          properties['Contract Type'] = { multi_select: [{ name: sfContractType }] };
        }

        if (changes.length > 0) {
          if (!dryRun) {
            const success = await updateNotionPage(notionMatch.id, properties);
            if (success) {
              result.updated.push({ name: sf.name, changes });
            } else {
              result.errors.push({ name: sf.name, error: 'Failed to update Notion page' });
            }
          } else {
            result.updated.push({ name: sf.name, changes });
          }
        } else {
          result.skipped.push({ name: sf.name, reason: 'Already in sync' });
        }
      } else {
        // Contract not in Notion - create it
        const properties: Record<string, any> = {
          Name: { title: [{ text: { content: sf.name } }] },
          'Contract Value': { number: sf.value || 0 },
          'Contract Status': { status: { name: 'Discussions Not Started' } },
        };

        if (sf.contractDate) {
          properties['Contract Date'] = { date: { start: sf.contractDate.split('T')[0] } };
        }

        if (sf.awardDate) {
          properties['Award Date'] = { date: { start: sf.awardDate.split('T')[0] } };
        }

        if (sf.salesStage) {
          properties['Sales Stage'] = { select: { name: sf.salesStage } };
        }

        // Add Contract Type (Opportunity Type from SF)
        if (sf.contractType?.[0]) {
          properties['Contract Type'] = { multi_select: [{ name: sf.contractType[0] }] };
        }

        if (!dryRun) {
          const success = await createNotionPage(properties);
          if (success) {
            result.created.push({ name: sf.name });
          } else {
            result.errors.push({ name: sf.name, error: 'Failed to create Notion page' });
          }
        } else {
          result.created.push({ name: sf.name });
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalSalesforce: sfContracts.length,
        totalNotion: notionContracts.size,
        updated: result.updated.length,
        created: result.created.length,
        skipped: result.skipped.length,
        errors: result.errors.length,
      },
      details: result,
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

/**
 * GET - Check sync status (dry run)
 */
export async function GET(request: NextRequest) {
  // Redirect to POST with dryRun flag
  const url = new URL(request.url);

  try {
    const sfResponse = await fetch(`${url.origin}/api/salesforce`);
    if (!sfResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch Salesforce data' }, { status: 500 });
    }
    const sfData = await sfResponse.json();
    const sfContracts = sfData.contracts || [];

    const notionContracts = await getAllNotionContracts();

    let needsUpdate = 0;
    let needsCreate = 0;
    let inSync = 0;

    for (const sf of sfContracts) {
      const sfNameLower = sf.name.toLowerCase();
      const notionMatch = notionContracts.get(sfNameLower);

      if (notionMatch) {
        // Check if any field differs
        const sfContractDate = sf.contractDate?.split('T')[0] || null;
        const sfAwardDate = sf.awardDate?.split('T')[0] || null;

        const isDifferent =
          sf.value !== notionMatch.value ||
          sfContractDate !== notionMatch.contractDate ||
          sfAwardDate !== notionMatch.awardDate ||
          (sf.salesStage && sf.salesStage !== notionMatch.salesStage);

        if (isDifferent) {
          needsUpdate++;
        } else {
          inSync++;
        }
      } else {
        needsCreate++;
      }
    }

    return NextResponse.json({
      status: 'ready',
      salesforceContracts: sfContracts.length,
      notionContracts: notionContracts.size,
      needsUpdate,
      needsCreate,
      inSync,
      action: 'POST to this endpoint to run sync',
    });

  } catch (error) {
    console.error('Sync check error:', error);
    return NextResponse.json({ error: 'Failed to check sync status' }, { status: 500 });
  }
}
