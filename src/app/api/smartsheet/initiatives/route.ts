import { NextRequest, NextResponse } from 'next/server';
import {
  fetchInitiatives,
  updateInitiative,
  PILLARS,
  STATUS_MAP,
  TIMEFRAME_MAP,
  SI_LEVELS,
  PillarName,
  StatusKey,
  TimeframeKey,
  SILevel,
} from '@/lib/smartsheet-initiatives';

export const dynamic = 'force-dynamic';

/**
 * GET /api/smartsheet/initiatives
 * Fetches strategic initiatives with optional filtering
 *
 * Query params:
 * - pillar: Filter by pillar name
 * - owner: Filter by owner code
 * - status: Filter by status (Green, Yellow, Red, Gray)
 * - timeframe: Filter by timeframe (30-60, 90, 90+)
 * - siLevel: Filter by SI level (SI-1, SI-2, SI-3, SI-4)
 * - search: Search in title, description, owner
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const filters = {
      pillar: searchParams.get('pillar') as PillarName | null,
      owner: searchParams.get('owner'),
      status: searchParams.get('status') as StatusKey | null,
      timeframe: searchParams.get('timeframe') as TimeframeKey | null,
      siLevel: searchParams.get('siLevel') as SILevel | null,
      search: searchParams.get('search'),
    };

    // Remove null values
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== null && v !== '')
    );

    const result = await fetchInitiatives(
      Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined
    );

    return NextResponse.json({
      ...result,
      meta: {
        pillars: Object.entries(PILLARS).map(([name, { color, icon }]) => ({
          name,
          color,
          icon,
        })),
        statuses: Object.entries(STATUS_MAP).map(([key, { label, color }]) => ({
          key,
          label,
          color,
        })),
        timeframes: Object.entries(TIMEFRAME_MAP).map(([key, { label, color, sortOrder }]) => ({
          key,
          label,
          color,
          sortOrder,
        })),
        siLevels: Object.entries(SI_LEVELS).map(([key, { label, description }]) => ({
          key,
          label,
          description,
        })),
      },
    });
  } catch (error) {
    console.error('Initiatives API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch initiatives',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/smartsheet/initiatives
 * Updates a single initiative row
 *
 * Body:
 * - rowId: The Smartsheet row ID to update
 * - updates: Object with fields to update (status, timeframe, percentComplete, comments, description)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { rowId, updates } = body;

    if (!rowId || typeof rowId !== 'number') {
      return NextResponse.json(
        { error: 'rowId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'updates object is required' },
        { status: 400 }
      );
    }

    await updateInitiative(rowId, updates);

    return NextResponse.json({
      success: true,
      message: 'Initiative updated successfully',
      rowId,
    });
  } catch (error) {
    console.error('Initiative update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update initiative',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
