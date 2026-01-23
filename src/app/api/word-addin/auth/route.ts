import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mars-word-addin-secret';

// Verify token for Word add-in
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string; name: string };

    return NextResponse.json({
      user: {
        email: decoded.email,
        name: decoded.name,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

// Exchange auth code for token (OAuth callback)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, redirect_uri } = body;

    if (!code) {
      return NextResponse.json({ error: 'Authorization code required' }, { status: 400 });
    }

    // Exchange code for Microsoft access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID || '',
        client_secret: process.env.AZURE_AD_CLIENT_SECRET || '',
        code,
        redirect_uri: redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL}/word-addin/auth-callback.html`,
        grant_type: 'authorization_code',
        scope: 'openid profile email',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const tokens = await tokenResponse.json();

    // Get user info from Microsoft Graph
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      return NextResponse.json({ error: 'Failed to get user info' }, { status: 401 });
    }

    const msUser = await userResponse.json();

    // Check if user exists in our system
    const admin = getSupabaseAdmin();
    const { data: existingUser } = await admin
      .from('users')
      .select('*')
      .eq('email', msUser.mail || msUser.userPrincipalName)
      .single();

    if (!existingUser) {
      // Create user in our system
      await admin.from('users').insert({
        email: msUser.mail || msUser.userPrincipalName,
        name: msUser.displayName,
        provider: 'microsoft',
        provider_id: msUser.id,
      });
    }

    // Generate MARS JWT token
    const marsToken = jwt.sign(
      {
        email: msUser.mail || msUser.userPrincipalName,
        name: msUser.displayName,
        ms_id: msUser.id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      token: marsToken,
      user: {
        email: msUser.mail || msUser.userPrincipalName,
        name: msUser.displayName,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
