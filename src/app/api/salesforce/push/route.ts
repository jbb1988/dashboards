/**
 * API Route: Push changes to Salesforce
 * Handles explicit user-initiated sync from local data to Salesforce
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  updateOpportunity,
  addOpportunityNote,
  addOpportunityTask,
  batchUpdateOpportunities,
  mapStatusToSalesforceStage,
  OpportunityUpdateFields,
  SalesforceUpdateResult,
} from '@/lib/salesforce';

interface PushRequest {
  action: 'update' | 'addNote' | 'addTask' | 'batchUpdate';
  opportunityId?: string;
  fields?: OpportunityUpdateFields;
  // For status updates - maps dashboard status to SF stage
  status?: string;
  currentStage?: string;
  // For notes
  noteTitle?: string;
  noteContent?: string;
  // For tasks
  taskSubject?: string;
  taskDescription?: string;
  taskDueDate?: string;
  taskPriority?: 'High' | 'Normal' | 'Low';
  // For batch updates
  updates?: Array<{
    id: string;
    fields: OpportunityUpdateFields;
    status?: string;
    currentStage?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: PushRequest = await request.json();
    const { action } = body;

    switch (action) {
      case 'update': {
        if (!body.opportunityId) {
          return NextResponse.json(
            { error: 'opportunityId is required' },
            { status: 400 }
          );
        }

        let fields = body.fields || {};

        // If status is provided, map it to Salesforce stage
        if (body.status) {
          fields.StageName = mapStatusToSalesforceStage(body.status, body.currentStage);
        }

        if (Object.keys(fields).length === 0) {
          return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
          );
        }

        const result = await updateOpportunity(body.opportunityId, fields);
        return NextResponse.json(result);
      }

      case 'addNote': {
        if (!body.opportunityId || !body.noteTitle || !body.noteContent) {
          return NextResponse.json(
            { error: 'opportunityId, noteTitle, and noteContent are required' },
            { status: 400 }
          );
        }

        const result = await addOpportunityNote(
          body.opportunityId,
          body.noteTitle,
          body.noteContent
        );
        return NextResponse.json(result);
      }

      case 'addTask': {
        if (!body.opportunityId || !body.taskSubject) {
          return NextResponse.json(
            { error: 'opportunityId and taskSubject are required' },
            { status: 400 }
          );
        }

        const result = await addOpportunityTask(
          body.opportunityId,
          body.taskSubject,
          body.taskDescription || '',
          body.taskDueDate,
          body.taskPriority
        );
        return NextResponse.json(result);
      }

      case 'batchUpdate': {
        if (!body.updates || body.updates.length === 0) {
          return NextResponse.json(
            { error: 'updates array is required and must not be empty' },
            { status: 400 }
          );
        }

        // Map statuses to Salesforce stages for each update
        const mappedUpdates = body.updates.map((update) => {
          const fields = { ...update.fields };
          if (update.status) {
            fields.StageName = mapStatusToSalesforceStage(update.status, update.currentStage);
          }
          return { id: update.id, fields };
        });

        const results = await batchUpdateOpportunities(mappedUpdates);

        const summary = {
          total: results.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          results,
        };

        return NextResponse.json(summary);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Salesforce push error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Check for auth errors
    if (message.includes('not connected') || message.includes('re-authenticate')) {
      return NextResponse.json(
        { error: message, requiresAuth: true },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET endpoint to check sync status / what would be pushed
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Salesforce Push API',
    endpoints: {
      'POST /api/salesforce/push': {
        actions: {
          update: 'Update a single opportunity',
          addNote: 'Add a note to an opportunity',
          addTask: 'Add a task to an opportunity',
          batchUpdate: 'Update multiple opportunities at once',
        },
      },
    },
  });
}
