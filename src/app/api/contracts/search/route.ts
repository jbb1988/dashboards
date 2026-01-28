import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Enhanced Global Search API
 * Searches across contracts, documents, tasks, NetSuite orders, and Asana tasks
 *
 * GET /api/contracts/search
 * Query Parameters:
 *   q - Search query (required, min 2 chars)
 *   scope - all | contracts | documents | tasks | netsuite | asana (default: all)
 *   includeArchived - Include archived/closed contracts (default: false)
 *   includeHistorical - Include pre-2025 contracts (default: false)
 *   status - Filter by status (optional)
 *   page - Page number (default: 1)
 *   limit - Results per page (default: 20, max: 100)
 */

// Result types
interface BaseSearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  url?: string;
  matchedField?: string;
  matchedText?: string;
  relevanceScore?: number;
  isArchived?: boolean;
}

interface ContractResult extends BaseSearchResult {
  type: 'contract';
  value?: number;
  status?: string;
  salesRep?: string;
  closeDate?: string;
}

interface DocumentResult extends BaseSearchResult {
  type: 'document';
  documentType?: string;
  status?: string;
  uploadedAt?: string;
  fileSize?: number;
}

interface TaskResult extends BaseSearchResult {
  type: 'task';
  status?: string;
  dueDate?: string;
  assignee?: string;
}

interface WorkOrderResult extends BaseSearchResult {
  type: 'work_order';
  status?: string;
  customerName?: string;
  woDate?: string;
  soNumber?: string;
}

interface SalesOrderResult extends BaseSearchResult {
  type: 'sales_order';
  status?: string;
  customerName?: string;
  soDate?: string;
  totalAmount?: number;
}

interface AsanaTaskResult extends BaseSearchResult {
  type: 'asana_task';
  completed?: boolean;
  dueOn?: string;
  assignee?: string;
  projectName?: string;
}

type SearchResult = ContractResult | DocumentResult | TaskResult | WorkOrderResult | SalesOrderResult | AsanaTaskResult;

interface SearchResponse {
  query: string;
  scope: string;
  results: {
    contracts: ContractResult[];
    documents: DocumentResult[];
    tasks: TaskResult[];
    workOrders: WorkOrderResult[];
    salesOrders: SalesOrderResult[];
    asanaTasks: AsanaTaskResult[];
  };
  totals: {
    contracts: number;
    documents: number;
    tasks: number;
    workOrders: number;
    salesOrders: number;
    asanaTasks: number;
    total: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Relevance scoring function (simplified - database version is more accurate)
function calculateRelevance(
  item: Record<string, unknown>,
  query: string,
  primaryField: string,
  secondaryFields: string[],
  valueField?: string
): number {
  const q = query.toLowerCase();
  let score = 0;

  // Primary field scoring
  const primary = String(item[primaryField] || '').toLowerCase();
  if (primary === q) {
    score += 100; // Exact match
  } else if (primary.startsWith(q)) {
    score += 75; // Starts with
  } else if (primary.includes(q)) {
    score += 50; // Contains
  }

  // Secondary fields scoring
  for (const field of secondaryFields) {
    const val = String(item[field] || '').toLowerCase();
    if (val.includes(q)) {
      score += 30;
      break; // Only count once
    }
  }

  // Value weight
  if (valueField && item[valueField]) {
    const value = Number(item[valueField]);
    if (value > 0) {
      score += Math.min(20, Math.floor(Math.log10(value)));
    }
  }

  return score;
}

// Get matched field and text highlight
function getMatchInfo(
  item: Record<string, unknown>,
  query: string,
  fieldMap: Record<string, string>
): { field: string; text?: string } {
  const q = query.toLowerCase();

  for (const [dbField, displayName] of Object.entries(fieldMap)) {
    const value = String(item[dbField] || '');
    if (value.toLowerCase().includes(q)) {
      // Find the match position and extract context
      const lowerValue = value.toLowerCase();
      const matchIndex = lowerValue.indexOf(q);
      const start = Math.max(0, matchIndex - 20);
      const end = Math.min(value.length, matchIndex + query.length + 20);
      let matchedText = value.substring(start, end);

      // Add ellipsis if truncated
      if (start > 0) matchedText = '...' + matchedText;
      if (end < value.length) matchedText = matchedText + '...';

      return { field: displayName, text: matchedText };
    }
  }

  return { field: 'unknown' };
}

// Check for fuzzy match using trigram similarity (done in SQL, this is fallback)
function fuzzyMatch(value: string, query: string): boolean {
  if (!value || !query) return false;
  const v = value.toLowerCase();
  const q = query.toLowerCase();

  // Direct contains
  if (v.includes(q)) return true;

  // Simple Levenshtein distance check for short queries
  if (q.length <= 5) {
    return levenshteinDistance(v.substring(0, q.length + 2), q) <= 1;
  }

  return false;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const scope = searchParams.get('scope') || 'all';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const includeHistorical = searchParams.get('includeHistorical') === 'true';
    const statusFilter = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    if (!query || query.length < 2) {
      return NextResponse.json({
        error: 'Query must be at least 2 characters',
        results: {
          contracts: [],
          documents: [],
          tasks: [],
          workOrders: [],
          salesOrders: [],
          asanaTasks: [],
        },
        totals: {
          contracts: 0,
          documents: 0,
          tasks: 0,
          workOrders: 0,
          salesOrders: 0,
          asanaTasks: 0,
          total: 0,
        },
        pagination: { page: 1, limit, totalPages: 0, hasMore: false },
      });
    }

    const admin = getSupabaseAdmin();
    const searchTerm = `%${query.toLowerCase()}%`;

    // Prepare results object
    const results: SearchResponse['results'] = {
      contracts: [],
      documents: [],
      tasks: [],
      workOrders: [],
      salesOrders: [],
      asanaTasks: [],
    };

    const totals = {
      contracts: 0,
      documents: 0,
      tasks: 0,
      workOrders: 0,
      salesOrders: 0,
      asanaTasks: 0,
      total: 0,
    };

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // =============================================================================
    // SEARCH CONTRACTS
    // =============================================================================
    if (scope === 'all' || scope === 'contracts') {
      let contractQuery = admin
        .from('contracts')
        .select('*', { count: 'exact' })
        .or(`name.ilike.${searchTerm},account_name.ilike.${searchTerm},opportunity_name.ilike.${searchTerm},sales_rep.ilike.${searchTerm}`);

      // Apply filters
      if (!includeArchived) {
        contractQuery = contractQuery.eq('is_closed', false);
      }
      if (!includeHistorical) {
        contractQuery = contractQuery.gte('close_date', '2025-01-01');
      }
      if (statusFilter) {
        contractQuery = contractQuery.eq('status', statusFilter);
      }

      const { data: contracts, error, count } = await contractQuery
        .order('value', { ascending: false })
        .range(offset, offset + limit - 1);

      if (!error && contracts) {
        totals.contracts = count || contracts.length;

        results.contracts = contracts.map(c => {
          const matchInfo = getMatchInfo(c, query, {
            account_name: 'account',
            name: 'name',
            opportunity_name: 'opportunity',
            sales_rep: 'salesRep',
          });

          return {
            id: c.id,
            type: 'contract' as const,
            title: c.account_name || c.name,
            subtitle: c.opportunity_name,
            value: c.value,
            status: c.status,
            salesRep: c.sales_rep,
            closeDate: c.close_date,
            url: `/contracts-dashboard?contract=${c.id}`,
            matchedField: matchInfo.field,
            matchedText: matchInfo.text,
            relevanceScore: calculateRelevance(c, query, 'account_name', ['name', 'opportunity_name', 'sales_rep'], 'value'),
            isArchived: c.is_closed,
          };
        });

        // Sort by relevance
        results.contracts.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      }
    }

    // =============================================================================
    // SEARCH DOCUMENTS
    // =============================================================================
    if (scope === 'all' || scope === 'documents') {
      // Search in file_name, account_name, opportunity_name, notes, and extracted_text
      const { data: documents, error, count } = await admin
        .from('documents')
        .select('*', { count: 'exact' })
        .or(`file_name.ilike.${searchTerm},account_name.ilike.${searchTerm},opportunity_name.ilike.${searchTerm},notes.ilike.${searchTerm},extracted_text.ilike.${searchTerm}`)
        .order('uploaded_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (!error && documents) {
        totals.documents = count || documents.length;

        results.documents = documents.map(d => {
          const matchInfo = getMatchInfo(d, query, {
            file_name: 'fileName',
            account_name: 'account',
            opportunity_name: 'opportunity',
            notes: 'notes',
            extracted_text: 'content',
          });

          return {
            id: d.id,
            type: 'document' as const,
            title: d.file_name,
            subtitle: `${d.account_name || 'Unknown'} - ${d.document_type || 'Document'}`,
            documentType: d.document_type,
            status: d.status,
            uploadedAt: d.uploaded_at,
            fileSize: d.file_size,
            url: d.file_url,
            matchedField: matchInfo.field,
            matchedText: matchInfo.text,
            relevanceScore: calculateRelevance(d, query, 'file_name', ['account_name', 'notes', 'extracted_text']),
          };
        });
      }
    }

    // =============================================================================
    // SEARCH TASKS
    // =============================================================================
    if (scope === 'all' || scope === 'tasks') {
      try {
        const { data: tasks, error, count } = await admin
          .from('tasks')
          .select('*', { count: 'exact' })
          .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .range(offset, offset + limit - 1);

        if (!error && tasks) {
          totals.tasks = count || tasks.length;

          results.tasks = tasks.map(t => {
            const matchInfo = getMatchInfo(t, query, {
              title: 'title',
              description: 'description',
            });

            return {
              id: t.id,
              type: 'task' as const,
              title: t.title,
              subtitle: t.description,
              status: t.status,
              dueDate: t.due_date,
              assignee: t.assignee,
              url: `/contracts-dashboard?tab=tasks&task=${t.id}`,
              matchedField: matchInfo.field,
              matchedText: matchInfo.text,
              relevanceScore: calculateRelevance(t, query, 'title', ['description']),
            };
          });
        }
      } catch {
        // Tasks table might not exist
      }
    }

    // =============================================================================
    // SEARCH NETSUITE WORK ORDERS
    // =============================================================================
    if (scope === 'all' || scope === 'netsuite') {
      // Search wo_number, tranid, and other fields
      const { data: workOrders, error, count } = await admin
        .from('netsuite_work_orders')
        .select('*', { count: 'exact' })
        .or(`wo_number.ilike.${searchTerm},tranid.ilike.${searchTerm},memo.ilike.${searchTerm},customer_name.ilike.${searchTerm},created_from_so_number.ilike.${searchTerm}`)
        .order('wo_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[SEARCH] Error searching work orders:', error);
      }

      if (!error && workOrders) {
        totals.workOrders = count || workOrders.length;

        results.workOrders = workOrders.map(wo => {
          const matchInfo = getMatchInfo(wo, query, {
            wo_number: 'woNumber',
            memo: 'memo',
            customer_name: 'customer',
            created_from_so_number: 'soNumber',
          });

          return {
            id: wo.id,
            type: 'work_order' as const,
            title: wo.wo_number,
            subtitle: `${wo.customer_name || 'Unknown Customer'}${wo.memo ? ' - ' + wo.memo.substring(0, 50) : ''}`,
            status: wo.status,
            customerName: wo.customer_name,
            woDate: wo.wo_date,
            soNumber: wo.created_from_so_number,
            url: `/closeout-dashboard?wo=${wo.wo_number}`,
            matchedField: matchInfo.field,
            matchedText: matchInfo.text,
            relevanceScore: calculateRelevance(wo, query, 'wo_number', ['customer_name', 'memo']),
          };
        });
      }
    }

    // =============================================================================
    // SEARCH NETSUITE SALES ORDERS
    // =============================================================================
    if (scope === 'all' || scope === 'netsuite') {
      // Search both so_number and tranid fields (some records use tranid for the SO number)
      const { data: salesOrders, error, count } = await admin
        .from('netsuite_sales_orders')
        .select('*', { count: 'exact' })
        .or(`so_number.ilike.${searchTerm},tranid.ilike.${searchTerm},memo.ilike.${searchTerm},customer_name.ilike.${searchTerm},sales_rep_name.ilike.${searchTerm}`)
        .order('so_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[SEARCH] Error searching sales orders:', error);
      }

      if (!error && salesOrders) {
        totals.salesOrders = count || salesOrders.length;

        results.salesOrders = salesOrders.map(so => {
          // Use tranid if so_number is missing
          const displayNumber = so.so_number || so.tranid || 'Unknown';

          const matchInfo = getMatchInfo(so, query, {
            so_number: 'soNumber',
            tranid: 'tranId',
            memo: 'memo',
            customer_name: 'customer',
            sales_rep_name: 'salesRep',
          });

          return {
            id: so.id,
            type: 'sales_order' as const,
            title: displayNumber,
            subtitle: so.customer_name || 'Unknown Customer',
            status: so.status,
            customerName: so.customer_name,
            soDate: so.so_date,
            totalAmount: so.total_amount,
            url: `/project-profitability?so=${displayNumber}`,
            matchedField: matchInfo.field,
            matchedText: matchInfo.text,
            relevanceScore: calculateRelevance(so, query, 'so_number', ['tranid', 'customer_name', 'memo'], 'total_amount'),
          };
        });
      }
    }

    // =============================================================================
    // SEARCH ASANA TASKS (from cache)
    // =============================================================================
    if (scope === 'all' || scope === 'asana') {
      try {
        const { data: asanaTasks, error, count } = await admin
          .from('asana_tasks_cache')
          .select('*', { count: 'exact' })
          .or(`name.ilike.${searchTerm},notes.ilike.${searchTerm},project_name.ilike.${searchTerm},assignee_name.ilike.${searchTerm}`)
          .order('modified_at_asana', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && asanaTasks) {
          totals.asanaTasks = count || asanaTasks.length;

          results.asanaTasks = asanaTasks.map(task => {
            const matchInfo = getMatchInfo(task, query, {
              name: 'name',
              notes: 'notes',
              project_name: 'project',
              assignee_name: 'assignee',
            });

            return {
              id: task.asana_gid,
              type: 'asana_task' as const,
              title: task.name,
              subtitle: task.project_name || 'Asana Task',
              completed: task.completed,
              dueOn: task.due_on,
              assignee: task.assignee_name,
              projectName: task.project_name,
              url: `https://app.asana.com/0/0/${task.asana_gid}`,
              matchedField: matchInfo.field,
              matchedText: matchInfo.text,
              relevanceScore: calculateRelevance(task, query, 'name', ['notes', 'project_name']),
            };
          });
        }
      } catch {
        // Asana cache table might not exist yet
      }
    }

    // Calculate total and pagination
    totals.total = totals.contracts + totals.documents + totals.tasks +
      totals.workOrders + totals.salesOrders + totals.asanaTasks;

    const maxTotal = Math.max(
      totals.contracts, totals.documents, totals.tasks,
      totals.workOrders, totals.salesOrders, totals.asanaTasks
    );
    const totalPages = Math.ceil(maxTotal / limit);

    return NextResponse.json({
      query,
      scope,
      results,
      totals,
      pagination: {
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    } as SearchResponse);

  } catch (error) {
    console.error('Error in global search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
