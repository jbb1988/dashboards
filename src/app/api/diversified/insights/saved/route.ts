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

// GET - Load saved insights (most recent by default, or all for history)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const history = searchParams.get('history') === 'true';
    const id = searchParams.get('id');

    // If specific ID requested, return that one
    if (id) {
      const { data, error } = await supabase
        .from('diversified_insights')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return NextResponse.json({ insights: null, message: 'Insight not found' });
      }

      return NextResponse.json({ insights: data });
    }

    // If history requested, return all insights
    if (history) {
      const { data, error } = await supabase
        .from('diversified_insights')
        .select('id, generated_at, created_at, executive_summary')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return NextResponse.json({ history: [], message: 'No insights history' });
        }
        throw error;
      }

      return NextResponse.json({
        history: data || [],
        message: 'History loaded successfully',
      });
    }

    // Default: return most recent
    const { data, error } = await supabase
      .from('diversified_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
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

// POST - Save new insights (keeps history - doesn't delete old ones)
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

    // Insert new insights (keeping history)
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

    // Optionally cleanup old insights (keep last 20)
    const { data: allInsights } = await supabase
      .from('diversified_insights')
      .select('id')
      .order('created_at', { ascending: false });

    if (allInsights && allInsights.length > 20) {
      const idsToDelete = allInsights.slice(20).map(i => i.id);
      await supabase.from('diversified_insights').delete().in('id', idsToDelete);
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

// DELETE - Delete a specific insight by ID, or clear all
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Delete specific insight
      const { error } = await supabase
        .from('diversified_insights')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({ message: 'Insight deleted successfully' });
    }

    // Clear all insights
    const { error } = await supabase
      .from('diversified_insights')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;

    return NextResponse.json({ message: 'All insights cleared successfully' });
  } catch (error) {
    console.error('Error deleting insights:', error);
    return NextResponse.json(
      { error: 'Failed to delete insights' },
      { status: 500 }
    );
  }
}
