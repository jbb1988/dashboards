import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID!;
const REDIRECT_URI = 'http://localhost:3000/api/salesforce/callback';

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
 * Initiates OAuth 2.0 Web Server Flow with PKCE
 * Redirects user to Salesforce login page
 */
export async function GET() {
  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';

  // Generate PKCE values
  const { codeVerifier, codeChallenge } = generatePKCE();

  // Store code verifier in cookie for callback
  const cookieStore = await cookies();
  cookieStore.set('sf_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: false, // localhost
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const authUrl = new URL(`${loginUrl}/services/oauth2/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', SALESFORCE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'api refresh_token');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(authUrl.toString());
}
