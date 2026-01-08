import { NextResponse } from 'next/server';
import { getContractOpportunities } from '@/lib/salesforce';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

const NOTION_TOKEN = process.env.NOTION_API_KEY || '';
const NOTION_DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc';

// Valid contract statuses from Notion
const VALID_STATUSES = [
  'Discussions Not Started',
  'Initial Agreement Development',
  'Review & Redlines',
  'Approval & Signature',
  'Agreement Submission',
  'PO Received',
];

// Status color mapping
const statusColors: Record<string, string> = {
  'Discussions Not Started': 'gray',
  'Initial Agreement Development': 'blue',
  'Review & Redlines': 'orange',
  'Approval & Signature': 'green',
  'Agreement Submission': 'purple',
  'PO Received': 'green',
};

/**
 * Fetch Contract Status from Notion database
 * Returns maps for SF ID matching and fuzzy name matching
 * Paginates to fetch ALL contracts (not just first 100)
 */
async function getNotionContractStatuses(): Promise<{
  bySalesforceId: Map<string, { status: string; statusGroup: string; notionName: string; notionPageId: string }>;
  exactMap: Map<string, { status: string; statusGroup: string; notionName: string }>;
  allEntries: Array<{ name: string; nameLower: string; status: string; statusGroup: string }>;
}> {
  const bySalesforceId = new Map<string, { status: string; statusGroup: string; notionName: string; notionPageId: string }>();
  const exactMap = new Map<string, { status: string; statusGroup: string; notionName: string }>();
  const allEntries: Array<{ name: string; nameLower: string; status: string; statusGroup: string }> = [];

  try {
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
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
        console.error('Notion API error:', await response.text());
        break;
      }

      const data = await response.json();

      for (const page of data.results) {
        const props = page.properties;
        const name = props.Name?.title?.[0]?.plain_text || '';
        const salesforceId = props['Salesforce ID']?.rich_text?.[0]?.plain_text || null;
        const statusObj = props['Contract Status']?.status;
        const status = statusObj?.name || 'Discussions Not Started';
        const statusGroup = statusColors[status] || 'default';

        // Store by Salesforce ID if available (preferred lookup)
        if (salesforceId) {
          bySalesforceId.set(salesforceId, { status, statusGroup, notionName: name, notionPageId: page.id });
        }

        // Also store by name for legacy/fallback matching
        if (name) {
          const nameLower = name.toLowerCase();
          exactMap.set(nameLower, { status, statusGroup, notionName: name });
          allEntries.push({ name, nameLower, status, statusGroup });
        }
      }

      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }
  } catch (err) {
    console.error('Error fetching Notion statuses:', err);
  }

  return { bySalesforceId, exactMap, allEntries };
}

/**
 * Fuzzy match Salesforce name to Notion entries
 * Tries: exact match, contains match, word overlap match, single significant word match
 */
function fuzzyMatchNotion(
  sfName: string,
  sfOppName: string | undefined,
  notionData: {
    exactMap: Map<string, { status: string; statusGroup: string; notionName: string }>;
    allEntries: Array<{ name: string; nameLower: string; status: string; statusGroup: string }>;
  }
): { status: string; statusGroup: string; notionName: string; matchType: string } | null {
  const sfNameLower = sfName.toLowerCase();
  const sfOppNameLower = sfOppName?.toLowerCase() || '';

  // PRIORITY 1: Match by OPPORTUNITY NAME first (more specific)
  // This allows separate statuses for M3 vs MCC for same account

  // 1a. Exact match on opportunity name
  if (sfOppNameLower && notionData.exactMap.has(sfOppNameLower)) {
    return { ...notionData.exactMap.get(sfOppNameLower)!, matchType: 'exact-opp' };
  }

  // 1b. Opportunity name contains Notion name or vice versa
  if (sfOppNameLower) {
    for (const entry of notionData.allEntries) {
      if (sfOppNameLower.includes(entry.nameLower) || entry.nameLower.includes(sfOppNameLower)) {
        return { status: entry.status, statusGroup: entry.statusGroup, notionName: entry.name, matchType: 'contains-opp' };
      }
    }
  }

  // PRIORITY 2: Fall back to ACCOUNT NAME matching

  // 2a. Exact match on account name
  if (notionData.exactMap.has(sfNameLower)) {
    return { ...notionData.exactMap.get(sfNameLower)!, matchType: 'exact' };
  }

  // 2b. Account name contains Notion name or vice versa
  for (const entry of notionData.allEntries) {
    if (sfNameLower.includes(entry.nameLower) || entry.nameLower.includes(sfNameLower)) {
      return { status: entry.status, statusGroup: entry.statusGroup, notionName: entry.name, matchType: 'contains' };
    }
  }

  // 4. Word overlap - at least 2 significant words match
  const sfWords = sfNameLower.split(/\s+/).filter(w => w.length > 2);
  const sfOppWords = sfOppNameLower.split(/[\s\-]+/).filter(w => w.length > 2);
  const allSfWords = [...new Set([...sfWords, ...sfOppWords])];

  for (const entry of notionData.allEntries) {
    const notionWords = entry.nameLower.split(/[\s\-]+/).filter(w => w.length > 2);
    const matchingWords = allSfWords.filter(w => notionWords.some(nw => nw.includes(w) || w.includes(nw)));
    if (matchingWords.length >= 2) {
      return { status: entry.status, statusGroup: entry.statusGroup, notionName: entry.name, matchType: 'word-overlap' };
    }
  }

  // 5. Single significant word match (for company names like "Badger Meter" -> "Badger Racine")
  // Only match on words that are likely company identifiers (4+ chars, not common words)
  const commonWords = ['water', 'city', 'county', 'district', 'public', 'utilities', 'company', 'corp', 'group', 'department', 'meter', 'services'];
  const significantSfWords = sfWords.filter(w => w.length >= 4 && !commonWords.includes(w));

  for (const entry of notionData.allEntries) {
    const notionWords = entry.nameLower.split(/[\s\-]+/).filter(w => w.length >= 4 && !commonWords.includes(w));
    for (const sfWord of significantSfWords) {
      for (const notionWord of notionWords) {
        if (sfWord === notionWord || sfWord.includes(notionWord) || notionWord.includes(sfWord)) {
          return { status: entry.status, statusGroup: entry.statusGroup, notionName: entry.name, matchType: 'single-word' };
        }
      }
    }
  }

  return null;
}

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
        message: 'Add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET to .env.local',
        configured: false,
      }, { status: 503 });
    }

    // Check if we have stored tokens
    const tokenPath = path.join(process.cwd(), '.salesforce-tokens.json');
    const hasTokens = fs.existsSync(tokenPath);

    if (!hasTokens) {
      return NextResponse.json({
        error: 'Salesforce not connected',
        message: 'Click "Connect Salesforce" to authenticate',
        authUrl: '/api/salesforce/auth',
        needsAuth: true,
        configured: true,
      }, { status: 401 });
    }

    // Fetch contracts from Salesforce AND statuses from Notion in parallel
    const [salesforceContracts, notionData] = await Promise.all([
      getContractOpportunities(),
      getNotionContractStatuses(),
    ]);

    // Merge: Use Salesforce data but status ONLY from Notion
    // PRIORITY 1: Match by Salesforce ID (exact 1:1 mapping)
    // PRIORITY 2: Fall back to fuzzy name matching for legacy records
    const contracts = salesforceContracts.map(contract => {
      // Determine if this is a renewal based on opportunity name
      const isRenewal = contract.opportunityName?.toLowerCase().includes('renewal') || false;

      // PRIORITY 1: Try exact match by Salesforce ID
      const sfIdMatch = notionData.bySalesforceId.get(contract.id);
      if (sfIdMatch) {
        return {
          ...contract,
          salesforceId: contract.id,
          status: sfIdMatch.status,
          statusGroup: sfIdMatch.statusGroup,
          notInNotion: false,
          notionName: sfIdMatch.notionName,
          notionPageId: sfIdMatch.notionPageId,
          matchType: 'salesforce-id',
          isRenewal,
        };
      }

      // PRIORITY 2: Fall back to fuzzy name matching (legacy records without SF ID)
      const match = fuzzyMatchNotion(contract.name, contract.opportunityName, notionData);
      if (match) {
        return {
          ...contract,
          salesforceId: contract.id,
          status: match.status,
          statusGroup: match.statusGroup,
          notInNotion: false,
          notionName: match.notionName,
          matchType: match.matchType,
          isRenewal,
        };
      }

      // If not in Notion, flag it and use default status
      return {
        ...contract,
        salesforceId: contract.id,
        status: 'Discussions Not Started',
        statusGroup: statusColors['Discussions Not Started'] || 'gray',
        notInNotion: true,
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
