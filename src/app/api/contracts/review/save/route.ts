import { NextRequest, NextResponse } from 'next/server';

const NOTION_API_KEY = process.env.NOTION_API_KEY || '';

interface NotionPage {
  id: string;
  properties: {
    Name?: { title: Array<{ plain_text: string }> };
    [key: string]: unknown;
  };
}

/**
 * Save redlines to a contract in Notion
 * - Updates the contract page with a "Redlines" property (searchable)
 * - Creates a child page with the full review details
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, provisionName, originalText, redlinedText, summary } = body;

    if (!contractId || !provisionName || !redlinedText) {
      return NextResponse.json(
        { error: 'Missing required fields: contractId, provisionName, redlinedText' },
        { status: 400 }
      );
    }

    if (!NOTION_API_KEY) {
      return NextResponse.json(
        { error: 'Notion API key not configured' },
        { status: 500 }
      );
    }

    // First, get the contract page to find its name, type, and existing redlines
    let contractName = 'Unknown Contract';
    let contractType = '';
    let existingRedlines = '';
    try {
      const contractResponse = await fetch(`https://api.notion.com/v1/pages/${contractId}`, {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        },
      });

      if (contractResponse.ok) {
        const contractPage: NotionPage = await contractResponse.json();
        contractName = contractPage.properties?.Name?.title?.[0]?.plain_text || 'Unknown Contract';
        // Get contract type (multi-select)
        const typeProperty = contractPage.properties?.['Contract Type'] as any;
        if (typeProperty?.multi_select?.length > 0) {
          contractType = typeProperty.multi_select.map((t: any) => t.name).join(', ');
        }
        // Get existing redlines if any
        const redlinesProperty = contractPage.properties?.['Redlines'] as any;
        if (redlinesProperty?.rich_text?.length > 0) {
          existingRedlines = redlinesProperty.rich_text.map((t: any) => t.plain_text).join('') + '\n\n---\n\n';
        }
      }
    } catch (fetchError) {
      console.error('Failed to fetch contract:', fetchError);
    }

    // Format the redlines summary for the searchable property
    const timestamp = new Date().toISOString().split('T')[0];
    const summaryText = Array.isArray(summary) ? summary.join(' | ') : summary;
    const newRedlineEntry = `[${timestamp}] ${provisionName}: ${summaryText}`;

    // Update the contract page with the redlines summary (searchable)
    // Rich text has a 2000 character limit per block, so we truncate
    const combinedRedlines = (existingRedlines + newRedlineEntry).slice(-2000);

    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${contractId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          'Redlines': {
            rich_text: [{
              type: 'text',
              text: { content: combinedRedlines }
            }]
          },
          'Last Redline Date': {
            date: { start: timestamp }
          }
        }
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Failed to update contract with redlines:', errorText);
      // Continue anyway - we'll still create the child page
    }

    // Create a detailed child page with the full review
    const reviewContent = {
      parent: {
        page_id: contractId,
      },
      properties: {
        title: {
          title: [
            {
              text: {
                // Use contract name and type instead of provision name
                content: `Review: ${contractName}${contractType ? ` (${contractType})` : ''} - ${timestamp}`,
              },
            },
          ],
        },
      },
      children: [
        {
          object: 'block' as const,
          type: 'heading_2' as const,
          heading_2: {
            rich_text: [{ type: 'text' as const, text: { content: 'Summary of Changes' } }],
          },
        },
        ...(Array.isArray(summary) ? summary.map(item => ({
          object: 'block' as const,
          type: 'bulleted_list_item' as const,
          bulleted_list_item: {
            rich_text: [{ type: 'text' as const, text: { content: item } }],
          },
        })) : [{
          object: 'block' as const,
          type: 'paragraph' as const,
          paragraph: {
            rich_text: [{ type: 'text' as const, text: { content: summary || '' } }],
          },
        }]),
        {
          object: 'block' as const,
          type: 'divider' as const,
          divider: {},
        },
        {
          object: 'block' as const,
          type: 'heading_2' as const,
          heading_2: {
            rich_text: [{ type: 'text' as const, text: { content: 'Redlined Text' } }],
          },
        },
        // Parse redlined text and convert to Notion rich text with formatting
        // Deleted text: red strikethrough, Inserted text: green underline
        ...splitRichTextIntoBlocks(parseRedlinedTextToNotionRichText(redlinedText)).map(richTextBlock => ({
          object: 'block' as const,
          type: 'paragraph' as const,
          paragraph: {
            rich_text: richTextBlock,
          },
        })),
        {
          object: 'block' as const,
          type: 'divider' as const,
          divider: {},
        },
        {
          object: 'block' as const,
          type: 'heading_2' as const,
          heading_2: {
            rich_text: [{ type: 'text' as const, text: { content: 'Original Text' } }],
          },
        },
        ...splitIntoChunks(originalText || '', 2000).map(chunk => ({
          object: 'block' as const,
          type: 'paragraph' as const,
          paragraph: {
            rich_text: [{ type: 'text' as const, text: { content: chunk } }],
          },
        })),
      ],
    };

    const createResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewContent),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      console.error('Notion create error:', errorData);
      return NextResponse.json(
        { error: 'Failed to save review to Notion' },
        { status: 500 }
      );
    }

    const createdPage = await createResponse.json();

    return NextResponse.json({
      success: true,
      reviewId: createdPage.id,
      contractName,
      provisionName,
      message: 'Review saved successfully',
    });
  } catch (error) {
    console.error('Save review error:', error);
    return NextResponse.json(
      { error: 'Failed to save review' },
      { status: 500 }
    );
  }
}

/**
 * Split text into chunks of specified size
 */
function splitIntoChunks(text: string, chunkSize: number): string[] {
  if (!text) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks.length > 0 ? chunks : [''];
}

/**
 * Convert redlined text with [strikethrough] and [underline] markers
 * to Notion rich_text format with proper formatting
 */
interface NotionRichText {
  type: 'text';
  text: { content: string };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    color?: string;
  };
}

function parseRedlinedTextToNotionRichText(text: string): NotionRichText[] {
  const richText: NotionRichText[] = [];

  // Regex to match [strikethrough]...[/strikethrough] and [underline]...[/underline]
  const regex = /\[strikethrough\]([\s\S]*?)\[\/strikethrough\]|\[underline\]([\s\S]*?)\[\/underline\]/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const plainText = text.slice(lastIndex, match.index);
      if (plainText) {
        richText.push({
          type: 'text',
          text: { content: plainText },
        });
      }
    }

    // Check which type of match we have
    if (match[1] !== undefined) {
      // Strikethrough (deleted text) - red with strikethrough
      richText.push({
        type: 'text',
        text: { content: match[1] },
        annotations: {
          strikethrough: true,
          color: 'red',
        },
      });
    } else if (match[2] !== undefined) {
      // Underline (inserted text) - green with underline
      richText.push({
        type: 'text',
        text: { content: match[2] },
        annotations: {
          underline: true,
          color: 'green',
        },
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining plain text after last match
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      richText.push({
        type: 'text',
        text: { content: remainingText },
      });
    }
  }

  // If no matches found, return the original text as plain
  if (richText.length === 0 && text) {
    richText.push({
      type: 'text',
      text: { content: text },
    });
  }

  return richText;
}

/**
 * Split rich text array into chunks that respect Notion's limits
 * Each rich_text array can have max 100 items, each text max 2000 chars
 */
function splitRichTextIntoBlocks(richText: NotionRichText[]): NotionRichText[][] {
  const blocks: NotionRichText[][] = [];
  let currentBlock: NotionRichText[] = [];
  let currentBlockLength = 0;

  for (const item of richText) {
    const content = item.text.content;

    // If this single item is too long, split it
    if (content.length > 2000) {
      // First, push current block if not empty
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
        currentBlockLength = 0;
      }

      // Split the long content
      for (let i = 0; i < content.length; i += 2000) {
        const chunk = content.slice(i, i + 2000);
        blocks.push([{
          ...item,
          text: { content: chunk },
        }]);
      }
    } else {
      // Check if adding this would exceed block limits
      if (currentBlock.length >= 100 || currentBlockLength + content.length > 2000) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
        }
        currentBlock = [];
        currentBlockLength = 0;
      }

      currentBlock.push(item);
      currentBlockLength += content.length;
    }
  }

  // Don't forget the last block
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks.length > 0 ? blocks : [[{ type: 'text', text: { content: '' } }]];
}
