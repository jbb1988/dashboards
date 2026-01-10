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
  contract_id?: string;
  contract_salesforce_id?: string;
  contract_name?: string;
  contract_stage?: string;
  is_auto_generated: boolean;
  task_template_id?: string;
  due_date?: string;
  completed_at?: string;
  assignee_email?: string;
  created_at?: string;
  updated_at?: string;
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
  install_date: string | null;
  sales_rep: string;
  probability: number;
  budgeted: boolean;
  manual_close_probability: number | null;
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

  // Add updated_at timestamp
  const contractsWithTimestamp = contracts.map(c => ({
    ...c,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await admin
    .from('contracts')
    .upsert(contractsWithTimestamp, {
      onConflict: 'salesforce_id',
      ignoreDuplicates: false
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
 */
export async function upsertDiversifiedSales(
  records: Omit<DiversifiedSale, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getSupabaseAdmin();

  const recordsWithTimestamp = records.map(r => ({
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

  return { success: true, count: records.length };
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

  let query = admin
    .from('diversified_sales')
    .select('class_name, class_category, quantity, revenue, cost, gross_profit, gross_profit_pct');

  if (filters?.years && filters.years.length > 0) {
    query = query.in('year', filters.years);
  }
  if (filters?.months && filters.months.length > 0) {
    query = query.in('month', filters.months);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching diversified sales by class:', error);
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

  for (const row of data) {
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
    avg_gross_profit_pct: agg.gross_profit_pcts.length > 0
      ? agg.gross_profit_pcts.reduce((a, b) => a + b, 0) / agg.gross_profit_pcts.length
      : 0,
    gross_profit_pcts: undefined as any,
  })).sort((a, b) => b.total_revenue - a.total_revenue);
}

/**
 * Get aggregated diversified sales by customer
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

  let query = admin
    .from('diversified_sales')
    .select('customer_id, customer_name, quantity, revenue, cost, gross_profit, gross_profit_pct');

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

  if (error || !data) {
    console.error('Error fetching diversified sales by customer:', error);
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

  for (const row of data) {
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
    avg_gross_profit_pct: agg.gross_profit_pcts.length > 0
      ? agg.gross_profit_pcts.reduce((a, b) => a + b, 0) / agg.gross_profit_pcts.length
      : 0,
    gross_profit_pcts: undefined as any,
  })).sort((a, b) => b.total_revenue - a.total_revenue);
}

/**
 * Get diversified dashboard summary
 */
export async function getDiversifiedDashboardSummary(filters?: {
  years?: number[];
  months?: number[];
}): Promise<{
  totalRevenue: number;
  totalUnits: number;
  totalCost: number;
  grossProfit: number;
  grossProfitPct: number;
  transactionCount: number;
  uniqueClasses: number;
  uniqueCustomers: number;
}> {
  const admin = getSupabaseAdmin();

  let query = admin
    .from('diversified_sales')
    .select('quantity, revenue, cost, gross_profit, class_name, customer_id');

  if (filters?.years && filters.years.length > 0) {
    query = query.in('year', filters.years);
  }
  if (filters?.months && filters.months.length > 0) {
    query = query.in('month', filters.months);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching dashboard summary:', error);
    return {
      totalRevenue: 0,
      totalUnits: 0,
      totalCost: 0,
      grossProfit: 0,
      grossProfitPct: 0,
      transactionCount: 0,
      uniqueClasses: 0,
      uniqueCustomers: 0,
    };
  }

  const uniqueClasses = new Set(data.map(d => d.class_name));
  const uniqueCustomers = new Set(data.filter(d => d.customer_id).map(d => d.customer_id));

  const totals = data.reduce(
    (acc, row) => ({
      revenue: acc.revenue + (row.revenue || 0),
      units: acc.units + (row.quantity || 0),
      cost: acc.cost + (row.cost || 0),
      grossProfit: acc.grossProfit + (row.gross_profit || 0),
    }),
    { revenue: 0, units: 0, cost: 0, grossProfit: 0 }
  );

  return {
    totalRevenue: totals.revenue,
    totalUnits: totals.units,
    totalCost: totals.cost,
    grossProfit: totals.grossProfit,
    grossProfitPct: totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0,
    transactionCount: data.length,
    uniqueClasses: uniqueClasses.size,
    uniqueCustomers: uniqueCustomers.size,
  };
}

/**
 * Get available years and months for diversified filters
 */
export async function getDiversifiedFilterOptions(): Promise<{
  years: number[];
  months: number[];
  classes: string[];
  customers: Array<{ id: string; name: string }>;
}> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('diversified_sales')
    .select('year, month, class_name, customer_id, customer_name');

  if (error || !data) {
    return { years: [], months: [], classes: [], customers: [] };
  }

  const years = [...new Set(data.map(d => d.year))].sort((a, b) => b - a);
  const months = [...new Set(data.map(d => d.month))].sort((a, b) => a - b);
  const classes = [...new Set(data.map(d => d.class_name))].sort();

  const customerMap = new Map<string, string>();
  for (const d of data) {
    if (d.customer_id && !customerMap.has(d.customer_id)) {
      customerMap.set(d.customer_id, d.customer_name || 'Unknown');
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
