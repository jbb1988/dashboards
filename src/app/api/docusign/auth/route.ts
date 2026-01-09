import { NextResponse } from 'next/server';

const DOCUSIGN_OAUTH_URL = process.env.DOCUSIGN_BASE_URI?.includes('demo')
  ? 'https://account-d.docusign.com'
  : 'https://account.docusign.com';

/**
 * Get the base URL for redirects
 */
function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://mars-dashboards.vercel.app';
  }
  return 'http://localhost:3000';
}

/**
 * Initiate DocuSign OAuth flow
 */
export async function GET() {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;

  if (!integrationKey) {
    return NextResponse.json({
      error: 'DocuSign not configured',
      message: 'DOCUSIGN_INTEGRATION_KEY not set',
    }, { status: 503 });
  }

  const baseUrl = getBaseUrl();
  const redirectUri = encodeURIComponent(`${baseUrl}/api/docusign/callback`);
  const scope = encodeURIComponent('signature impersonation');

  const authUrl = `${DOCUSIGN_OAUTH_URL}/oauth/auth?response_type=code&scope=${scope}&client_id=${integrationKey}&redirect_uri=${redirectUri}`;

  console.log('[DocuSign Auth] Redirecting to:', authUrl);

  return NextResponse.redirect(authUrl);
}
