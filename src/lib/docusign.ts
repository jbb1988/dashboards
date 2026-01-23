/**
 * DocuSign API Client
 * Fetches envelope status and document information
 * Uses JWT Grant authentication
 */

import * as jose from 'jose';
import { getOAuthToken, saveOAuthToken } from './supabase';

const DOCUSIGN_BASE_URL = process.env.DOCUSIGN_BASE_URI || 'https://demo.docusign.net';
const DOCUSIGN_OAUTH_URL = DOCUSIGN_BASE_URL.includes('demo')
  ? 'https://account-d.docusign.com'
  : 'https://account.docusign.com';

// Try to get stored OAuth tokens (from Supabase database)
async function getStoredTokens(): Promise<{ access_token: string; refresh_token?: string; expires_at: number } | null> {
  try {
    const token = await getOAuthToken('docusign');
    if (token) {
      const expiresAt = new Date(token.expires_at).getTime();
      // Check if token is still valid (with 5 min buffer)
      if (expiresAt && Date.now() < expiresAt - 5 * 60 * 1000) {
        return {
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expires_at: expiresAt,
        };
      }
      // Token expired, try to refresh
      console.log('Stored token expired, will try to refresh or use JWT');
    }
  } catch (e) {
    console.log('No stored tokens found, will use JWT auth');
  }
  return null;
}

// Refresh OAuth token using refresh_token
async function refreshStoredToken(): Promise<string | null> {
  try {
    const storedToken = await getOAuthToken('docusign');
    if (!storedToken?.refresh_token) return null;

    const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
    const secretKey = process.env.DOCUSIGN_SECRET_KEY;

    if (!integrationKey || !secretKey) return null;

    const response = await fetch(`${DOCUSIGN_OAUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${integrationKey}:${secretKey}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: storedToken.refresh_token,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokens = await response.json();

    // Update stored tokens in Supabase
    await saveOAuthToken({
      provider: 'docusign',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || storedToken.refresh_token,
      expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
    });

    console.log('DocuSign token refreshed successfully');
    return tokens.access_token;
  } catch (e) {
    console.error('Error refreshing token:', e);
    return null;
  }
}

// Type definitions
export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  emailSubject: string;
  sentDateTime?: string;
  deliveredDateTime?: string;
  completedDateTime?: string;
  declinedDateTime?: string;
  voidedDateTime?: string;
  statusChangedDateTime?: string;
  documentsUri?: string;
  recipientsUri?: string;
  envelopeUri?: string;
  sender?: {
    userName: string;
    email: string;
  };
}

export interface DocuSignRecipient {
  recipientId: string;
  recipientType: string;
  email: string;
  name: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined';
  signedDateTime?: string;
  deliveredDateTime?: string;
  declinedDateTime?: string;
  declinedReason?: string;
}

export interface DocuSignEnvelopeDetail extends DocuSignEnvelope {
  recipients?: {
    signers: DocuSignRecipient[];
    carbonCopies?: DocuSignRecipient[];
  };
  documents?: {
    documentId: string;
    name: string;
    type: string;
    order: string;
  }[];
  customFields?: {
    textCustomFields?: {
      name: string;
      value: string;
    }[];
  };
}

interface DocuSignListResponse {
  envelopes?: DocuSignEnvelope[];
  resultSetSize: string;
  totalSetSize: string;
  startPosition: string;
  endPosition: string;
  nextUri?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// JWT token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get access token - tries stored OAuth tokens first, then falls back to JWT Grant
async function getAccessToken(): Promise<string> {
  // 1. Check for stored OAuth tokens first (from Supabase)
  const storedTokens = await getStoredTokens();
  if (storedTokens) {
    console.log('Using stored OAuth access token');
    return storedTokens.access_token;
  }

  // 2. Try to refresh stored token if we have a refresh_token
  const refreshedToken = await refreshStoredToken();
  if (refreshedToken) {
    return refreshedToken;
  }

  // 3. Check JWT token cache (with 5 minute buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.token;
  }

  // 4. Fall back to JWT Grant authentication
  const userId = process.env.DOCUSIGN_USER_ID;
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const privateKeyPem = process.env.DOCUSIGN_PRIVATE_KEY;

  if (!userId || !integrationKey || !privateKeyPem) {
    throw new Error(
      'DocuSign credentials not configured. Need DOCUSIGN_USER_ID, DOCUSIGN_INTEGRATION_KEY, and DOCUSIGN_PRIVATE_KEY'
    );
  }

  try {
    // Parse the private key - handle escaped newlines from env
    const formattedKey = privateKeyPem.replace(/\\n/g, '\n');

    // Import RSA private key (supports both PKCS#1 and PKCS#8 formats)
    const crypto = await import('crypto');
    const keyObject = crypto.createPrivateKey({
      key: formattedKey,
      format: 'pem',
    });

    // Convert to jose key
    const privateKey = await jose.importPKCS8(
      keyObject.export({ type: 'pkcs8', format: 'pem' }) as string,
      'RS256'
    );

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new jose.SignJWT({
      iss: integrationKey,
      sub: userId,
      aud: DOCUSIGN_OAUTH_URL.replace('https://', ''),
      iat: now,
      exp: now + 3600, // 1 hour
      scope: 'signature impersonation',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .sign(privateKey);

    // Exchange JWT for access token
    const tokenResponse = await fetch(`${DOCUSIGN_OAUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('DocuSign token error:', errorText);

      // Check if it's a consent error
      if (errorText.includes('consent_required')) {
        const consentUrl = `${DOCUSIGN_OAUTH_URL}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${integrationKey}&redirect_uri=http://localhost:3000/api/docusign/callback`;
        throw new Error(
          `DocuSign consent required. User must grant consent at: ${consentUrl}`
        );
      }

      throw new Error(`DocuSign OAuth error (${tokenResponse.status}): ${errorText}`);
    }

    const tokenData: TokenResponse = await tokenResponse.json();

    // Cache the token
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    };

    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting DocuSign access token:', error);
    throw error;
  }
}

// Helper to get auth headers
async function getHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

// Generic fetch helper
async function docusignFetch<T>(endpoint: string): Promise<T> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('DOCUSIGN_ACCOUNT_ID not configured');
  }

  const url = `${DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/${accountId}${endpoint}`;

  const response = await fetch(url, {
    headers: await getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign API error (${response.status}): ${error}`);
  }

  return response.json();
}

// List envelopes with optional filters
export async function listEnvelopes(options: {
  fromDate?: string;
  toDate?: string;
  status?: string;
  searchText?: string;
  count?: number;
} = {}): Promise<DocuSignEnvelope[]> {
  const params = new URLSearchParams();

  // Default to last 30 days if no date specified
  if (options.fromDate) {
    params.set('from_date', options.fromDate);
  } else {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    params.set('from_date', thirtyDaysAgo.toISOString());
  }

  if (options.toDate) {
    params.set('to_date', options.toDate);
  }

  if (options.status) {
    params.set('status', options.status);
  }

  if (options.searchText) {
    params.set('search_text', options.searchText);
  }

  params.set('count', String(options.count || 100));
  params.set('order', 'desc');
  params.set('order_by', 'status_changed');

  const result = await docusignFetch<DocuSignListResponse>(`/envelopes?${params}`);
  return result.envelopes || [];
}

// Get envelope details including recipients
export async function getEnvelope(envelopeId: string): Promise<DocuSignEnvelopeDetail> {
  const envelope = await docusignFetch<DocuSignEnvelopeDetail>(
    `/envelopes/${envelopeId}?include=recipients,documents,custom_fields`
  );
  return envelope;
}

// Get envelope recipients
export async function getEnvelopeRecipients(envelopeId: string): Promise<{
  signers: DocuSignRecipient[];
  carbonCopies?: DocuSignRecipient[];
}> {
  return docusignFetch(`/envelopes/${envelopeId}/recipients`);
}

// Get URL to view envelope in DocuSign web interface
export function getEnvelopeViewUrl(envelopeId: string): string {
  // DocuSign web interface URL format
  const baseUrl = DOCUSIGN_BASE_URL.includes('demo')
    ? 'https://appdemo.docusign.com'
    : 'https://app.docusign.com';
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  return `${baseUrl}/documents/details/${envelopeId}`;
}

// Get document download URL (returns the combined PDF)
export async function getDocumentDownload(envelopeId: string, documentId: string = 'combined'): Promise<Buffer> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('DOCUSIGN_ACCOUNT_ID not configured');
  }

  const url = `${DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/${documentId}`;
  const token = await getAccessToken();

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/pdf',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign document download error (${response.status}): ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Extract customer name and type from DocuSign envelope subject
export function extractCustomerFromSubject(subject: string): { customer: string; type: 'project' | 'mcc' } | null {
  // Project pattern: "Please DocuSign: [Customer Name] MARS Project Final Acceptance"
  const projectMatch = subject.match(/Please DocuSign:\s*(.+?)\s*MARS Project Final Acceptance/i);
  if (projectMatch) {
    return { customer: projectMatch[1].trim(), type: 'project' };
  }

  // MCC pattern: "Complete with Docusign: [Customer Name] MCC Work Order Acceptance"
  const mccMatch = subject.match(/Complete with Docusign:\s*(.+?)\s*MCC Work Order Acceptance/i);
  if (mccMatch) {
    return { customer: mccMatch[1].trim(), type: 'mcc' };
  }

  return null;
}

// Check if DocuSign is properly configured
export function isDocuSignConfigured(): boolean {
  return !!(
    process.env.DOCUSIGN_USER_ID &&
    process.env.DOCUSIGN_INTEGRATION_KEY &&
    process.env.DOCUSIGN_PRIVATE_KEY &&
    process.env.DOCUSIGN_ACCOUNT_ID
  );
}

// Helper to get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'signed':
      return '#22C55E'; // Green
    case 'sent':
    case 'delivered':
      return '#F59E0B'; // Yellow/Orange
    case 'created':
      return '#8B5CF6'; // Purple
    case 'declined':
    case 'voided':
      return '#EF4444'; // Red
    default:
      return '#64748B'; // Gray
  }
}

// Helper to get status label
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'signed':
      return 'Signed';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'created':
      return 'Draft';
    case 'declined':
      return 'Declined';
    case 'voided':
      return 'Voided';
    default:
      return status;
  }
}

// ============================================================================
// ENVELOPE CREATION FUNCTIONS (for e-signature integration)
// ============================================================================

export interface CreateEnvelopeOptions {
  emailSubject: string;
  emailBody?: string;
  webhookUrl?: string;
  carbonCopies?: Array<{ email: string; name: string }>;
  sendImmediately?: boolean;
}

export interface Signer {
  email: string;
  name: string;
  order?: number;
}

export interface DocumentInput {
  content: string; // Base64 encoded
  name: string;
  extension: string;
}

interface EnvelopeDefinition {
  emailSubject: string;
  emailBlurb?: string;
  documents: Array<{
    documentBase64: string;
    name: string;
    fileExtension: string;
    documentId: string;
  }>;
  recipients: {
    signers: Array<{
      email: string;
      name: string;
      recipientId: string;
      routingOrder: number;
      tabs?: {
        signHereTabs?: Array<{
          documentId: string;
          pageNumber: string;
          xPosition: string;
          yPosition: string;
        }>;
        dateSignedTabs?: Array<{
          documentId: string;
          pageNumber: string;
          xPosition: string;
          yPosition: string;
        }>;
      };
    }>;
    carbonCopies?: Array<{
      email: string;
      name: string;
      recipientId: string;
      routingOrder: number;
    }>;
  };
  status: 'created' | 'sent';
  eventNotification?: {
    url: string;
    loggingEnabled: boolean;
    requireAcknowledgment: boolean;
    envelopeEvents: Array<{ envelopeEventStatusCode: string }>;
    recipientEvents: Array<{ recipientEventStatusCode: string }>;
  };
}

export interface EnvelopeCreateResponse {
  envelopeId: string;
  status: string;
  statusDateTime: string;
  uri: string;
}

/**
 * Create and send an envelope for signing
 */
export async function createEnvelope(
  documents: DocumentInput[],
  signers: Signer[],
  options: CreateEnvelopeOptions
): Promise<EnvelopeCreateResponse> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('DOCUSIGN_ACCOUNT_ID not configured');
  }

  const envelopeDefinition: EnvelopeDefinition = {
    emailSubject: options.emailSubject,
    emailBlurb: options.emailBody,
    documents: documents.map((doc, index) => ({
      documentBase64: doc.content,
      name: doc.name,
      fileExtension: doc.extension,
      documentId: String(index + 1),
    })),
    recipients: {
      signers: signers.map((signer, index) => ({
        email: signer.email,
        name: signer.name,
        recipientId: String(index + 1),
        routingOrder: signer.order || index + 1,
        tabs: {
          signHereTabs: [
            {
              documentId: '1',
              pageNumber: '1',
              xPosition: '200',
              yPosition: '700',
            },
          ],
          dateSignedTabs: [
            {
              documentId: '1',
              pageNumber: '1',
              xPosition: '200',
              yPosition: '750',
            },
          ],
        },
      })),
      carbonCopies: options.carbonCopies?.map((cc, index) => ({
        email: cc.email,
        name: cc.name,
        recipientId: String(signers.length + index + 1),
        routingOrder: Math.max(...signers.map(s => s.order || 0)) + 1,
      })),
    },
    status: options.sendImmediately !== false ? 'sent' : 'created',
  };

  // Add webhook notification if URL provided
  if (options.webhookUrl) {
    envelopeDefinition.eventNotification = {
      url: options.webhookUrl,
      loggingEnabled: true,
      requireAcknowledgment: true,
      envelopeEvents: [
        { envelopeEventStatusCode: 'sent' },
        { envelopeEventStatusCode: 'delivered' },
        { envelopeEventStatusCode: 'completed' },
        { envelopeEventStatusCode: 'declined' },
        { envelopeEventStatusCode: 'voided' },
      ],
      recipientEvents: [
        { recipientEventStatusCode: 'Sent' },
        { recipientEventStatusCode: 'Delivered' },
        { recipientEventStatusCode: 'Completed' },
        { recipientEventStatusCode: 'Declined' },
      ],
    };
  }

  const url = `${DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/${accountId}/envelopes`;
  const token = await getAccessToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelopeDefinition),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign create envelope error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Void an envelope
 */
export async function voidEnvelope(envelopeId: string, reason: string): Promise<void> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('DOCUSIGN_ACCOUNT_ID not configured');
  }

  const url = `${DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
  const token = await getAccessToken();

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'voided',
      voidedReason: reason,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign void envelope error (${response.status}): ${error}`);
  }
}

/**
 * Resend envelope to recipients
 */
export async function resendEnvelope(envelopeId: string): Promise<void> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('DOCUSIGN_ACCOUNT_ID not configured');
  }

  const url = `${DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}?resend_envelope=true`;
  const token = await getAccessToken();

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign resend envelope error (${response.status}): ${error}`);
  }
}

/**
 * Verify webhook signature (HMAC-SHA256)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  hmacKey: string
): boolean {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', hmacKey);
  hmac.update(payload);
  const computedSignature = hmac.digest('base64');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

// ============================================================================
// STATS FUNCTIONS
// ============================================================================

// Calculate envelope stats
export function calculateEnvelopeStats(envelopes: DocuSignEnvelope[]): {
  total: number;
  completed: number;
  pending: number;
  declined: number;
  voided: number;
  avgDaysToSign: number;
} {
  const stats = {
    total: envelopes.length,
    completed: 0,
    pending: 0,
    declined: 0,
    voided: 0,
    avgDaysToSign: 0,
  };

  let totalDays = 0;
  let completedCount = 0;

  envelopes.forEach(env => {
    switch (env.status) {
      case 'completed':
      case 'signed':
        stats.completed++;
        // Calculate days to sign
        if (env.sentDateTime && env.completedDateTime) {
          const sent = new Date(env.sentDateTime);
          const completed = new Date(env.completedDateTime);
          const days = Math.ceil((completed.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24));
          totalDays += days;
          completedCount++;
        }
        break;
      case 'sent':
      case 'delivered':
      case 'created':
        stats.pending++;
        break;
      case 'declined':
        stats.declined++;
        break;
      case 'voided':
        stats.voided++;
        break;
    }
  });

  if (completedCount > 0) {
    stats.avgDaysToSign = Math.round(totalDays / completedCount);
  }

  return stats;
}
