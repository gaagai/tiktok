# Quick Start Guide - תחילת עבודה מהירה

## מה נבנה? ✅

המערכת מוכנה ל-100%! כל הקוד נכתב, נבדק ומקומפל בהצלחה.

```
✅ TypeScript project structure
✅ Internal Scheduler (node-cron) - לא צריך system cron!
✅ PM2 Process Manager config
✅ Yesterday Filter - רק סרטונים מאתמול (00:00-23:59)
✅ Apify API client עם retry
✅ MongoDB schemas + operations
✅ Report generator מלא
✅ Winston logger + alerts
✅ Utilities (config, retry, date, backup)
✅ Pipeline ראשי מלא
✅ README + PM2_GUIDE מקיפים
✅ Build successful (dist/ created)
```

## מה חסר? (5 דקות)

רק 4 דברים שאתה צריך לעשות:

### 1. צור קובץ .env (דקה אחת)

```bash
# העתק את הקובץ לדוגמה
cp .env.example .env

# ערוך אותו
nano .env
```

הכנס את הערכים הבאים:

```bash
# קבל את הטוקן שלך מ-Apify Console (Settings → Integrations → API Token)
APIFY_TOKEN=apify_api_YOUR_TOKEN_HERE

# MongoDB - עוד לא מוכן? השאר את זה בינתיים
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/tiktok_scraper?retryWrites=true&w=majority

# הגדרות - אלה מושלמות כמו שהן
PROFILE_HANDLE=success_israel
MAX_POSTS=50
TIMEZONE=Asia/Jerusalem
NODE_ENV=production
LOG_LEVEL=info
BACKUP_RETENTION_DAYS=14

# אופציונלי: הרצה מיידית בהפעלה (לבדיקות)
# RUN_ON_STARTUP=true
```

### 2. הגדר MongoDB Atlas (5 דקות)

עקוב אחר ההוראות המפורטות ב-[README.md](README.md#3-הגדר-mongodb-atlas) - סעיף 3.

**תקציר מהיר:**
1. גש ל-https://www.mongodb.com/cloud/atlas/register
2. צור cluster חינמי (M0)
3. צור משתמש: `tiktok_app` עם סיסמה
4. Network Access: אפשר `0.0.0.0/0`
5. קבל connection string והכנס ל-.env

### 3. התקן PM2 (דקה אחת)

```bash
# התקן PM2 globally
npm install -g pm2

# על Ubuntu עם sudo:
sudo npm install -g pm2
```

### 4. הפעל את השירות (דקה אחת)

**אופציה A: בדיקה מיידית (מומלץ!)**
```bash
# הרץ pipeline מיד (בלי לחכות ל-7:00)
RUN_ON_STARTUP=true npm run start
```

תראה:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TikTok Daily Scraper v1.1.0
   Internal Scheduler (node-cron)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 RUN_ON_STARTUP=true detected. Running immediately...

🚀 Starting daily scraping pipeline for @success_israel
Step 1: Connecting to MongoDB...
✅ Connected to MongoDB successfully
...
✅ Pipeline completed successfully in 125.45s

✅ Scheduler is running. Waiting for next execution at 7:00 AM...
```

**אופציה B: הפעלה עם PM2 (לפרודקשן)**
```bash
# הפעל כשירות 24/7
pm2 start ecosystem.config.js

# צפה בלוגים
pm2 logs tiktok-scraper

# בדוק סטטוס
pm2 status
```

תראה:
```
🕐 Scheduling daily scraper:
   Schedule: 0 7 * * * (7:00 AM daily)
   Timezone: Asia/Jerusalem
   Profile: success_israel

✅ Scheduler initialized successfully
✅ Scheduler is running. Waiting for next execution...
```

## אחרי שזה עובד

### בדוק את התוצרים

```bash
# דוח יומי מוכן (העתק זאת!)
cat backups/report-$(date +%Y-%m-%d).txt

# נתונים גולמיים
cat backups/$(date +%Y-%m-%d).json

# לוגים
tail -100 logs/app.log
```

**כבר הגדרת PM2 auto-startup?** אם לא, תחזור לסעיף מעלה ↑

## Checklist בדיקה

לאחר הרצה ראשונה:

- [ ] PM2 status = `online` (`pm2 status`)
- [ ] `logs/app.log` מלא בלוגים (בלי errors)
- [ ] `backups/YYYY-MM-DD.json` קיים (נתונים גולמיים)
- [ ] `backups/report-YYYY-MM-DD.txt` קיים - **שים לב: תאריך של אתמול!**
- [ ] הדוח מציג "סרטונים מתאריך: DD/MM/YYYY (אתמול)"
- [ ] MongoDB `videos` collection מכילה סרטונים **רק מאתמול**
- [ ] MongoDB `runs` collection מכילה run record אחד
- [ ] MongoDB `reports` collection מכילה דוח אחד
- [ ] אין duplicates ב-`videos` (הרץ פעמיים, ספור videoId unique)
- [ ] PM2 auto-startup מוגדר (`pm2 save` הורץ)

## Troubleshooting מהיר

### "Missing required environment variable: APIFY_TOKEN"
➜ לא יצרת `.env` או שהוא ריק. הרץ: `cp .env.example .env && nano .env`

### "Database connection failed"
➜ MongoDB URI לא נכון או Network Access חסום. בדוק ב-Atlas.

### "Apify API error"
➜ Token לא תקף. בדוק ב-https://console.apify.com/ → Settings → API Token

### PM2 לא רץ
➜ בדוק: `pm2 status` ו-`pm2 logs tiktok-scraper --err`

### Scheduler לא מפעיל ריצה
➜ בדוק ש-timezone נכון ב-.env: `TIMEZONE=Asia/Jerusalem`

## קבצים חשובים

| קובץ | מה זה | מתי לבדוק |
|------|-------|-----------|
| `.env` | קונפיגורציה (סודי!) | אם יש שגיאות config |
| `logs/app.log` | לוג מפורט של הפייפליין | כל תקלה |
| `logs/pm2-out.log` | PM2 output logs | אם PM2 נראה תקוע |
| `logs/pm2-error.log` | PM2 error logs | על errors |
| `backups/report-*.txt` | דוח יומי (של אתמול!) | כל יום |
| `backups/*.json` | נתונים גולמיים | לבדיקות |
| `README.md` | מדריך מלא | הכל |
| `PM2_GUIDE.md` | מדריך PM2 מפורט | PM2 commands |

## מה הלאה?

1. **בדוק שPM2 רץ** - `pm2 status` אמור להראות `online`
2. **נטר logs** - `pm2 logs tiktok-scraper` לראות מתי הריצה הבאה
3. **Reboot test** - `sudo reboot` ובדוק ש-PM2 עולה אוטומטית
4. **בדוק duplicates** - אחרי כמה ריצות, ודא שאין duplicates ב-DB

**פקודות שימושיות:**
```bash
pm2 status              # סטטוס
pm2 logs tiktok-scraper # לוגים
pm2 restart tiktok-scraper  # restart
pm2 monit               # dashboard
```

---

**המערכת מוכנה לפרודקשן! 🚀**

אם משהו לא עובד, עיין ב-[README.md](README.md) לפרטים מלאים או בדוק את ה-Troubleshooting section.
