# TikTok Daily Scraper

מערכת production-grade לגריפה יומית אוטומטית של סרטוני TikTok מפרופיל success_israel, עם שמירה ב-MongoDB ויצירת דוחות טקסט יומיים.

## תכונות עיקריות

- ✅ **Internal Scheduler**: `node-cron` מובנה - לא צריך system cron!
- ✅ **Yesterday Filter**: אוסף **רק** סרטונים מיום אתמול (00:00-23:59)
- ✅ **Fail-Safe**: מנגנוני retry בכל שכבה (Apify, MongoDB, File I/O)
- ✅ **Idempotent**: ריצה מרובה ללא כפילויות (unique index על videoId)
- ✅ **Alerts**: התראות אוטומטיות על תקלות ותוצאות חריגות
- ✅ **Backup**: שמירת JSON raw יומית + retention 14 ימים
- ✅ **Logging**: Winston logger עם rotation אוטומטי
- ✅ **TypeScript**: Type-safe עם validation מלא
- ✅ **PM2 Ready**: auto-restart, monitoring, logs
- ✅ **Production-Ready**: מוכן לפריסה על DO Droplet / כל VPS

## דרישות מערכת

- Node.js 22.x
- MongoDB Atlas (Free Tier תומך)
- Apify account עם API token
- Ubuntu/Linux server (או macOS למפתח)

## התקנה מהירה

### 1. Clone/Download הפרויקט

```bash
cd /path/to/project
```

### 2. התקן תלויות

```bash
npm install
```

### 3. הגדר MongoDB Atlas

#### יצירת Cluster

1. גש ל-https://www.mongodb.com/cloud/atlas/register
2. צור חשבון חינם (אם אין לך)
3. לחץ "Create a New Cluster"
4. בחר **Free Tier (M0)**
5. בחר Region קרוב (מומלץ: `eu-central-1` Frankfurt או `us-east-1`)
6. שם ל-Cluster: `tiktok-scraper`
7. לחץ "Create Cluster" (ייקח כמה דקות)

#### הגדרת משתמש ורשת

**Database Access:**
1. בתפריט צד: "Database Access" → "Add New Database User"
2. Username: `tiktok_app`
3. Password: צור סיסמה חזקה (שמור בצד!)
4. Database User Privileges: `Read and write to any database`
5. לחץ "Add User"

**Network Access:**
1. בתפריט צד: "Network Access" → "Add IP Address"
2. לפיתוח: לחץ "Allow Access from Anywhere" (`0.0.0.0/0`)
3. לפרודקשן: הוסף את IP של השרת שלך
4. לחץ "Confirm"

#### קבלת Connection String

1. חזור ל-"Database" בתפריט
2. לחץ "Connect" על ה-Cluster שלך
3. בחר "Connect your application"
4. Driver: **Node.js**, Version: **5.5 or later**
5. העתק את ה-connection string:
   ```
   mongodb+srv://tiktok_app:<password>@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **החלף `<password>` בסיסמה האמיתית**
7. **הוסף את שם ה-database**: `/tiktok_scraper` לפני `?retryWrites`
   ```
   mongodb+srv://tiktok_app:YOUR_PASSWORD@cluster.xxxxx.mongodb.net/tiktok_scraper?retryWrites=true&w=majority
   ```

### 4. הגדר קובץ .env

צור קובץ `.env` בשורש הפרויקט:

```bash
cp .env.example .env
nano .env
```

ערוך את הערכים:

```bash
# Apify Configuration
APIFY_TOKEN=apify_api_YOUR_TOKEN_HERE
APIFY_ACTOR_ID=clockworks/tiktok-profile-scraper

# MongoDB Atlas
MONGODB_URI=mongodb+srv://tiktok_app:YOUR_PASSWORD@cluster.xxxxx.mongodb.net/tiktok_scraper?retryWrites=true&w=majority

# Scraper Settings
PROFILE_HANDLE=success_israel
MAX_POSTS=50
TIMEZONE=Asia/Jerusalem
# Note: System automatically collects videos from yesterday (00:00-23:59) each day

# System Settings
NODE_ENV=production
LOG_LEVEL=info
BACKUP_RETENTION_DAYS=14
```

**איפה למצוא את APIFY_TOKEN?**
1. התחבר ל-https://console.apify.com/
2. Settings → Integrations → API Token
3. העתק את הטוקן

### 5. בנה את הפרויקט

```bash
npm run build
```

זה יצור תיקיית `dist/` עם ה-JavaScript מקומפל.

### 6. הפעל עם PM2 (Process Manager)

```bash
# התקן PM2 globally
npm install -g pm2

# הפעל את הסקריפט
pm2 start ecosystem.config.js

# בדוק סטטוס
pm2 status

# צפה בלוגים
pm2 logs tiktok-scraper
```

תראה output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TikTok Daily Scraper v1.1.0
   Internal Scheduler (node-cron)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕐 Scheduling daily scraper:
   Schedule: 0 7 * * * (7:00 AM daily)
   Timezone: Asia/Jerusalem
   Profile: success_israel

✅ Scheduler is running. Waiting for next execution...
```

בדוק:
- `pm2 logs` - לוגים בזמן אמת
- `logs/app.log` - לוג מפורט של הפייפליין
- `backups/YYYY-MM-DD.json` - נתונים גולמיים
- `backups/report-YYYY-MM-DD.txt` - דוח טקסט מוכן

## הגדרת PM2 Auto-Startup

### 1. ודא שהנתיב נכון

```bash
# מצא את הנתיב המלא לפרויקט
pwd
# דוגמה: /home/user/tiktok-scraper

# מצא את הנתיב ל-node
which node
# דוגמה: /usr/bin/node
```

### 2. ערוך crontab

```bash
crontab -e
```

הוסף שורה זו (התאם את הנתיבים):

```cron
0 8 * * * cd /home/user/tiktok-scraper && NODE_ENV=production /usr/bin/node dist/index.js >> logs/cron.log 2>&1
```

**הסבר:**
- `0 8 * * *` - כל יום ב-8:00 בבוקר
- `cd /home/user/tiktok-scraper` - עבור לתיקיית הפרויקט
- `NODE_ENV=production` - הגדר סביבת production
- `/usr/bin/node dist/index.js` - הרץ את הסקריפט
- `>> logs/cron.log 2>&1` - שמור output לקובץ

### 3. וידוא

```bash
# בדוק שה-cron נוסף
crontab -l

# בדוק שה-cron service רץ
systemctl status cron

# צפה בלוגים
tail -f logs/cron.log
tail -f logs/app.log
```

### שינוי תדירות

**כל יום ב-7 בבוקר ו-7 בערב (backup run):**
```cron
0 7,19 * * * cd /home/user/tiktok-scraper && NODE_ENV=production /usr/bin/node dist/index.js >> logs/cron.log 2>&1
```

**אחרי חצות (אם רוצים לאסוף כמה שיותר מהר):**
```cron
0 1 * * * cd /home/user/tiktok-scraper && NODE_ENV=production /usr/bin/node dist/index.js >> logs/cron.log 2>&1
```

## מבנה הפרויקט

```
tiktok-scraper/
├── src/
│   ├── index.ts              # Entry point
│   ├── runDaily.ts           # Pipeline ראשי
│   ├── apify/
│   │   ├── client.ts         # Apify API wrapper
│   │   ├── types.ts          # Apify types
│   │   └── poller.ts         # Polling logic
│   ├── db/
│   │   ├── connection.ts     # MongoDB connection
│   │   ├── models.ts         # Mongoose schemas
│   │   └── operations.ts     # DB operations
│   ├── report/
│   │   ├── generator.ts      # Report generation
│   │   └── templates.ts      # Text templates
│   ├── alert/
│   │   └── logger.ts         # Winston logger + alerts
│   ├── utils/
│   │   ├── config.ts         # Configuration
│   │   ├── retry.ts          # Retry logic
│   │   ├── date.ts           # Date utilities
│   │   └── backup.ts         # Backup management
│   └── types/
│       └── index.ts          # TypeScript types
├── dist/                     # קבצים מקומפלים (נוצר ב-build)
├── backups/                  # JSON + report files
├── logs/                     # Log files
├── node_modules/
├── .env                      # קונפיגורציה (לא ב-git!)
├── .env.example              # דוגמת קונפיגורציה
├── package.json
├── tsconfig.json
├── crontab.example
└── README.md
```

## Data Models

### Collection: `videos`
```javascript
{
  videoId: "7123456789",           // Unique
  profileHandle: "success_israel",
  text: "טקסט הסרטון...",
  webVideoUrl: "https://tiktok.com/@success_israel/video/7123456789",
  createTimeISO: "2024-02-02T10:30:00.000Z",
  scrapedAt: ISODate("2024-02-02T08:00:00Z"),
  runId: "abc123",
  metrics: {
    playCount: 15000,
    diggCount: 1200,
    commentCount: 150,
    shareCount: 80
  },
  category: "Latest",
  rawData: { /* full Apify response */ }
}
```

### Collection: `runs`
```javascript
{
  runId: "abc123",
  actorId: "clockworks/tiktok-profile-scraper",
  profileHandle: "success_israel",
  startedAt: ISODate("2024-02-02T08:00:00Z"),
  finishedAt: ISODate("2024-02-02T08:02:30Z"),
  status: "SUCCEEDED",
  itemsFetched: 42,
  itemsInserted: 5,
  itemsUpdated: 37,
  datasetId: "xyz789"
}
```

### Collection: `reports`
```javascript
{
  reportDate: "2024-02-02",
  profileHandle: "success_israel",
  windowHours: 25,
  maxPosts: 50,
  generatedAt: ISODate("2024-02-02T08:02:30Z"),
  text: "📊 דוח יומי - TikTok @success_israel\n...",
  videoIds: ["7123456789", ...],
  status: "ok",
  warningMessage: null
}
```

## ניטור ותחזוקה

### בדיקת סטטוס יומי

```bash
# לוגים אחרונים
tail -100 logs/app.log

# דוח אחרון
cat backups/report-$(date +%Y-%m-%d).txt

# בדיקת cron
grep CRON /var/log/syslog | tail -20
```

### MongoDB - בדיקה ב-Atlas UI

1. התחבר ל-https://cloud.mongodb.com
2. "Database" → "Browse Collections"
3. בחר `tiktok_scraper` database
4. צפה ב-collections: `videos`, `runs`, `reports`

### התראות

המערכת תתריע אוטומטית ב-`logs/app.log` על:
- ❌ 0 תוצאות (ERROR)
- ⚠️ מתחת ל-10 תוצאות (WARNING)
- ❌ Apify run נכשל (ERROR)
- ❌ MongoDB connection נכשל (CRITICAL)
- ❌ Pipeline קרס (CRITICAL)

### טיפול בתקלות

**אם Pipeline נכשל:**

1. בדוק `logs/app.log` לשגיאה:
   ```bash
   tail -100 logs/app.log | grep -i error
   ```

2. בדוק את ה-`runs` collection ב-MongoDB:
   - סטטוס FAILED?
   - מה ה-error message?

3. הרץ ידנית לבדיקה:
   ```bash
   npm run start
   ```

4. בדיקות נפוצות:
   - **APIFY_TOKEN תקף?** בדוק ב-Apify console
   - **MONGODB_URI נכון?** נסה להתחבר עם mongo shell
   - **Internet connection?** `ping apify.com`
   - **Disk space?** `df -h`

**אם אין תוצאות (0 videos):**

1. בדוק שהפרופיל `success_israel` פעיל ב-TikTok
2. בדוק את `WINDOW_HOURS` - אולי צריך להגדיל ל-48
3. הרץ ידנית ובדוק את הפלט מ-Apify

### Cleanup ידני

```bash
# מחק backups ישנים (מעל 14 ימים)
find backups/ -name "*.json" -mtime +14 -delete
find backups/ -name "*.txt" -mtime +14 -delete

# מחק logs ישנים
find logs/ -name "*.log" -mtime +30 -delete
```

## Scripts זמינים

```bash
# בניה
npm run build

# הרצה (production)
npm run start

# הרצה (development עם tsx)
npm run dev

# הרצה עם watch mode
npm run watch

# בדיקה מהירה
npm run test:run
```

## Troubleshooting

### שגיאה: "Missing required environment variable"

**פתרון:** ודא שקובץ `.env` קיים ומכיל את כל המשתנים הנדרשים. השווה ל-`.env.example`.

### שגיאה: "Invalid APIFY_TOKEN format"

**פתרון:** הטוקן חייב להתחיל ב-`apify_api_`. קבל טוקן חדש מ-Apify console.

### שגיאה: "MongoDB connection failed"

**פתרון:**
1. בדוק ש-IP שלך מאושר ב-Network Access (Atlas)
2. בדוק שהסיסמה נכונה ב-connection string
3. בדוק שהמשתמש קיים ב-Database Access

### שגיאה: "Apify run timed out"

**פתרון:** זה יכול לקרות אם TikTok איטי. הסקריפט ינסה שוב אוטומטית (3 ניסיונות).

### PM2 לא רץ

**פתרון:**
```bash
# בדוק סטטוס
pm2 status

# אם stopped, הפעל
pm2 restart tiktok-scraper

# צפה ב-errors
pm2 logs tiktok-scraper --err --lines 50

# אם auto-startup לא עובד
pm2 unstartup
pm2 startup
# הרץ את הפקודה שמוצגת
pm2 save
```

## אבטחה

⚠️ **חשוב מאוד:**

- ✅ **אין** לשמור `.env` ב-git (כבר ב-`.gitignore`)
- ✅ **אין** להדליף את APIFY_TOKEN או MongoDB password
- ✅ השתמש ב-Network Access ב-Atlas להגבלת IP בפרודקשן
- ✅ לפני push ראשון ל-GitHub, בדוק שאין credentials בקבצי תיעוד
- ✅ שקול secrets manager (AWS Secrets Manager / Vault) לפרודקשן רציני

### Before Publishing to GitHub

1. ✅ Verify `.env` is in `.gitignore`
2. ✅ Replace any example credentials in docs with placeholders
3. ✅ Never commit real API tokens or passwords
4. ✅ Use `.env.example` as template for others

## Roadmap עתידי

- [ ] Email/Slack alerts
- [ ] Playlist detection (אם TikTok מאפשר)
- [ ] Multiple profiles support
- [ ] Dashboard UI למעקב
- [ ] Docker containerization
- [ ] Webhook integration
- [ ] Historical analytics

## תמיכה

אם יש בעיה:
1. בדוק `logs/app.log`
2. בדוק `runs` collection ב-MongoDB
3. הרץ `npm run start` ידנית
4. פתח issue עם הלוג המלא

---

**Built with ❤️ for @success_israel**

Version: 1.0.0 | License: ISC
