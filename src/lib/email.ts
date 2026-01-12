/**
 * Email Service using Resend
 */

import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND;
    if (!apiKey) {
      throw new Error('RESEND API key is not configured');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// From email - must be verified domain or use Resend's default
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = 'MARS Executive Dashboards';

/**
 * Generate a random temporary password
 */
export function generateTempPassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Send welcome email with login credentials
 */
export async function sendWelcomeEmail(params: {
  to: string;
  password: string;
  loginUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, password, loginUrl } = params;

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: 'Welcome to MARS Executive Dashboards',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>Welcome to MARS</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0B1220;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B1220; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(to bottom, #151F2E, #0F1722); border-radius: 16px; overflow: hidden; max-width: 600px; border: 1px solid rgba(255,255,255,0.08);">

          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px;">
              <a href="${loginUrl}" style="display: block; text-decoration: none;">
                <img src="https://mars-dashboards.vercel.app/mars-logo-horizontal.png" alt="MARS" width="180" style="display: block; max-width: 180px; height: auto;">
              </a>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding: 20px 40px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #FFFFFF;">
                Welcome to MARS
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #8FA3BF; text-align: center;">
                Your account has been created. Use the credentials below to sign in to the <span style="color: #38BDF8;">MARS Executive Dashboards</span> platform.
              </p>
            </td>
          </tr>

          <!-- Credentials Box -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B1220; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
                <tr>
                  <td style="padding: 24px;">
                    <!-- Email -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                      <tr>
                        <td style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748B; padding-bottom: 8px;">
                          Your Email
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #151F2E; border-radius: 8px; padding: 14px 16px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 15px; color: #FFFFFF; border: 1px solid rgba(255,255,255,0.05);">
                          ${to}
                        </td>
                      </tr>
                    </table>
                    <!-- Password -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748B; padding-bottom: 8px;">
                          Temporary Password
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #151F2E; border-radius: 8px; padding: 14px 16px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 15px; color: #FFFFFF; border: 1px solid rgba(255,255,255,0.05);">
                          ${password}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 30px;">
              <a href="${loginUrl}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #0189CB 0%, #38BDF8 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(1, 137, 203, 0.4);">
                Sign In Now
              </a>
            </td>
          </tr>

          <!-- Security Note -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748B; text-align: center;">
                For security, please change your password after your first login.<br>
                Use "Forgot Password" on the login page to set a new password.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1) 50%, transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 30px 40px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #38BDF8; font-weight: 600;">
                Business Intelligence Platform
              </p>
              <p style="margin: 0 0 4px; font-size: 12px; color: #64748B;">
                This email was sent to ${to}
              </p>
              <p style="margin: 0; font-size: 12px; color: #475569;">
                © 2026 MARS Company. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Welcome email sent:', data?.id);
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Send password reset email (backup if Supabase fails)
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, resetUrl } = params;

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: 'Reset your MARS password',
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0D0E12; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: linear-gradient(180deg, #1E2028 0%, #16181D 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); padding: 40px; }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo-text { font-size: 28px; font-weight: 700; color: #EAF2FF; letter-spacing: -0.5px; }
    .logo-accent { color: #E16259; }
    h1 { color: #EAF2FF; font-size: 24px; margin: 0 0 16px 0; text-align: center; }
    p { color: #8FA3BF; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; text-align: center; }
    .button { display: block; background: linear-gradient(135deg, #0189CB 0%, #38BDF8 100%); color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; text-align: center; margin: 32px auto; max-width: 280px; box-shadow: 0 4px 12px rgba(1, 137, 203, 0.3); }
    .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 32px 0; }
    .footer { text-align: center; color: #475569; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <span class="logo-text">MARS<span class="logo-accent">water</span></span>
      </div>

      <h1>Reset Your Password</h1>

      <p>We received a request to reset your password. Click the button below to set a new password.</p>

      <a href="${resetUrl}" class="button">Reset Password</a>

      <div class="divider"></div>

      <p style="font-size: 13px; color: #64748B;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>

    <div class="footer" style="margin-top: 24px;">
      <p>&copy; 2026 MARSwater. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}
