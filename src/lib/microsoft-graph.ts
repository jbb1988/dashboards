import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';

/**
 * Microsoft Graph API Client for OneDrive integration
 * Used to upload contract documents and get embeddable editing URLs
 */

// Initialize Graph client with app-only authentication
export function getGraphClient(): Client {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Microsoft Graph credentials not configured. ' +
      'Required: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET'
    );
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return Client.initWithMiddleware({ authProvider });
}

export interface OneDriveUploadResult {
  fileId: string;
  webUrl: string;
  embedUrl: string;
  downloadUrl?: string;
}

/**
 * Upload a file to OneDrive and return file info including embed URL
 * Supports two modes:
 * 1. Drive ID + Folder ID (traditional)
 * 2. User email + folder path (simpler setup)
 *
 * @param fileName - The name for the file in OneDrive
 * @param fileContent - The file content as a Buffer
 * @returns Object with fileId, webUrl, and embedUrl
 */
export async function uploadToOneDrive(
  fileName: string,
  fileContent: Buffer
): Promise<OneDriveUploadResult> {
  const client = getGraphClient();

  const driveId = process.env.ONEDRIVE_DRIVE_ID;
  const folderId = process.env.ONEDRIVE_FOLDER_ID;
  const userEmail = process.env.ONEDRIVE_USER_EMAIL;
  const folderPath = process.env.ONEDRIVE_FOLDER_PATH;

  let uploadResult;

  if (driveId && folderId) {
    // Mode 1: Use drive ID and folder ID directly
    uploadResult = await client
      .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/content`)
      .put(fileContent);
  } else if (userEmail && folderPath) {
    // Mode 2: Use user email and folder path
    // This resolves the drive automatically from the user's OneDrive
    uploadResult = await client
      .api(`/users/${userEmail}/drive/root:/${folderPath}/${fileName}:/content`)
      .put(fileContent);
  } else {
    throw new Error(
      'OneDrive folder not configured. Required: either (ONEDRIVE_DRIVE_ID + ONEDRIVE_FOLDER_ID) or (ONEDRIVE_USER_EMAIL + ONEDRIVE_FOLDER_PATH)'
    );
  }

  // Get the drive ID from the upload result for subsequent calls
  const itemDriveId = uploadResult.parentReference?.driveId;

  // Create a sharing link with edit permissions
  // scope: 'organization' limits to users within the tenant
  const shareResult = await client
    .api(`/drives/${itemDriveId}/items/${uploadResult.id}/createLink`)
    .post({
      type: 'edit',
      scope: 'organization',
    });

  // Get the download URL if available
  const itemInfo = await client
    .api(`/drives/${itemDriveId}/items/${uploadResult.id}`)
    .select('id,webUrl,@microsoft.graph.downloadUrl')
    .get();

  // Construct embed URL for Office Online editing
  const embedUrl = constructEmbedUrl(shareResult.link.webUrl);

  return {
    fileId: uploadResult.id,
    webUrl: uploadResult.webUrl,
    embedUrl: embedUrl,
    downloadUrl: itemInfo['@microsoft.graph.downloadUrl'],
  };
}

/**
 * Get an embeddable URL for an existing file
 * @param fileId - The OneDrive file ID
 * @returns The embed URL for editing in an iframe
 */
export async function getEmbedUrl(fileId: string): Promise<string> {
  const client = getGraphClient();
  const driveId = process.env.ONEDRIVE_DRIVE_ID;

  if (!driveId) {
    throw new Error('ONEDRIVE_DRIVE_ID not configured');
  }

  // Check for existing sharing link or create a new one
  const shareResult = await client
    .api(`/drives/${driveId}/items/${fileId}/createLink`)
    .post({
      type: 'edit',
      scope: 'organization',
    });

  return constructEmbedUrl(shareResult.link.webUrl);
}

/**
 * Delete a file from OneDrive
 * @param fileId - The OneDrive file ID to delete
 */
export async function deleteFromOneDrive(fileId: string): Promise<void> {
  const client = getGraphClient();
  const driveId = process.env.ONEDRIVE_DRIVE_ID;

  if (!driveId) {
    throw new Error('ONEDRIVE_DRIVE_ID not configured');
  }

  await client.api(`/drives/${driveId}/items/${fileId}`).delete();
}

/**
 * Get file metadata and download URL
 * @param fileId - The OneDrive file ID
 */
export async function getFileInfo(fileId: string): Promise<{
  name: string;
  webUrl: string;
  downloadUrl: string;
  size: number;
  lastModified: string;
}> {
  const client = getGraphClient();
  const driveId = process.env.ONEDRIVE_DRIVE_ID;
  const userEmail = process.env.ONEDRIVE_USER_EMAIL;

  let result;

  if (driveId) {
    result = await client
      .api(`/drives/${driveId}/items/${fileId}`)
      .select('name,webUrl,@microsoft.graph.downloadUrl,size,lastModifiedDateTime')
      .get();
  } else if (userEmail) {
    // Use user's drive when no drive ID is configured
    result = await client
      .api(`/users/${userEmail}/drive/items/${fileId}`)
      .select('name,webUrl,@microsoft.graph.downloadUrl,size,lastModifiedDateTime')
      .get();
  } else {
    throw new Error('Neither ONEDRIVE_DRIVE_ID nor ONEDRIVE_USER_EMAIL configured');
  }

  return {
    name: result.name,
    webUrl: result.webUrl,
    downloadUrl: result['@microsoft.graph.downloadUrl'],
    size: result.size,
    lastModified: result.lastModifiedDateTime,
  };
}

/**
 * Construct an embed URL from a sharing link
 * Office Online uses specific URL patterns for embedding
 */
function constructEmbedUrl(shareUrl: string): string {
  // For Word documents, we can use the sharing URL directly
  // The URL typically looks like: https://org.sharepoint.com/:w:/r/sites/...
  // We can append action=embedview for view-only or action=edit for editing

  // If it's a direct sharing link, we can use it as-is
  // The sharing link format already provides proper access
  if (shareUrl.includes('sharepoint.com') || shareUrl.includes('onedrive.com')) {
    // Ensure we have the edit action
    const url = new URL(shareUrl);

    // For SharePoint URLs, ensure action=edit is set
    if (!url.searchParams.has('action')) {
      // Check if it's an Office document URL pattern
      if (shareUrl.includes('/:w:/') || shareUrl.includes('/:x:/') || shareUrl.includes('/:p:/')) {
        // These are already in embed format, just ensure edit access
        return shareUrl;
      }
    }
  }

  return shareUrl;
}

/**
 * Get file content directly from OneDrive
 * Fallback method when downloadUrl is not available
 * Uses the /content endpoint to stream file directly
 * @param fileId - The OneDrive file ID
 */
export async function getFileContent(fileId: string): Promise<ArrayBuffer | null> {
  const client = getGraphClient();
  const driveId = process.env.ONEDRIVE_DRIVE_ID;
  const userEmail = process.env.ONEDRIVE_USER_EMAIL;

  try {
    // Use /content endpoint which streams file directly via Graph API
    // The Graph client returns a ReadableStream for /content endpoints
    let stream: ReadableStream | null = null;

    if (driveId) {
      stream = await client
        .api(`/drives/${driveId}/items/${fileId}/content`)
        .get();
    } else if (userEmail) {
      stream = await client
        .api(`/users/${userEmail}/drive/items/${fileId}/content`)
        .get();
    }

    if (!stream) return null;

    // Convert ReadableStream to ArrayBuffer
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    // Combine chunks into single ArrayBuffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  } catch (error) {
    console.error('Failed to get file content via /content endpoint:', error);
  }
  return null;
}

/**
 * Check if Microsoft Graph is properly configured
 * @returns true if all required env vars are present
 */
export function isGraphConfigured(): boolean {
  const hasCredentials = !!(
    process.env.MICROSOFT_TENANT_ID &&
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET
  );

  const hasDriveConfig = !!(
    process.env.ONEDRIVE_DRIVE_ID &&
    process.env.ONEDRIVE_FOLDER_ID
  );

  const hasPathConfig = !!(
    process.env.ONEDRIVE_USER_EMAIL &&
    process.env.ONEDRIVE_FOLDER_PATH
  );

  return hasCredentials && (hasDriveConfig || hasPathConfig);
}
