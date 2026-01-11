import { NextRequest, NextResponse } from 'next/server';
import { listTasks, AsanaTask } from '@/lib/asana';

export const dynamic = 'force-dynamic';

const DIVERSIFIED_PROJECT_ID = process.env.ASANA_DIVERSIFIED_PROJECT_ID || '';

interface InsightTaskMetadata {
  source: string;
  insight_id: string;
  category: string;
  customer: string;
  created: string;
}

interface InsightTask {
  task_gid: string;
  task_name: string;
  completed: boolean;
  completed_at: string | null;
  metadata: InsightTaskMetadata;
  days_to_complete: number | null;
}

interface CategoryAnalytics {
  category: string;
  total: number;
  completed: number;
  pending: number;
  conversion_rate: number;
  avg_days_to_complete: number | null;
}

interface InsightAnalytics {
  total_insight_tasks: number;
  completed: number;
  pending: number;
  overall_conversion_rate: number;
  by_category: CategoryAnalytics[];
  recent_completions: InsightTask[];
  tasks: InsightTask[];
}

/**
 * Parse insight metadata from task notes
 * Looks for the structured footer we add when creating insight tasks
 */
function parseInsightMetadata(notes: string | undefined): InsightTaskMetadata | null {
  if (!notes) return null;

  // Check if this is an insight task
  if (!notes.includes('source: ai_insight')) return null;

  const metadata: InsightTaskMetadata = {
    source: 'ai_insight',
    insight_id: 'unknown',
    category: 'general',
    customer: 'unknown',
    created: '',
  };

  // Parse each metadata field
  const insightIdMatch = notes.match(/insight_id:\s*(.+)/);
  if (insightIdMatch) metadata.insight_id = insightIdMatch[1].trim();

  const categoryMatch = notes.match(/category:\s*(.+)/);
  if (categoryMatch) metadata.category = categoryMatch[1].trim();

  const customerMatch = notes.match(/customer:\s*(.+)/);
  if (customerMatch) metadata.customer = customerMatch[1].trim();

  const createdMatch = notes.match(/created:\s*(.+)/);
  if (createdMatch) metadata.created = createdMatch[1].trim();

  return metadata;
}

/**
 * Calculate days between two dates
 */
function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * GET - Fetch insight task analytics from Asana
 *
 * This endpoint:
 * 1. Fetches all tasks (including completed) from the Diversified project
 * 2. Filters to only insight-generated tasks (by parsing notes metadata)
 * 3. Calculates conversion rates by category
 */
export async function GET(request: NextRequest) {
  try {
    if (!DIVERSIFIED_PROJECT_ID) {
      return NextResponse.json({
        error: 'Asana not configured',
        analytics: null,
      });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90', 10);

    // Fetch ALL tasks including completed (last N days)
    const completedSince = new Date();
    completedSince.setDate(completedSince.getDate() - days);

    // Fetch both incomplete and recently completed tasks
    const [incompleteTasks, completedTasks] = await Promise.all([
      listTasks(DIVERSIFIED_PROJECT_ID, {}), // All incomplete
      listTasks(DIVERSIFIED_PROJECT_ID, {
        completedSince: completedSince.toISOString()
      }).catch(() => [] as AsanaTask[]), // Completed in last N days
    ]);

    // Combine and dedupe
    const allTasksMap = new Map<string, AsanaTask>();
    [...incompleteTasks, ...completedTasks].forEach(task => {
      allTasksMap.set(task.gid, task);
    });
    const allTasks = Array.from(allTasksMap.values());

    // Filter to insight tasks and parse metadata
    const insightTasks: InsightTask[] = [];

    for (const task of allTasks) {
      const metadata = parseInsightMetadata(task.notes);
      if (metadata) {
        const daysToComplete = task.completed && task.completed_at && metadata.created
          ? daysBetween(metadata.created, task.completed_at)
          : null;

        insightTasks.push({
          task_gid: task.gid,
          task_name: task.name,
          completed: task.completed,
          completed_at: task.completed_at || null,
          metadata,
          days_to_complete: daysToComplete,
        });
      }
    }

    // Calculate overall stats
    const completed = insightTasks.filter(t => t.completed);
    const pending = insightTasks.filter(t => !t.completed);

    // Calculate by category
    const categoryMap = new Map<string, { total: number; completed: number; daysToComplete: number[] }>();

    for (const task of insightTasks) {
      const cat = task.metadata.category || 'general';
      const existing = categoryMap.get(cat) || { total: 0, completed: 0, daysToComplete: [] };
      existing.total++;
      if (task.completed) {
        existing.completed++;
        if (task.days_to_complete !== null) {
          existing.daysToComplete.push(task.days_to_complete);
        }
      }
      categoryMap.set(cat, existing);
    }

    const byCategory: CategoryAnalytics[] = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      total: stats.total,
      completed: stats.completed,
      pending: stats.total - stats.completed,
      conversion_rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      avg_days_to_complete: stats.daysToComplete.length > 0
        ? Math.round(stats.daysToComplete.reduce((a, b) => a + b, 0) / stats.daysToComplete.length)
        : null,
    })).sort((a, b) => b.conversion_rate - a.conversion_rate);

    // Recent completions (last 5)
    const recentCompletions = completed
      .filter(t => t.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .slice(0, 5);

    const analytics: InsightAnalytics = {
      total_insight_tasks: insightTasks.length,
      completed: completed.length,
      pending: pending.length,
      overall_conversion_rate: insightTasks.length > 0
        ? Math.round((completed.length / insightTasks.length) * 100)
        : 0,
      by_category: byCategory,
      recent_completions: recentCompletions,
      tasks: insightTasks,
    };

    return NextResponse.json({
      analytics,
      period_days: days,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching insight analytics:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
        analytics: null,
      },
      { status: 500 }
    );
  }
}
