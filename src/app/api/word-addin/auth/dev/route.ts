import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mars-word-addin-secret';

// CORS headers for Word add-in
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Development authentication endpoint for Word add-in.
 * Allows sign-in with just an email address (no OAuth required).
 * This is useful for testing and development when Azure AD isn't configured.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Extract name from email (part before @)
    const name = normalizedEmail.split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Generate MARS JWT token
    const token = jwt.sign(
      {
        email: normalizedEmail,
        name: name,
        dev_auth: true, // Flag to indicate this was dev auth
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Word Add-in Dev Auth] User signed in: ${normalizedEmail}`);

    return NextResponse.json({
      token,
      user: {
        email: normalizedEmail,
        name: name,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Dev auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}
