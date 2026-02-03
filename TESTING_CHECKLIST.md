# Testing Checklist - רשימת בדיקות

## Pre-Deployment Testing

### 1. Configuration Validation

- [ ] `.env` קיים עם כל המשתנים הנדרשים
- [ ] `APIFY_TOKEN` מתחיל ב-`apify_api_`
- [ ] `MONGODB_URI` מתחיל ב-`mongodb+srv://` או `mongodb://`
- [ ] `PROFILE_HANDLE` מוגדר נכון (success_israel)
- [ ] `MAX_POSTS` בין 1-200
- [ ] `WINDOW_HOURS` בין 1-168

### 2. Build & Compilation

- [x] `npm install` הושלם ללא errors
- [x] `npm run build` הושלם ללא TypeScript errors
- [x] תיקיית `dist/` נוצרה עם קבצי JS
- [x] תיקיות `backups/` ו-`logs/` קיימות

### 3. Database Connection

- [ ] MongoDB Atlas cluster פעיל
- [ ] משתמש DB נוצר עם הרשאות `readWrite`
- [ ] Network Access מאפשר חיבור (0.0.0.0/0 או IP ספציפי)
- [ ] Connection string נבדק (הרצת הסקריפט בהצלחה)
- [ ] Collections נוצרו: `videos`, `runs`, `reports`
- [ ] Indexes נוצרו אוטומטית

### 4. First Run - Successful Path

- [ ] הרצה ראשונה: `npm run start`
- [ ] לוג מראה "Pipeline completed successfully"
- [ ] Exit code = 0
- [ ] `logs/app.log` קיים ומכיל לוגים מפורטים
- [ ] `backups/YYYY-MM-DD.json` קיים ומכיל JSON תקין
- [ ] `backups/report-YYYY-MM-DD.txt` קיים ומכיל דוח בעברית

### 5. Database Verification

- [ ] MongoDB `videos` collection מכילה רשומות
  - [ ] videoId unique (אין duplicates)
  - [ ] profileHandle = "success_israel"
  - [ ] createTimeISO הגיוני
  - [ ] metrics מכיל playCount, diggCount וכו'
  - [ ] category = "Latest"

- [ ] MongoDB `runs` collection מכילה run record
  - [ ] runId קיים
  - [ ] status = "SUCCEEDED"
  - [ ] itemsFetched > 0
  - [ ] itemsInserted + itemsUpdated = itemsFetched (בריצה ראשונה)
  - [ ] startedAt ו-finishedAt הגיוניים

- [ ] MongoDB `reports` collection מכילה דוח
  - [ ] reportDate = תאריך היום (YYYY-MM-DD)
  - [ ] profileHandle = "success_israel"
  - [ ] text מכיל דוח בעברית
  - [ ] videoIds array מלא
  - [ ] status = "ok" או "warning"

### 6. Idempotency Test (No Duplicates)

- [ ] הרץ שוב: `npm run start` (פעם שנייה)
- [ ] Pipeline הושלם בהצלחה
- [ ] itemsInserted = 0 (אין חדשים)
- [ ] itemsUpdated > 0 (עדכון קיימים)
- [ ] ספירת videos ב-DB לא השתנתה (או השתנתה מעט אם יש חדשים)
- [ ] אין videoId כפולים: `db.videos.aggregate([{$group: {_id: "$videoId", count: {$sum: 1}}}, {$match: {count: {$gt: 1}}}])`

### 7. Report Quality

- [ ] הדוח מכיל header עם תאריך ושעה
- [ ] סטטיסטיקות נכונות (סה"כ סרטונים)
- [ ] סרטונים מקובצים לפי קטגוריה
- [ ] כל סרטון מכיל:
  - [ ] כותרת מקוצרת
  - [ ] טקסט מלא
  - [ ] לינק תקין
  - [ ] צפיות/לייקים/תגובות/שיתופים
  - [ ] תאריך בפורמט DD/MM HH:MM
- [ ] Footer עם סטטוס (✅ או ⚠️)

### 8. Backup System

- [ ] קובץ JSON raw נשמר ב-`backups/`
- [ ] קובץ report text נשמר ב-`backups/`
- [ ] שני הקבצים מכילים תוכן תקין
- [ ] Cleanup של backups ישנים עובד (אם יש ישנים מעל 14 יום)

### 9. Error Handling & Alerts

#### Zero Results Test
- [ ] שנה `WINDOW_HOURS=0.1` ב-.env (6 דקות)
- [ ] הרץ שוב
- [ ] אמור להיות 0 results
- [ ] לוג מכיל: "Scraper returned ZERO results"
- [ ] alert ברמת ERROR ב-`logs/app.log`
- [ ] status ב-`runs` = "PARTIAL"

#### Invalid Token Test
- [ ] שנה `APIFY_TOKEN=invalid_token` ב-.env
- [ ] הרץ שוב
- [ ] Pipeline נכשל עם שגיאה ברורה
- [ ] Exit code = 1
- [ ] alert ב-logs
- [ ] שחזר token נכון

#### Invalid MongoDB URI Test
- [ ] שנה `MONGODB_URI=invalid` ב-.env
- [ ] הרץ שוב
- [ ] Pipeline נכשל עם "Database connection failed"
- [ ] Exit code = 1
- [ ] alert ב-logs
- [ ] שחזר URI נכון

### 10. Retry Mechanisms

- [ ] Apify retry: אפשר לראות ב-logs ניסיונות חוזרים אם יש timeout
- [ ] DB retry: אפשר לראות אם יש connection hiccup
- [ ] Network retry: מוודא 3 ניסיונות לפני כישלון

### 11. Logging System

- [ ] `logs/app.log` מכיל:
  - [ ] Timestamp בכל שורה
  - [ ] Level (info/warn/error)
  - [ ] Messages ברורות
  - [ ] Context objects (runId, itemsFetched וכו')
  - [ ] Stack traces על errors

- [ ] `logs/error.log` מכיל רק errors
- [ ] Log rotation עובד (maxsize 10MB, maxFiles 5)

### 12. Performance

- [ ] Pipeline מסתיים תוך 2-5 דקות לרוב
- [ ] Polling של Apify לא תקוע (max 10 דקות)
- [ ] DB operations מהירות (< 1 שניה כל אחת)
- [ ] אין memory leaks (הרץ 3 פעמים, בדוק RSS)

### 13. Cron Setup (Ubuntu)

- [ ] `crontab -e` מוגדר עם השורה הנכונה
- [ ] Cron service רץ: `systemctl status cron`
- [ ] `crontab -l` מראה את ההגדרה
- [ ] `logs/cron.log` נוצר ומכיל output
- [ ] אחרי 24 שעות: בדוק שריצה יומית התבצעה

### 14. Data Integrity

- [ ] videoId ב-videos תואם ל-id ב-rawData
- [ ] createTimeISO תואם לתאריך האמיתי של הסרטון
- [ ] metrics.playCount הגיוני (לא 0 לכולם)
- [ ] webVideoUrl פותח את הסרטון ב-TikTok
- [ ] profileHandle = success_israel בכל הרשומות

### 15. Edge Cases

#### Empty Profile (לא רלוונטי כרגע)
- [ ] פרופיל ללא סרטונים מטופל נכון

#### Very Large Results
- [ ] MAX_POSTS=200 עובד ללא crash

#### Network Timeout
- [ ] אם Apify איטי מאוד, retry עובד

#### Partial Failure
- [ ] אם DB נכשל באמצע upsert, status = PARTIAL

## Post-Deployment Monitoring

### Week 1
- [ ] יום 1: בדוק שריצת cron עברה
- [ ] יום 2: בדוק שאין duplicates
- [ ] יום 3: בדוק גודל DB (לא צומח מהר מדי)
- [ ] יום 7: בדוק שיש 7 reports ב-MongoDB

### Week 2
- [ ] Backup cleanup עובד (backups מעל 14 יום נמחקו)
- [ ] אין errors חוזרים ב-logs

### Monthly
- [ ] MongoDB storage usage (Free tier: 512MB limit)
- [ ] Log files size (rotation עובד?)
- [ ] Apify usage/credits

## Success Criteria

המערכת נחשבת מוכנה לפרודקשן אם:

- ✅ כל הבדיקות בסעיפים 1-10 עברו
- ✅ ריצה ידנית מצליחה 3 פעמים ברצף
- ✅ אין duplicates אחרי ריצות מרובות
- ✅ דוחות קריאים ושלמים
- ✅ Alerts עובדים על תקלות
- ✅ Cron מוגדר ורץ באופן יומי

---

## Quick Test Commands

```bash
# בדיקה מהירה של כל המערכת
npm run start && \
  cat logs/app.log | tail -20 && \
  cat backups/report-$(date +%Y-%m-%d).txt | head -20

# בדיקת MongoDB
# (צריך mongo shell או Compass)
db.videos.count()
db.runs.find().sort({startedAt: -1}).limit(1).pretty()
db.reports.find().sort({generatedAt: -1}).limit(1).pretty()

# בדיקת duplicates
db.videos.aggregate([
  {$group: {_id: "$videoId", count: {$sum: 1}}},
  {$match: {count: {$gt: 1}}}
])

# בדיקת cron
crontab -l
tail -f logs/cron.log
```

---

**כל הבדיקות עברו? מזל טוב! המערכת מוכנה לפרודקשן! 🎉**
