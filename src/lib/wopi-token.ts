import jwt from 'jsonwebtoken';

const WOPI_SECRET = process.env.WOPI_SECRET || 'your-secret-key-change-in-production';

interface WOPIAccessToken {
  file_id: string;
  user_id: string;
  user_email: string;
  document_id: string;
  expires_at: number;
}

export function generateWOPIAccessToken(params: {
  fileId: string;
  userId: string;
  userEmail: string;
  documentId: string;
  expiresInMinutes?: number;
}): string {
  const expiresIn = params.expiresInMinutes || 60;
  const payload: WOPIAccessToken = {
    file_id: params.fileId,
    user_id: params.userId,
    user_email: params.userEmail,
    document_id: params.documentId,
    expires_at: Date.now() + (expiresIn * 60 * 1000),
  };
  return jwt.sign(payload, WOPI_SECRET, { expiresIn: `${expiresIn}m` });
}

export function verifyWOPIAccessToken(token: string): WOPIAccessToken | null {
  try {
    const decoded = jwt.verify(token, WOPI_SECRET) as WOPIAccessToken;
    if (decoded.expires_at < Date.now()) return null;
    return decoded;
  } catch (error) {
    return null;
  }
}
