import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

// Type for saved insights
interface SavedInsight {
  id?: string;
  recommendations: unknown[];
  executive_summary: string;
  generated_at: string;
  filters?: {
    years?: number[];
  };
  created_at?: string;
  updated_at?: string;
}

// GET - Load the most recent saved insights
export async function GET() {
  try {
    // First, check if the table exists by trying to query it
    const { data, error } = await supabase
      .from('diversified_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If table doesn't exist or no data, return empty
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return NextResponse.json({
          insights: null,
          message: 'No saved insights found',
        });
      }
      throw error;
    }

    return NextResponse.json({
      insights: data,
      message: 'Insights loaded successfully',
    });
  } catch (error) {
    console.error('Error loading saved insights:', error);
    return NextResponse.json(
      { error: 'Failed to load saved insights', insights: null },
      { status: 500 }
    );
  }
}

// POST - Save new insights (upsert - replace existing)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recommendations, executive_summary, generated_at, filters } = body as SavedInsight;

    if (!recommendations || !executive_summary) {
      return NextResponse.json(
        { error: 'Missing required fields: recommendations and executive_summary' },
        { status: 400 }
      );
    }

    // First, try to create the table if it doesn't exist
    // This is a one-time operation
    await ensureTableExists();

    // Delete any existing insights (we only keep the latest)
    await supabase.from('diversified_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert new insights
    const { data, error } = await supabase
      .from('diversified_insights')
      .insert({
        recommendations,
        executive_summary,
        generated_at,
        filters: filters || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      insights: data,
      message: 'Insights saved successfully',
    });
  } catch (error) {
    console.error('Error saving insights:', error);
    return NextResponse.json(
      { error: 'Failed to save insights' },
      { status: 500 }
    );
  }
}

// DELETE - Clear saved insights
export async function DELETE() {
  try {
    const { error } = await supabase
      .from('diversified_insights')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: 'Insights cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing insights:', error);
    return NextResponse.json(
      { error: 'Failed to clear insights' },
      { status: 500 }
    );
  }
}

// Helper function to ensure the table exists
async function ensureTableExists() {
  // Try to create the table using raw SQL via RPC
  // This will fail silently if table already exists
  try {
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS diversified_insights (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recommendations JSONB NOT NULL,
          executive_summary TEXT NOT NULL,
          generated_at TIMESTAMPTZ,
          filters JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
  } catch {
    // Table might already exist or RPC not available - that's fine
    // We'll handle errors when we try to insert
  }
}
