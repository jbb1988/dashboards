/**
 * Supabase Client Configuration
 * Provides client and server-side Supabase access
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Environment variables (NEXT_PUBLIC_ vars are available on client)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses SSR-compatible browser client for proper cookie handling)
export const supabase = typeof window !== 'undefined'
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (lazy-loaded, only works on server)
let _supabaseAdmin: SupabaseClient | null = null;
export const getSupabaseAdmin = () => {
  if (!_supabaseAdmin) {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not available (client-side?)');
    }
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabaseAdmin;
};

// Legacy export for compatibility (will error on client-side if used)
export const supabaseAdmin = typeof window === 'undefined'
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  : null as unknown as SupabaseClient;

// Types for our database tables
export interface OAuthToken {
  id?: string;
  provider: 'docusign' | 'salesforce';
  access_token: string;
  refresh_token?: string;
  instance_url?: string; // For Salesforce
  expires_at: string;
  updated_at?: string;
}

export interface UserRole {
  user_id: string;
  role: 'admin' | 'sales' | 'finance' | 'pm' | 'legal' | 'viewer';
  created_at?: string;
}

// Dashboard access by role
export const DASHBOARD_ACCESS: Record<string, string[]> = {
  admin: ['contracts-dashboard', 'mcc-dashboard', 'closeout-dashboard', 'pm-dashboard', 'contracts/review'],
  sales: ['contracts-dashboard'],
  finance: ['mcc-dashboard', 'closeout-dashboard'],
  pm: ['closeout-dashboard', 'pm-dashboard'],
  legal: ['contracts/review'],
  viewer: [],
};

/**
 * Get OAuth token from database
 */
export async function getOAuthToken(provider: 'docusign' | 'salesforce'): Promise<OAuthToken | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('oauth_tokens')
    .select('*')
    .eq('provider', provider)
    .single();

  if (error || !data) {
    console.log(`No ${provider} token found in database`);
    return null;
  }

  return data as OAuthToken;
}

/**
 * Save OAuth token to database
 */
export async function saveOAuthToken(token: OAuthToken): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('oauth_tokens')
    .upsert(
      {
        provider: token.provider,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        instance_url: token.instance_url,
        expires_at: token.expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' }
    );

  if (error) {
    console.error('Error saving OAuth token:', error);
    return false;
  }

  return true;
}

/**
 * Get user role from database
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role;
}

/**
 * Check if user can access a dashboard
 */
export function canAccessDashboard(role: string, dashboardPath: string): boolean {
  const allowedDashboards = DASHBOARD_ACCESS[role] || [];
  return allowedDashboards.some(d => dashboardPath.includes(d));
}

/**
 * Get Excel file from Supabase Storage
 */
export async function getExcelFromStorage(filename: string): Promise<Buffer | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .storage
    .from('data-files')
    .download(filename);

  if (error || !data) {
    console.error('Error downloading file from storage:', error);
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Task type for Supabase tasks table
export interface Task {
  id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Contract linking (mutually exclusive with bundle)
  contract_id?: string;
  contract_salesforce_id?: string;
  contract_name?: string;
  contract_stage?: string;

  // Bundle linking (NEW)
  bundle_id?: string;
  bundle_name?: string;

  is_auto_generated: boolean;
  task_template_id?: string;
  due_date?: string;
  completed_at?: string;
  assignee_email?: string;
  created_at?: string;
  updated_at?: string;
}

// Bundle info for tasks linked to bundles
export interface TaskBundleInfo {
  bundleId: string;
  bundleName: string;
  contractCount: number;
  contracts: {
    id: string;
    name: string;
    salesforceId: string;
    isPrimary: boolean;
  }[];
}

// Task with enriched bundle information
export interface TaskWithBundleInfo extends Task {
  bundleInfo?: TaskBundleInfo;
}

// Contract type for Supabase contracts table
export interface Contract {
  id?: string;
  salesforce_id: string;
  name: string;
  opportunity_name: string;
  account_name: string;
  value: number;
  status: string;
  status_group: string;
  sales_stage: string;
  contract_type: string[];
  close_date: string | null;
  award_date: string | null;
  contract_date: string | null;
  deliver_date: string | null;
  install_date: string | null;
  cash_date: string | null;
  current_situation: string | null;
  next_steps: string | null;
  sales_rep: string;
  probability: number;
  budgeted: boolean;
  manual_close_probability: number | null;
  manual_status_override?: boolean; // TRUE when status manually set and should not be overwritten by sync
  is_closed: boolean;
  is_won: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get all contracts from Supabase
 */
export async function getContracts(): Promise<Contract[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('contracts')
    .select('*')
    .order('close_date', { ascending: true });

  if (error) {
    console.error('Error fetching contracts:', error);
    return [];
  }

  return data as Contract[];
}

/**
 * Upsert contracts to Supabase (insert or update based on salesforce_id)
 */
export async function upsertContracts(contracts: Contract[]): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getSupabaseAdmin();

  // Use atomic upsert function that sets sync flag within same transaction
  // This prevents the trigger from marking these updates as "pending sync"
  // Add updated_at timestamp
  const contractsWithTimestamp = contracts.map(c => ({
    ...c,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await admin.rpc('upsert_contracts_from_sync', {
    contracts_data: contractsWithTimestamp
  });

  if (error) {
    console.error('Error upserting contracts:', error);
    return { success: false, count: 0, error: error.message };
  }

  return { success: true, count: contracts.length };
}

/**
 * Delete contracts that are no longer in Salesforce
 */
export async function deleteStaleContracts(activeSalesforceIds: string[]): Promise<number> {
  const admin = getSupabaseAdmin();

  // Get all current contract IDs in Supabase
  const { data: existing } = await admin
    .from('contracts')
    .select('salesforce_id');

  if (!existing) return 0;

  // Find IDs that are in Supabase but not in the active Salesforce list
  const staleIds = existing
    .map(c => c.salesforce_id)
    .filter(id => !activeSalesforceIds.includes(id));

  if (staleIds.length === 0) return 0;

  // Mark stale contracts as closed (or delete them)
  const { error } = await admin
    .from('contracts')
    .update({ is_closed: true, status: 'Closed', updated_at: new Date().toISOString() })
    .in('salesforce_id', staleIds);

  if (error) {
    console.error('Error updating stale contracts:', error);
    return 0;
  }

  return staleIds.length;
}

// ============================================
// TASK CRUD FUNCTIONS
// ============================================

/**
 * Get all tasks from Supabase
 */
export async function getTasks(filters?: {
  contractId?: string;
  contractSalesforceId?: string;
  contractName?: string;
  bundleId?: string;
  status?: string;
  assigneeEmail?: string;
}): Promise<Task[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false });

  if (filters?.contractId) {
    query = query.eq('contract_id', filters.contractId);
  }
  if (filters?.contractSalesforceId) {
    query = query.eq('contract_salesforce_id', filters.contractSalesforceId);
  }
  if (filters?.contractName) {
    query = query.eq('contract_name', filters.contractName);
  }
  if (filters?.bundleId) {
    query = query.eq('bundle_id', filters.bundleId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.assigneeEmail) {
    query = query.eq('assignee_email', filters.assigneeEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  return data as Task[];
}

/**
 * Get tasks for a specific contract
 */
export async function getTasksForContract(contractSalesforceId: string): Promise<Task[]> {
  return getTasks({ contractSalesforceId });
}

/**
 * Create a new task
 */
export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('tasks')
    .insert({
      ...task,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return null;
  }

  return data as Task;
}

/**
 * Create multiple tasks at once (for auto-generation)
 */
export async function createTasks(tasks: Array<Omit<Task, 'id' | 'created_at' | 'updated_at'>>): Promise<Task[]> {
  const admin = getSupabaseAdmin();

  const tasksWithTimestamps = tasks.map(task => ({
    ...task,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await admin
    .from('tasks')
    .insert(tasksWithTimestamps)
    .select();

  if (error) {
    console.error('Error creating tasks:', error);
    return [];
  }

  return data as Task[];
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  updates: Partial<Omit<Task, 'id' | 'created_at'>>
): Promise<Task | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('tasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      // Set completed_at if task is being marked complete
      ...(updates.status === 'completed' && !updates.completed_at
        ? { completed_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    return null;
  }

  return data as Task;
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('Error deleting task:', error);
    return false;
  }

  return true;
}

/**
 * Delete all auto-generated tasks for a contract stage
 * (Used when contract moves to a new stage to clean up old stage tasks)
 */
export async function deleteAutoTasksForContractStage(
  contractSalesforceId: string,
  stage: string
): Promise<number> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('tasks')
    .delete()
    .eq('contract_salesforce_id', contractSalesforceId)
    .eq('contract_stage', stage)
    .eq('is_auto_generated', true)
    .eq('status', 'pending') // Only delete uncompleted auto-tasks
    .select();

  if (error) {
    console.error('Error deleting auto tasks:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get task statistics for dashboard
 */
export async function getTaskStats(): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueThisWeek: number;
}> {
  const admin = getSupabaseAdmin();

  const today = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const { data, error } = await admin
    .from('tasks')
    .select('id, status, due_date');

  if (error || !data) {
    console.error('Error fetching task stats:', error);
    return { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0, dueThisWeek: 0 };
  }

  const stats = {
    total: data.length,
    pending: data.filter(t => t.status === 'pending').length,
    inProgress: data.filter(t => t.status === 'in_progress').length,
    completed: data.filter(t => t.status === 'completed').length,
    overdue: data.filter(t =>
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      t.due_date &&
      new Date(t.due_date) < today
    ).length,
    dueThisWeek: data.filter(t =>
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      t.due_date &&
      new Date(t.due_date) >= today &&
      new Date(t.due_date) <= weekFromNow
    ).length,
  };

  return stats;
}

// ============================================
// DOCUSIGN DOCUMENT STORAGE FUNCTIONS
// ============================================

/**
 * Upload a DocuSign document to Supabase storage
 * Returns the storage path and public URL
 */
export async function uploadDocuSignDocument(params: {
  buffer: Buffer;
  customerName: string;
  type: 'project' | 'mcc';
  envelopeId: string;
}): Promise<{ path: string; url: string }> {
  const admin = getSupabaseAdmin();
  const { buffer, customerName, type, envelopeId } = params;

  // Generate storage path: docusign/{year}/{month}/{customer}_{type}_{envelope}.pdf
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const sanitizedCustomer = customerName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').substring(0, 50);
  const envelopeShort = envelopeId.substring(0, 8);
  const typeLabel = type === 'project' ? 'Project' : 'MCC';

  const storagePath = `docusign/${year}/${month}/${sanitizedCustomer}_${typeLabel}_${envelopeShort}.pdf`;

  // Upload to storage
  const { error: uploadError } = await admin
    .storage
    .from('data-files')
    .upload(storagePath, new Uint8Array(buffer), {
      contentType: 'application/pdf',
      upsert: true, // Overwrite if exists
    });

  if (uploadError) {
    console.error('Error uploading DocuSign document:', uploadError);
    throw new Error(`Failed to upload document: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = admin
    .storage
    .from('data-files')
    .getPublicUrl(storagePath);

  return {
    path: storagePath,
    url: urlData.publicUrl,
  };
}

/**
 * Download a DocuSign document from Supabase storage
 * Used for retrying Slack uploads
 */
export async function getDocuSignDocumentFromStorage(storagePath: string): Promise<Buffer | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .storage
    .from('data-files')
    .download(storagePath);

  if (error || !data) {
    console.error('Error downloading DocuSign document:', error);
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Save DocuSign document metadata to the documents table
 */
export async function saveDocuSignDocumentRecord(params: {
  customerName: string;
  type: 'project' | 'mcc';
  envelopeId: string;
  storagePath: string;
  storageUrl: string;
  signedDate: string;
  fileSize?: number;
}): Promise<{ id: string } | null> {
  const admin = getSupabaseAdmin();
  const { customerName, type, envelopeId, storagePath, storageUrl, signedDate, fileSize } = params;

  const typeLabel = type === 'project' ? 'Project' : 'MCC';
  const documentType = type === 'project' ? 'Executed Contract' : 'MCC Acceptance';
  const sanitizedCustomer = customerName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
  const fileName = `${sanitizedCustomer}_${typeLabel}_Acceptance.pdf`;

  const { data, error } = await admin
    .from('documents')
    .insert({
      document_type: documentType,
      status: 'executed',
      file_name: fileName,
      file_url: storageUrl,
      file_size: fileSize || 0,
      mime_type: 'application/pdf',
      version_number: 1,
      is_current_version: true,
      metadata: {
        envelopeId,
        customerName,
        signedDate,
        storagePath,
        type,
        source: 'docusign_webhook',
      },
      notes: `Signed ${typeLabel} acceptance for ${customerName}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving DocuSign document record:', error);
    return null;
  }

  return { id: data.id };
}

/**
 * Get DocuSign document record by envelope ID
 */
export async function getDocuSignDocumentByEnvelopeId(envelopeId: string): Promise<{
  id: string;
  storagePath: string;
  storageUrl: string;
  customerName: string;
  type: 'project' | 'mcc';
} | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('documents')
    .select('id, file_url, metadata')
    .filter('metadata->>envelopeId', 'eq', envelopeId)
    .single();

  if (error || !data) {
    return null;
  }

  const metadata = data.metadata as {
    envelopeId: string;
    customerName: string;
    storagePath: string;
    type: 'project' | 'mcc';
  };

  return {
    id: data.id,
    storagePath: metadata.storagePath,
    storageUrl: data.file_url,
    customerName: metadata.customerName,
    type: metadata.type,
  };
}

// ============================================
// DIVERSIFIED SALES FUNCTIONS
// ============================================

export interface DiversifiedSale {
  id?: string;
  netsuite_transaction_id: string;
  netsuite_line_id: string;
  transaction_type: string;
  transaction_number: string;
  transaction_date: string;
  posting_period: string;
  year: number;
  month: number;
  class_id: string;
  class_name: string;
  class_category: string;
  parent_class: string;
  customer_id: string;
  customer_name: string;
  account_id: string;
  account_name: string;
  quantity: number;
  revenue: number;
  cost: number;
  gross_profit: number;
  gross_profit_pct: number;
  item_id: string;
  item_name: string;
  item_description: string;
  synced_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DiversifiedBudget {
  id?: string;
  year: number;
  month: number;
  class_name: string;
  class_category?: string;
  budget_revenue: number;
  budget_units: number;
  budget_cost: number;
  budget_gross_profit: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

/**
 * Upsert diversified sales records to Supabase
 * Deduplicates records before upserting to prevent duplicate line items
 */
export async function upsertDiversifiedSales(
  records: Omit<DiversifiedSale, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getSupabaseAdmin();

  // Deduplicate records by unique key: transaction_id + item_id + quantity + revenue
  // This prevents duplicate line items that have different internal line IDs
  const uniqueRecords = new Map<string, Omit<DiversifiedSale, 'id' | 'created_at' | 'updated_at'>>();
  for (const r of records) {
    const key = `${r.netsuite_transaction_id}-${r.item_id}-${r.quantity}-${r.revenue}`;
    if (!uniqueRecords.has(key)) {
      uniqueRecords.set(key, r);
    }
  }

  const deduplicatedRecords = Array.from(uniqueRecords.values());
  if (deduplicatedRecords.length < records.length) {
    console.log(`Deduplicated ${records.length} -> ${deduplicatedRecords.length} records`);
  }

  const recordsWithTimestamp = deduplicatedRecords.map(r => ({
    ...r,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from('diversified_sales')
    .upsert(recordsWithTimestamp, {
      onConflict: 'netsuite_transaction_id,netsuite_line_id',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error upserting diversified sales:', error);
    return { success: false, count: 0, error: error.message };
  }

  return { success: true, count: deduplicatedRecords.length };
}

/**
 * Get diversified sales with filters
 */
export async function getDiversifiedSales(filters?: {
  year?: number;
  years?: number[];
  months?: number[];
  className?: string;
  classNames?: string[];
  customerId?: string;
  customerIds?: string[];
  accountId?: string;
}): Promise<DiversifiedSale[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('diversified_sales')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (filters?.year) {
    query = query.eq('year', filters.year);
  }
  if (filters?.years && filters.years.length > 0) {
    query = query.in('year', filters.years);
  }
  if (filters?.months && filters.months.length > 0) {
    query = query.in('month', filters.months);
  }
  if (filters?.className) {
    query = query.eq('class_name', filters.className);
  }
  if (filters?.classNames && filters.classNames.length > 0) {
    query = query.in('class_name', filters.classNames);
  }
  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters?.customerIds && filters.customerIds.length > 0) {
    query = query.in('customer_id', filters.customerIds);
  }
  if (filters?.accountId) {
    query = query.eq('account_id', filters.accountId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching diversified sales:', error);
    return [];
  }

  return data as DiversifiedSale[];
}

/**
 * Get aggregated diversified sales by class
 * Fetches data in batches per year to avoid 1000-row limit
 */
export async function getDiversifiedSalesByClass(filters?: {
  years?: number[];
  months?: number[];
}): Promise<Array<{
  class_name: string;
  class_category: string;
  total_units: number;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
  transaction_count: number;
}>> {
  const admin = getSupabaseAdmin();

  // Determine which years to query
  const yearsToQuery = filters?.years && filters.years.length > 0
    ? filters.years
    : [2024, 2025, 2026];

  const allData: Array<{ class_name: string; class_category: string; quantity: number; revenue: number; cost: number; gross_profit: number; gross_profit_pct: number }> = [];

  // Fetch data per year in batches to avoid 1000-row limit
  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = admin
        .from('diversified_sales')
        .select('class_name, class_category, quantity, revenue, cost, gross_profit, gross_profit_pct')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (filters?.months && filters.months.length > 0) {
        query = query.in('month', filters.months);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching year ${year} class data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  if (allData.length === 0) {
    return [];
  }

  // Aggregate by class_name
  const byClass = new Map<string, {
    class_name: string;
    class_category: string;
    total_units: number;
    total_revenue: number;
    total_cost: number;
    total_gross_profit: number;
    gross_profit_pcts: number[];
    transaction_count: number;
  }>();

  for (const row of allData) {
    const key = row.class_name;
    if (!byClass.has(key)) {
      byClass.set(key, {
        class_name: row.class_name,
        class_category: row.class_category || '',
        total_units: 0,
        total_revenue: 0,
        total_cost: 0,
        total_gross_profit: 0,
        gross_profit_pcts: [],
        transaction_count: 0,
      });
    }
    const agg = byClass.get(key)!;
    agg.total_units += row.quantity || 0;
    agg.total_revenue += row.revenue || 0;
    agg.total_cost += row.cost || 0;
    agg.total_gross_profit += row.gross_profit || 0;
    if (row.gross_profit_pct) agg.gross_profit_pcts.push(row.gross_profit_pct);
    agg.transaction_count += 1;
  }

  return Array.from(byClass.values()).map(agg => ({
    ...agg,
    // Calculate GP% from totals: (revenue - cost) / revenue * 100
    avg_gross_profit_pct: agg.total_revenue > 0
      ? ((agg.total_revenue - agg.total_cost) / agg.total_revenue) * 100
      : 0,
    gross_profit_pcts: undefined as any,
  })).sort((a, b) => b.total_revenue - a.total_revenue);
}

/**
 * Get aggregated diversified sales by customer
 * Fetches data in batches per year to avoid 1000-row limit
 */
export async function getDiversifiedSalesByCustomer(filters?: {
  years?: number[];
  months?: number[];
  className?: string;
}): Promise<Array<{
  customer_id: string;
  customer_name: string;
  total_units: number;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
  transaction_count: number;
}>> {
  const admin = getSupabaseAdmin();

  // Determine which years to query
  const yearsToQuery = filters?.years && filters.years.length > 0
    ? filters.years
    : [2024, 2025, 2026];

  const allData: Array<{ customer_id: string; customer_name: string; quantity: number; revenue: number; cost: number; gross_profit: number; gross_profit_pct: number }> = [];

  // Fetch data per year in batches to avoid 1000-row limit
  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = admin
        .from('diversified_sales')
        .select('customer_id, customer_name, quantity, revenue, cost, gross_profit, gross_profit_pct')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (filters?.months && filters.months.length > 0) {
        query = query.in('month', filters.months);
      }
      if (filters?.className) {
        query = query.eq('class_name', filters.className);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching year ${year} customer data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  if (allData.length === 0) {
    return [];
  }

  // Aggregate by customer
  const byCustomer = new Map<string, {
    customer_id: string;
    customer_name: string;
    total_units: number;
    total_revenue: number;
    total_cost: number;
    total_gross_profit: number;
    gross_profit_pcts: number[];
    transaction_count: number;
  }>();

  for (const row of allData) {
    const key = row.customer_id || row.customer_name || 'Unknown';
    if (!byCustomer.has(key)) {
      byCustomer.set(key, {
        customer_id: row.customer_id || '',
        customer_name: row.customer_name || 'Unknown',
        total_units: 0,
        total_revenue: 0,
        total_cost: 0,
        total_gross_profit: 0,
        gross_profit_pcts: [],
        transaction_count: 0,
      });
    }
    const agg = byCustomer.get(key)!;
    agg.total_units += row.quantity || 0;
    agg.total_revenue += row.revenue || 0;
    agg.total_cost += row.cost || 0;
    agg.total_gross_profit += row.gross_profit || 0;
    if (row.gross_profit_pct) agg.gross_profit_pcts.push(row.gross_profit_pct);
    agg.transaction_count += 1;
  }

  return Array.from(byCustomer.values()).map(agg => ({
    ...agg,
    // Calculate GP% from totals: (revenue - cost) / revenue * 100
    avg_gross_profit_pct: agg.total_revenue > 0
      ? ((agg.total_revenue - agg.total_cost) / agg.total_revenue) * 100
      : 0,
    gross_profit_pcts: undefined as any,
  })).sort((a, b) => b.total_revenue - a.total_revenue);
}

/**
 * Get diversified dashboard summary
 * Fetches data in batches per year to avoid 1000-row limit
 */
export async function getDiversifiedDashboardSummary(filters?: {
  years?: number[];
  months?: number[];
  className?: string;
  classNames?: string[];
}): Promise<{
  totalRevenue: number;
  totalUnits: number;
  totalUnitsPrior: number;
  unitsYoYChangePct: number | null;
  totalCost: number;
  grossProfit: number;
  grossProfitPct: number;
  transactionCount: number;
  uniqueClasses: number;
  uniqueCustomers: number;
}> {
  const admin = getSupabaseAdmin();

  // Calculate R12 periods for YoY comparison
  const now = new Date();
  const currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentPeriodStart = new Date(currentPeriodEnd);
  currentPeriodStart.setMonth(currentPeriodStart.getMonth() - 12);

  const priorPeriodEnd = new Date(currentPeriodStart);
  priorPeriodEnd.setDate(priorPeriodEnd.getDate() - 1);
  const priorPeriodStart = new Date(priorPeriodEnd);
  priorPeriodStart.setMonth(priorPeriodStart.getMonth() - 12);

  // Determine which years to query
  const yearsToQuery = filters?.years && filters.years.length > 0
    ? filters.years
    : [2024, 2025, 2026];

  const allData: Array<{
    quantity: number;
    revenue: number;
    cost: number;
    gross_profit: number;
    class_name: string;
    customer_id: string;
    transaction_date: string;
  }> = [];

  // Fetch data per year in batches to avoid 1000-row limit
  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = admin
        .from('diversified_sales')
        .select('quantity, revenue, cost, gross_profit, class_name, customer_id, transaction_date')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (filters?.months && filters.months.length > 0) {
        query = query.in('month', filters.months);
      }

      // Apply class name filters
      if (filters?.className) {
        query = query.eq('class_name', filters.className);
      } else if (filters?.classNames && filters.classNames.length > 0) {
        query = query.in('class_name', filters.classNames);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching year ${year} data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  if (allData.length === 0) {
    return {
      totalRevenue: 0,
      totalUnits: 0,
      totalUnitsPrior: 0,
      unitsYoYChangePct: null,
      totalCost: 0,
      grossProfit: 0,
      grossProfitPct: 0,
      transactionCount: 0,
      uniqueClasses: 0,
      uniqueCustomers: 0,
    };
  }

  const uniqueClasses = new Set(allData.map(d => d.class_name));
  const uniqueCustomers = new Set(allData.filter(d => d.customer_id).map(d => d.customer_id));

  // Aggregate totals and separate by period for YoY
  const totals = allData.reduce(
    (acc, row) => {
      const txDate = new Date(row.transaction_date);

      // Add to overall totals
      acc.revenue += row.revenue || 0;
      acc.units += row.quantity || 0;
      acc.cost += row.cost || 0;
      acc.grossProfit += row.gross_profit || 0;

      // Track units by period for YoY
      if (txDate >= currentPeriodStart && txDate <= currentPeriodEnd) {
        acc.unitsCurrent += row.quantity || 0;
      } else if (txDate >= priorPeriodStart && txDate <= priorPeriodEnd) {
        acc.unitsPrior += row.quantity || 0;
      }

      return acc;
    },
    { revenue: 0, units: 0, cost: 0, grossProfit: 0, unitsCurrent: 0, unitsPrior: 0 }
  );

  // Calculate YoY change percentage
  const unitsYoYChangePct = totals.unitsPrior > 0
    ? ((totals.unitsCurrent - totals.unitsPrior) / totals.unitsPrior) * 100
    : totals.unitsCurrent > 0 ? 100 : null;

  return {
    totalRevenue: totals.revenue,
    totalUnits: totals.units,
    totalUnitsPrior: totals.unitsPrior,
    unitsYoYChangePct,
    totalCost: totals.cost,
    grossProfit: totals.grossProfit,
    grossProfitPct: totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0,
    transactionCount: allData.length,
    uniqueClasses: uniqueClasses.size,
    uniqueCustomers: uniqueCustomers.size,
  };
}

/**
 * Get units sold breakdown by class with YoY comparison
 */
export async function getDiversifiedUnitsByClass(filters?: {
  years?: number[];
  months?: number[];
  className?: string;
  groupByParent?: boolean;
}): Promise<{
  byClass: Array<{
    class_name: string;
    parent_class: string | null;
    current_units: number;
    prior_units: number;
    units_change_pct: number;
    current_revenue: number;
    prior_revenue: number;
    revenue_change_pct: number;
    avg_price_per_unit: number;
  }>;
  monthlyTrends: Array<{
    year: number;
    month: number;
    class_name: string;
    units: number;
    revenue: number;
  }>;
  topItemsByClass: Record<string, Array<{
    item_id: string;
    item_name: string;
    item_description: string;
    units: number;
    revenue: number;
  }>>;
  periods: {
    current: { start: string; end: string };
    prior: { start: string; end: string };
  };
}> {
  const admin = getSupabaseAdmin();

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  // Determine years to query and calculate periods based on filters
  let currentPeriodStart: Date;
  let currentPeriodEnd: Date;
  let priorPeriodStart: Date;
  let priorPeriodEnd: Date;
  let yearsToQuery: number[];

  if (filters?.years && filters.years.length > 0) {
    // User has selected specific year(s) - compare against prior year
    const selectedYears = [...filters.years].sort((a, b) => a - b);
    const minYear = selectedYears[0];
    const maxYear = selectedYears[selectedYears.length - 1];

    // Current period: selected year(s) and month(s)
    // Use Date.UTC to ensure consistent timezone handling with database dates
    if (filters?.months && filters.months.length > 0) {
      const selectedMonths = [...filters.months].sort((a, b) => a - b);
      const minMonth = selectedMonths[0];
      const maxMonth = selectedMonths[selectedMonths.length - 1];

      currentPeriodStart = new Date(Date.UTC(minYear, minMonth - 1, 1));
      currentPeriodEnd = new Date(Date.UTC(maxYear, maxMonth, 0, 23, 59, 59, 999)); // End of last day

      // Prior period: same months in prior year(s)
      priorPeriodStart = new Date(Date.UTC(minYear - 1, minMonth - 1, 1));
      priorPeriodEnd = new Date(Date.UTC(maxYear - 1, maxMonth, 0, 23, 59, 59, 999));
    } else {
      // All months in selected year(s)
      currentPeriodStart = new Date(Date.UTC(minYear, 0, 1));
      currentPeriodEnd = new Date(Date.UTC(maxYear, 11, 31, 23, 59, 59, 999));

      // Prior period: same in prior year(s)
      priorPeriodStart = new Date(Date.UTC(minYear - 1, 0, 1));
      priorPeriodEnd = new Date(Date.UTC(maxYear - 1, 11, 31, 23, 59, 59, 999));
    }

    // Query both current and prior years
    yearsToQuery = [...new Set([...selectedYears, ...selectedYears.map(y => y - 1)])];
  } else {
    // No year filter - use R12 periods from today (UTC)
    const now = new Date();
    currentPeriodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    currentPeriodStart = new Date(currentPeriodEnd);
    currentPeriodStart.setUTCMonth(currentPeriodStart.getUTCMonth() - 12);
    currentPeriodStart.setUTCHours(0, 0, 0, 0);

    priorPeriodEnd = new Date(currentPeriodStart);
    priorPeriodEnd.setUTCDate(priorPeriodEnd.getUTCDate() - 1);
    priorPeriodEnd.setUTCHours(23, 59, 59, 999);
    priorPeriodStart = new Date(priorPeriodEnd);
    priorPeriodStart.setUTCMonth(priorPeriodStart.getUTCMonth() - 12);
    priorPeriodStart.setUTCHours(0, 0, 0, 0);

    yearsToQuery = [2024, 2025, 2026];
  }

  // Fetch all data in batches
  const allData: Array<{
    item_id: string;
    item_name: string;
    item_description: string;
    class_name: string;
    parent_class: string | null;
    transaction_date: string;
    year: number;
    month: number;
    quantity: number;
    revenue: number;
  }> = [];

  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = admin
        .from('diversified_sales')
        .select('item_id, item_name, item_description, class_name, parent_class, transaction_date, year, month, quantity, revenue')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      // Apply filters
      if (filters?.months && filters.months.length > 0) {
        query = query.in('month', filters.months);
      }
      if (filters?.className) {
        query = query.eq('class_name', filters.className);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching units data for year ${year}:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  // Aggregate by class
  const classMap = new Map<string, {
    class_name: string;
    parent_class: string | null;
    current_units: number;
    prior_units: number;
    current_revenue: number;
    prior_revenue: number;
    items: Map<string, { item_id: string; item_name: string; item_description: string; units: number; revenue: number }>;
  }>();

  // Monthly trends map
  const monthlyTrendsMap = new Map<string, {
    year: number;
    month: number;
    class_name: string;
    units: number;
    revenue: number;
  }>();

  for (const row of allData) {
    const txDate = new Date(row.transaction_date);
    const classKey = filters?.groupByParent && row.parent_class
      ? row.parent_class
      : row.class_name;

    // Initialize class entry
    if (!classMap.has(classKey)) {
      classMap.set(classKey, {
        class_name: classKey,
        parent_class: row.parent_class,
        current_units: 0,
        prior_units: 0,
        current_revenue: 0,
        prior_revenue: 0,
        items: new Map(),
      });
    }

    const classData = classMap.get(classKey)!;

    // Aggregate by period
    if (txDate >= currentPeriodStart && txDate <= currentPeriodEnd) {
      classData.current_units += row.quantity || 0;
      classData.current_revenue += row.revenue || 0;

      // Track items
      const itemKey = row.item_id || row.item_name;
      if (itemKey) {
        if (!classData.items.has(itemKey)) {
          classData.items.set(itemKey, {
            item_id: row.item_id,
            item_name: row.item_name,
            item_description: row.item_description || '',
            units: 0,
            revenue: 0,
          });
        }
        classData.items.get(itemKey)!.units += row.quantity || 0;
        classData.items.get(itemKey)!.revenue += row.revenue || 0;
      }
    } else if (txDate >= priorPeriodStart && txDate <= priorPeriodEnd) {
      classData.prior_units += row.quantity || 0;
      classData.prior_revenue += row.revenue || 0;
    }

    // Monthly trends
    const trendKey = `${row.year}-${row.month}-${classKey}`;
    if (!monthlyTrendsMap.has(trendKey)) {
      monthlyTrendsMap.set(trendKey, {
        year: row.year,
        month: row.month,
        class_name: classKey,
        units: 0,
        revenue: 0,
      });
    }
    monthlyTrendsMap.get(trendKey)!.units += row.quantity || 0;
    monthlyTrendsMap.get(trendKey)!.revenue += row.revenue || 0;
  }

  // Build byClass array with YoY calculations
  const byClass = Array.from(classMap.values()).map(c => {
    const units_change_pct = c.prior_units > 0
      ? ((c.current_units - c.prior_units) / c.prior_units) * 100
      : c.current_units > 0 ? 100 : 0;

    const revenue_change_pct = c.prior_revenue > 0
      ? ((c.current_revenue - c.prior_revenue) / c.prior_revenue) * 100
      : c.current_revenue > 0 ? 100 : 0;

    const avg_price_per_unit = c.current_units > 0
      ? c.current_revenue / c.current_units
      : 0;

    return {
      class_name: c.class_name,
      parent_class: c.parent_class,
      current_units: c.current_units,
      prior_units: c.prior_units,
      units_change_pct,
      current_revenue: c.current_revenue,
      prior_revenue: c.prior_revenue,
      revenue_change_pct,
      avg_price_per_unit,
    };
  }).sort((a, b) => b.current_units - a.current_units);

  // Build monthly trends array
  const monthlyTrends = Array.from(monthlyTrendsMap.values())
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.class_name.localeCompare(b.class_name);
    });

  // Build top items by class (top 10 per class)
  const topItemsByClass: Record<string, Array<{
    item_id: string;
    item_name: string;
    item_description: string;
    units: number;
    revenue: number;
  }>> = {};

  for (const [className, classData] of classMap.entries()) {
    const topItems = Array.from(classData.items.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 10);
    if (topItems.length > 0) {
      topItemsByClass[className] = topItems;
    }
  }

  return {
    byClass,
    monthlyTrends,
    topItemsByClass,
    periods: {
      current: {
        start: formatDate(currentPeriodStart),
        end: formatDate(currentPeriodEnd),
      },
      prior: {
        start: formatDate(priorPeriodStart),
        end: formatDate(priorPeriodEnd),
      },
    },
  };
}

/**
 * Get available years and months for diversified filters
 * Uses separate queries per year to avoid 1000 row limit issue
 */
export async function getDiversifiedFilterOptions(): Promise<{
  years: number[];
  months: number[];
  classes: string[];
  customers: Array<{ id: string; name: string }>;
}> {
  const admin = getSupabaseAdmin();

  // Get distinct years by querying each potential year range separately
  // This avoids the 1000-row limit issue that causes missing years
  const potentialYears = [2024, 2025, 2026, 2027];
  const yearsWithData: number[] = [];

  for (const year of potentialYears) {
    const { data } = await admin
      .from('diversified_sales')
      .select('id')
      .eq('year', year)
      .limit(1);
    if (data && data.length > 0) {
      yearsWithData.push(year);
    }
  }

  const years = yearsWithData.sort((a, b) => b - a);

  // Get distinct months (always 1-12)
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Get distinct classes - order by year DESC to get from all years
  const { data: classData } = await admin
    .from('diversified_sales')
    .select('class_name')
    .order('year', { ascending: false })
    .range(0, 999);

  const classes = [...new Set((classData || []).map(d => d.class_name))].sort();

  // Get distinct customers from all years
  const customerMap = new Map<string, string>();
  for (const year of yearsWithData) {
    const { data: customerData } = await admin
      .from('diversified_sales')
      .select('customer_id, customer_name')
      .eq('year', year)
      .range(0, 999);

    for (const d of customerData || []) {
      if (d.customer_id && !customerMap.has(d.customer_id)) {
        customerMap.set(d.customer_id, d.customer_name || 'Unknown');
      }
    }
  }

  const customers = Array.from(customerMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { years, months, classes, customers };
}

/**
 * Get budgets for variance calculation
 */
export async function getDiversifiedBudgets(filters?: {
  year?: number;
  years?: number[];
  months?: number[];
  className?: string;
}): Promise<DiversifiedBudget[]> {
  const admin = getSupabaseAdmin();

  let query = admin
    .from('diversified_budgets')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: true });

  if (filters?.year) {
    query = query.eq('year', filters.year);
  }
  if (filters?.years && filters.years.length > 0) {
    query = query.in('year', filters.years);
  }
  if (filters?.months && filters.months.length > 0) {
    query = query.in('month', filters.months);
  }
  if (filters?.className) {
    query = query.eq('class_name', filters.className);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching diversified budgets:', error);
    return [];
  }

  return data as DiversifiedBudget[];
}

/**
 * Upsert diversified budgets
 */
export async function upsertDiversifiedBudgets(
  budgets: Omit<DiversifiedBudget, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getSupabaseAdmin();

  const budgetsWithTimestamp = budgets.map(b => ({
    ...b,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from('diversified_budgets')
    .upsert(budgetsWithTimestamp, {
      onConflict: 'year,month,class_name',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error upserting diversified budgets:', error);
    return { success: false, count: 0, error: error.message };
  }

  return { success: true, count: budgets.length };
}

/**
 * Delete diversified sales by date range
 * Used to clear data before re-syncing
 */
export async function deleteDiversifiedSalesByDateRange(
  startDate: string,
  endDate: string
): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getSupabaseAdmin();

  // Parse dates to get year/month for filtering
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endMonth = end.getMonth() + 1;

  // Delete by year/month (since transaction_date format varies)
  let query = admin
    .from('diversified_sales')
    .delete()
    .eq('year', startYear);

  // If single month, filter by it
  if (startMonth === endMonth && startYear === endYear) {
    query = query.eq('month', startMonth);
  } else if (startYear === endYear) {
    query = query.gte('month', startMonth).lte('month', endMonth);
  }

  const { data, error } = await query.select();

  if (error) {
    console.error('Error deleting diversified sales:', error);
    return { success: false, count: 0, error: error.message };
  }

  console.log(`Deleted ${data?.length || 0} records for year=${startYear} month=${startMonth}-${endMonth}`);
  return { success: true, count: data?.length || 0 };
}

/**
 * Delete ALL diversified sales (full table clear)
 */
export async function deleteAllDiversifiedSales(): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('diversified_sales')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Match all rows
    .select();

  if (error) {
    console.error('Error deleting all diversified sales:', error);
    return { success: false, count: 0, error: error.message };
  }

  console.log(`Deleted ${data?.length || 0} total records`);
  return { success: true, count: data?.length || 0 };
}

/**
 * Get monthly summary data for charts
 * Returns aggregated data by year/month for trend visualizations
 */
export async function getDiversifiedMonthlySummary(filters?: {
  years?: number[];
}): Promise<Array<{
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossProfitPct: number;
  units: number;
  transactionCount: number;
}>> {
  const admin = getSupabaseAdmin();
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Determine which years to query
  const yearsToQuery = filters?.years && filters.years.length > 0
    ? filters.years
    : [2024, 2025, 2026];

  const allData: Array<{ year: number; month: number; quantity: number; revenue: number; cost: number; gross_profit: number }> = [];

  // Fetch data per year in batches
  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from('diversified_sales')
        .select('year, month, quantity, revenue, cost, gross_profit')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error(`Error fetching year ${year} data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  // Group by year + month
  const monthlyMap = new Map<string, {
    year: number;
    month: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    units: number;
    count: number;
  }>();

  for (const row of allData) {
    const key = `${row.year}-${row.month}`;
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, {
        year: row.year,
        month: row.month,
        revenue: 0,
        cost: 0,
        grossProfit: 0,
        units: 0,
        count: 0,
      });
    }
    const agg = monthlyMap.get(key)!;
    agg.revenue += row.revenue || 0;
    agg.cost += row.cost || 0;
    agg.grossProfit += row.gross_profit || 0;
    agg.units += row.quantity || 0;
    agg.count += 1;
  }

  // Convert to array and sort
  return Array.from(monthlyMap.values())
    .map(m => ({
      year: m.year,
      month: m.month,
      monthName: MONTH_NAMES[m.month - 1] || `M${m.month}`,
      revenue: m.revenue,
      cost: m.cost,
      grossProfit: m.grossProfit,
      grossProfitPct: m.revenue > 0 ? ((m.revenue - m.cost) / m.revenue) * 100 : 0,
      units: m.units,
      transactionCount: m.count,
    }))
    .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
}

/**
 * Get monthly data by class for heatmap and comparison charts
 */
export async function getDiversifiedClassMonthlySummary(filters?: {
  years?: number[];
}): Promise<Array<{
  className: string;
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  units: number;
}>> {
  const admin = getSupabaseAdmin();
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const yearsToQuery = filters?.years && filters.years.length > 0
    ? filters.years
    : [2024, 2025, 2026];

  const allData: Array<{ class_name: string; year: number; month: number; quantity: number; revenue: number; cost: number; gross_profit: number }> = [];

  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from('diversified_sales')
        .select('class_name, year, month, quantity, revenue, cost, gross_profit')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error(`Error fetching year ${year} class data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  // Group by class + year + month
  const classMonthlyMap = new Map<string, {
    className: string;
    year: number;
    month: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    units: number;
  }>();

  for (const row of allData) {
    const key = `${row.class_name}-${row.year}-${row.month}`;
    if (!classMonthlyMap.has(key)) {
      classMonthlyMap.set(key, {
        className: row.class_name,
        year: row.year,
        month: row.month,
        revenue: 0,
        cost: 0,
        grossProfit: 0,
        units: 0,
      });
    }
    const agg = classMonthlyMap.get(key)!;
    agg.revenue += row.revenue || 0;
    agg.cost += row.cost || 0;
    agg.grossProfit += row.gross_profit || 0;
    agg.units += row.quantity || 0;
  }

  return Array.from(classMonthlyMap.values())
    .map(m => ({
      ...m,
      monthName: MONTH_NAMES[m.month - 1] || `M${m.month}`,
    }))
    .sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
}

// ============================================
// PROJECT PROFITABILITY FUNCTIONS
// ============================================

export interface ProjectProfitability {
  id?: string;
  netsuite_transaction_id: string;
  netsuite_line_id: string;
  transaction_number: string;
  transaction_type: string;
  transaction_date: string;
  posting_period: string;
  year: number;
  month: number;
  customer_id: string;
  customer_name: string;
  class_id: string;
  class_name: string;
  project_type: string;
  account_id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  is_revenue: boolean;
  is_cogs: boolean;
  amount: number;
  costestimate: number; // COGS from NetSuite costestimate field
  quantity: number;
  item_id: string;
  item_name: string;
  item_description?: string;
  synced_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectBudget {
  id?: string;
  year: number;
  customer_name: string;
  project_type?: string;
  budget_revenue: number;
  budget_cogs: number;
  budget_gp: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface ProjectProfitabilitySyncLog {
  id?: string;
  sync_type: 'full' | 'delta';
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed';
  records_fetched: number;
  records_upserted: number;
  records_deleted: number;
  error_message?: string;
  metadata?: Record<string, any>;
}

/**
 * Upsert project profitability records to Supabase
 */
export async function upsertProjectProfitability(
  records: Omit<ProjectProfitability, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getSupabaseAdmin();

  const recordsWithTimestamp = records.map(r => ({
    ...r,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from('project_profitability')
    .upsert(recordsWithTimestamp, {
      onConflict: 'netsuite_transaction_id,netsuite_line_id',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error upserting project profitability:', error);
    return { success: false, count: 0, error: error.message };
  }

  return { success: true, count: records.length };
}

/**
 * Get project profitability data with filters
 */
export async function getProjectProfitabilityData(filters?: {
  years?: number[];
  months?: number[];
  projectTypes?: string[];
  customerName?: string;
}): Promise<ProjectProfitability[]> {
  const admin = getSupabaseAdmin();

  // If no years specified, query all years from 2020-2030 to catch all data
  const yearsToQuery = filters?.years && filters.years.length > 0
    ? filters.years
    : [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const allData: ProjectProfitability[] = [];

  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = admin
        .from('project_profitability')
        .select('*')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (filters?.months && filters.months.length > 0) {
        query = query.in('month', filters.months);
      }
      if (filters?.projectTypes && filters.projectTypes.length > 0) {
        query = query.in('project_type', filters.projectTypes);
      }
      if (filters?.customerName) {
        query = query.ilike('customer_name', `%${filters.customerName}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching year ${year} profitability data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...(data as ProjectProfitability[]));
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  return allData;
}

/**
 * Get aggregated profitability by project (customer)
 */
export async function getProjectProfitabilityByProject(filters?: {
  years?: number[];
  projectTypes?: string[];
}): Promise<Array<{
  customer_name: string;
  project_type: string;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_profit_pct: number;
  transaction_count: number;
}>> {
  const data = await getProjectProfitabilityData(filters);

  // Aggregate revenue and COGS by customer AND project type
  // COGS now comes from costestimate field (like Diversified Products)
  const byCustomerType = new Map<string, {
    customer_name: string;
    project_type: string;
    total_revenue: number;
    total_cogs: number;
    transaction_ids: Set<string>;
  }>();

  for (const row of data) {
    // Key by both customer AND project type to see breakdown
    const projectType = row.project_type || 'Unknown';
    const key = `${row.customer_name}|||${projectType}`;
    if (!byCustomerType.has(key)) {
      byCustomerType.set(key, {
        customer_name: row.customer_name,
        project_type: projectType,
        total_revenue: 0,
        total_cogs: 0,
        transaction_ids: new Set(),
      });
    }
    const agg = byCustomerType.get(key)!

    if (row.is_revenue) {
      agg.total_revenue += Math.abs(row.amount);
    }
    // COGS from costestimate field (NetSuite line item cost)
    agg.total_cogs += row.costestimate || 0;
    agg.transaction_ids.add(row.netsuite_transaction_id);
  }

  return Array.from(byCustomerType.values())
    .map(agg => {
      const gross_profit = agg.total_revenue - agg.total_cogs;
      const gross_profit_pct = agg.total_revenue > 0
        ? (gross_profit / agg.total_revenue) * 100
        : 0;

      return {
        customer_name: agg.customer_name,
        project_type: agg.project_type,
        total_revenue: agg.total_revenue,
        total_cogs: agg.total_cogs,
        gross_profit,
        gross_profit_pct,
        transaction_count: agg.transaction_ids.size,
      };
    })
    .sort((a, b) => b.total_revenue - a.total_revenue);
}

/**
 * Get profitability summary for dashboard KPIs
 */
export async function getProjectProfitabilitySummary(filters?: {
  years?: number[];
  projectTypes?: string[];
}): Promise<{
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossProfitPct: number;
  projectCount: number;
  atRiskCount: number;
}> {
  const projects = await getProjectProfitabilityByProject(filters);

  const totals = projects.reduce(
    (acc, p) => ({
      revenue: acc.revenue + p.total_revenue,
      cogs: acc.cogs + p.total_cogs,
    }),
    { revenue: 0, cogs: 0 }
  );

  const grossProfit = totals.revenue - totals.cogs;
  const grossProfitPct = totals.revenue > 0 ? (grossProfit / totals.revenue) * 100 : 0;

  // At-risk = GPM < 50%
  const atRiskCount = projects.filter(p => p.gross_profit_pct < 50).length;

  return {
    totalRevenue: totals.revenue,
    totalCogs: totals.cogs,
    grossProfit,
    grossProfitPct,
    projectCount: projects.length,
    atRiskCount,
  };
}

/**
 * Get monthly profitability trend
 */
export async function getProjectProfitabilityMonthly(filters?: {
  years?: number[];
  projectTypes?: string[];
}): Promise<Array<{
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossProfitPct: number;
}>> {
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = await getProjectProfitabilityData(filters);

  // Aggregate by year/month
  const monthly = new Map<string, {
    year: number;
    month: number;
    revenue: number;
    cogs: number;
  }>();

  for (const row of data) {
    const key = `${row.year}-${row.month}`;
    if (!monthly.has(key)) {
      monthly.set(key, {
        year: row.year,
        month: row.month,
        revenue: 0,
        cogs: 0,
      });
    }
    const agg = monthly.get(key)!;
    if (row.is_revenue) agg.revenue += Math.abs(row.amount);
    // COGS from costestimate field (NetSuite line item cost)
    agg.cogs += row.costestimate || 0;
  }

  return Array.from(monthly.values())
    .map(m => ({
      year: m.year,
      month: m.month,
      monthName: MONTH_NAMES[m.month - 1] || `M${m.month}`,
      revenue: m.revenue,
      cogs: m.cogs,
      grossProfit: m.revenue - m.cogs,
      grossProfitPct: m.revenue > 0 ? ((m.revenue - m.cogs) / m.revenue) * 100 : 0,
    }))
    .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
}

/**
 * Get profitability by project type
 */
export async function getProjectProfitabilityByType(filters?: {
  years?: number[];
}): Promise<Array<{
  project_type: string;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_profit_pct: number;
  project_count: number;
}>> {
  const projects = await getProjectProfitabilityByProject(filters);

  // Aggregate by type
  const byType = new Map<string, {
    project_type: string;
    total_revenue: number;
    total_cogs: number;
    project_count: number;
  }>();

  for (const p of projects) {
    const type = p.project_type || 'Unknown';
    if (!byType.has(type)) {
      byType.set(type, {
        project_type: type,
        total_revenue: 0,
        total_cogs: 0,
        project_count: 0,
      });
    }
    const agg = byType.get(type)!;
    agg.total_revenue += p.total_revenue;
    agg.total_cogs += p.total_cogs;
    agg.project_count += 1;
  }

  return Array.from(byType.values())
    .map(t => ({
      project_type: t.project_type,
      total_revenue: t.total_revenue,
      total_cogs: t.total_cogs,
      gross_profit: t.total_revenue - t.total_cogs,
      gross_profit_pct: t.total_revenue > 0
        ? ((t.total_revenue - t.total_cogs) / t.total_revenue) * 100
        : 0,
      project_count: t.project_count,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue);
}

/**
 * Get project budgets
 */
export async function getProjectBudgets(filters?: {
  year?: number;
  customerName?: string;
}): Promise<ProjectBudget[]> {
  const admin = getSupabaseAdmin();

  let query = admin
    .from('project_budgets')
    .select('*')
    .order('year', { ascending: false });

  if (filters?.year) {
    query = query.eq('year', filters.year);
  }
  if (filters?.customerName) {
    query = query.ilike('customer_name', `%${filters.customerName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching project budgets:', error);
    return [];
  }

  return data as ProjectBudget[];
}

/**
 * Upsert project budgets
 */
export async function upsertProjectBudgets(
  budgets: Omit<ProjectBudget, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getSupabaseAdmin();

  const budgetsWithTimestamp = budgets.map(b => ({
    ...b,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from('project_budgets')
    .upsert(budgetsWithTimestamp, {
      onConflict: 'year,customer_name',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error upserting project budgets:', error);
    return { success: false, count: 0, error: error.message };
  }

  return { success: true, count: budgets.length };
}

/**
 * Create sync log entry
 */
export async function createProfitabilitySyncLog(
  syncType: 'full' | 'delta'
): Promise<string | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('project_profitability_sync_log')
    .insert({
      sync_type: syncType,
      started_at: new Date().toISOString(),
      status: 'running',
      records_fetched: 0,
      records_upserted: 0,
      records_deleted: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating sync log:', error);
    return null;
  }

  return data.id;
}

/**
 * Update sync log entry
 */
export async function updateProfitabilitySyncLog(
  logId: string,
  updates: Partial<ProjectProfitabilitySyncLog>
): Promise<boolean> {
  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from('project_profitability_sync_log')
    .update(updates)
    .eq('id', logId);

  if (error) {
    console.error('Error updating sync log:', error);
    return false;
  }

  return true;
}

/**
 * Delete project profitability by year (for full re-sync)
 */
export async function deleteProjectProfitabilityByYear(year: number): Promise<number> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('project_profitability')
    .delete()
    .eq('year', year)
    .select();

  if (error) {
    console.error('Error deleting project profitability:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Delete all project profitability data
 */
export async function deleteAllProjectProfitability(): Promise<number> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('project_profitability')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select();

  if (error) {
    console.error('Error deleting all project profitability:', error);
    return 0;
  }

  return data?.length || 0;
}

// ============================================
// CONTRACT REVIEW FUNCTIONS
// ============================================

export interface ContractReview {
  id?: string;
  contract_id?: string;
  contract_name?: string;
  provision_name: string;
  original_text: string;
  redlined_text: string;
  modified_text?: string;
  summary: string[];
  status: 'draft' | 'sent_to_boss' | 'sent_to_client' | 'approved';
  created_at?: string;
  updated_at?: string;
  // Approval workflow fields
  approval_status?: 'pending' | 'approved' | 'rejected' | 'expired';
  approval_token?: string;
  approver_email?: string;
  approval_feedback?: string;
  approved_at?: string;
  token_expires_at?: string;
  submitted_by_email?: string;
  submitted_at?: string;
  // OneDrive integration fields
  onedrive_file_id?: string;
  onedrive_web_url?: string;
  onedrive_embed_url?: string;
  document_versions?: Array<{
    version: number;
    savedAt: string;
    savedBy?: string;
    fileId?: string;
  }>;
}

/**
 * Create a new contract review
 */
export async function createContractReview(
  review: Omit<ContractReview, 'id' | 'created_at' | 'updated_at'>
): Promise<ContractReview | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('contract_reviews')
    .insert({
      ...review,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating contract review:', error);
    throw new Error(`Database error: ${error.message} (code: ${error.code})`);
  }

  return data as ContractReview;
}

/**
 * Get all contract reviews (with optional filters)
 */
export async function getContractReviews(filters?: {
  contractId?: string;
  status?: string;
  limit?: number;
}): Promise<ContractReview[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('contract_reviews')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.contractId) {
    query = query.eq('contract_id', filters.contractId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching contract reviews:', error);
    return [];
  }

  return data as ContractReview[];
}

/**
 * Get a single contract review by ID
 */
export async function getContractReview(reviewId: string): Promise<ContractReview | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('contract_reviews')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (error) {
    console.error('Error fetching contract review:', error);
    return null;
  }

  return data as ContractReview;
}

/**
 * Update a contract review
 */
export async function updateContractReview(
  reviewId: string,
  updates: Partial<Omit<ContractReview, 'id' | 'created_at'>>
): Promise<ContractReview | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('contract_reviews')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .select()
    .single();

  if (error) {
    console.error('Error updating contract review:', error);
    return null;
  }

  return data as ContractReview;
}

/**
 * Delete a contract review
 */
export async function deleteContractReview(reviewId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from('contract_reviews')
    .delete()
    .eq('id', reviewId);

  if (error) {
    console.error('Error deleting contract review:', error);
    return false;
  }

  return true;
}

/**
 * Get filter options for profitability dashboard
 */
export async function getProjectProfitabilityFilterOptions(): Promise<{
  years: number[];
  projectTypes: string[];
  customers: string[];
}> {
  const admin = getSupabaseAdmin();

  // Check which years have data
  const potentialYears = [2022, 2023, 2024, 2025, 2026];
  const yearsWithData: number[] = [];

  for (const year of potentialYears) {
    const { data } = await admin
      .from('project_profitability')
      .select('id')
      .eq('year', year)
      .limit(1);
    if (data && data.length > 0) {
      yearsWithData.push(year);
    }
  }

  // Get distinct project types - check each known type to see if it has data
  const knownProjectTypes = [
    'TBEN', 'TBEU', 'TBIN', 'TBIU', 'M3IN', 'M3IU', 'M3 Software',
    'MCC', 'TB Service', 'TB Components', 'Other'
  ];
  const projectTypesWithData: string[] = [];

  for (const projectType of knownProjectTypes) {
    const { data } = await admin
      .from('project_profitability')
      .select('id')
      .eq('project_type', projectType)
      .limit(1);
    if (data && data.length > 0) {
      projectTypesWithData.push(projectType);
    }
  }

  const projectTypes = projectTypesWithData.sort();

  // Get distinct customers
  const { data: customerData } = await admin
    .from('project_profitability')
    .select('customer_name')
    .limit(1000);

  const customers = [...new Set((customerData || []).map(d => d.customer_name).filter(Boolean))].sort();

  return {
    years: yearsWithData.sort((a, b) => b - a),
    projectTypes,
    customers,
  };
}
