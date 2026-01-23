import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: List all playbooks
export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    const { data: playbooks, error } = await admin
      .from('playbooks')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to fetch playbooks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch playbooks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ playbooks: playbooks || [] });
  } catch (error) {
    console.error('Error fetching playbooks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new playbook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, content, createdBy } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Playbook name is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Create the playbook
    const { data: playbook, error: playbookError } = await admin
      .from('playbooks')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        current_version: 1,
      })
      .select()
      .single();

    if (playbookError) {
      console.error('Failed to create playbook:', playbookError);
      return NextResponse.json(
        { error: 'Failed to create playbook' },
        { status: 500 }
      );
    }

    // Create initial version if content provided
    if (content?.trim()) {
      const { error: versionError } = await admin
        .from('playbook_versions')
        .insert({
          playbook_id: playbook.id,
          version: 1,
          content: content.trim(),
          change_notes: 'Initial version',
          created_by: createdBy || null,
        });

      if (versionError) {
        console.error('Failed to create initial version:', versionError);
        // Playbook created but version failed - still return success
      }
    }

    return NextResponse.json({
      success: true,
      playbook,
    });
  } catch (error) {
    console.error('Error creating playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
