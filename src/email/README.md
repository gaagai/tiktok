# Email Module - מודול מייל

**Path**: `src/email/`  
**Version**: 2.2.0

---

## סקירה כללית

מודול זה מספק אינטגרציה מלאה עם **Brevo Transactional Email** לשליחת דוחות יומיים.

### קבצים

```
src/email/
├── brevo.ts          # Brevo API client
├── index.ts          # Email orchestration & idempotency
└── README.md         # תיעוד זה
```

---

## Architecture

### Flow Diagram

```
runDaily.ts (Step 10.5)
    ↓
email/index.ts:sendReportEmail()
    ↓
Check emailStatus (idempotency)
    ↓
  [SENT && !forceResend]
    → Skip (already sent)
    
  [NOT SENT || forceResend]
    ↓
  Set emailStatus = PENDING
    ↓
  Build email request (subject, body, attachment)
    ↓
  email/brevo.ts:sendBrevoEmail()
    ↓
  POST https://api.brevo.com/v3/smtp/email
    ↓
  Retry logic (3 attempts, exponential backoff)
    ↓
  [Success]
    → Update emailStatus = SENT
    → Save messageId & timestamp
    
  [Failure]
    → Update emailStatus = FAILED
    → Save error message
    → Log error (don't crash pipeline)
```

---

## API Reference

### `src/email/index.ts`

#### `sendReportEmail(report, forceResend?)`

שולח דוח במייל עם הגנת idempotency מלאה.

**Parameters:**
- `report: ReportDocument` - הדוח לשליחה
- `forceResend?: boolean` - אם `true`, שולח גם אם כבר נשלח (default: `false`)

**Returns:**
- `Promise<SendEmailResult>` - תוצאה עם `success`, `messageId?`, `error?`

**Behavior:**
- בדיקת `emailStatus === 'SENT'` לפני שליחה
- אם `forceResend === false` וכבר נשלח → מדלג
- מסמן `PENDING` → שולח → מעדכן `SENT`/`FAILED`
- **לא זורק חריגה** - מחזיר `SendEmailResult` תמיד

**Example:**
```typescript
const report = await getReportByDate('success_israel', '2026-02-04');
const result = await sendReportEmail(report, false);

if (result.success) {
  console.log('Sent!', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

---

#### `isEmailConfigured()`

בדיקה אם email מוגדר נכון.

**Returns:**
- `boolean` - `true` אם כל שדות email חובה קיימים

**Example:**
```typescript
if (isEmailConfigured()) {
  await sendReportEmail(report);
} else {
  console.log('Email not configured - skipping');
}
```

---

### `src/email/brevo.ts`

#### `sendBrevoEmail(apiKey, emailRequest, maxRetries?)`

שולח מייל דרך Brevo API עם retry logic חכם.

**Parameters:**
- `apiKey: string` - Brevo API key
- `emailRequest: BrevoEmailRequest` - אובייקט email מלא
- `maxRetries?: number` - מספר ניסיונות (default: 3)

**Returns:**
- `Promise<SendEmailResult>` - תוצאה עם `success`, `messageId?`, `error?`

**Retry Logic:**
- ✅ Retry על: 5xx, 429, timeouts
- ❌ לא retry על: 401, 403, 400
- Exponential backoff: 2s, 4s, 8s

**Example:**
```typescript
const result = await sendBrevoEmail(
  config.email.brevoApiKey,
  {
    sender: { name: 'VAI Reports', email: 'support@vai.co.il' },
    to: [{ email: 'client@example.com' }],
    subject: '[דוח טיקטוק יומי] – success_israel – 2026-02-04',
    textContent: reportText,
    attachment: [{ name: '2026-02-04-success_israel.txt', content: base64 }],
  },
  3
);
```

---

#### `parseEmailList(emailString)`

ממיר string של emails מופרדים בפסיק לarray של אובייקטים.

**Parameters:**
- `emailString: string` - emails מופרדים בפסיק

**Returns:**
- `Array<{ email: string }>` - רשימת אובייקטי email

**Example:**
```typescript
parseEmailList('a@example.com,b@example.com')
// → [{ email: 'a@example.com' }, { email: 'b@example.com' }]
```

---

## Types

### `BrevoEmailRequest`

```typescript
interface BrevoEmailRequest {
  sender: {
    name: string;      // שם השולח
    email: string;     // כתובת השולח (verified domain)
  };
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  subject: string;     // Subject של המייל
  textContent: string; // Body (Plain text)
  attachment?: Array<{
    name: string;      // שם קובץ
    content: string;   // תוכן ב-base64
  }>;
}
```

### `SendEmailResult`

```typescript
interface SendEmailResult {
  success: boolean;      // האם השליחה הצליחה
  messageId?: string;    // Brevo message ID (אם הצליח)
  error?: string;        // הודעת שגיאה (אם נכשל)
}
```

---

## Error Handling

### Permanent Errors (לא retry)

| Status | Reason | Action |
|--------|--------|--------|
| 401 | Unauthorized - API Key שגוי | בדוק `BREVO_API_KEY` |
| 403 | Forbidden - Sender לא מאומת | אמת domain ב-Brevo |
| 400 | Bad Request - Invalid data | בדוק פורמט email |

### Temporary Errors (עם retry)

| Status | Reason | Action |
|--------|--------|--------|
| 5xx | Server Error | המערכת מנסה שוב אוטומטית |
| 429 | Rate Limit | המתנה + retry |
| Timeout | Network | המערכת מנסה שוב אוטומטית |

### Pipeline Behavior

**כשל שליחה לא מפיל pipeline!**

```typescript
try {
  const result = await sendReportEmail(report);
  
  if (result.success) {
    // ✅ Email sent
    logSuccess('Email sent', { messageId: result.messageId });
  } else {
    // ❌ Email failed, but report is saved
    logError('Email failed', { error: result.error });
    // Pipeline continues ✅
  }
} catch (error) {
  // Unexpected error
  logError('Email process failed', error);
  // Pipeline continues ✅
}
```

---

## Configuration

### Required Environment Variables

```bash
EMAIL_PROVIDER=brevo          # Only 'brevo' supported
BREVO_API_KEY=xkeysib-...     # From Brevo dashboard
EMAIL_FROM=support@vai.co.il  # Verified sender
EMAIL_FROM_NAME=VAI Reports   # Sender name
EMAIL_TO=client@example.com   # Recipients (comma-separated)
EMAIL_SUBJECT_PREFIX=[דוח טיקטוק יומי]  # Subject prefix
```

### Optional Environment Variables

```bash
EMAIL_TO_CC=manager@example.com    # CC recipients
EMAIL_TO_BCC=archive@example.com   # BCC recipients
```

---

## Database Schema

### `reports` Collection

שדות email חדשים:

```typescript
{
  emailStatus?: 'PENDING' | 'SENT' | 'FAILED',
  emailSentAt?: Date,        // Timestamp של שליחה מוצלחת
  emailMessageId?: string,   // Brevo message ID
  emailError?: string        // הודעת שגיאה (אם נכשל)
}
```

---

## Testing

### Manual Test

```bash
# Build
npm run build

# Run with email enabled
npm run dev

# Force resend (for testing)
npm run dev -- --resend-email
```

### Check Results

**Logs:**
```bash
✅ Step 10.5: Sending report via email...
✅ Email sent successfully via Brevo
   messageId: <0200018e...>
```

**MongoDB:**
```javascript
db.reports.findOne({ reportDate: "2026-02-04" })
// emailStatus: "SENT"
// emailSentAt: ISODate("2026-02-04T08:15:23.456Z")
// emailMessageId: "<0200018e...>"
```

**Inbox:**
- Check recipient's inbox
- Check Spam/Junk folder
- Subject: `[דוח טיקטוק יומי] – success_israel – 2026-02-04`
- Attachment: `2026-02-04-success_israel.txt`

---

## Troubleshooting

### Problem: Email not sent

**Check:**
1. ✅ `EMAIL_PROVIDER=brevo` set in `.env`
2. ✅ All required env vars exist
3. ✅ Brevo API key is valid
4. ✅ Domain `vai.co.il` is verified in Brevo

### Problem: `emailStatus: FAILED`

**Check:**
1. View `emailError` field in MongoDB
2. Check logs: `❌ Brevo API error: ...`
3. Retry with: `npm run dev -- --resend-email`

### Problem: Email sent twice

**This is prevented by default!**

The system checks `emailStatus === 'SENT'` before sending.

To intentionally resend:
```bash
npm run dev -- --resend-email
```

---

## Future Enhancements

Possible future features:

- [ ] HTML email templates
- [ ] Customizable templates per profile
- [ ] Email scheduling (send at specific time)
- [ ] Multiple email providers (SendGrid, AWS SES)
- [ ] Bulk email for multiple profiles
- [ ] Email analytics/tracking

---

## See Also

- [EMAIL_SETUP_GUIDE.md](../../EMAIL_SETUP_GUIDE.md) - מדריך הגדרה מלא
- [CHANGELOG.md](../../CHANGELOG.md) - היסטוריית שינויים
- [Brevo API Docs](https://developers.brevo.com/)
