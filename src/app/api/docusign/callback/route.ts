import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';

const DOCUSIGN_OAUTH_URL = 'https://account.docusign.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('DocuSign OAuth error:', error);
    return NextResponse.redirect(new URL(`/contracts-dashboard?docusign_error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/contracts-dashboard?docusign_error=no_code', request.url));
  }

  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const secretKey = process.env.DOCUSIGN_SECRET_KEY;
  const redirectUri = 'http://localhost:3000/api/docusign/callback';

  if (!integrationKey || !secretKey) {
    return NextResponse.redirect(new URL('/contracts-dashboard?docusign_error=missing_config', request.url));
  }

  try {
    // Exchange code for tokens - try with credentials in body
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: integrationKey,
      client_secret: secretKey,
    });

    console.log('Token exchange request to:', `${DOCUSIGN_OAUTH_URL}/oauth/token`);
    console.log('With client_id:', integrationKey);
    console.log('With redirect_uri:', redirectUri);

    const tokenResponse = await fetch(`${DOCUSIGN_OAUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      return NextResponse.redirect(new URL(`/contracts-dashboard?docusign_error=token_exchange_failed`, request.url));
    }

    const tokens = await tokenResponse.json();

    // Store tokens in a file (for local development)
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
      token_type: tokens.token_type,
    };

    const tokenPath = join(process.cwd(), '.docusign-tokens.json');
    writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));

    console.log('DocuSign tokens obtained and stored successfully!');

    // Redirect to dashboard with success
    return NextResponse.redirect(new URL('/contracts-dashboard?docusign_success=true', request.url));
  } catch (error) {
    console.error('DocuSign callback error:', error);
    return NextResponse.redirect(new URL('/contracts-dashboard?docusign_error=unknown', request.url));
  }
}
