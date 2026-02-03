# PM2 Process Manager - מדריך מלא

PM2 הוא process manager לשמירה על הסקריפט רץ 24/7 עם auto-restart וניטור.

## התקנה

```bash
# התקן PM2 globally
npm install -g pm2

# או עם sudo על Ubuntu
sudo npm install -g pm2
```

## הפעלה ראשונה

```bash
# בנה את הפרויקט
npm run build

# הפעל עם PM2
pm2 start ecosystem.config.js

# בדוק סטטוס
pm2 status
```

## פקודות בסיסיות

### ניהול תהליך

```bash
# הצג רשימת תהליכים
pm2 list

# הצג סטטוס מפורט
pm2 status

# צפה בלוגים בזמן אמת
pm2 logs tiktok-scraper

# צפה ב-100 שורות אחרונות
pm2 logs tiktok-scraper --lines 100

# צפה רק ב-errors
pm2 logs tiktok-scraper --err

# ניקוי logs
pm2 flush
```

### הפעלה מחדש

```bash
# Restart
pm2 restart tiktok-scraper

# עצירה
pm2 stop tiktok-scraper

# מחיקה מהרשימה
pm2 delete tiktok-scraper

# Reload (zero-downtime, אם יש כמה instances)
pm2 reload tiktok-scraper
```

### ניטור

```bash
# Dashboard אינטראקטיבי
pm2 monit

# מידע מפורט על התהליך
pm2 info tiktok-scraper

# מטריקות
pm2 show tiktok-scraper
```

## Auto-Startup (חשוב!)

כדי שהסקריפט יעלה אוטומטית אחרי reboot של השרת:

```bash
# הגדר auto-startup
pm2 startup

# הרץ את הפקודה שPM2 מראה (עם sudo)
# לדוגמה:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# שמור את הקונפיגורציה הנוכחית
pm2 save

# אם רוצה לבטל auto-startup
pm2 unstartup systemd
```

## עדכון הקוד

כשיש שינויים בקוד:

```bash
# 1. Pull/Edit הקוד החדש
git pull origin main  # או העתק קבצים ידנית

# 2. בנה מחדש
npm run build

# 3. Restart את PM2
pm2 restart tiktok-scraper

# או בשורה אחת:
npm run build && pm2 restart tiktok-scraper
```

## פקודות מתקדמות

### Environment Variables

```bash
# הפעל עם env משתנה
pm2 start ecosystem.config.js --update-env

# הפעל עם RUN_ON_STARTUP
RUN_ON_STARTUP=true pm2 start ecosystem.config.js
```

### Scale (אם צריך יותר מinstance אחד)

```bash
# הפעל 2 instances
pm2 scale tiktok-scraper 2

# חזור ל-1
pm2 scale tiktok-scraper 1
```

### Logs Management

```bash
# התקן pm2-logrotate
pm2 install pm2-logrotate

# הגדר rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Monitoring עם PM2 Plus (אופציונלי)

PM2 מציע שירות ניטור בענן חינמי:

```bash
# הירשם ל-PM2 Plus
pm2 link <secret> <public>

# צפה ב-dashboard:
# https://app.pm2.io/
```

## Troubleshooting

### הסקריפט לא רץ

```bash
# בדוק errors
pm2 logs tiktok-scraper --err --lines 50

# בדוק שה-path נכון
pm2 info tiktok-scraper

# נסה להריץ ידנית
node dist/index.js
```

### Memory Leak

```bash
# PM2 יעשה restart אוטומטי ב-500MB (מוגדר ב-ecosystem.config.js)
# אם צריך לשנות:
pm2 restart tiktok-scraper --max-memory-restart 1G
```

### Startup לא עובד

```bash
# מחק את הקונפיגורציה הישנה
pm2 unstartup
pm2 kill

# התקן מחדש
pm2 startup
# הרץ את הפקודה שמוצגת
pm2 save
```

## בדיקת הצלחה

לאחר הגדרת PM2:

```bash
# 1. בדוק שהתהליך רץ
pm2 status
# אמור להראות: status: online

# 2. צפה בלוגים
pm2 logs tiktok-scraper --lines 50
# אמור להראות: "Scheduler is running"

# 3. Restart את השרת ובדוק שחוזר
sudo reboot
# אחרי reboot:
pm2 status
# אמור להראות: status: online
```

## Cheat Sheet

```bash
# הפעלה
pm2 start ecosystem.config.js
pm2 logs tiktok-scraper

# עצירה
pm2 stop tiktok-scraper

# Restart
pm2 restart tiktok-scraper

# מחיקה
pm2 delete tiktok-scraper

# ניטור
pm2 monit
pm2 status

# Auto-startup
pm2 startup
pm2 save

# עדכון קוד
npm run build && pm2 restart tiktok-scraper
```

## תמיכה

אם יש בעיות:
1. `pm2 logs tiktok-scraper --err`
2. `pm2 info tiktok-scraper`
3. בדוק את `logs/app.log` בתיקיית הפרויקט

---

**PM2 Documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/
