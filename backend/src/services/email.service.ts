import nodemailer from 'nodemailer';
import { env } from '../config/env';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });

  static async sendPasswordResetEmail(toEmail: string, resetLink: string, recipientName = 'User'): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"KnowledgeAI Security" <${env.GMAIL_USER}>`,
        to: toEmail,
        subject: 'Reset Your KnowledgeAI Password',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff;">
            <div style="margin-bottom: 24px; text-align: center;">
              <h2 style="color: #18181b; margin: 0; font-size: 24px; font-weight: bold;">KnowledgeAI</h2>
              <p style="color: #71717a; font-size: 14px; margin-top: 4px;">Enterprise Knowledge Base & AI Assistant</p>
            </div>
            
            <div style="color: #27272a; font-size: 15px; line-height: 1.6;">
              <p>Hello ${recipientName},</p>
              <p>We received a request to reset your password for your KnowledgeAI account. Click the button below to choose a new password:</p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">Reset Password</a>
              </div>
              
              <p style="font-size: 13px; color: #71717a;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #7c3aed; word-break: break-all;"><a href="${resetLink}" style="color: #7c3aed;">${resetLink}</a></p>
              
              <p style="font-size: 13px; color: #a1a1aa; margin-top: 32px;">This password reset link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
            </div>
          </div>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[Email] Password reset email sent to ${toEmail}. Message ID: ${info.messageId}`);
      return true;
    } catch (err: any) {
      console.error('[Email] Failed to send password reset email:', err.message);
      return false;
    }
  }
}
