# TikTok Daily Scraper - Project Status

**תאריך עדכון אחרון**: 04/02/2026  
**גרסה**: 2.2.0  
**סטטוס**: ⚠️ **Requires Build, Testing & Deployment**

---

## סיכום מהיר

המערכת עברה שדרוג מרכזי ל-**Primary/Fallback Architecture** עם Circuit Breaker להגנת עלויות.

**חדש ב-v2.2.0:** Email Integration - שליחת דוחות יומיים במייל:
- 📧 **Automatic Email Reports** - שליחה אוטומטית דרך Brevo Transactional
- 🛡️ **Robust Error Handling** - כשל שליחה לא מפיל pipeline
- 🔄 **Idempotency** - מניעת שליחה כפולה
- 📊 **Email Tracking** - status, timestamp, messageId, errors
- 🌍 **Hebrew Support** - subject ותוכן בעברית מלא

**חדש ב-v2.1.0:** Reliability Hardening - 6 תוספות אפיון קריטיות:
- 🔒 **Distributed Lock** - מניעת ריצות במקביל
- 📊 **Data Quality Checks** - בדיקת איכות נתונים
- 🌙 **Empty-Day Policy** - זיהוי ימים שקטים תקינים
- 📈 **Streak Detection** - זיהוי רצפי ימים ריקים
- 🔧 **Enhanced Fallback** - לוגיקה משופרת עם Data Quality
- 📝 **Extended Schemas** - שדות חדשים ב-DB

### מה השתנה ב-v2.0:

🔄 **Primary/Fallback Actors** - מערכת דו-שלבית לאמינות  
🛡️ **Circuit Breaker** - הגנה אוטומטית על עלויות  
🔍 **Normalization Layer** - טיפול בפורמטים שונים מ-actors  
📊 **Enhanced Reporting** - דוחות עם מידע על מקור הנתונים  
⚙️ **New Configuration** - משתני סביבה מורחבים

### מה השתנה ב-v2.2.0:

📧 **Email Integration** - שליחת דוחות יומיים במייל אוטומטית  
🛡️ **Robust Error Handling** - retry חכם, כשל לא מפיל pipeline  
🔄 **Idempotency Protection** - מניעת שליחה כפולה + `--resend-email` flag  
📊 **Email Tracking** - שדות חדשים ב-reports: emailStatus, emailSentAt, emailMessageId  
🌍 **Hebrew Support** - subject, body, footer בעברית מלא  
📎 **TXT Attachment** - קובץ דוח מצורף לכל מייל

### מה השתנה ב-v2.1.0:

🔒 **Distributed Lock** - מניעת race conditions מ-cron jobs חופפים  
📊 **Data Quality Checks** - זיהוי נתונים שבורים vs. אין תוכן  
🌙 **Empty-Day Policy** - סיווג נכון של ימים שקטים (חגים/שבתות)  
📈 **Streak Detection** - זיהוי רצפי ימים ריקים חשודים  
🔧 **Enhanced Fallback** - 4 triggers כולל Data Quality  
📝 **Extended DB** - שדות חדשים + `locks` collection

---

## ארכיטקטורה חדשה (v2.0)

### Primary/Fallback Flow

```
07:00 Daily Run
     ↓
Calculate reportDate (yesterday YYYY-MM-DD)
     ↓
Run PRIMARY Actor (apidojo - cheap)
     ↓
Normalize results
     ↓
Filter by yesterday (00:00-23:59)
     ↓
Check if fallback needed:
  - Status FAILED?
  - itemsInRange == 0?
  - itemsInRange < threshold?
     ↓
  [YES] → Check Circuit Breaker
           ↓
         [ALLOWED] → Run FALLBACK Actor (clockworks - expensive)
                  → Normalize & Filter
           ↓
         [BLOCKED] → Use PRIMARY results + Alert
     ↓
  [NO] → Continue with PRIMARY results
     ↓
Upsert to MongoDB
     ↓
Generate Report
     ↓
Save Run Record (with actor metadata)
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **Actors Orchestration** | `src/actors.ts` | Primary/Fallback logic + Circuit Breaker |
| **Email Integration** | `src/email/` | Brevo transactional email with retry & tracking |
| **Normalization** | `src/normalize.ts` | Unify different actor outputs |
| **Pipeline** | `src/runDaily.ts` | Main orchestrator |
| **Config** | `src/utils/config.ts` | Multi-actor configuration |
| **DB Schemas** | `src/db/models.ts` | Extended with metadata fields |
| **Lock** | `src/db/lock.ts` | Distributed Lock (v2.1.0) |
| **Data Quality** | `src/utils/dataQuality.ts` | Quality validation (v2.1.0) |

---

## מצב נוכחי (v2.1.0)

### ✅ מה הושלם:

- ✅ **Primary/Fallback Logic** - מערכת דו-שלבית מלאה
- ✅ **Circuit Breaker** - מגבלת fallback ל-48 שעות
- ✅ **Normalization Layer** - תמיכה ב-2 actor formats
- ✅ **Enhanced Schemas** - שדות חדשים ב-runs/reports
- ✅ **Distributed Lock** - מניעת race conditions (v2.1.0)
- ✅ **Data Quality Checks** - בדיקות אוטומטיות (v2.1.0)
- ✅ **Empty-Day Detection** - זיהוי ימים שקטים (v2.1.0)
- ✅ **Streak Detection** - מעקב אחר רצפים (v2.1.0)

### ⚠️ דורש בדיקה:

- ⚠️ **TypeScript Compilation** - צריך `npm run build`
- ⚠️ **Integration Test** - בדיקת flow מלא עם תוספות חדשות
- ⚠️ **Lock Mechanism** - וודא שה-lock עובד נכון
- ⚠️ **Data Quality** - בדוק חישוב percentages
- ⚠️ **Empty Day Streak** - בדוק שה-streak מחושב נכון
- ⚠️ **Migration** - עדכון ידני של .env נדרש

---

## Breaking Changes (v1.x → v2.0)

### Environment Variables

**הוסרו:**
- ❌ `APIFY_ACTOR_ID` (replaced)

**נוספו:**
- ✅ `PRIMARY_ACTOR_ID` (default: `apidojo/tiktok-profile-scraper`)
- ✅ `FALLBACK_ACTOR_ID` (default: `clockworks/tiktok-profile-scraper`)
- ✅ `LOW_RESULTS_THRESHOLD` (default: 10)
- ✅ `RUN_TIMEOUT_MINUTES` (default: 12)
- ✅ `POLL_INTERVAL_SECONDS` (default: 10)
- ✅ `MAX_RETRIES` (default: 3)
- ✅ `FALLBACK_MAX_PER_48H` (default: 1)

**שונו:**
- 🔄 `MAX_POSTS`: 50 → **40** (cost optimization)

### Database Schema

**שדות חדשים ב-`runs`:**
- `reportDate` (string, YYYY-MM-DD) - **קריטי ל-Circuit Breaker**
- `actorUsed` ('primary' | 'fallback')
- `fallbackReason` ('FAILED' | 'ZERO_RESULTS' | 'LOW_RESULTS' | null)
- `circuitBreakerSuppressed` (boolean)
- `itemsFetchedRaw` (number)
- `itemsInRange` (number)
- `warningFlags` (string[])

**שדות חדשים ב-`videos`:**
- `actorUsed` ('primary' | 'fallback')

**שדות חדשים ב-`reports`:**
- `actorUsed` ('primary' | 'fallback')
- `warningFlags` (string[])

**Indexes חדשים:**
- `runs`: `{ profileHandle: 1, reportDate: -1 }`
- `runs`: `{ actorUsed: 1 }`

---

## מדריך Migration מגרסה 1.x

### שלב 1: עדכון קוד

```bash
cd /path/to/tiktok-scraper
git pull origin main
npm install  # אם יש dependencies חדשים
npm run build
```

### שלב 2: עדכון .env

העתק את `.env.example` החדש והתאם:

```bash
cp .env.example .env.new
# ערוך .env.new עם הטוקנים והקונפיגורציה שלך
# בדוק שכל המשתנים החדשים מוגדרים
```

**חובה לשנות:**
```env
# OLD (remove):
APIFY_ACTOR_ID=clockworks/tiktok-profile-scraper

# NEW (add):
PRIMARY_ACTOR_ID=apidojo/tiktok-profile-scraper
FALLBACK_ACTOR_ID=clockworks/tiktok-profile-scraper
LOW_RESULTS_THRESHOLD=10
RUN_TIMEOUT_MINUTES=12
POLL_INTERVAL_SECONDS=10
MAX_RETRIES=3
FALLBACK_MAX_PER_48H=1
```

**מומלץ לשנות:**
```env
MAX_POSTS=40  # (was 50)
```

### שלב 3: Restart שירות

```bash
pm2 restart tiktok-scraper
pm2 logs tiktok-scraper --lines 50
```

### שלב 4: בדיקת תקינות

```bash
# בדוק logs לאחר ריצה ראשונה
pm2 logs tiktok-scraper --err

# בדוק MongoDB
# - וודא ש-runs חדשים כוללים reportDate
# - בדוק ש-actorUsed מופיע
```

---

## מבנה הפרויקט (v2.0)

```
tiktok-scraper/
├── 📁 src/                    [18 TypeScript files]
│   ├── index.ts               ← Scheduler (node-cron)
│   ├── runDaily.ts            ← Main pipeline (REFACTORED)
│   ├── actors.ts              ← NEW: Primary/Fallback logic
│   ├── normalize.ts           ← NEW: Normalization layer
│   ├── apify/                 ← Apify client (updated)
│   ├── db/                    ← MongoDB (updated schemas)
│   ├── report/                ← Report generator (updated)
│   ├── alert/                 ← Alerts (expanded)
│   ├── utils/                 ← Utilities
│   └── types/                 ← TypeScript types (expanded)
│
├── 📁 dist/                   [Compiled JavaScript]
├── 📁 backups/                [Auto-created]
├── 📁 logs/                   [Auto-created]
│
├── 📄 .env.example            ← UPDATED with new vars
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 ecosystem.config.js     ← PM2 config
│
└── 📚 Documentation:
    ├── README.md              ← UPDATED for v2.0
    ├── QUICKSTART.md          ← UPDATED
    ├── PROJECT_STATUS.md      ← This file (UPDATED)
    ├── CHANGELOG.md           ← UPDATED with v2.0 changes
    ├── PM2_GUIDE.md
    ├── DEPLOYMENT_DO.md
    └── TESTING_CHECKLIST.md
```

---

## Circuit Breaker Explained

### מטרה

למנוע שימוש יתר ב-fallback actor היקר ולשמור על תקציב הAPIFY.

### איך זה עובד?

1. כל פעם ש-fallback רץ, המערכת שומרת את ה-`reportDate` ב-`runs` collection
2. לפני הפעלת fallback, המערכת בודקת כמה פעמים fallback רץ ב-48 שעות האחרונות
3. אם המספר >= `FALLBACK_MAX_PER_48H`, fallback **נחסם**
4. המערכת ממשיכה עם תוצאות ה-primary + שולחת alert

### דוגמה

```
יום א': Primary נכשל → Fallback רץ ✅
יום ב': Primary נכשל → Fallback **נחסם** ❌ (כבר רץ ב-48h)
יום ד': Primary נכשל → Fallback רץ ✅ (עברו 48h)
```

---

## Smart Fallback Logic (v2.0.1)

### מטרה

להבחין בין **ימים שקטים תקינים** (חגים, שבתות) לבין **תקלות טכניות** שדורשות fallback.

### עיקרון הליבה

**"Fallback נועד להציל ימים שבורים, לא לשרוף כסף על ימים שקטים"**

- אפס סרטונים זה **לפעמים תקין** (יום כיפור, שבת)
- מעט סרטונים זה **חשוד** (Primary אולי פספס משהו)

### מתי fallback **ירוץ**?

1. **כשל טכני** - `status FAILED/TIMED-OUT/ABORTED`
2. **אין נתונים כלל** - `itemsFetchedRaw == 0` (חשוד: API חסום/שינוי)
3. **מעט מדי תוכן** - `itemsInRange > 0` אבל `< LOW_RESULTS_THRESHOLD` (חשוד: Primary פספס)

### מתי fallback **לא ירוץ**?

**יום שקט תקין:**
- ✅ `status == SUCCEEDED`
- ✅ `itemsFetchedRaw > 0` (Primary הביא נתונים)
- ✅ `itemsInRange == 0` (אבל אין מהיום הקודם)
- ✅ `!fallbackReason` (לא היה טריגר אחר)

→ זה מצב עסקי תקין, לא תקלה!

### דוגמאות

| מצב | itemsFetchedRaw | itemsInRange | Fallback? | הסבר |
|-----|-----------------|--------------|-----------|------|
| 🕍 יום כיפור | 40 | 0 | ❌ | Primary הביא 40 פריטים, אף אחד לא מאתמול - **תקין** |
| 🕊️ שבת רגילה | 40 | 0 | ❌ | Primary הביא 40 פריטים, אף אחד לא מאתמול - **תקין** |
| ⚠️ יום רגיל חשוד | 40 | 6 | ✅ | Primary הביא 40, רק 6 מאתמול - **חשוד, מריץ fallback** |
| 🚫 תקלה מלאה | 0 | 0 | ✅ | Primary לא הביא כלום - **תקלה טכנית** |
| 💥 Primary נכשל | - | - | ✅ | סטטוס FAILED - **תקלה** |

### תוצאות

- 💰 **חיסכון בעלויות** - fallback לא ירוץ בכל שבת/חג
- 📊 **דוחות נקיים** - "לא פורסמו סרטונים ביום זה" במקום אזהרה
- 🔕 **אלרטים רלוונטיים** - רק על תקלות אמיתיות

---

## Reliability Hardening (v2.1.0)

### סקירה כללית

גרסה 2.1.0 מוסיפה 6 תוספות אפיון קריטיות למניעת כשלים שקטים, ריצות כפולות, ו-False Negatives/Positives.

**משפט המפתח:**  
> "Fallback מציל ימים שבורים. Lock מונע כאוס. Data Quality מבדיל בין שקט לתקלה. Empty-streak מזהה בעיות בלי לבזבז כסף."

---

### 1️⃣ Distributed Lock - מניעת ריצות במקביל

**הבעיה:**
- Cron יכול להפעיל ריצה חדשה בזמן שריצה קודמת עדיין רצה
- בלי Lock → race conditions, כתיבה כפולה, reports לא עקביים

**הפתרון:**
- Lock מבוסס MongoDB עם TTL
- Format: `${profileHandle}:${reportDate}`
- TTL default: 45 דקות
- Lock נרכש בתחילת Pipeline ומשתחרר בסוף

**מימוש:**
```typescript
// בתחילת runDaily.ts
const lockAcquired = await acquireLock(profileHandle, reportDate);
if (!lockAcquired) {
  return { success: true, warningFlags: ['LOCK_ACTIVE'] };
}

// בסוף (finally block)
await releaseLock(profileHandle, reportDate);
```

---

### 2️⃣ Data Quality Checks - בדיקת איכות נתונים

**מטרה:**
להבדיל בין:
- "אין תוכן באמת" ✅
- "יש תוכן אבל הנתונים שבורים" ❌

**מדדים:**
- `missingCreateTimePct` - אחוז items עם createTime חסר
- `missingUrlPct` - אחוז items עם URL חסר

**ספים:**
- `MAX_MISSING_CREATETIME_PCT = 0.3` (30%)
- `MAX_MISSING_URL_PCT = 0.3` (30%)

**כללים:**
אם אחד מהספים עובר:
1. `warningFlags += 'DATA_QUALITY_ISSUE'`
2. אם `itemsInRange == 0` → מפעיל fallback (זה לא "יום שקט")

---

### 3️⃣ Empty-Day Policy - מדיניות ימים ריקים

**עיקרון:**
לא כל "0 תוצאות" הוא תקלה. צריך להבחין.

**Empty Day תקין:**
- `itemsInRange == 0`
- `itemsFetchedRaw > 0` (Primary הצליח)
- Data Quality תקין (אחוזים מתחת לספים)

**במצב זה:**
- `report.status = 'ok'` (לא error!)
- טקסט: "לא פורסמו סרטוני TikTok ביום זה."
- אין fallback
- אין alert

**Empty Day חשוד:**
- `itemsInRange == 0`
- אבל Data Quality לא תקין
- → זה תקלה, לא יום שקט

---

### 4️⃣ Empty-Day Streak Detection - רצף ימים ריקים

**הבעיה:**
- יום אחד בלי תוכן → לגיטימי
- יומיים–שלושה ברצף → חשוד

**מימוש:**
- חישוב `emptyDayStreak` - ימים ריקים רצופים אחורה
- רק ימים עם `itemsInRange=0` ו-`status='ok'`

**כללים:**
- `emptyDayStreak >= 2` → שולח alert `SUSPICIOUS_EMPTY_STREAK`
- `emptyDayStreak >= 5` → המלצה להתערבות ידנית
- ⚠️ לא מריץ fallback אוטומטי (חיסכון בכסף)

---

### 5️⃣ Enhanced Fallback Logic - עדכון לוגיקה

**Fallback ירוץ רק אם:**
1. **כשל טכני** - `status FAILED/TIMED-OUT/ABORTED`
2. **אין נתונים כלל** - `itemsFetchedRaw == 0`
3. **מעט תוכן חשוד** - `itemsInRange > 0` אבל `< threshold`
4. **Empty Day + Data Quality Issue** - `itemsInRange == 0` + איכות נמוכה

**ובכל מקרה:**
- Fallback כפוף ל-Circuit Breaker

---

### 6️⃣ שדות חדשים ב-Database

**`runs` collection:**
```typescript
missingCreateTimePct?: number;
missingUrlPct?: number;
emptyDay?: boolean;
emptyDayStreak?: number;
```

**`reports` collection:**
```typescript
emptyDay?: boolean;
emptyDayStreak?: number;
```

**`locks` collection (חדש):**
```typescript
_id: string;           // ${profileHandle}:${reportDate}
lockedAt: Date;
expiresAt: Date;      // TTL index
```

---

## Monitoring & Alerts

### Alert Types (עודכן ב-v2.1.0)

| Alert | Level | Trigger |
|-------|-------|---------|
| `alertFallbackTriggered` | WARNING | Fallback נדרש ורץ |
| `alertCircuitBreakerBlocked` | ERROR | Fallback נדרש אבל נחסם |
| `alertNormalizationWarnings` | WARNING | בעיות ב-normalization |
| `alertNoResults` | ERROR | itemsInRange == 0 |
| `alertLowResults` | WARNING | itemsInRange < threshold |
| `alertApifyFailed` | ERROR | Actor status FAILED |
| `alertPipelineCrashed` | CRITICAL | Pipeline crash |
| `alertEmptyDayStreak` | WARNING | 2+ ימים ריקים ברצף (v2.1.0) |

### Warning Flags (עודכן ב-v2.1.0)

מופיעים בדוחות וב-run records:

- `CIRCUIT_BREAKER_SUPPRESSED` - fallback נחסם
- `PRIMARY_FAILED` - primary נכשל
- `ZERO_RESULTS` - אין תוצאות
- `LOW_RESULTS` - תוצאות מתחת לthreshold
- `MISSING_VIDEO_URL` - חסר URL בחלק מהסרטונים
- `MISSING_CREATE_TIME` - חסר זמן יצירה
- `URL_BUILT_FROM_ID` - URL נבנה מ-videoId
- `DATA_QUALITY_ISSUE` - איכות נתונים נמוכה (v2.1.0)
- `HIGH_MISSING_CREATETIME` - אחוז גבוה של createTime חסר (v2.1.0)
- `HIGH_MISSING_URL` - אחוז גבוה של URL חסר (v2.1.0)
- `EMPTY_STREAK` - רצף ימים ריקים (v2.1.0)
- `LOCK_ACTIVE` - ריצה חופפת זוהתה (v2.1.0)

---

## Testing Checklist (v2.0)

### Phase 1: Basic Compilation

- [ ] `npm run build` עובר בלי שגיאות
- [ ] אין TypeScript errors
- [ ] כל ה-imports נכונים

### Phase 2: Configuration

- [ ] `.env` מכיל את כל המשתנים החדשים
- [ ] `getConfig()` לא זורק exception
- [ ] Validation עובר על ערכים תקינים

### Phase 3: Database

- [ ] MongoDB connection מצליחה
- [ ] Indexes נוצרים (כולל החדשים)
- [ ] שדות חדשים נשמרים בלי errors

### Phase 4: Scenario Testing

**Scenario 1: Primary Success**
- [ ] Primary actor מצליח
- [ ] itemsInRange >= threshold
- [ ] לא עובר ל-fallback
- [ ] Report מציין "Primary Actor"

**Scenario 2: Primary Fails → Fallback Runs**
- [ ] Primary נכשל (או itemsInRange=0)
- [ ] Circuit breaker מאפשר
- [ ] Fallback רץ
- [ ] Report מציין "Fallback Actor"
- [ ] `actorUsed='fallback'` ב-DB

**Scenario 3: Primary Fails → Circuit Breaker Blocks**
- [ ] Primary נכשל
- [ ] Fallback כבר רץ פעמיים ב-48h
- [ ] Circuit breaker חוסם
- [ ] Run status = PARTIAL
- [ ] Alert נשלח
- [ ] `circuitBreakerSuppressed=true`

**Scenario 4: Low Results → Fallback**
- [ ] Primary מצליח אבל itemsInRange < 10
- [ ] Fallback רץ
- [ ] Report מציין warning

### Phase 5: Idempotency

- [ ] ריצה כפולה לאותו reportDate לא יוצרת duplicates
- [ ] `videoId` unique constraint עובד

---

## Technical Specs (v2.0)

- **Language**: TypeScript 5.7.2 (ES2022)
- **Runtime**: Node.js 22.x
- **Database**: MongoDB Atlas M0 (Free)
- **Primary Actor**: Apify `apidojo/tiktok-profile-scraper`
- **Fallback Actor**: Apify `clockworks/tiktok-profile-scraper`
- **Scheduler**: node-cron 3.0.3
- **Process Manager**: PM2
- **Logger**: Winston 3.17.0
- **Dependencies**: 7 core packages

---

## Known Limitations (v2.0)

1. **No Automatic Migration** - עדכון .env ידני נדרש
2. **Circuit Breaker per Profile** - לא גלובלי (אם יש multi-profile בעתיד)
3. **48h Rolling Window** - מחושב מ-reportDate, לא מזמן ריצה
4. **Normalization Best-Effort** - אם חסרים שדות קריטיים, הפריט נדחה
5. **Single Profile** - רק success_israel (multi-profile בעתיד)

---

## Roadmap v2.1+

### v2.1 (Short-term)
- [ ] Automated migration script
- [ ] Email/Slack notifications for circuit breaker
- [ ] Dashboard UI להצגת fallback usage
- [ ] CLI tool עם `--date` flag לריצות ידניות

### v3.0 (Long-term)
- [ ] Multiple profiles support
- [ ] Smart fallback (machine learning on failure patterns)
- [ ] Historical cost analysis
- [ ] Webhook integration for real-time alerts

---

## תמיכה

אם יש בעיות:

1. בדוק **CHANGELOG.md** ל-v2.0 breaking changes
2. בדוק **logs/app.log** לשגיאות
3. הרץ `pm2 logs tiktok-scraper --err`
4. בדוק MongoDB Atlas dashboard
5. בדוק Apify runs: https://console.apify.com/

---

**המערכת דורשת build + testing לפני deployment! 🔨**
