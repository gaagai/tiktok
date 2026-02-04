# Changelog - TikTok Daily Scraper

## [2.2.0] - 2026-02-04

### 📧 Email Integration - שילוב שליחת דוחות במייל

גרסה זו מוסיפה יכולת שליחת דוחות יומיים אוטומטית במייל דרך Brevo Transactional Email.

#### ✨ תכונות חדשות:

**1. 📨 Automatic Daily Email Reports**
- שליחה אוטומטית לאחר יצירת דוח יומי
- תמיכה במספר נמענים (TO/CC/BCC)
- Subject בעברית: `[דוח טיקטוק יומי] – {profile} – {date}`
- טקסט הדוח + Footer קבוע
- קובץ TXT מצורף (base64)

**2. 🛡️ Robust Error Handling**
- כשל שליחה לא מפיל את ה-pipeline
- Retry חכם (רק על שגיאות זמניות: 5xx, 429, timeouts)
- שגיאות קבועות (401, 403, 400) - fail מיידי
- לוגים מפורטים לכל שלב

**3. 🔄 Idempotency Protection**
- לא שולח מייל פעמיים לאותו דוח
- בדיקת `emailStatus == SENT` לפני שליחה
- CLI flag: `--resend-email` לשליחה מחדש מכוונת

**4. 📊 Email Tracking**
- `emailStatus`: PENDING | SENT | FAILED
- `emailSentAt`: timestamp של שליחה מוצלחת
- `emailMessageId`: Brevo message ID
- `emailError`: הודעת שגיאה במקרה של כשל

**5. 📧 Send Reports Even on Empty Days**
- שולח דוח גם כש-`itemsInRange == 0`
- טקסט מותאם: "לא פורסמו סרטוני TikTok ביום זה"
- מבדיל בין יום שקט תקין לכשל טכני

#### 💾 שדות חדשים ב-Database:

**`reports` collection:**
```typescript
emailStatus?: 'PENDING' | 'SENT' | 'FAILED'
emailSentAt?: Date
emailMessageId?: string
emailError?: string
```

#### ⚙️ קונפיגורציה חדשה (.env):

```bash
# Email provider (רק 'brevo' נתמך כרגע)
EMAIL_PROVIDER=brevo

# Brevo API Key
BREVO_API_KEY=xkeysib-...

# From email (דומיין מאומת בלבד)
EMAIL_FROM=support@vai.co.il
EMAIL_FROM_NAME=VAI Reports

# To email(s) - comma-separated
EMAIL_TO=client@example.com,manager@example.com

# Optional: CC/BCC
EMAIL_TO_CC=...
EMAIL_TO_BCC=...

# Subject prefix (עברית נתמכת)
EMAIL_SUBJECT_PREFIX=[דוח טיקטוק יומי]
```

#### 📁 קבצים חדשים:

- `src/email/brevo.ts` - Brevo API client
- `src/email/index.ts` - Email orchestration

#### 🔧 שינויים בקבצים קיימים:

- `src/types/index.ts` - הוספת Email types
- `src/db/models.ts` - שדות email ב-Report schema
- `src/db/operations.ts` - `updateReportEmailStatus()`
- `src/utils/config.ts` - טעינת קונפיגורציית email
- `src/runDaily.ts` - שליחת מייל לאחר יצירת דוח (Step 10.5)

#### 🚀 שימוש:

```bash
# ריצה רגילה (שולח מייל אוטומטית)
npm run dev

# שליחה מחדש מכוונת
npm run dev -- --resend-email
```

#### ✅ Acceptance Criteria:

- ✅ יום רגיל עם סרטונים → נשלח מייל בעברית + attachment
- ✅ יום בלי סרטונים → נשלח מייל בעברית עם טקסט "לא פורסמו סרטונים"
- ✅ כשל שליחה → report נשמר, `emailStatus=FAILED`, pipeline לא נופל
- ✅ ריצה כפולה לאותו תאריך → לא נשלח מייל פעמיים
- ✅ `--resend-email` → שולח מחדש בכוונה

---

## [2.1.0] - 2026-02-04

### 🛡️ Reliability Hardening - חיזוק אמינות המערכת

גרסה זו מוסיפה 6 תוספות אפיון קריטיות למניעת כשלים שקטים, ריצות כפולות, ו-False Negatives/Positives.

#### ✨ תכונות חדשות:

**1. 🔒 Distributed Lock - מניעת ריצות במקביל**
- Lock מבוסס MongoDB למניעת race conditions
- TTL אוטומטי (default: 45 דקות)
- Format: `${profileHandle}:${reportDate}`
- מונע duplicate runs מ-cron jobs חופפים

**2. 📊 Data Quality Checks - בדיקת איכות נתונים**
- חישוב `missingCreateTimePct` ו-`missingUrlPct`
- ספים מוגדרים: 30% tolerance (ניתן להגדרה)
- מבדיל בין "אין תוכן" ל"נתונים שבורים"
- מפעיל fallback אם איכות נתונים נמוכה

**3. 🌙 Empty-Day Policy - מדיניות ימים ריקים**
- זיהוי אוטומטי של ימים שקטים תקינים (חגים/שבתות)
- בדיקת data quality לפני סיווג כ-"יום שקט"
- טקסט report מותאם: "לא פורסמו סרטוני TikTok ביום זה"
- status='ok' לימים שקטים תקינים (לא error)

**4. 📈 Empty-Day Streak Detection - זיהוי רצפים**
- ספירת ימים ריקים ברצף
- Alert על 2+ ימים ברצף (חשוד)
- 5+ ימים = המלצה להתערבות ידנית
- לא מפעיל fallback אוטומטי על streak (חיסכון בעלויות)

**5. 🔧 Fallback Logic Update - עדכון לוגיקת fallback**
- Trigger חדש: Empty Day + Data Quality Issue
- משולב עם Circuit Breaker
- 4 triggers סה"כ:
  1. Status FAILED/TIMED-OUT/ABORTED
  2. `itemsFetchedRaw == 0`
  3. `itemsInRange < threshold`
  4. `itemsInRange == 0` + Data Quality Issue

**6. 📝 New Database Fields - שדות חדשים**
- `runs`: +4 שדות (missingCreateTimePct, missingUrlPct, emptyDay, emptyDayStreak)
- `reports`: +2 שדות (emptyDay, emptyDayStreak)
- `locks`: collection חדשה לגמרי

#### 💾 שדות חדשים ב-Database:

**Collection: `runs`**
```typescript
missingCreateTimePct?: number;   // אחוז items עם createTime חסר
missingUrlPct?: number;           // אחוז items עם URL חסר
emptyDay?: boolean;               // האם יום ריק תקין
emptyDayStreak?: number;          // מספר ימים ריקים ברצף
```

**Collection: `reports`**
```typescript
emptyDay?: boolean;
emptyDayStreak?: number;
```

**Collection: `locks` (חדש)**
```typescript
_id: string;           // ${profileHandle}:${reportDate}
lockedAt: Date;
expiresAt: Date;      // TTL index
```

#### 🆕 משתני סביבה חדשים:

```bash
# Lock Configuration
LOCK_TTL_MINUTES=45

# Data Quality Thresholds
MAX_MISSING_CREATETIME_PCT=0.3
MAX_MISSING_URL_PCT=0.3
```

#### 📁 קבצים חדשים:

- `src/db/lock.ts` - Distributed Lock logic
- `src/utils/dataQuality.ts` - Data Quality validation

#### 📁 קבצים ששונו:

- `src/types/index.ts` - +3 interfaces חדשים
- `src/db/models.ts` - Lock schema + שדות חדשים
- `src/db/operations.ts` - `getEmptyDayStreak()`
- `src/actors.ts` - `shouldFallback()` עם Data Quality
- `src/report/generator.ts` - Empty day support
- `src/alert/logger.ts` - `alertEmptyDayStreak()`
- `src/utils/config.ts` - Config חדש
- `src/runDaily.ts` - שילוב כל התוספות
- `.env.example` - משתנים חדשים

#### 🎯 השפעה:

- ✅ **אמינות**: מניעת race conditions וכשלים שקטים
- 💰 **חיסכון**: פחות fallback מיותר על ימים שקטים
- 📊 **דיוק**: הבחנה מדויקת בין quiet days לתקלות
- 🔍 **ניטור**: זיהוי מוקדם של בעיות (streak detection)
- 📈 **איכות נתונים**: בדיקות אוטומטיות לזיהוי data corruption

#### 🔄 Migration Notes:

1. העתק משתנים חדשים מ-`.env.example` ל-`.env`
2. MongoDB ייצור את ה-`locks` collection אוטומטית
3. השדות החדשים ב-`runs`/`reports` יתווספו אוטומטית (backward compatible)
4. אין צורך ב-migration script - הכל backward compatible

---

## [2.0.1] - 2026-02-04

### 🎯 Enhanced - Smart Fallback Logic

שיפור בלוגיקת ההחלטה מתי להפעיל Fallback Actor - הבחנה בין ימים שקטים לתקלות טכניות.

#### מה השתנה:

**לוגיקת Fallback מעודכנת:**
- ✅ **ימים שקטים (חגים/שבתות)** - אם `itemsInRange=0` אבל `itemsFetchedRaw>0` וסטטוס SUCCEEDED → זה מצב תקין, **לא מפעילים fallback**
- ✅ **תקלות טכניות** - אם `itemsFetchedRaw=0` או `itemsInRange < threshold` → **מפעילים fallback**
- ✅ **דוחות משופרים** - טקסט מותאם: "לא פורסמו סרטוני TikTok ביום זה" במקום אזהרה
- ✅ **אלרטים חכמים** - לא שולחים alerts על ימים שקטים תקינים

**דוגמאות:**

| מצב | itemsFetchedRaw | itemsInRange | Fallback? | הערה |
|-----|-----------------|--------------|-----------|------|
| יום כיפור | 40 | 0 | ❌ | מצב תקין - יום שקט |
| שבת | 40 | 0 | ❌ | מצב תקין - יום שקט |
| יום רגיל עם תקלה | 40 | 6 | ✅ | חשוד - מעט מדי |
| תקלה API מלאה | 0 | 0 | ✅ | תקלה טכנית |

#### קבצים ששונו:

- `src/actors.ts` - עדכון `shouldFallback()` עם פרמטר `itemsFetchedRaw`
- `src/runDaily.ts` - הבחנה בין ימים שקטים לתקלות
- `src/report/generator.ts` - טקסטים מותאמים ליום שקט
- `src/report/templates.ts` - תמיכה בטקסט "לא פורסמו סרטונים"

#### השפעה:

- 💰 **חיסכון בעלויות** - fallback לא ירוץ מיותר בשבתות/חגים
- 📊 **דוחות נקיים** - אין אזהרות על ימים שקטים תקינים
- 🔔 **אלרטים רלוונטיים** - רק על תקלות אמיתיות

---

## [2.0.0] - 2026-02-04

### 🚀 Major Update - Primary/Fallback Architecture

המערכת עברה שדרוג ארכיטקטוני מרכזי למערכת דו-שלבית עם Primary/Fallback actors והגנת עלויות.

#### ✨ תכונות חדשות:

**1. Primary/Fallback Actor System**
- Actor ראשי (Primary): `apidojo/tiktok-profile-scraper` - זול, רץ תמיד קודם
- Actor גיבוי (Fallback): `clockworks/tiktok-profile-scraper` - יקר, רץ רק בצורך
- לוגיקת החלטה אוטומטית מתי להפעיל fallback

**2. Circuit Breaker - הגנת עלויות**
- מניעת שימוש יתר ב-fallback actor היקר
- מגבלה: פעם אחת ל-48 שעות (ניתן להגדרה)
- חסימה אוטומטית כשעוברים את המגבלה
- Alert במקרה של חסימה

**3. Normalization Layer**
- טיפול בפורמטים שונים מ-actors שונים
- יישור קו אוטומטי למבנה אחיד
- זיהוי ותיקון שדות חסרים
- warning flags על בעיות

**4. Enhanced Monitoring**
- `reportDate` (YYYY-MM-DD) - זיהוי יום ייחודי
- `actorUsed` - מעקב אחר actor שנבחר
- `fallbackReason` - סיבה למעבר ל-fallback
- `circuitBreakerSuppressed` - סימון חסימת fallback
- `warningFlags` - רשימת אזהרות למעקב

**5. Improved Reports**
- מידע על מקור הנתונים (Primary/Fallback)
- הצגת warning flags בעברית
- סטטוס משופר (ok/warning/error)

#### 💥 Breaking Changes:

**Environment Variables:**
```diff
- APIFY_ACTOR_ID=clockworks/tiktok-profile-scraper
+ PRIMARY_ACTOR_ID=apidojo/tiktok-profile-scraper
+ FALLBACK_ACTOR_ID=clockworks/tiktok-profile-scraper
+ LOW_RESULTS_THRESHOLD=10
+ RUN_TIMEOUT_MINUTES=12
+ POLL_INTERVAL_SECONDS=10
+ MAX_RETRIES=3
+ FALLBACK_MAX_PER_48H=1
- MAX_POSTS=50
+ MAX_POSTS=40
```

**Database Schema Changes:**
- `runs` collection: +7 שדות חדשים
- `videos` collection: +1 שדה חדש
- `reports` collection: +2 שדות חדשים
- 2 indexes חדשים על `runs`

#### 📁 קבצים חדשים:

- `src/actors.ts` - Primary/Fallback orchestration
- `src/normalize.ts` - Normalization layer

#### 📝 קבצים ששונו:

- `src/runDaily.ts` - Refactor מלא עם flow חדש
- `src/apify/client.ts` - תמיכה ב-multi-actor
- `src/db/models.ts` - שדות חדשים ב-schemas
- `src/db/operations.ts` - פונקציות חדשות
- `src/report/generator.ts` - תמיכה ב-actorUsed + warningFlags
- `src/report/templates.ts` - עדכון templates
- `src/alert/logger.ts` - 3 alert functions חדשות
- `src/types/index.ts` - טיפוסים מורחבים
- `src/utils/config.ts` - קונפיגורציה מורחבת
- `.env.example` - משתנים חדשים

#### 🔧 Migration Guide:

**שלב 1: עדכון .env**
```bash
# הוסף את כל המשתנים החדשים מ-.env.example
cp .env.example .env.new
# ערוך .env.new והחלף את .env הישן
```

**שלב 2: Build & Restart**
```bash
npm run build
pm2 restart tiktok-scraper
pm2 logs tiktok-scraper
```

**שלב 3: Verify**
- בדוק ש-runs חדשים כוללים `reportDate`
- בדוק ש-`actorUsed` מופיע בrecords
- נטר logs ליום ראשון

#### ⚠️ Important Notes:

- **Backward Compatibility**: שדות חדשים ב-MongoDB הם optional - runs ישנים לא ישברו
- **Cost Impact**: Primary actor זול יותר אבל אם לא עובד יעבור ל-fallback
- **Circuit Breaker**: מוגדר ל-1 fallback ל-48h - התאם לפי צורך
- **Testing Required**: מומלץ לבדוק על סביבת dev לפני production

---

## [1.2.1] - 2026-02-04

### 🐛 Fixed - Apify API URL Format

תיקון טכני ב-Apify client לתמיכה נכונה ב-Actor IDs עם slash.

#### שינויים:

- **Apify URL encoding**: החלפת `/` ב-`~` ב-Actor ID עבור API URLs
  - דוגמה: `clockworks/tiktok-profile-scraper` → `clockworks~tiktok-profile-scraper`
  - תואם לפורמט הנדרש של Apify API v2
- **קובץ ששונה**: `src/apify/client.ts` (שורות 34-36)

#### השפעה:
- ✅ מבטיח תקשורת תקינה עם Apify API
- ✅ תומך ב-Actor IDs בפורמט `namespace/actor-name`
- ✅ אין שינוי בממשק או בהגדרות

---

## [1.2.0] - 2026-02-02

### 🔄 Changed - Internal Scheduler (node-cron)

המערכת עברה מ-system cron חיצוני ל-**scheduler פנימי** עם `node-cron`.

#### שינויים עיקריים:

- **node-cron מובנה**: הסקריפט רץ כשירות 24/7 עם scheduler פנימי
- **PM2 Process Manager**: שומר על התהליך חי עם auto-restart
- **אין צורך ב-crontab**: הכל מתוזמן בתוך הקוד
- **Portable**: אותו קוד עובד על כל סביבה (DO Droplet, AWS, etc.)

#### קבצים חדשים:
- `ecosystem.config.js` - קונפיגורציית PM2
- `PM2_GUIDE.md` - מדריך מלא לPM2

#### קבצים שהשתנו:
- `src/index.ts` - שונה ל-scheduler mode
- `package.json` - נוסף `node-cron` + `@types/node-cron`
- `README.md` - הוראות PM2 במקום crontab
- `QUICKSTART.md` - עדכון הוראות

#### קבצים שנמחקו:
- ❌ `crontab.example` - לא בשימוש יותר

#### Breaking Changes:
- ⚠️ צריך להתקין PM2: `npm install -g pm2`
- ⚠️ השינוי מ-`npm run start` (one-shot) ל-scheduler mode
- ✅ שירות רץ 24/7 במקום ריצות נפרדות

---

## [1.1.0] - 2026-02-02

### ✨ Changed - Yesterday Filter Logic

המערכת עודכנה לסנן **רק סרטונים מיום אתמול** במקום 25 שעות אחרונות.

#### שינויים עיקריים:

- **סינון חכם**: כעת המערכת אוספת רק סרטונים שפורסמו ביום אתמול (00:00-23:59)
- **שעת הרצה**: שונתה מ-08:00 ל-**07:00 בבוקר** כדי לוודא שכל הסרטונים של אתמול נאספו
- **דוח מדויק**: הדוח מציג "סרטונים מתאריך: DD/MM/YYYY (אתמול)" במקום "חלון זמן: 25 שעות"

#### דוגמה:
- **ריצה ב-02/02/2026 בשעה 07:00** → אוסף סרטונים מ-**01/02/2026** בלבד

#### קבצים שהשתנו:
- `src/utils/date.ts` - נוספה `getYesterdayRange()` ו-`isFromYesterday()`
- `src/runDaily.ts` - סינון לפי טווח אתמול לפני upsert ודוח
- `src/report/generator.ts` - עדכון לוגיקת יצירת דוח
- `src/report/templates.ts` - עדכון טקסטים בעברית
- `src/utils/config.ts` - `windowHours` קבוע ל-24
- `.env.example` - הוסרה `WINDOW_HOURS`
- `crontab.example` - שעה 07:00 במקום 08:00

#### Breaking Changes:
- ❌ `WINDOW_HOURS` הוסר מ-.env (לא בשימוש יותר)
- ✅ הקונפיגורציה פשוטה יותר - פחות פרמטרים

---

## [1.0.0] - 2026-02-02

### 🚀 Initial Release

- ✅ TypeScript project structure
- ✅ Apify API integration
- ✅ MongoDB Atlas storage
- ✅ Daily report generation
- ✅ Winston logging system
- ✅ Fail-safe mechanisms (retry, idempotency)
- ✅ Alert system
- ✅ Backup & retention
- ✅ Cron-ready deployment
