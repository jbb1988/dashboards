import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mars-word-addin-secret';

// Verify token endpoint
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
      valid: true,
      user: {
        email: decoded.email,
        name: decoded.name,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token', valid: false }, { status: 401 });
  }
}
