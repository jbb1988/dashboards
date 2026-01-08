import { NextRequest, NextResponse } from 'next/server';

const NOTION_TOKEN = process.env.NOTION_API_KEY!;
const DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc';

/**
 * Search Notion database for contracts by name
 * Uses word-based matching for better fuzzy search
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  try {
    // Extract significant words (3+ chars) from query for better matching
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3);

    // Build OR filter for each word to find partial matches
    let filter: any = {
      property: 'Archive',
      checkbox: { equals: false }
    };

    if (words.length > 0) {
      // Search for ANY word matching (OR logic)
      const wordFilters = words.map(word => ({
        property: 'Name',
        title: { contains: word }
      }));

      filter = {
        and: [
          { property: 'Archive', checkbox: { equals: false } },
          wordFilters.length === 1
            ? wordFilters[0]
            : { or: wordFilters }
        ]
      };
    }

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
          page_size: 30,
          filter,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Notion search error:', error);
      return NextResponse.json({ error: 'Failed to search Notion' }, { status: 500 });
    }

    const data = await response.json();

    // Transform and rank results by relevance
    const results = data.results.map((page: any) => {
      const props = page.properties;
      const name = props.Name?.title?.[0]?.plain_text || '';
      const nameLower = name.toLowerCase();

      // Calculate relevance score
      let score = 0;
      words.forEach(word => {
        if (nameLower.includes(word)) score += 10;
        if (nameLower.startsWith(word)) score += 5;
      });
      if (nameLower === query.toLowerCase()) score += 100; // Exact match bonus

      return {
        id: page.id,
        name,
        status: props['Contract Status']?.status?.name || 'Discussions Not Started',
        value: props['Contract Value']?.number || 0,
        url: page.url,
        score,
      };
    });

    // Sort by relevance score
    results.sort((a: any, b: any) => b.score - a.score);

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Error searching Notion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Add a new contract to Notion database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, value, status, contractDate, awardDate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Contract name is required' }, { status: 400 });
    }

    // Build properties for new page
    const properties: Record<string, any> = {
      Name: {
        title: [{ text: { content: name } }]
      },
    };

    if (value !== undefined) {
      properties['Contract Value'] = { number: parseFloat(value) || 0 };
    }

    if (status) {
      properties['Contract Status'] = { status: { name: status } };
    }

    if (contractDate) {
      properties['Contract Date'] = { date: { start: contractDate } };
    }

    if (awardDate) {
      properties['Award Date'] = { date: { start: awardDate } };
    }

    if (body.salesStage) {
      properties['Sales Stage'] = { select: { name: body.salesStage } };
    }

    // Create new page in Notion
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
      const error = await response.json();
      console.error('Notion create error:', error);
      return NextResponse.json({ error: 'Failed to create in Notion' }, { status: 500 });
    }

    const newPage = await response.json();

    return NextResponse.json({
      success: true,
      pageId: newPage.id,
      url: newPage.url,
    });

  } catch (error) {
    console.error('Error creating in Notion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
