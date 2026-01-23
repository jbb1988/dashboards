import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// This endpoint should be called by a cron job (e.g., Vercel Cron)
// Recommended: Run daily at 8:00 AM

export const maxDuration = 60; // 1 minute max

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    // First, refresh all obligation statuses
    await admin.rpc('refresh_obligation_statuses');

    // Find obligations that need reminders
    const { data: obligationsToRemind, error: fetchError } = await admin
      .from('contract_obligations')
      .select('*')
      .in('status', ['pending', 'upcoming', 'due', 'overdue'])
      .not('assigned_to', 'is', null)
      .or(`next_reminder_date.lte.${today},status.eq.overdue`);

    if (fetchError) {
      console.error('Failed to fetch obligations for reminders:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch obligations' },
        { status: 500 }
      );
    }

    const remindersToSend: Array<{
      obligation: typeof obligationsToRemind[0];
      type: 'scheduled' | 'overdue' | 'due';
    }> = [];

    for (const obligation of obligationsToRemind || []) {
      // Determine reminder type
      let reminderType: 'scheduled' | 'overdue' | 'due' = 'scheduled';
      if (obligation.status === 'overdue') {
        reminderType = 'overdue';
      } else if (obligation.status === 'due') {
        reminderType = 'due';
      }

      // Check if we already sent a reminder today
      const { data: existingReminder } = await admin
        .from('obligation_reminders')
        .select('id')
        .eq('obligation_id', obligation.id)
        .gte('sent_at', `${today}T00:00:00Z`)
        .single();

      if (!existingReminder) {
        remindersToSend.push({ obligation, type: reminderType });
      }
    }

    // Send reminders (in production, this would send actual emails)
    const sentReminders: Array<{ id: string; obligation_id: string; sent_to: string[] }> = [];

    for (const { obligation, type } of remindersToSend) {
      const recipients = [
        obligation.assigned_to,
        ...(obligation.watchers || []),
      ].filter(Boolean) as string[];

      if (recipients.length === 0) continue;

      // Build email content
      const subject = buildEmailSubject(obligation, type);
      const content = buildEmailContent(obligation, type);

      // In production, send actual email here
      // await sendEmail({ to: recipients, subject, html: content });

      // Log the reminder
      const { data: reminder, error: insertError } = await admin
        .from('obligation_reminders')
        .insert({
          obligation_id: obligation.id,
          reminder_type: type,
          sent_to: recipients,
          email_subject: subject,
          email_content: content,
          delivery_status: 'sent', // Would be updated based on actual delivery
        })
        .select()
        .single();

      if (!insertError && reminder) {
        sentReminders.push({
          id: reminder.id,
          obligation_id: obligation.id,
          sent_to: recipients,
        });

        // Update last reminder sent
        await admin
          .from('contract_obligations')
          .update({ last_reminder_sent: new Date().toISOString() })
          .eq('id', obligation.id);
      }
    }

    // Summary
    const { data: summary } = await admin
      .from('contract_obligations')
      .select('status')
      .in('status', ['pending', 'upcoming', 'due', 'overdue']);

    const counts = {
      pending: summary?.filter(s => s.status === 'pending').length || 0,
      upcoming: summary?.filter(s => s.status === 'upcoming').length || 0,
      due: summary?.filter(s => s.status === 'due').length || 0,
      overdue: summary?.filter(s => s.status === 'overdue').length || 0,
    };

    return NextResponse.json({
      success: true,
      processed_at: new Date().toISOString(),
      obligations_checked: obligationsToRemind?.length || 0,
      reminders_sent: sentReminders.length,
      reminders: sentReminders,
      summary: counts,
    });
  } catch (error) {
    console.error('Error in obligation reminders cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildEmailSubject(
  obligation: { title: string; due_date: string | null; contract_name: string },
  type: 'scheduled' | 'overdue' | 'due'
): string {
  switch (type) {
    case 'overdue':
      return `[OVERDUE] ${obligation.title} - ${obligation.contract_name}`;
    case 'due':
      return `[DUE TODAY] ${obligation.title} - ${obligation.contract_name}`;
    default:
      const dueDate = obligation.due_date
        ? new Date(obligation.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'No date set';
      return `[Reminder] ${obligation.title} due ${dueDate}`;
  }
}

function buildEmailContent(
  obligation: {
    title: string;
    description: string | null;
    due_date: string | null;
    contract_name: string;
    counterparty_name: string | null;
    obligation_type: string;
    priority: string;
  },
  type: 'scheduled' | 'overdue' | 'due'
): string {
  const priorityColors = {
    low: '#22C55E',
    medium: '#F59E0B',
    high: '#EF4444',
    critical: '#DC2626',
  };

  const statusMessage = type === 'overdue'
    ? '<strong style="color: #EF4444;">This obligation is OVERDUE and requires immediate attention.</strong>'
    : type === 'due'
    ? '<strong style="color: #F59E0B;">This obligation is DUE TODAY.</strong>'
    : `This is a reminder for an upcoming obligation.`;

  const dueDate = obligation.due_date
    ? new Date(obligation.due_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Not specified';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0F1722; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .detail { margin-bottom: 15px; }
    .label { font-weight: bold; color: #666; }
    .priority { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    .button { display: inline-block; padding: 12px 24px; background: #14B8A6; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">MARS Contract Obligation</h1>
    </div>
    <div class="content">
      <p>${statusMessage}</p>

      <div class="detail">
        <div class="label">Obligation</div>
        <div style="font-size: 18px; font-weight: bold;">${obligation.title}</div>
      </div>

      ${obligation.description ? `
      <div class="detail">
        <div class="label">Description</div>
        <div>${obligation.description}</div>
      </div>
      ` : ''}

      <div class="detail">
        <div class="label">Due Date</div>
        <div>${dueDate}</div>
      </div>

      <div class="detail">
        <div class="label">Contract</div>
        <div>${obligation.contract_name}${obligation.counterparty_name ? ` (${obligation.counterparty_name})` : ''}</div>
      </div>

      <div class="detail">
        <div class="label">Type</div>
        <div style="text-transform: capitalize;">${obligation.obligation_type}</div>
      </div>

      <div class="detail">
        <div class="label">Priority</div>
        <span class="priority" style="background: ${priorityColors[obligation.priority as keyof typeof priorityColors] || priorityColors.medium}20; color: ${priorityColors[obligation.priority as keyof typeof priorityColors] || priorityColors.medium};">
          ${obligation.priority.toUpperCase()}
        </span>
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://mars-contracts.vercel.app'}/obligations" class="button">
        View All Obligations
      </a>
    </div>
  </div>
</body>
</html>
  `;
}
