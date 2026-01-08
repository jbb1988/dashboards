/**
 * Slack Integration
 * Posts notifications to Slack channels via webhooks
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: {
    type: string;
    text: string;
  }[];
}

/**
 * Check if Slack is configured
 */
export function isSlackConfigured(): boolean {
  return !!SLACK_WEBHOOK_URL;
}

/**
 * Send a message to Slack
 */
export async function sendSlackMessage(message: SlackMessage): Promise<{ success: boolean; error?: string }> {
  if (!SLACK_WEBHOOK_URL) {
    return { success: false, error: 'Slack webhook URL not configured' };
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Slack API error: ${text}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending to Slack'
    };
  }
}

/**
 * Send acceptance signed notification
 */
export async function notifyAcceptanceSigned(params: {
  customerName: string;
  type: 'project' | 'mcc';
  signedDate: string;
  envelopeId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { customerName, type, signedDate, envelopeId } = params;

  const typeLabel = type === 'project' ? 'Project' : 'MCC (Maintenance)';
  const formattedDate = new Date(signedDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const message: SlackMessage = {
    text: `Acceptance Document Signed: ${customerName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Acceptance Document Signed!',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Customer:*\n${customerName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${typeLabel}`,
          },
          {
            type: 'mrkdwn',
            text: `*Signed:*\n${formattedDate}`,
          },
          {
            type: 'mrkdwn',
            text: `*Envelope ID:*\n${envelopeId.substring(0, 8)}...`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Action Required:* Key activation & send invoice',
        },
      },
    ],
  };

  return sendSlackMessage(message);
}
