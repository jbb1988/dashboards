import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = 'openai/gpt-4o-mini';

interface HelpChatRequest {
  message: string;
  guideContext: string;
}

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  value?: number;
  status?: string;
}

// Search real data based on user query
async function searchRealData(query: string): Promise<{
  contracts: SearchResult[];
  documents: SearchResult[];
  tasks: SearchResult[];
}> {
  const supabase = getSupabaseAdmin();
  const results = { contracts: [], documents: [], tasks: [] } as {
    contracts: SearchResult[];
    documents: SearchResult[];
    tasks: SearchResult[];
  };

  try {
    const searchTerm = `%${query.toLowerCase()}%`;

    // Search contracts
    const { data: contracts } = await supabase
      .from('salesforce_contracts')
      .select('id, salesforce_id, name, status, amount, close_date, account_name')
      .or(`name.ilike.${searchTerm},account_name.ilike.${searchTerm}`)
      .limit(5);

    if (contracts) {
      results.contracts = contracts.map(c => ({
        id: c.id,
        type: 'contract',
        title: c.name,
        subtitle: c.account_name,
        value: c.amount,
        status: c.status,
      }));
    }

    // Search documents
    const { data: documents } = await supabase
      .from('contract_documents')
      .select('id, file_name, document_type, contract_id, uploaded_at')
      .ilike('file_name', searchTerm)
      .limit(5);

    if (documents) {
      results.documents = documents.map(d => ({
        id: d.id,
        type: 'document',
        title: d.file_name,
        subtitle: d.document_type,
      }));
    }

    // Search tasks
    const { data: tasks } = await supabase
      .from('contract_tasks')
      .select('id, title, status, due_date, priority')
      .ilike('title', searchTerm)
      .limit(5);

    if (tasks) {
      results.tasks = tasks.map(t => ({
        id: t.id,
        type: 'task',
        title: t.title,
        status: t.status,
      }));
    }
  } catch (error) {
    console.error('[Help Chat] Search error:', error);
  }

  return results;
}

// Format search results for AI context
function formatSearchResults(results: { contracts: SearchResult[]; documents: SearchResult[]; tasks: SearchResult[] }): string {
  const lines: string[] = [];

  if (results.contracts.length > 0) {
    lines.push('MATCHING CONTRACTS:');
    results.contracts.forEach(c => {
      lines.push(`- ${c.title} (${c.subtitle || 'No account'}) - Status: ${c.status}, Value: $${c.value?.toLocaleString() || 'N/A'}`);
    });
    lines.push('');
  }

  if (results.documents.length > 0) {
    lines.push('MATCHING DOCUMENTS:');
    results.documents.forEach(d => {
      lines.push(`- ${d.title} (Type: ${d.subtitle || 'Unknown'})`);
    });
    lines.push('');
  }

  if (results.tasks.length > 0) {
    lines.push('MATCHING TASKS:');
    results.tasks.forEach(t => {
      lines.push(`- ${t.title} - Status: ${t.status}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// Extract potential search terms from the message
function extractSearchTerms(message: string): string[] {
  // Common words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'where', 'when', 'how',
    'who', 'which', 'why', 'can', 'could', 'would', 'should', 'do', 'does', 'did',
    'have', 'has', 'had', 'be', 'been', 'being', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'they', 'them',
    'find', 'show', 'get', 'tell', 'about', 'for', 'with', 'from', 'any', 'all',
    'contract', 'contracts', 'document', 'documents', 'task', 'tasks', 'file', 'files'
  ]);

  // Extract words that might be search terms (proper nouns, specific terms)
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Also look for quoted strings
  const quotedMatches = message.match(/"([^"]+)"/g);
  if (quotedMatches) {
    quotedMatches.forEach(match => {
      words.push(match.replace(/"/g, ''));
    });
  }

  return [...new Set(words)]; // Remove duplicates
}

export async function POST(request: NextRequest) {
  try {
    const { message, guideContext }: HelpChatRequest = await request.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({
        response: "I'm currently unable to process your question. Please try searching the guides above, or contact support@marswater.com for assistance."
      });
    }

    // Check if the message seems to be asking about specific data
    const lowerMessage = message.toLowerCase();
    const isDataQuery =
      lowerMessage.includes('find') ||
      lowerMessage.includes('search') ||
      lowerMessage.includes('show me') ||
      lowerMessage.includes('what contracts') ||
      lowerMessage.includes('which contracts') ||
      lowerMessage.includes('list') ||
      lowerMessage.includes('status of') ||
      lowerMessage.includes('where is') ||
      message.match(/"[^"]+"/) !== null; // Has quoted terms

    let dataContext = '';

    if (isDataQuery) {
      // Extract search terms and search real data
      const searchTerms = extractSearchTerms(message);

      if (searchTerms.length > 0) {
        // Search for each term and combine results
        const allResults = { contracts: [] as SearchResult[], documents: [] as SearchResult[], tasks: [] as SearchResult[] };

        for (const term of searchTerms.slice(0, 3)) { // Limit to 3 terms
          const results = await searchRealData(term);
          allResults.contracts.push(...results.contracts);
          allResults.documents.push(...results.documents);
          allResults.tasks.push(...results.tasks);
        }

        // Deduplicate
        const seen = new Set();
        allResults.contracts = allResults.contracts.filter(c => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        }).slice(0, 5);

        allResults.documents = allResults.documents.filter(d => {
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        }).slice(0, 5);

        allResults.tasks = allResults.tasks.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        }).slice(0, 5);

        dataContext = formatSearchResults(allResults);
      }
    }

    const systemPrompt = `You are MARS Help Assistant, an AI helper for the MARS contract management platform.

You can help with two types of questions:
1. HOW-TO questions about using MARS (use the GUIDE CONTENT below)
2. FINDING specific contracts, documents, or tasks (use the REAL DATA below)

IMPORTANT RULES:
- Keep responses concise - under 200 words
- For how-to questions, cite which guide section your answer comes from
- For data queries, list the matching items you found
- If you found real data matches, present them clearly with their key details
- If no data matches were found, say "I couldn't find any matching items. Try using the Search feature for more comprehensive results."
- Be friendly and helpful
- Format responses with short paragraphs or bullet points

GUIDE CONTENT (for how-to questions):
${guideContext || 'No guide content available for this page.'}

REAL DATA FOUND (for data queries):
${dataContext || 'No specific data search was performed for this question.'}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Help Chat] OpenRouter API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get AI response' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'Empty response from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: aiResponse
    });

  } catch (error) {
    console.error('[Help Chat] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
