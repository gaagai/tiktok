# Email Setup Guide - מדריך הגדרת מייל

**גרסה**: 2.2.0  
**עדכון אחרון**: 04/02/2026

---

## תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [הגדרת חשבון Brevo](#הגדרת-חשבון-brevo)
3. [הגדרת משתני סביבה](#הגדרת-משתני-סביבה)
4. [בדיקת הקונפיגורציה](#בדיקת-הקונפיגורציה)
5. [שימוש](#שימוש)
6. [פורמט המייל](#פורמט-המייל)
7. [טיפול בשגיאות](#טיפול-בשגיאות)
8. [שאלות נפוצות](#שאלות-נפוצות)

---

## סקירה כללית

החל מגרסה 2.2.0, המערכת תומכת בשליחת דוחות יומיים אוטומטית במייל דרך **Brevo (Sendinblue) Transactional Email**.

### מה נשלח במייל?

- **Subject בעברית**: `[דוח טיקטוק יומי] – success_israel – 2026-02-04`
- **Body**: תוכן הדוח המלא (Plain Text) + Footer קבוע
- **Attachment**: קובץ TXT עם תוכן הדוח (`2026-02-04-success_israel.txt`)

### תכונות עיקריות

✅ **שליחה אוטומטית** - לאחר יצירת דוח יומי  
✅ **תמיכה במספר נמענים** - TO/CC/BCC  
✅ **מייל גם ביום ריק** - עם הודעה "לא פורסמו סרטונים"  
✅ **Idempotency** - לא שולח פעמיים לאותו דוח  
✅ **Error handling** - כשל שליחה לא מפיל את ה-pipeline  
✅ **Retry חכם** - רק על שגיאות זמניות (5xx, 429, timeouts)  
✅ **Email tracking** - status, timestamp, messageId ב-MongoDB

---

## הגדרת חשבון Brevo

### שלב 1: יצירת חשבון

1. היכנס ל-[Brevo](https://www.brevo.com/) (לשעבר Sendinblue)
2. צור חשבון חדש או התחבר לחשבון קיים
3. בחר בתכנית **Free** (300 מיילים ביום) או **Paid** לפי צורך

### שלב 2: אימות דומיין (Sender Domain Verification)

**חשוב מאוד!** חובה לאמת את הדומיין `vai.co.il` לפני שליחת מיילים.

1. עבור ל-**Settings** → **Senders & IP**
2. לחץ על **Add a sender** / **Domains**
3. הוסף את הדומיין: `vai.co.il`
4. עקוב אחר ההוראות להוספת רשומות DNS:
   - **SPF Record** - לאימות זהות השולח
   - **DKIM Record** - לחתימה דיגיטלית
   - **DMARC Record** (אופציונלי) - למדיניות אבטחה

**דוגמה לרשומות DNS נדרשות:**

```
Type: TXT
Host: vai.co.il
Value: v=spf1 include:spf.sendinblue.com ~all

Type: TXT
Host: mail._domainkey.vai.co.il
Value: k=rsa; p=MIGfMA0GCSqGSIb3DQEBA... (הערך שמספקת Brevo)
```

5. חכה לאימות (עד 48 שעות, בדרך כלל תוך דקות)
6. וודא שהסטטוס הוא **Verified** ✅

### שלב 3: יצירת API Key

1. עבור ל-**Settings** → **API Keys**
2. לחץ על **Create a new API key**
3. תן שם לAPI key: `TikTok Daily Scraper`
4. העתק את ה-API Key (מתחיל ב-`xkeysib-...`)
5. **שמור את ה-Key במקום בטוח** - הוא לא יוצג שוב!

---

## הגדרת משתני סביבה

### קובץ `.env`

הוסף את השורות הבאות לקובץ `.env` שלך:

```bash
# ============================================
# Email Configuration
# ============================================

# Email provider (only 'brevo' supported)
EMAIL_PROVIDER=brevo

# Brevo API Key
BREVO_API_KEY=xkeysib-YOUR_ACTUAL_API_KEY_HERE

# From email (must be verified domain)
EMAIL_FROM=support@vai.co.il
EMAIL_FROM_NAME=VAI Reports

# To email(s) - comma-separated for multiple recipients
EMAIL_TO=client-team@example.com,manager@example.com

# Optional: CC recipients
# EMAIL_TO_CC=backup@example.com

# Optional: BCC recipients
# EMAIL_TO_BCC=archive@example.com

# Email subject prefix (Hebrew supported)
EMAIL_SUBJECT_PREFIX=[דוח טיקטוק יומי]
```

### פרמטרים חובה vs. אופציונליים

| פרמטר | חובה? | תיאור | דוגמה |
|-------|-------|-------|-------|
| `EMAIL_PROVIDER` | ✅ | ספק המייל (רק `brevo` נתמך) | `brevo` |
| `BREVO_API_KEY` | ✅ | API Key מ-Brevo | `xkeysib-abc123...` |
| `EMAIL_FROM` | ✅ | כתובת שולח (דומיין מאומת) | `support@vai.co.il` |
| `EMAIL_FROM_NAME` | ✅ | שם השולח | `VAI Reports` |
| `EMAIL_TO` | ✅ | נמענים (מופרדים בפסיק) | `client@example.com` |
| `EMAIL_TO_CC` | ❌ | CC (אופציונלי) | `manager@example.com` |
| `EMAIL_TO_BCC` | ❌ | BCC (אופציונלי) | `archive@example.com` |
| `EMAIL_SUBJECT_PREFIX` | ❌ | Prefix ל-subject | `[דוח טיקטוק יומי]` |

### דוגמה מלאה

```bash
EMAIL_PROVIDER=brevo
BREVO_API_KEY=xkeysib-abc123def456ghi789
EMAIL_FROM=support@vai.co.il
EMAIL_FROM_NAME=VAI Reports
EMAIL_TO=elad@example.com,team@example.com
EMAIL_TO_CC=manager@example.com
EMAIL_SUBJECT_PREFIX=[דוח טיקטוק יומי]
```

---

## בדיקת הקונפיגורציה

### בדיקה 1: ולידציה של משתני סביבה

הפעל את המערכת פעם אחת:

```bash
npm run build
npm run dev
```

אם יש בעיה בקונפיגורציה, תקבל הודעת שגיאה ברורה:

```
❌ Error: Missing required environment variable: EMAIL_FROM
❌ Error: EMAIL_FROM must be a valid email address
❌ Error: Only EMAIL_PROVIDER=brevo is supported
```

### בדיקה 2: בדיקת שליחת מייל

הפעל ריצה רגילה עם `--resend-email`:

```bash
npm run dev -- --resend-email
```

זה ישלח מייל מחדש גם אם כבר נשלח, ותוכל לראות:

```
✅ Step 10.5: Sending report via email...
✅ Email sent successfully via Brevo
   messageId: <0200018e1234abcd-1234-5678-90ab-cdef12345678-000000@email.amazonses.com>
```

### בדיקה 3: בדיקה ב-MongoDB

בדוק את השדה `emailStatus` ב-collection `reports`:

```javascript
db.reports.find({ reportDate: "2026-02-04" }).pretty()

// תוצאה צפויה:
{
  "_id": ObjectId("..."),
  "reportDate": "2026-02-04",
  "profileHandle": "success_israel",
  "emailStatus": "SENT",
  "emailSentAt": ISODate("2026-02-04T08:15:23.456Z"),
  "emailMessageId": "<0200018e1234abcd...>",
  ...
}
```

---

## שימוש

### ריצה רגילה (שליחת מייל אוטומטית)

```bash
npm run dev
```

המערכת תשלח מייל אוטומטית לאחר יצירת הדוח.

### שליחה מחדש מכוונת

אם אתה רוצה לשלוח מייל שוב (למשל, בגלל שגיאה או לבדיקה):

```bash
npm run dev -- --resend-email
```

זה ישלח את הדוח **גם אם כבר נשלח** בעבר.

### השבתת מייל זמנית

אם אתה רוצה להריץ את המערכת **בלי** לשלוח מייל, פשוט הסר/comment את `EMAIL_PROVIDER`:

```bash
# EMAIL_PROVIDER=brevo
```

או השתמש ב-CLI flag:

```bash
EMAIL_PROVIDER= npm run dev
```

---

## פורמט המייל

### Subject (עברית בלבד)

```
[דוח טיקטוק יומי] – success_israel – 2026-02-04
```

**פורמט**:
```
{EMAIL_SUBJECT_PREFIX} – {profileHandle} – {reportDate}
```

### Body (טקסט רגיל)

```
═══════════════════════════════════════
📊 דוח יומי TikTok - success_israel
═══════════════════════════════════════

📅 תאריך דוח: 2026-02-03
⏰ תאריך יצירה: 2026-02-04T05:23:45.123Z
🌍 אזור זמן: Asia/Jerusalem
🎯 פרופיל: @success_israel
📈 סרטונים נמצאו: 15

---

📂 קטגוריה: Latest (15)

1️⃣ סרטון #1
   📝 תיאור: ...
   🔗 קישור: https://www.tiktok.com/@success_israel/video/...
   ⏰ פורסם: 03/02/2026, 09:15:23

... (עוד סרטונים) ...

---

דוח זה נוצר ונשלח באופן אוטומטי.
```

### Attachment

- **שם קובץ**: `2026-02-04-success_israel.txt`
- **תוכן**: אותו טקסט כמו ב-body
- **קידוד**: Base64 (אוטומטי ע"י Brevo)

### מייל ביום ריק

אם אין סרטונים (יום שקט/חג/שבת):

```
═══════════════════════════════════════
📊 דוח יומי TikTok - success_israel
═══════════════════════════════════════

📅 תאריך דוח: 2026-02-03
⏰ תאריך יצירה: 2026-02-04T05:23:45.123Z
🌍 אזור זמן: Asia/Jerusalem
🎯 פרופיל: @success_israel

---

לא פורסמו סרטוני TikTok ביום זה.

---

דוח זה נוצר ונשלח באופן אוטומטי.
```

---

## טיפול בשגיאות

### שגיאות נפוצות

#### 1. שגיאת אימות (401 Unauthorized)

```
❌ Brevo API error: 401 - Unauthorized
```

**פתרון**:
- בדוק שה-`BREVO_API_KEY` נכון
- וודא שה-API Key לא פג תוקף
- צור API Key חדש ב-Brevo

#### 2. שולח לא מאומת (400 Bad Request - Invalid sender)

```
❌ Brevo API error: 400 - Invalid sender domain
```

**פתרון**:
- וודא שהדומיין `vai.co.il` מאומת ב-Brevo
- עקוב אחר [הגדרת דומיין](#שלב-2-אימות-דומיין-sender-domain-verification)

#### 3. Rate limit (429 Too Many Requests)

```
⚠️ Retrying email send (attempt 2/3)
   error: Rate limit exceeded
```

**פתרון**:
- המערכת תנסה שוב אוטומטית (retry)
- אם התקבע, המתן מספר דקות ונסה שוב עם `--resend-email`

#### 4. כשל שליחה לא מפיל pipeline

```
❌ Report email failed
   error: Timeout after 30s
✅ Report saved: 2026-02-04 (emailStatus: FAILED)
✅ Pipeline completed successfully
```

זו התנהגות נכונה! המערכת:
- שמרה את הדוח ב-MongoDB
- שמרה את קובץ ה-TXT
- סימנה `emailStatus: FAILED`
- **לא קרסה**

### Retry Logic (לוגיקת ניסיון חוזר)

המערכת מנסה שוב **רק** על שגיאות זמניות:

| סוג שגיאה | Retry? | דוגמאות |
|-----------|--------|----------|
| 5xx (Server Error) | ✅ כן | 500, 502, 503 |
| 429 (Rate Limit) | ✅ כן | Too Many Requests |
| Timeout / Network | ✅ כן | ECONNRESET, ETIMEDOUT |
| 401 (Unauthorized) | ❌ לא | API Key שגוי |
| 403 (Forbidden) | ❌ לא | Sender לא מאושר |
| 400 (Bad Request) | ❌ לא | Invalid email format |

**הגדרות Retry**:
- מספר ניסיונות: 3 (ניתן להגדרה ב-`MAX_RETRIES`)
- Exponential backoff: 2s, 4s, 8s
- מקסימום המתנה: 10s

---

## שאלות נפוצות

### 1. האם המייל נשלח גם אם אין סרטונים?

**כן!** זו דרישה מפורשת מהאפיון. גם ביום שקט (חג/שבת) המערכת שולחת דוח עם ההודעה:
```
לא פורסמו סרטוני TikTok ביום זה.
```

### 2. מה קורה אם המייל נכשל?

המערכת:
- שומרת את הדוח ב-MongoDB ובקובץ TXT ✅
- מסמנת `emailStatus: FAILED` + `emailError` ✅
- **לא מפילה את ה-pipeline** ✅
- כותבת log ברור ✅

אתה יכול לנסות לשלוח שוב עם:
```bash
npm run dev -- --resend-email
```

### 3. איך אני יודע שהמייל נשלח בהצלחה?

בדרכים הבאות:

**א. Logs של המערכת:**
```bash
✅ Email sent successfully via Brevo
   messageId: <0200018e1234abcd...>
```

**ב. MongoDB:**
```javascript
db.reports.find({ reportDate: "2026-02-04" }, { emailStatus: 1, emailSentAt: 1 })
// { emailStatus: "SENT", emailSentAt: ISODate("...") }
```

**ג. תיבת הדואר של הנמען:**
- בדוק את תיבת הדואר הנכנס
- בדוק גם Spam/Junk (בפעם הראשונה)

**ד. Brevo Dashboard:**
- עבור ל-**Logs** → **Email Activity**
- חפש לפי `messageId` או תאריך

### 4. איך אני מוסיף/מסיר נמענים?

ערוך את `.env`:

```bash
# נמען יחיד
EMAIL_TO=client@example.com

# מספר נמענים
EMAIL_TO=client@example.com,manager@example.com,team@example.com

# עם CC
EMAIL_TO=client@example.com
EMAIL_TO_CC=manager@example.com,cfo@example.com

# עם BCC (נסתר)
EMAIL_TO_BCC=archive@example.com
```

הפעל מחדש את המערכת.

### 5. מה קורה אם אני מריץ את המערכת פעמיים לאותו תאריך?

**המערכת חכמה!** היא לא תשלח מייל פעמיים:

```bash
# ריצה ראשונה
npm run dev
# → מייל נשלח ✅

# ריצה שנייה (אותו תאריך)
npm run dev
# → "Email already sent for this report - skipping"
# → לא נשלח שוב ❌
```

אלא אם תשתמש ב-`--resend-email`:

```bash
npm run dev -- --resend-email
# → מייל נשלח שוב ✅ (מכוונת)
```

### 6. האם יש הגבלה על מספר המיילים?

**תלוי בתכנית Brevo שלך:**

| תכנית | מיילים/יום | מיילים/חודש |
|--------|-------------|--------------|
| Free | 300 | 9,000 |
| Lite | ללא הגבלה | 10,000 |
| Premium | ללא הגבלה | 20,000+ |

**במקרה שלנו:**
- מייל אחד ביום (דוח יומי)
- ~30 מיילים/חודש
- התכנית החינמית מספיקה! ✅

### 7. האם המערכת תומכת ב-HTML email?

כרגע **רק Plain Text**. זה אופטימלי עבור:
- קריאה קלה
- תאימות מלאה לכל הלקוחות
- קובץ TXT מצורף

אם תרצה HTML בעתיד, צור ticket חדש.

### 8. איך אני משנה את ה-subject prefix?

ערוך ב-`.env`:

```bash
# Default (עברית)
EMAIL_SUBJECT_PREFIX=[דוח טיקטוק יומי]

# English
EMAIL_SUBJECT_PREFIX=[Daily TikTok Report]

# Custom
EMAIL_SUBJECT_PREFIX=[VAI Analytics]
```

### 9. איך אני יכול לבדוק שה-domain מאומת?

**Brevo Dashboard:**
1. עבור ל-**Settings** → **Senders & IP**
2. לחץ על **Domains**
3. חפש את `vai.co.il`
4. הסטטוס צריך להיות:
   - ✅ **Verified** - מאומת
   - ⚠️ **Pending** - בבדיקה (חכה עד 48 שעות)
   - ❌ **Failed** - נכשל (בדוק רשומות DNS)

**DNS Check (חיצוני):**
```bash
# בדוק SPF
dig txt vai.co.il | grep spf

# בדוק DKIM
dig txt mail._domainkey.vai.co.il
```

### 10. איך אני מנתח בעיות אם המייל לא מגיע?

**צ'קליסט בדיקה:**

1. ✅ בדוק logs של המערכת - האם `emailStatus: SENT`?
2. ✅ בדוק Brevo Dashboard → Email Activity
3. ✅ בדוק תיבת Spam/Junk
4. ✅ בדוק שהנמען קיים ופעיל
5. ✅ בדוק SPF/DKIM records (MXToolbox.com)
6. ✅ נסה לשלוח ל-Gmail test account
7. ✅ פנה ל-Brevo Support אם הבעיה נמשכת

---

## תמיכה

אם נתקלת בבעיה:

1. בדוק את [טיפול בשגיאות](#טיפול-בשגיאות)
2. בדוק את [שאלות נפוצות](#שאלות-נפוצות)
3. בדוק logs של המערכת ב-`logs/` folder
4. צור GitHub Issue עם:
   - תיאור הבעיה
   - Logs רלוונטיים (הסר API keys!)
   - משתני סביבה (הסר sensitive data!)

---

**הצלחה! 🚀**
