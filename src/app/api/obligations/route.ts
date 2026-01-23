import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: List obligations with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // Optional filters
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const assignedTo = searchParams.get('assigned_to');
    const contractId = searchParams.get('contract_id');
    const upcoming = searchParams.get('upcoming'); // days
    const overdue = searchParams.get('overdue') === 'true';

    let query = admin
      .from('contract_obligations')
      .select('*')
      .order('due_date', { ascending: true });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('obligation_type', type);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (contractId) {
      query = query.eq('contract_id', contractId);
    }
    if (upcoming) {
      const days = parseInt(upcoming);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      query = query
        .gte('due_date', new Date().toISOString().split('T')[0])
        .lte('due_date', futureDate.toISOString().split('T')[0])
        .in('status', ['pending', 'upcoming', 'due']);
    }
    if (overdue) {
      query = query.eq('status', 'overdue');
    }

    const { data: obligations, error } = await query;

    if (error) {
      console.error('Failed to fetch obligations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch obligations' },
        { status: 500 }
      );
    }

    // Get summary stats
    const { data: stats } = await admin
      .from('contract_obligations')
      .select('status')
      .in('status', ['pending', 'upcoming', 'due', 'overdue']);

    const summary = {
      pending: 0,
      upcoming: 0,
      due: 0,
      overdue: 0,
    };

    stats?.forEach(s => {
      if (s.status in summary) {
        summary[s.status as keyof typeof summary]++;
      }
    });

    return NextResponse.json({
      obligations: obligations || [],
      summary,
    });
  } catch (error) {
    console.error('Error fetching obligations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new obligation
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      contract_id,
      contract_review_id,
      contract_name,
      counterparty_name,
      title,
      description,
      obligation_type,
      due_date,
      recurrence,
      recurrence_interval,
      recurrence_end_date,
      reminder_days,
      assigned_to,
      assigned_team,
      watchers,
      priority,
      financial_impact,
      ai_extracted,
      ai_confidence,
      source_text,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'Obligation title is required' },
        { status: 400 }
      );
    }
    if (!contract_name?.trim()) {
      return NextResponse.json(
        { error: 'Contract name is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: obligation, error } = await admin
      .from('contract_obligations')
      .insert({
        contract_id: contract_id || null,
        contract_review_id: contract_review_id || null,
        contract_name: contract_name.trim(),
        counterparty_name: counterparty_name?.trim() || null,
        title: title.trim(),
        description: description?.trim() || null,
        obligation_type: obligation_type || 'other',
        due_date: due_date || null,
        recurrence: recurrence || null,
        recurrence_interval: recurrence_interval || null,
        recurrence_end_date: recurrence_end_date || null,
        reminder_days: reminder_days || [30, 7, 1],
        assigned_to: assigned_to || null,
        assigned_team: assigned_team || null,
        watchers: watchers || [],
        priority: priority || 'medium',
        financial_impact: financial_impact || null,
        ai_extracted: ai_extracted || false,
        ai_confidence: ai_confidence || null,
        source_text: source_text || null,
        extraction_review_status: ai_extracted ? 'pending_review' : 'confirmed',
        created_by: user.email || 'unknown',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create obligation:', error);
      return NextResponse.json(
        { error: 'Failed to create obligation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      obligation,
    });
  } catch (error) {
    console.error('Error creating obligation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update an obligation
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Obligation ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Handle completion
    if (updates.status === 'completed') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = user.email;

      // Also create completion record
      await admin.from('obligation_completions').insert({
        obligation_id: id,
        completion_date: new Date().toISOString().split('T')[0],
        completed_by: user.email || 'unknown',
        notes: updates.completion_notes || null,
      });
    }

    const { data: obligation, error } = await admin
      .from('contract_obligations')
      .update({
        ...updates,
        updated_by: user.email || 'unknown',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update obligation:', error);
      return NextResponse.json(
        { error: 'Failed to update obligation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      obligation,
    });
  } catch (error) {
    console.error('Error updating obligation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
