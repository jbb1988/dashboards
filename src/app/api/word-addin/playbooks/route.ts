import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mars-word-addin-secret';

// Verify token helper (allows test mode)
function verifyToken(request: NextRequest): { email: string; name: string } | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return null;

  // Allow test mode token
  if (token === 'test-mode-token') {
    return { email: 'test@mars.com', name: 'Test User' };
  }

  try {
    return jwt.verify(token, JWT_SECRET) as { email: string; name: string };
  } catch {
    return null;
  }
}

// GET: Get playbooks for Word add-in
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const playbookId = searchParams.get('id');

    // If specific playbook requested, return it with content
    if (playbookId) {
      const { data: playbook, error: playbookError } = await admin
        .from('playbooks')
        .select('*')
        .eq('id', playbookId)
        .single();

      if (playbookError || !playbook) {
        return NextResponse.json(
          { error: 'Playbook not found' },
          { status: 404 }
        );
      }

      // Get current version content
      const { data: version } = await admin
        .from('playbook_versions')
        .select('content')
        .eq('playbook_id', playbookId)
        .eq('version', playbook.current_version)
        .single();

      return NextResponse.json({
        playbook: {
          id: playbook.id,
          name: playbook.name,
          description: playbook.description,
          content: version?.content || '',
          current_version: playbook.current_version,
        },
      });
    }

    // Otherwise, return list of all playbooks
    const { data: playbooks, error } = await admin
      .from('playbooks')
      .select('id, name, description, current_version, updated_at')
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to fetch playbooks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch playbooks' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      playbooks: playbooks || [],
    });
  } catch (error) {
    console.error('Error fetching playbooks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
