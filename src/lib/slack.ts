/**
 * Slack Integration
 * Posts notifications to Slack channels via webhooks
 * Uploads files to Slack using the Bot Token
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || '';

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
 * Check if Slack webhook is configured
 */
export function isSlackConfigured(): boolean {
  return !!SLACK_WEBHOOK_URL;
}

/**
 * Check if Slack file upload is configured (requires bot token and channel)
 */
export function isSlackFileUploadConfigured(): boolean {
  return !!SLACK_BOT_TOKEN && !!SLACK_CHANNEL_ID;
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

/**
 * Upload a file to Slack
 * Uses the Slack Web API files.uploadV2 method
 */
export async function uploadFileToSlack(params: {
  fileBuffer: Buffer;
  filename: string;
  title?: string;
  initialComment?: string;
}): Promise<{ success: boolean; error?: string; fileUrl?: string }> {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID) {
    return {
      success: false,
      error: 'Slack file upload not configured. Set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID.'
    };
  }

  const { fileBuffer, filename, title, initialComment } = params;

  try {
    // Step 1: Get upload URL
    const getUploadUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        filename,
        length: fileBuffer.length.toString(),
      }),
    });

    const uploadUrlData = await getUploadUrlResponse.json();

    if (!uploadUrlData.ok) {
      return { success: false, error: `Failed to get upload URL: ${uploadUrlData.error}` };
    }

    // Step 2: Upload file to the URL
    const uploadResponse = await fetch(uploadUrlData.upload_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!uploadResponse.ok) {
      return { success: false, error: 'Failed to upload file content' };
    }

    // Step 3: Complete the upload
    const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [{
          id: uploadUrlData.file_id,
          title: title || filename,
        }],
        channel_id: SLACK_CHANNEL_ID,
        initial_comment: initialComment,
      }),
    });

    const completeData = await completeResponse.json();

    if (!completeData.ok) {
      return { success: false, error: `Failed to complete upload: ${completeData.error}` };
    }

    return {
      success: true,
      fileUrl: completeData.files?.[0]?.url_private || undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error uploading to Slack'
    };
  }
}

/**
 * Send acceptance signed notification with optional document attachment
 */
export async function notifyAcceptanceSignedWithDocument(params: {
  customerName: string;
  type: 'project' | 'mcc';
  signedDate: string;
  envelopeId: string;
  documentBuffer?: Buffer;
}): Promise<{ success: boolean; error?: string; fileUploaded?: boolean }> {
  const { customerName, type, signedDate, envelopeId, documentBuffer } = params;

  // First, send the notification message
  const messageResult = await notifyAcceptanceSigned({
    customerName,
    type,
    signedDate,
    envelopeId,
  });

  if (!messageResult.success) {
    return { success: false, error: messageResult.error, fileUploaded: false };
  }

  // If document is provided and file upload is configured, upload it
  if (documentBuffer && isSlackFileUploadConfigured()) {
    const typeLabel = type === 'project' ? 'Project' : 'MCC';
    const sanitizedName = customerName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${sanitizedName}_${typeLabel}_Acceptance.pdf`;

    const uploadResult = await uploadFileToSlack({
      fileBuffer: documentBuffer,
      filename,
      title: `${customerName} - ${typeLabel} Acceptance Document`,
      initialComment: `Signed acceptance document for ${customerName}`,
    });

    if (!uploadResult.success) {
      console.error('Failed to upload document to Slack:', uploadResult.error);
      // Still return success for the message, just note file wasn't uploaded
      return { success: true, fileUploaded: false, error: uploadResult.error };
    }

    return { success: true, fileUploaded: true };
  }

  return { success: true, fileUploaded: false };
}
