import { NextRequest, NextResponse } from 'next/server';

const NOTION_TOKEN = process.env.NOTION_API_KEY || '';
const DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc';

interface SearchResult {
  id: string;
  name: string;
  status: string;
  value: number;
  redlines: string;
  lastRedlineDate: string | null;
  matchSnippet: string;
}

/**
 * Search contracts by name, status, or redlines content
 * GET /api/contracts/search?q=indemnification
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || '';
    const searchType = searchParams.get('type') || 'all'; // 'all', 'name', 'redlines'

    if (!query) {
      return NextResponse.json({
        results: [],
        query: '',
        message: 'No search query provided',
      });
    }

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
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Notion API error:', error);
      return NextResponse.json({ error: 'Failed to search contracts' }, { status: 500 });
    }

    const data = await response.json();

    // Filter and transform results
    const results: SearchResult[] = [];

    for (const page of data.results) {
      const props = page.properties;

      const name = props.Name?.title?.[0]?.plain_text || 'Unnamed';
      const status = props['Contract Status']?.status?.name || 'Unknown';
      const value = props['Contract Value']?.number || 0;
      const redlines = props['Redlines']?.rich_text?.[0]?.plain_text || '';
      const lastRedlineDate = props['Last Redline Date']?.date?.start || null;

      // Check if this contract matches the search
      let matches = false;
      let matchSnippet = '';

      const nameLower = name.toLowerCase();
      const statusLower = status.toLowerCase();
      const redlinesLower = redlines.toLowerCase();

      if (searchType === 'all' || searchType === 'name') {
        if (nameLower.includes(query)) {
          matches = true;
          matchSnippet = `Name: ${name}`;
        }
      }

      if (searchType === 'all' || searchType === 'redlines') {
        if (redlinesLower.includes(query)) {
          matches = true;
          // Find and extract a snippet around the match
          const matchIndex = redlinesLower.indexOf(query);
          const start = Math.max(0, matchIndex - 40);
          const end = Math.min(redlines.length, matchIndex + query.length + 40);
          matchSnippet = (start > 0 ? '...' : '') +
            redlines.slice(start, end) +
            (end < redlines.length ? '...' : '');
        }
      }

      if (searchType === 'all' && statusLower.includes(query)) {
        matches = true;
        matchSnippet = matchSnippet || `Status: ${status}`;
      }

      if (matches) {
        results.push({
          id: page.id,
          name,
          status,
          value,
          redlines,
          lastRedlineDate,
          matchSnippet,
        });
      }
    }

    // Sort by last redline date (most recent first), then by name
    results.sort((a, b) => {
      if (a.lastRedlineDate && b.lastRedlineDate) {
        return new Date(b.lastRedlineDate).getTime() - new Date(a.lastRedlineDate).getTime();
      }
      if (a.lastRedlineDate) return -1;
      if (b.lastRedlineDate) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      results,
      query,
      totalFound: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
