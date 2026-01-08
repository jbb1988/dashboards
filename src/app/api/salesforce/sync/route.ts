import { NextRequest, NextResponse } from 'next/server';
import { getContractOpportunities } from '@/lib/salesforce';

const NOTION_TOKEN = process.env.NOTION_API_KEY || '';
const DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc';

interface NotionPage {
  id: string;
  salesforceId: string | null;
  name: string;
  status: string;
}

interface ExistingPages {
  bySalesforceId: Map<string, NotionPage>;
  byName: Map<string, NotionPage>;
}

/**
 * Fetch all Notion pages - indexed by both SF ID and Name for duplicate detection
 */
async function getAllNotionPages(): Promise<ExistingPages> {
  const bySalesforceId = new Map<string, NotionPage>();
  const byName = new Map<string, NotionPage>();
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
      const salesforceId = props['Salesforce ID']?.rich_text?.[0]?.plain_text || null;
      const status = props['Contract Status']?.status?.name || 'Discussions Not Started';

      const pageData: NotionPage = {
        id: page.id,
        salesforceId,
        name,
        status,
      };

      // Index by SF ID if available
      if (salesforceId) {
        bySalesforceId.set(salesforceId, pageData);
      }

      // Always index by name (lowercase for matching)
      if (name) {
        byName.set(name.toLowerCase(), pageData);
      }
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return { bySalesforceId, byName };
}

/**
 * Delete all existing Notion pages (move to trash)
 */
async function archiveAllPages(): Promise<number> {
  let archived = 0;
  let hasMore = true;
  let startCursor: string | undefined;

  // Keep fetching and deleting until no more pages
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
        }),
      }
    );

    if (!response.ok) break;

    const data = await response.json();

    if (data.results.length === 0) break;

    for (const page of data.results) {
      // Actually delete by setting archived: true on the PAGE (moves to trash)
      await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archived: true,
        }),
      });
      archived++;
    }

    // Don't use cursor - deleted pages won't appear in next query
    // Keep fetching from start until no more pages
    hasMore = data.results.length > 0;
    startCursor = undefined;
  }

  return archived;
}

// Track which optional properties exist in Notion
const missingProperties = new Set<string>();

/**
 * Create a Notion page for a Salesforce opportunity
 * Returns { success: boolean, error?: string }
 */
async function createNotionPage(opp: any): Promise<{ success: boolean; error?: string }> {
  // Core properties - Name is required, others are optional
  // Name format: "Account Name - Opportunity Name" for easy identification
  const displayName = opp.opportunityName || opp.name;

  const properties: Record<string, any> = {
    Name: {
      title: [{ text: { content: displayName } }]
    },
    'Contract Status': {
      status: { name: 'Discussions Not Started' }
    },
    Archive: {
      checkbox: false
    },
  };

  // Add optional properties (skip if we know they don't exist)
  if (!missingProperties.has('Account Name') && opp.name) {
    properties['Account Name'] = {
      rich_text: [{ text: { content: opp.name } }]
    };
  }

  if (!missingProperties.has('Salesforce ID')) {
    properties['Salesforce ID'] = {
      rich_text: [{ text: { content: opp.id } }]
    };
  }

  // Add Contract Value if available
  if (opp.value !== undefined) {
    properties['Contract Value'] = { number: opp.value || 0 };
  }

  // Add optional date fields
  if (opp.closeDate) {
    properties['Contract Date'] = { date: { start: opp.closeDate.split('T')[0] } };
  }

  if (opp.awardDate) {
    properties['Award Date'] = { date: { start: opp.awardDate.split('T')[0] } };
  }

  // Add sales stage
  if (opp.salesStage) {
    properties['Sales Stage'] = { select: { name: opp.salesStage } };
  }

  // Add Contract Type (multi-select in Notion)
  if (!missingProperties.has('Contract Type') && opp.contractType?.[0]) {
    properties['Contract Type'] = {
      multi_select: [{ name: opp.contractType[0] }]
    };
  }

  // Add Install Date
  if (!missingProperties.has('Install Date') && opp.installDate) {
    properties['Install Date'] = { date: { start: opp.installDate.split('T')[0] } };
  }

  // Add Budgeted (checkbox)
  if (!missingProperties.has('Budgeted') && opp.budgeted !== undefined) {
    properties['Budgeted'] = { checkbox: opp.budgeted };
  }

  // Add Manual Close Probability (number)
  if (!missingProperties.has('Manual Close Probability') && opp.manualCloseProbability != null) {
    properties['Manual Close Probability'] = { number: opp.manualCloseProbability };
  }

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

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    const errorMsg = errorData.message || JSON.stringify(errorData);

    // Check if error is about missing properties - could be multiple
    // Pattern: "PropertyName is not a property that exists"
    const propertyMatches = errorMsg.matchAll(/([A-Za-z][A-Za-z\s]+?) is not a property that exists/g);
    let foundMissing = false;

    for (const match of propertyMatches) {
      const missingProp = match[1].trim();
      if (!missingProperties.has(missingProp)) {
        console.log(`Property "${missingProp}" not found in Notion, marking for retry...`);
        missingProperties.add(missingProp);
        foundMissing = true;
      }
    }

    if (foundMissing) {
      return createNotionPage(opp); // Retry without missing properties
    }

    console.error('Failed to create Notion page:', errorMsg);
    return { success: false, error: errorMsg };
  }

  return { success: true };
}

/**
 * POST - Sync Salesforce opportunities to Notion
 * Uses Salesforce ID as unique key for 1:1 mapping
 *
 * Query params:
 * - clearFirst=true: Archive all existing pages before sync
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clearFirst = searchParams.get('clearFirst') === 'true';

    // Reset the missing properties tracking for each sync request
    missingProperties.clear();

    const result = {
      archived: 0,
      created: 0,
      existing: 0,
      errors: [] as string[],
    };

    // Step 1: Archive existing pages if requested
    if (clearFirst) {
      result.archived = await archiveAllPages();
    }

    // Step 2: Fetch Salesforce opportunities
    const opportunities = await getContractOpportunities();

    // Step 3: Fetch existing Notion pages (by SF ID and Name)
    const existingPages = await getAllNotionPages();

    // Step 4: Create Notion pages for each SF opportunity
    let firstError: string | null = null;
    for (const opp of opportunities) {
      const sfId = opp.id;
      const oppName = (opp.opportunityName || opp.name || '').toLowerCase();

      // Check if already exists by SF ID or by name
      if (existingPages.bySalesforceId.has(sfId) || existingPages.byName.has(oppName)) {
        // Already exists, skip
        result.existing++;
        continue;
      }

      // Create new page
      const createResult = await createNotionPage(opp);
      if (createResult.success) {
        result.created++;
        // Add to byName map to prevent duplicates within same sync
        existingPages.byName.set(oppName, {
          id: 'pending',
          salesforceId: sfId,
          name: opp.opportunityName || opp.name,
          status: 'Discussions Not Started',
        });
      } else {
        if (!firstError && createResult.error) {
          firstError = createResult.error;
        }
        result.errors.push(`${opp.opportunityName || opp.name}`);
      }
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      summary: {
        totalOpportunities: opportunities.length,
        archived: result.archived,
        created: result.created,
        existing: result.existing,
        errors: result.errors.length,
      },
      missingProperties: missingProperties.size > 0 ? Array.from(missingProperties) : undefined,
      firstError: firstError || undefined,
      failedContracts: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      message: clearFirst
        ? `Rebuilt Notion: archived ${result.archived} old pages, created ${result.created} new pages`
        : `Synced: created ${result.created} new pages, ${result.existing} already existed`,
      note: missingProperties.size > 0
        ? `Some properties not found in Notion: ${Array.from(missingProperties).join(', ')}. Add these as Text properties to enable full sync.`
        : undefined,
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET - Check sync status without making changes
 */
export async function GET() {
  try {
    const opportunities = await getContractOpportunities();
    const existingPages = await getAllNotionPages();

    let needsCreate = 0;
    let alreadyExists = 0;

    for (const opp of opportunities) {
      if (existingPages.bySalesforceId.has(opp.id)) {
        alreadyExists++;
      } else {
        needsCreate++;
      }
    }

    return NextResponse.json({
      status: 'ready',
      salesforceOpportunities: opportunities.length,
      notionPagesWithSfId: existingPages.bySalesforceId.size,
      needsCreate,
      alreadyExists,
      actions: {
        sync: 'POST /api/salesforce/sync - Create missing pages',
        rebuild: 'POST /api/salesforce/sync?clearFirst=true - Archive all and rebuild',
      },
    });

  } catch (error) {
    console.error('Sync check error:', error);
    return NextResponse.json({
      error: 'Failed to check sync status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
