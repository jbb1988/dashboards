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
