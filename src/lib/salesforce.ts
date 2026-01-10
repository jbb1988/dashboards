/**
 * Salesforce API Integration
 * Uses OAuth 2.0 Web Server Flow for authentication
 */

import { getOAuthToken, saveOAuthToken, OAuthToken } from './supabase';

interface SalesforceAuthResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
  issued_at: string;
}

interface SalesforceOpportunity {
  Id: string;
  Name: string;
  AccountName: string;
  Amount: number;
  StageName: string;
  CloseDate: string;
  Probability: number;
  Type: string;
  OwnerId: string;
  OwnerName?: string;
  CreatedDate: string;
  LastModifiedDate: string;
  IsClosed: boolean;
  IsWon: boolean;
  DaysInStage?: number;
}

interface SalesforceQueryResponse {
  totalSize: number;
  done: boolean;
  records: any[];
}

// Cache for access token
let tokenCache: { token: string; instanceUrl: string; expiresAt: number } | null = null;

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  issued_at: number;
  expires_in: number;
}

/**
 * Load stored tokens from Supabase
 */
async function loadStoredTokens(): Promise<StoredTokens | null> {
  try {
    const token = await getOAuthToken('salesforce');
    if (token) {
      return {
        access_token: token.access_token,
        refresh_token: token.refresh_token || '',
        instance_url: (token as any).instance_url || '',
        issued_at: new Date(token.expires_at).getTime() - 7200000, // Approximate issued_at
        expires_in: 7200,
      };
    }
  } catch (err) {
    console.error('Error loading stored tokens:', err);
  }
  return null;
}

/**
 * Save tokens to Supabase
 */
async function saveTokens(tokens: StoredTokens): Promise<void> {
  try {
    await saveOAuthToken({
      provider: 'salesforce',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(tokens.issued_at + tokens.expires_in * 1000).toISOString(),
    });
  } catch (err) {
    console.error('Error saving tokens:', err);
  }
}

/**
 * Refresh the access token using stored refresh token
 */
async function refreshAccessToken(refreshToken: string, instanceUrl: string): Promise<string> {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';

  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token refresh failed:', error);
    throw new Error('REAUTH_REQUIRED');
  }

  const data = await response.json();

  // Update stored tokens in Supabase
  const storedTokens = await loadStoredTokens();
  if (storedTokens) {
    storedTokens.access_token = data.access_token;
    storedTokens.issued_at = Date.now();
    await saveTokens(storedTokens);
  }

  return data.access_token;
}

/**
 * Get Salesforce access token - uses OAuth Web Flow tokens
 */
export async function getSalesforceToken(): Promise<{ token: string; instanceUrl: string }> {
  // Check memory cache first
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return { token: tokenCache.token, instanceUrl: tokenCache.instanceUrl };
  }

  // Try to load stored tokens from Supabase
  const storedTokens = await loadStoredTokens();

  if (storedTokens) {
    // Check if token is still valid (with 5 min buffer)
    const tokenAge = Date.now() - storedTokens.issued_at;
    const expiresIn = (storedTokens.expires_in || 7200) * 1000;

    if (tokenAge < expiresIn - 300000) {
      // Token still valid
      tokenCache = {
        token: storedTokens.access_token,
        instanceUrl: storedTokens.instance_url,
        expiresAt: storedTokens.issued_at + expiresIn,
      };
      return { token: storedTokens.access_token, instanceUrl: storedTokens.instance_url };
    }

    // Token expired, try to refresh
    if (storedTokens.refresh_token) {
      try {
        const newToken = await refreshAccessToken(storedTokens.refresh_token, storedTokens.instance_url);
        tokenCache = {
          token: newToken,
          instanceUrl: storedTokens.instance_url,
          expiresAt: Date.now() + 7200000,
        };
        return { token: newToken, instanceUrl: storedTokens.instance_url };
      } catch (err) {
        if (err instanceof Error && err.message === 'REAUTH_REQUIRED') {
          throw new Error('Salesforce session expired. Please re-authenticate at /api/salesforce/auth');
        }
        throw err;
      }
    }
  }

  throw new Error('Salesforce not connected. Visit /api/salesforce/auth to connect.');
}

/**
 * Execute a SOQL query against Salesforce
 */
export async function salesforceQuery(soql: string): Promise<SalesforceQueryResponse> {
  const { token, instanceUrl } = await getSalesforceToken();

  const response = await fetch(
    `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Salesforce query error:', error);
    throw new Error(`Salesforce query failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all contract opportunities from Salesforce
 * Shows active pipeline - contracts being worked (not closed lost)
 */
export async function getContractOpportunities() {
  // Query active pipeline opportunities - contracts in progress
  // Using custom MARS fields for Award Date and Contract Date
  // Matches the Excel report criteria for active contracts
  const soql = `
    SELECT
      Id,
      Name,
      Account.Name,
      Amount,
      StageName,
      CloseDate,
      Probability,
      Type,
      Owner.Name,
      CreatedDate,
      LastModifiedDate,
      IsClosed,
      IsWon,
      LastStageChangeDate,
      Award_Date__c,
      Calculated_Award_Date__c,
      Contract_Date__c,
      Install_Date__c,
      X24_Budget__c,
      X24_Manual_Close_Probability__c
    FROM Opportunity
    WHERE IsClosed = false
      AND StageName != 'Closed Lost'
      AND CloseDate >= TODAY
      AND CloseDate <= NEXT_N_DAYS:365
      AND (NOT Name LIKE '%TEST%')
      AND (NOT Account.Name LIKE '%TEST%')
    ORDER BY CloseDate ASC
    LIMIT 200
  `;

  const result = await salesforceQuery(soql);

  // Transform to our contract format
  const contracts = result.records.map((opp: any) => {
    const closeDate = opp.CloseDate;
    const lastStageChange = opp.LastStageChangeDate || opp.LastModifiedDate;
    // Use Award_Date__c first, fall back to Calculated_Award_Date__c
    const awardDate = opp.Award_Date__c || opp.Calculated_Award_Date__c || null;
    // Contract_Date__c is same as CloseDate per user
    const contractDate = opp.Contract_Date__c || opp.CloseDate || null;
    // Install date from custom field
    const installDate = opp.Install_Date__c || null;
    // Budget/Forecast flag and Manual Close Probability
    const budgeted = opp.X24_Budget__c || false;
    // Manual Close Probability - Salesforce returns as whole number (9400 for 94%), normalize to 0-100
    const rawProb = opp.X24_Manual_Close_Probability__c;
    const manualCloseProbability = rawProb != null
      ? (rawProb > 100 ? rawProb / 100 : rawProb)
      : null;

    // Calculate days in stage
    const daysInStage = lastStageChange
      ? Math.floor((Date.now() - new Date(lastStageChange).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Calculate days until deadline
    const daysUntilDeadline = closeDate
      ? Math.floor((new Date(closeDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    // Map Salesforce stage to our status
    const status = mapSalesforceStage(opp.StageName);

    // Extract raw sales stage (S1, S2, R1, etc.) from StageName
    const salesStageMatch = opp.StageName?.match(/^[SR]\d/);
    const salesStage = salesStageMatch ? salesStageMatch[0] : opp.StageName;

    return {
      id: opp.Id,
      name: opp.Account?.Name || opp.Name,
      opportunityName: opp.Name,
      value: opp.Amount || 0,
      status: status,
      statusGroup: getStatusGroup(status),
      salesStage: salesStage, // Raw Salesforce stage (S1, S2, R1, etc.)
      contractType: [opp.Type || 'Unknown'],
      daysInStage,
      daysUntilDeadline,
      closeDate,
      awardDate,
      contractDate,
      installDate,
      statusChangeDate: lastStageChange,
      progress: opp.Probability || 0,
      isOverdue: daysUntilDeadline < 0,
      nextTask: '',
      salesRep: opp.Owner?.Name || 'Unassigned',
      probability: opp.Probability || 0,
      budgeted,
      manualCloseProbability,
    };
  });

  return contracts;
}

/**
 * Map Salesforce stage names to our dashboard status
 */
function mapSalesforceStage(stageName: string): string {
  const stageMap: Record<string, string> = {
    // Common Salesforce stages
    'Prospecting': 'Discussions Not Started',
    'Qualification': 'Discussions Not Started',
    'Needs Analysis': 'Initial Agreement Development',
    'Value Proposition': 'Initial Agreement Development',
    'Id. Decision Makers': 'Initial Agreement Development',
    'Perception Analysis': 'Review & Redlines',
    'Proposal/Price Quote': 'Review & Redlines',
    'Negotiation/Review': 'Review & Redlines',
    'Closed Won': 'PO Received',
    'Closed Lost': 'Closed Lost',
    // Custom MARS S-stages (Sales pipeline)
    'S1': 'Discussions Not Started',
    'S2': 'Initial Agreement Development',
    'S3': 'Review & Redlines',
    'S4': 'Approval & Signature',
    'S5': 'Agreement Submission',
    // Custom MARS R-stages (Renewal pipeline)
    'R1': 'Discussions Not Started',
    'R2': 'Initial Agreement Development',
    'R3': 'Review & Redlines',
    'R4': 'Approval & Signature',
    'R5': 'PO Received',
  };

  // Check for partial matches (e.g., "R5- (87%) 90 Day..." or "S2 (Propose Solution)")
  for (const [key, value] of Object.entries(stageMap)) {
    if (stageName.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return stageName;
}

/**
 * Get status group color based on status
 */
function getStatusGroup(status: string): string {
  const colorMap: Record<string, string> = {
    'Discussions Not Started': 'gray',
    'Initial Agreement Development': 'blue',
    'Review & Redlines': 'orange',
    'Approval & Signature': 'green',
    'PO Received': 'green',
    'Closed Lost': 'red',
  };
  return colorMap[status] || 'default';
}

/**
 * Get aggregated contracts (grouped by account)
 */
export async function getAggregatedContracts() {
  const opportunities = await getContractOpportunities();

  // Group by account
  const accountMap = new Map<string, any>();

  for (const opp of opportunities) {
    const accountName = opp.name;

    if (accountMap.has(accountName)) {
      const existing = accountMap.get(accountName);
      existing.value += opp.value;
      existing.opportunities.push(opp);
      // Use the closest close date
      if (opp.closeDate && (!existing.closeDate || new Date(opp.closeDate) < new Date(existing.closeDate))) {
        existing.closeDate = opp.closeDate;
        existing.daysUntilDeadline = opp.daysUntilDeadline;
      }
      // Use highest progress status
      if (opp.progress > existing.progress) {
        existing.status = opp.status;
        existing.progress = opp.progress;
      }
    } else {
      accountMap.set(accountName, {
        ...opp,
        opportunities: [opp],
      });
    }
  }

  return Array.from(accountMap.values());
}

// ============================================
// BIDIRECTIONAL SYNC - Write Operations
// ============================================

export interface OpportunityUpdateFields {
  StageName?: string;
  Amount?: number;
  CloseDate?: string; // YYYY-MM-DD format
  Award_Date__c?: string;
  Contract_Date__c?: string;
  Install_Date__c?: string;
  X24_Budget__c?: boolean;
  X24_Manual_Close_Probability__c?: number;
  Probability?: number;
}

export interface SalesforceUpdateResult {
  success: boolean;
  id: string;
  errors?: string[];
}

/**
 * Update an existing Opportunity in Salesforce
 * Requires explicit user action - does not auto-sync
 */
export async function updateOpportunity(
  opportunityId: string,
  fields: OpportunityUpdateFields
): Promise<SalesforceUpdateResult> {
  const { token, instanceUrl } = await getSalesforceToken();

  const response = await fetch(
    `${instanceUrl}/services/data/v59.0/sobjects/Opportunity/${opportunityId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fields),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errors: string[] = [];
    try {
      const errorJson = JSON.parse(errorText);
      errors = Array.isArray(errorJson)
        ? errorJson.map((e: any) => e.message || e.errorCode)
        : [errorJson.message || errorText];
    } catch {
      errors = [errorText];
    }
    console.error('Salesforce update error:', errors);
    return { success: false, id: opportunityId, errors };
  }

  // Salesforce returns 204 No Content on successful PATCH
  return { success: true, id: opportunityId };
}

/**
 * Map dashboard status back to Salesforce stage
 */
export function mapStatusToSalesforceStage(status: string, currentStage?: string): string {
  // If we have the current stage from Salesforce, try to preserve the S/R prefix
  const isRenewal = currentStage?.startsWith('R');

  const statusToStageMap: Record<string, { sales: string; renewal: string }> = {
    'Discussions Not Started': { sales: 'S1', renewal: 'R1' },
    'Initial Agreement Development': { sales: 'S2', renewal: 'R2' },
    'Review & Redlines': { sales: 'S3', renewal: 'R3' },
    'Approval & Signature': { sales: 'S4', renewal: 'R4' },
    'Agreement Submission': { sales: 'S5', renewal: 'R4' },
    'PO Received': { sales: 'S5', renewal: 'R5' },
  };

  const mapping = statusToStageMap[status];
  if (mapping) {
    return isRenewal ? mapping.renewal : mapping.sales;
  }

  return currentStage || status;
}

/**
 * Add a note/comment to an Opportunity in Salesforce
 * Creates a ContentNote linked to the Opportunity
 */
export async function addOpportunityNote(
  opportunityId: string,
  title: string,
  content: string
): Promise<SalesforceUpdateResult> {
  const { token, instanceUrl } = await getSalesforceToken();

  // First, create the ContentNote
  const noteResponse = await fetch(
    `${instanceUrl}/services/data/v59.0/sobjects/ContentNote`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Title: title,
        Content: Buffer.from(content).toString('base64'),
      }),
    }
  );

  if (!noteResponse.ok) {
    const errorText = await noteResponse.text();
    console.error('Salesforce note creation error:', errorText);
    return { success: false, id: opportunityId, errors: [errorText] };
  }

  const noteResult = await noteResponse.json();
  const contentNoteId = noteResult.id;

  // Link the note to the Opportunity via ContentDocumentLink
  const linkResponse = await fetch(
    `${instanceUrl}/services/data/v59.0/sobjects/ContentDocumentLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ContentDocumentId: contentNoteId,
        LinkedEntityId: opportunityId,
        ShareType: 'V', // Viewer permission
        Visibility: 'AllUsers',
      }),
    }
  );

  if (!linkResponse.ok) {
    const errorText = await linkResponse.text();
    console.error('Salesforce note link error:', errorText);
    return { success: false, id: opportunityId, errors: [errorText] };
  }

  return { success: true, id: contentNoteId };
}

/**
 * Add a Task to an Opportunity in Salesforce
 * Better for actionable items than notes
 */
export async function addOpportunityTask(
  opportunityId: string,
  subject: string,
  description: string,
  dueDate?: string,
  priority: 'High' | 'Normal' | 'Low' = 'Normal'
): Promise<SalesforceUpdateResult> {
  const { token, instanceUrl } = await getSalesforceToken();

  const taskData: Record<string, any> = {
    Subject: subject,
    Description: description,
    WhatId: opportunityId, // Links task to the Opportunity
    Priority: priority,
    Status: 'Not Started',
  };

  if (dueDate) {
    taskData.ActivityDate = dueDate;
  }

  const response = await fetch(
    `${instanceUrl}/services/data/v59.0/sobjects/Task`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Salesforce task creation error:', errorText);
    return { success: false, id: opportunityId, errors: [errorText] };
  }

  const result = await response.json();
  return { success: true, id: result.id };
}

/**
 * Batch update multiple opportunities
 * Uses Salesforce Composite API for efficiency
 */
export async function batchUpdateOpportunities(
  updates: Array<{ id: string; fields: OpportunityUpdateFields }>
): Promise<SalesforceUpdateResult[]> {
  if (updates.length === 0) return [];

  // Salesforce composite API limit is 25 subrequests
  if (updates.length > 25) {
    const results: SalesforceUpdateResult[] = [];
    for (let i = 0; i < updates.length; i += 25) {
      const batch = updates.slice(i, i + 25);
      const batchResults = await batchUpdateOpportunities(batch);
      results.push(...batchResults);
    }
    return results;
  }

  const { token, instanceUrl } = await getSalesforceToken();

  const compositeRequest = {
    allOrNone: false, // Continue even if some fail
    compositeRequest: updates.map((update, index) => ({
      method: 'PATCH',
      url: `/services/data/v59.0/sobjects/Opportunity/${update.id}`,
      referenceId: `update_${index}`,
      body: update.fields,
    })),
  };

  const response = await fetch(
    `${instanceUrl}/services/data/v59.0/composite`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(compositeRequest),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Salesforce batch update error:', errorText);
    return updates.map(u => ({ success: false, id: u.id, errors: [errorText] }));
  }

  const result = await response.json();

  return result.compositeResponse.map((res: any, index: number) => ({
    success: res.httpStatusCode >= 200 && res.httpStatusCode < 300,
    id: updates[index].id,
    errors: res.httpStatusCode >= 400 ? [JSON.stringify(res.body)] : undefined,
  }));
}
