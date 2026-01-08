import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as fs from 'fs';
import * as path from 'path';

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID!;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET!;
const REDIRECT_URI = 'http://localhost:3000/api/salesforce/callback';

/**
 * OAuth callback - exchanges authorization code for tokens
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      `http://localhost:3000/contracts-dashboard?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      'http://localhost:3000/contracts-dashboard?error=No authorization code received'
    );
  }

  try {
    const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';

    // Get code verifier from cookie (PKCE)
    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get('sf_code_verifier')?.value;

    if (!codeVerifier) {
      console.error('Missing code verifier cookie');
      return NextResponse.redirect(
        'http://localhost:3000/contracts-dashboard?error=Missing code verifier - please try again'
      );
    }

    // Exchange code for tokens (with PKCE code_verifier)
    const tokenResponse = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: SALESFORCE_CLIENT_ID,
        client_secret: SALESFORCE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(
        `http://localhost:3000/contracts-dashboard?error=${encodeURIComponent('Token exchange failed')}`
      );
    }

    const tokens = await tokenResponse.json();

    // Store tokens in a local file (for development)
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      instance_url: tokens.instance_url,
      issued_at: Date.now(),
      expires_in: 7200, // 2 hours typically
    };

    // Save to .salesforce-tokens.json
    const tokenPath = path.join(process.cwd(), '.salesforce-tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));

    console.log('Salesforce tokens saved successfully!');
    console.log('Instance URL:', tokens.instance_url);

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      'http://localhost:3000/contracts-dashboard?salesforce=connected'
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      `http://localhost:3000/contracts-dashboard?error=${encodeURIComponent('Authentication failed')}`
    );
  }
}
