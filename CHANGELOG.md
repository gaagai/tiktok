# Changelog - TikTok Daily Scraper

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
