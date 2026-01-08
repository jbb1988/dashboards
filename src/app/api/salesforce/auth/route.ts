import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID!;

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE() {
  // Generate random code verifier (43-128 characters)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');

  // Generate code challenge using SHA-256
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * Get the base URL for redirects
 */
function getBaseUrl(): string {
  // Hardcoded for production - update if domain changes
  if (process.env.NODE_ENV === 'production') {
    return 'https://mars-dashboards.vercel.app';
  }
  return 'http://localhost:3000';
}

/**
 * Initiates OAuth 2.0 Web Server Flow with PKCE
 * Redirects user to Salesforce login page
 */
export async function GET() {
  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/salesforce/callback`;

  // Generate PKCE values
  const { codeVerifier, codeChallenge } = generatePKCE();

  // Store code verifier in cookie for callback
  const isProduction = !baseUrl.includes('localhost');
  const cookieStore = await cookies();
  cookieStore.set('sf_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const authUrl = new URL(`${loginUrl}/services/oauth2/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', SALESFORCE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'api refresh_token');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(authUrl.toString());
}
