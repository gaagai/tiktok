# Webhook Integration Guide

## Overview

The TikTok scraper can send an automatic HTTP notification (webhook) to any external system
every time a daily report is generated (~00:01 Israel time).

The notification contains the list of videos published that day (text + link),
and is secured with an HMAC-SHA256 signature so your system can verify the request is authentic.

---

## Activation

Edit the `.env` file on the server and set the following three variables:

```env
WEBHOOK_ENABLED=true
WEBHOOK_URL=https://your-system.com/api/tiktok-report
WEBHOOK_SECRET=replace-with-a-long-random-secret-string
```

Then restart the process:

```bash
pm2 restart tiktok-scraper
```

**Requirements:**
- `WEBHOOK_URL` must start with `https://` (or `http://` for internal/testing endpoints)
- `WEBHOOK_SECRET` must be **at least 16 characters** – treat it like a password, keep it private

---

## What the Webhook Sends

A single `POST` request is sent to your URL with the following JSON body:

```json
{
  "event": "report.created",
  "reportDate": "2026-05-05",
  "profileHandle": "success_israel",
  "status": "ok",
  "generatedAt": "2026-05-06T00:02:14.000Z",
  "videosCount": 8,
  "emptyDay": false,
  "videos": [
    {
      "text": "caption text of the video",
      "url": "https://www.tiktok.com/@success_israel/video/123456789"
    },
    {
      "text": "another video caption",
      "url": "https://www.tiktok.com/@success_israel/video/987654321"
    }
  ]
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Always `"report.created"` |
| `reportDate` | string | Date of the videos (yesterday, `YYYY-MM-DD`) |
| `profileHandle` | string | TikTok profile that was scraped |
| `status` | string | `"ok"` / `"warning"` / `"error"` |
| `generatedAt` | string | ISO 8601 UTC timestamp when the report was created |
| `videosCount` | number | Number of videos in the `videos` array |
| `emptyDay` | boolean | `true` if no videos were published that day (Shabbat / holiday) |
| `videos` | array | List of videos. Each item has `text` (caption) and `url` (TikTok link) |

---

## Security – Verifying the Request

Every request includes two security headers:

| Header | Description |
|--------|-------------|
| `X-Timestamp` | Unix timestamp (seconds) when the request was built |
| `X-Signature-256` | `sha256=` followed by the HMAC-SHA256 signature |

### Signature Algorithm

```
signature = HMAC-SHA256(WEBHOOK_SECRET, "<X-Timestamp>.<raw request body>")
```

### Verification Steps (recommended)

1. **Check the timestamp** – reject requests where `X-Timestamp` is older than 5 minutes.  
   This prevents replay attacks.

2. **Recompute the signature** – compute `HMAC-SHA256(secret, timestamp + "." + rawBody)`  
   and compare it to the value in `X-Signature-256` (after stripping the `sha256=` prefix).

3. **Use a constant-time comparison** – avoid simple `==` to prevent timing attacks.

### Example: Node.js / Express

```javascript
const crypto = require('crypto');

function verifyWebhook(req, secret) {
  const timestamp = req.headers['x-timestamp'];
  const receivedSig = req.headers['x-signature-256'];

  // 1. Reject stale requests (older than 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false; // Request too old
  }

  // 2. Recompute signature
  const rawBody = JSON.stringify(req.body); // Must be the exact raw body string
  const expected = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

  // 3. Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(receivedSig),
    Buffer.from(expected)
  );
}

// Express route example
app.post('/api/tiktok-report', express.json(), (req, res) => {
  if (!verifyWebhook(req, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { reportDate, videos, status } = req.body;
  console.log(`Report for ${reportDate}: ${videos.length} videos`);

  // Your business logic here...

  res.status(200).json({ received: true });
});
```

### Example: Python / Flask

```python
import hmac
import hashlib
import time
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = 'your-secret-here'

def verify_webhook(request, secret):
    timestamp = request.headers.get('X-Timestamp', '')
    received_sig = request.headers.get('X-Signature-256', '')

    # 1. Reject stale requests
    if abs(time.time() - int(timestamp)) > 300:
        return False

    # 2. Recompute signature
    raw_body = request.get_data(as_text=True)
    message = f"{timestamp}.{raw_body}"
    expected = 'sha256=' + hmac.new(
        secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()

    # 3. Constant-time comparison
    return hmac.compare_digest(received_sig, expected)

@app.route('/api/tiktok-report', methods=['POST'])
def receive_report():
    if not verify_webhook(request, WEBHOOK_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401

    data = request.json
    print(f"Report for {data['reportDate']}: {data['videosCount']} videos")

    # Your business logic here...

    return jsonify({'received': True}), 200
```

---

## Retry Behavior

If your server is temporarily unavailable or returns a `5xx` error, the scraper will
automatically retry the webhook up to **3 times** with exponential backoff (3s, 6s, 12s).

If all retries fail, the failure is **logged but does not affect the daily pipeline** –
the report is still saved to the database and emailed normally.

`4xx` errors (bad URL, authentication failure, etc.) are **not retried** since they indicate
a configuration problem that retrying will not fix.

---

## Testing

To test the webhook without waiting for the next scheduled run at 00:01:

```bash
# On the server, run the pipeline immediately:
RUN_ON_STARTUP=true pm2 restart tiktok-scraper
```

Or use a tool like [Webhook.site](https://webhook.site) as a temporary `WEBHOOK_URL`
to inspect the exact payload your system will receive.

---

## Empty Day Behavior

On days with no new videos (Shabbat, holidays), the webhook is still sent with:

```json
{
  "event": "report.created",
  "status": "ok",
  "emptyDay": true,
  "videosCount": 0,
  "videos": []
}
```

Your system can check `emptyDay === true` to handle this case gracefully.
