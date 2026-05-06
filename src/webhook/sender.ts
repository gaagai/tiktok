/**
 * Outbound Webhook sender (v2.3.0)
 *
 * Sends a signed POST request to the configured WEBHOOK_URL whenever
 * a daily report is generated. Uses HMAC-SHA256 for security so the
 * receiving system can verify the request is authentic.
 *
 * Security headers sent with every request:
 *   X-Timestamp:      Unix timestamp (seconds) of when the request was built
 *   X-Signature-256:  sha256=HMAC-SHA256(secret, "<timestamp>.<body>")
 */

import crypto from 'crypto';
import fetch from 'node-fetch';
import { ReportDocument, WebhookPayload, WebhookResult, WebhookVideo } from '../types/index.js';
import { getConfig } from '../utils/config.js';
import { logInfo, logSuccess, logError, logWarning } from '../alert/logger.js';
import { withRetry } from '../utils/retry.js';

/**
 * Build the HMAC-SHA256 signature for a webhook payload.
 * Signature format: sha256=HMAC-SHA256(secret, "<timestamp>.<body>")
 */
export function buildWebhookSignature(secret: string, timestamp: string, body: string): string {
  const message = `${timestamp}.${body}`;
  return 'sha256=' + crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Send the webhook with retry logic.
 * Server-side errors (5xx) trigger retries; client errors (4xx) do not.
 * Failure is non-fatal – a failed webhook will not crash the pipeline.
 */
export async function sendWebhook(
  url: string,
  secret: string,
  report: ReportDocument,
  videos: WebhookVideo[],
  maxRetries: number = 3
): Promise<WebhookResult> {
  const payload: WebhookPayload = {
    event: 'report.created',
    reportDate: report.reportDate,
    profileHandle: report.profileHandle,
    status: report.status,
    generatedAt: report.generatedAt.toISOString(),
    videosCount: videos.length,
    emptyDay: report.emptyDay ?? false,
    videos,
  };

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = buildWebhookSignature(secret, timestamp, body);

  logInfo('Sending webhook', {
    url,
    reportDate: report.reportDate,
    videosCount: videos.length,
    event: payload.event,
  });

  const sendRequest = async (): Promise<WebhookResult> => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp,
          'X-Signature-256': signature,
          'User-Agent': 'TikTok-Scraper-Webhook/1.0',
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const errorMsg = `Webhook HTTP ${response.status}: ${text.substring(0, 200)}`;

        // 5xx = temporary server error → retry
        if (response.status >= 500) {
          throw new Error(errorMsg);
        }

        // 4xx = client/config error → don't retry
        logError('Webhook rejected (non-retryable)', new Error(errorMsg), {
          status: response.status,
        });
        return { success: false, statusCode: response.status, error: errorMsg };
      }

      return { success: true, statusCode: response.status };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logWarning('Webhook attempt failed', { error: err.message });
      throw err;
    }
  };

  try {
    const result = await withRetry(sendRequest, {
      maxRetries,
      initialDelayMs: 3000,
      maxDelayMs: 15000,
      onRetry: (error, attempt) => {
        logWarning(`Retrying webhook (attempt ${attempt}/${maxRetries})`, {
          error: error.message,
        });
      },
    });

    logSuccess('Webhook delivered successfully', {
      url,
      statusCode: result.statusCode,
      reportDate: report.reportDate,
    });

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError('Webhook failed after all retries', err, { url, maxRetries });
    return { success: false, error: err.message };
  }
}

/**
 * Check whether webhook sending is enabled and fully configured.
 */
export function isWebhookConfigured(): boolean {
  const config = getConfig();
  return !!(
    config.webhook?.enabled &&
    config.webhook.url &&
    config.webhook.secret
  );
}
