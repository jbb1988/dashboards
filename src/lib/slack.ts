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
    console.error('[Slack Upload] Missing config:', {
      hasBotToken: !!SLACK_BOT_TOKEN,
      hasChannelId: !!SLACK_CHANNEL_ID,
    });
    return {
      success: false,
      error: 'Slack file upload not configured. Set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID.'
    };
  }

  const { fileBuffer, filename, title, initialComment } = params;

  console.log('[Slack Upload] Starting upload:', {
    filename,
    fileSize: fileBuffer.length,
    title,
    channelId: SLACK_CHANNEL_ID,
  });

  try {
    // Step 1: Get upload URL
    console.log('[Slack Upload] Step 1: Getting upload URL...');
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
    console.log('[Slack Upload] Step 1 response:', {
      ok: uploadUrlData.ok,
      hasUploadUrl: !!uploadUrlData.upload_url,
      fileId: uploadUrlData.file_id,
      error: uploadUrlData.error,
    });

    if (!uploadUrlData.ok) {
      return { success: false, error: `Failed to get upload URL: ${uploadUrlData.error}` };
    }

    // Step 2: Upload file to the URL
    console.log('[Slack Upload] Step 2: Uploading file content to external URL...');
    const uploadResponse = await fetch(uploadUrlData.upload_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      // Buffer is a Uint8Array subclass in Node.js - use type assertion for fetch compatibility
      body: fileBuffer as unknown as BodyInit,
    });

    console.log('[Slack Upload] Step 2 response:', {
      ok: uploadResponse.ok,
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Slack Upload] Step 2 failed:', errorText);
      return { success: false, error: `Failed to upload file content: ${uploadResponse.status} ${errorText}` };
    }

    // Step 3: Complete the upload
    console.log('[Slack Upload] Step 3: Completing upload and sharing to channel...');
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
    console.log('[Slack Upload] Step 3 response:', {
      ok: completeData.ok,
      error: completeData.error,
      filesCount: completeData.files?.length,
    });

    if (!completeData.ok) {
      return { success: false, error: `Failed to complete upload: ${completeData.error}` };
    }

    console.log('[Slack Upload] Upload completed successfully');
    return {
      success: true,
      fileUrl: completeData.files?.[0]?.url_private || undefined
    };
  } catch (error) {
    console.error('[Slack Upload] Exception during upload:', error);
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

  console.log('[Slack] notifyAcceptanceSignedWithDocument called:', {
    customerName,
    type,
    envelopeId,
    hasDocumentBuffer: !!documentBuffer,
    bufferSize: documentBuffer?.length || 0,
  });

  // First, send the notification message
  const messageResult = await notifyAcceptanceSigned({
    customerName,
    type,
    signedDate,
    envelopeId,
  });

  if (!messageResult.success) {
    console.error('[Slack] Message notification failed:', messageResult.error);
    return { success: false, error: messageResult.error, fileUploaded: false };
  }

  console.log('[Slack] Message notification sent successfully');

  // Check file upload prerequisites
  const fileUploadConfigured = isSlackFileUploadConfigured();
  console.log('[Slack] File upload check:', {
    hasDocumentBuffer: !!documentBuffer,
    isFileUploadConfigured: fileUploadConfigured,
    hasBotToken: !!SLACK_BOT_TOKEN,
    hasChannelId: !!SLACK_CHANNEL_ID,
  });

  // If document is provided and file upload is configured, upload it to Slack
  if (documentBuffer && fileUploadConfigured) {
    const typeLabel = type === 'project' ? 'Project' : 'MCC';
    const sanitizedName = customerName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${sanitizedName}_${typeLabel}_Acceptance.pdf`;

    console.log('[Slack] Attempting file upload:', { filename, bufferSize: documentBuffer.length });

    const uploadResult = await uploadFileToSlack({
      fileBuffer: documentBuffer,
      filename,
      title: `${customerName} - ${typeLabel} Acceptance Document`,
      initialComment: `Signed acceptance document for ${customerName}`,
    });

    if (!uploadResult.success) {
      console.error('[Slack] Failed to upload document to Slack:', uploadResult.error);
      // Still return success for the message, just note file wasn't uploaded
      return { success: true, fileUploaded: false, error: uploadResult.error };
    }

    console.log('[Slack] File uploaded successfully:', uploadResult.fileUrl);
    return { success: true, fileUploaded: true };
  }

  if (!documentBuffer) {
    console.log('[Slack] No document buffer provided - skipping file upload');
  } else if (!fileUploadConfigured) {
    console.log('[Slack] File upload not configured - skipping file upload');
  }

  return { success: true, fileUploaded: false };
}
