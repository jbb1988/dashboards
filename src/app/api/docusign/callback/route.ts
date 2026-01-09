import { NextRequest, NextResponse } from 'next/server';
import { saveOAuthToken } from '@/lib/supabase';

const DOCUSIGN_OAUTH_URL = 'https://account.docusign.com';

/**
 * Get the base URL for redirects
 */
function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://mars-dashboards.vercel.app';
  }
  return 'http://localhost:3000';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/docusign/callback`;

  console.log('[DocuSign Callback] Starting OAuth callback');
  console.log('[DocuSign Callback] Redirect URI:', redirectUri);

  if (error) {
    console.error('[DocuSign Callback] OAuth error:', error);
    return NextResponse.redirect(`${baseUrl}/contracts-dashboard?docusign_error=${error}`);
  }

  if (!code) {
    console.error('[DocuSign Callback] No authorization code');
    return NextResponse.redirect(`${baseUrl}/contracts-dashboard?docusign_error=no_code`);
  }

  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const secretKey = process.env.DOCUSIGN_SECRET_KEY;

  if (!integrationKey || !secretKey) {
    console.error('[DocuSign Callback] Missing config');
    return NextResponse.redirect(`${baseUrl}/contracts-dashboard?docusign_error=missing_config`);
  }

  try {
    // Exchange code for tokens
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: integrationKey,
      client_secret: secretKey,
    });

    console.log('[DocuSign Callback] Exchanging code for tokens...');

    const tokenResponse = await fetch(`${DOCUSIGN_OAUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[DocuSign Callback] Token exchange error:', errorText);
      return NextResponse.redirect(`${baseUrl}/contracts-dashboard?docusign_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log('[DocuSign Callback] Tokens received');

    // Save tokens to Supabase
    console.log('[DocuSign Callback] Saving tokens to Supabase...');
    const saved = await saveOAuthToken({
      provider: 'docusign',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
    });

    if (!saved) {
      console.error('[DocuSign Callback] Failed to save tokens to Supabase');
      return NextResponse.redirect(`${baseUrl}/contracts-dashboard?docusign_error=save_failed`);
    }

    console.log('[DocuSign Callback] SUCCESS - DocuSign connected!');

    // Redirect to dashboard with success
    return NextResponse.redirect(`${baseUrl}/contracts-dashboard?docusign_success=true`);
  } catch (error) {
    console.error('[DocuSign Callback] Exception:', error);
    return NextResponse.redirect(`${baseUrl}/contracts-dashboard?docusign_error=unknown`);
  }
}
