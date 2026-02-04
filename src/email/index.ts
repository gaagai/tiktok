/**
 * Email orchestration for daily reports
 */

import { ReportDocument, BrevoEmailRequest, SendEmailResult } from '../types/index.js';
import { getConfig } from '../utils/config.js';
import { sendBrevoEmail, parseEmailList } from './brevo.js';
import { logInfo, logSuccess, logError, logWarning } from '../alert/logger.js';

/**
 * Send daily report via email
 * 
 * @param report - The report document to send
 * @param forceResend - If true, send even if already sent (for --resend-email flag)
 * @returns SendEmailResult with success status and message ID
 */
export async function sendReportEmail(
  report: ReportDocument,
  forceResend: boolean = false
): Promise<SendEmailResult> {
  
  logInfo('Starting email send process', {
    reportDate: report.reportDate,
    profileHandle: report.profileHandle,
    forceResend,
    currentEmailStatus: report.emailStatus,
  });

  // Get email configuration
  const config = getConfig();
  
  if (!config.email) {
    logWarning('Email configuration not found - skipping email send');
    return {
      success: false,
      error: 'Email configuration not available',
    };
  }

  // Check if already sent (idempotency)
  if (report.emailStatus === 'SENT' && !forceResend) {
    logInfo('Email already sent for this report - skipping', {
      reportDate: report.reportDate,
      emailSentAt: report.emailSentAt,
      emailMessageId: report.emailMessageId,
    });
    
    return {
      success: true,
      messageId: report.emailMessageId,
    };
  }

  if (report.emailStatus === 'SENT' && forceResend) {
    logWarning('Force resending email (--resend-email flag)', {
      reportDate: report.reportDate,
      previousMessageId: report.emailMessageId,
    });
  }

  // Build email subject (Hebrew)
  const subject = `${config.email.subjectPrefix} – ${report.profileHandle} – ${report.reportDate}`;

  // Build email body
  const body = buildEmailBody(report);

  // Create attachment (TXT file with report content)
  const attachmentName = `${report.reportDate}-${report.profileHandle}.txt`;
  const attachmentContent = Buffer.from(report.text, 'utf-8').toString('base64');

  // Parse recipients
  const toRecipients = parseEmailList(config.email.to);
  const ccRecipients = config.email.cc ? parseEmailList(config.email.cc) : undefined;
  const bccRecipients = config.email.bcc ? parseEmailList(config.email.bcc) : undefined;

  // Build Brevo request
  const emailRequest: BrevoEmailRequest = {
    sender: {
      name: config.email.fromName,
      email: config.email.from,
    },
    to: toRecipients,
    cc: ccRecipients,
    bcc: bccRecipients,
    subject,
    textContent: body,
    attachment: [
      {
        name: attachmentName,
        content: attachmentContent,
      },
    ],
  };

  // Send email
  logInfo('Sending email via Brevo', {
    to: toRecipients.length,
    cc: ccRecipients?.length || 0,
    bcc: bccRecipients?.length || 0,
    subject,
    attachmentName,
  });

  const result = await sendBrevoEmail(
    config.email.brevoApiKey,
    emailRequest,
    config.system.maxRetries
  );

  if (result.success) {
    logSuccess('Email sent successfully', {
      messageId: result.messageId,
      reportDate: report.reportDate,
      profileHandle: report.profileHandle,
    });
  } else {
    logError('Email send failed', new Error(result.error || 'Unknown error'), {
      reportDate: report.reportDate,
      profileHandle: report.profileHandle,
    });
  }

  return result;
}

/**
 * Build email body with report content and footer
 */
function buildEmailBody(report: ReportDocument): string {
  const parts: string[] = [];

  // Add report content
  parts.push(report.text);

  // Add footer
  parts.push('');
  parts.push('---');
  parts.push('דוח זה נוצר ונשלח באופן אוטומטי.');

  return parts.join('\n');
}

/**
 * Check if email configuration is valid
 */
export function isEmailConfigured(): boolean {
  const config = getConfig();
  
  if (!config.email) {
    return false;
  }

  const required = [
    config.email.provider,
    config.email.brevoApiKey,
    config.email.from,
    config.email.fromName,
    config.email.to,
    config.email.subjectPrefix,
  ];

  return required.every(field => field && field.length > 0);
}
