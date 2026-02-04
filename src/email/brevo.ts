/**
 * Brevo (Sendinblue) Transactional Email integration
 */

import fetch from 'node-fetch';
import { BrevoEmailRequest, BrevoEmailResponse, SendEmailResult } from '../types/index.js';
import { logInfo, logError, logWarning } from '../alert/logger.js';
import { withRetry } from '../utils/retry.js';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Check if error is retryable (temporary failure)
 */
function isRetryableError(status: number): boolean {
  // Retry on:
  // - 5xx (server errors)
  // - 429 (rate limit)
  // - Network timeouts
  return status >= 500 || status === 429;
}

/**
 * Check if error is permanent (don't retry)
 */
function isPermanentError(status: number): boolean {
  // Don't retry on:
  // - 401 (unauthorized)
  // - 403 (forbidden)
  // - 400 (bad request - invalid sender, etc.)
  return status === 401 || status === 403 || status === 400;
}

/**
 * Send email via Brevo API with retry logic
 */
export async function sendBrevoEmail(
  apiKey: string,
  emailRequest: BrevoEmailRequest,
  maxRetries: number = 3
): Promise<SendEmailResult> {
  
  logInfo('Sending email via Brevo', {
    to: emailRequest.to.map(r => r.email).join(', '),
    subject: emailRequest.subject,
    hasAttachment: !!emailRequest.attachment,
  });

  const sendEmail = async (): Promise<SendEmailResult> => {
    try {
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(emailRequest),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        const status = response.status;
        
        // Parse error message
        let errorMessage = `Brevo API error: ${status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage += ` - ${responseText.substring(0, 200)}`;
        }

        logError('Brevo API error', new Error(errorMessage), {
          status,
          response: responseText.substring(0, 500),
        });

        // Check if we should retry
        if (isPermanentError(status)) {
          // Permanent error - don't retry
          logError('Permanent email error - not retrying', new Error(errorMessage), { status });
          return {
            success: false,
            error: errorMessage,
          };
        } else if (isRetryableError(status)) {
          // Temporary error - throw to trigger retry
          throw new Error(errorMessage);
        } else {
          // Unknown error - don't retry
          return {
            success: false,
            error: errorMessage,
          };
        }
      }

      // Parse success response
      const data = JSON.parse(responseText) as BrevoEmailResponse;
      
      logInfo('Email sent successfully via Brevo', {
        messageId: data.messageId,
        to: emailRequest.to.map(r => r.email).join(', '),
      });

      return {
        success: true,
        messageId: data.messageId,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Network errors or timeout - throw to trigger retry
      logWarning('Email send attempt failed', {
        error: err.message,
        willRetry: true,
      });
      
      throw err;
    }
  };

  // Execute with retry logic
  try {
    return await withRetry(sendEmail, {
      maxRetries,
      initialDelayMs: 2000,
      maxDelayMs: 10000,
      onRetry: (error, attempt) => {
        logWarning(`Retrying email send (attempt ${attempt}/${maxRetries})`, {
          error: error.message,
        });
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    logError('Email send failed after all retries', err, {
      maxRetries,
    });

    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Parse email addresses from comma-separated string
 */
export function parseEmailList(emailString: string): Array<{ email: string }> {
  return emailString
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0)
    .map(email => ({ email }));
}
