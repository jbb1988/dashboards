import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { saveOAuthToken } from '@/lib/supabase';

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID!;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET!;

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
 * OAuth callback - exchanges authorization code for tokens
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/salesforce/callback`;

  console.log('[SF Callback] Starting OAuth callback');
  console.log('[SF Callback] Code received:', code ? 'yes' : 'no');
  console.log('[SF Callback] Redirect URI:', redirectUri);

  if (error) {
    console.error('[SF Callback] OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/contracts-dashboard?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    console.error('[SF Callback] No authorization code');
    return NextResponse.redirect(
      `${baseUrl}/contracts-dashboard?error=No_authorization_code_received`
    );
  }

  try {
    const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
    console.log('[SF Callback] Login URL:', loginUrl);

    // Get code verifier from cookie (PKCE)
    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get('sf_code_verifier')?.value;

    console.log('[SF Callback] Code verifier found:', codeVerifier ? 'yes' : 'no');

    if (!codeVerifier) {
      console.error('[SF Callback] Missing code verifier cookie');
      return NextResponse.redirect(
        `${baseUrl}/contracts-dashboard?error=Missing_code_verifier`
      );
    }

    // Check if env vars are set
    console.log('[SF Callback] Client ID set:', SALESFORCE_CLIENT_ID ? 'yes' : 'no');
    console.log('[SF Callback] Client Secret set:', SALESFORCE_CLIENT_SECRET ? 'yes' : 'no');

    // Exchange code for tokens (with PKCE code_verifier)
    console.log('[SF Callback] Exchanging code for tokens...');
    const tokenResponse = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: SALESFORCE_CLIENT_ID,
        client_secret: SALESFORCE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      }).toString(),
    });

    console.log('[SF Callback] Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[SF Callback] Token exchange failed:', errorText);
      return NextResponse.redirect(
        `${baseUrl}/contracts-dashboard?error=Token_exchange_failed_${tokenResponse.status}`
      );
    }

    const tokens = await tokenResponse.json();
    console.log('[SF Callback] Tokens received, instance_url:', tokens.instance_url);
    console.log('[SF Callback] Has access_token:', tokens.access_token ? 'yes' : 'no');
    console.log('[SF Callback] Has refresh_token:', tokens.refresh_token ? 'yes' : 'no');

    // Save tokens to Supabase
    console.log('[SF Callback] Saving tokens to Supabase...');
    const saved = await saveOAuthToken({
      provider: 'salesforce',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      instance_url: tokens.instance_url,
      expires_at: new Date(Date.now() + 7200000).toISOString(), // 2 hours
    });

    console.log('[SF Callback] Save result:', saved);

    if (!saved) {
      console.error('[SF Callback] Failed to save tokens to Supabase');
      return NextResponse.redirect(
        `${baseUrl}/contracts-dashboard?error=Failed_to_save_tokens`
      );
    }

    console.log('[SF Callback] SUCCESS - Salesforce connected!');

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      `${baseUrl}/contracts-dashboard?salesforce=connected`
    );
  } catch (err) {
    console.error('[SF Callback] Exception:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      `${baseUrl}/contracts-dashboard?error=${encodeURIComponent(errorMsg)}`
    );
  }
}
