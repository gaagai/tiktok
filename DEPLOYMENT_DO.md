# Deployment על DigitalOcean Droplet

מדריך צעד-אחר-צעד לפריסת TikTok Scraper על DO Droplet.

## דרישות

- DigitalOcean account
- Droplet Ubuntu 22.04 LTS (Basic plan - $6/month מספיק)
- MongoDB Atlas account (Free tier)
- Apify account עם API token

---

## שלב 1: יצירת Droplet (5 דקות)

### 1.1 התחבר ל-DigitalOcean

https://cloud.digitalocean.com/

### 1.2 Create Droplet

1. **Image**: Ubuntu 22.04 LTS
2. **Plan**: Basic - Regular - $6/mo (1GB RAM)
3. **Datacenter**: Frankfurt (FRA1) או Amsterdam (AMS3)
4. **Authentication**: SSH Key (מומלץ) או Password
5. **Hostname**: `tiktok-scraper-prod`
6. **Tags**: `production`, `tiktok`

לחץ **Create Droplet**

### 1.3 חיבור לשרת

```bash
# קבל את ה-IP מה-dashboard
ssh root@YOUR_DROPLET_IP

# אם זו ההתחברות הראשונה:
yes  # אשר את ה-fingerprint
```

---

## שלב 2: הגדרת השרת (10 דקות)

### 2.1 עדכון מערכת

```bash
apt update
apt upgrade -y
```

### 2.2 התקנת Node.js 22

```bash
# הוסף NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

# התקן Node.js
apt install -y nodejs

# בדוק גרסה
node --version  # אמור להיות v22.x.x
npm --version
```

### 2.3 התקנת PM2

```bash
npm install -g pm2

# בדוק
pm2 --version
```

### 2.4 יצירת משתמש (אבטחה)

```bash
# צור משתמש לא-root
adduser tiktok
usermod -aG sudo tiktok

# עבור למשתמש החדש
su - tiktok
```

---

## שלב 3: העלאת הקוד (5 דקות)

### אופציה A: Git Clone (מומלץ)

```bash
# אם הקוד ב-git
cd ~
git clone https://github.com/YOUR_USERNAME/tiktok-scraper.git
cd tiktok-scraper
```

### אופציה B: העתקה ידנית

```bash
# במחשב המקומי (terminal נפרד):
cd /Users/galagai/Documents/Business/clients/Elad\ Hadar

# דחוס את הפרויקט (ללא node_modules)
tar -czf tiktok-scraper.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='logs' \
  --exclude='backups' \
  --exclude='.env' \
  .

# העלה לשרת
scp tiktok-scraper.tar.gz tiktok@YOUR_DROPLET_IP:~

# חזור לשרת:
cd ~
tar -xzf tiktok-scraper.tar.gz
cd tiktok-scraper  # או תיקייה שנפתחה
```

---

## שלב 4: הגדרת הפרויקט (5 דקות)

```bash
# התקן dependencies
npm install

# צור .env
cp .env.example .env
nano .env
```

**ערוך את .env:**
```bash
APIFY_TOKEN=apify_api_YOUR_TOKEN_HERE
APIFY_ACTOR_ID=clockworks/tiktok-profile-scraper

MONGODB_URI=mongodb+srv://tiktok_app:YOUR_PASSWORD@cluster.xxxxx.mongodb.net/tiktok_scraper?retryWrites=true&w=majority

PROFILE_HANDLE=success_israel
MAX_POSTS=50
TIMEZONE=Asia/Jerusalem
NODE_ENV=production
LOG_LEVEL=info
BACKUP_RETENTION_DAYS=14
```

שמור: `Ctrl+X`, `Y`, `Enter`

```bash
# בנה את הפרויקט
npm run build

# בדוק שהבנייה הצליחה
ls -lh dist/index.js
```

---

## שלב 5: MongoDB Atlas Setup (5 דקות)

אם עוד לא הגדרת, עקוב אחר [README.md - MongoDB Atlas Setup](README.md#הגדר-mongodb-atlas)

**תקציר:**
1. https://www.mongodb.com/cloud/atlas/register
2. Create Free Cluster (M0)
3. Database Access: Create user `tiktok_app`
4. Network Access: Add Droplet IP (או `0.0.0.0/0` לבינתיים)
5. Get connection string → הכנס ל-.env

---

## שלב 6: בדיקה ראשונה (2 דקות)

```bash
# בדיקה מיידית (לא לחכות ל-7:00)
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

**אם זה עובד** - עבור לשלב הבא!  
**אם יש שגיאה** - בדוק Troubleshooting למטה ↓

---

## שלב 7: הפעלה עם PM2 (3 דקות)

```bash
# עצור את הריצה הידנית (Ctrl+C)

# הפעל עם PM2
pm2 start ecosystem.config.js

# בדוק סטטוס
pm2 status
# אמור להראות:
# ┌─────┬───────────────────┬─────┬────────┬───────┐
# │ id  │ name              │ mode│ status │ cpu   │
# ├─────┼───────────────────┼─────┼────────┼───────┤
# │ 0   │ tiktok-scraper    │ fork│ online │ 0%    │
# └─────┴───────────────────┴─────┴────────┴───────┘

# צפה בלוגים
pm2 logs tiktok-scraper

# Dashboard
pm2 monit
```

---

## שלב 8: Auto-Startup (חשוב!)

```bash
# הגדר PM2 לעלות אוטומטית אחרי reboot
pm2 startup

# PM2 יראה לך פקודה - הרץ אותה!
# לדוגמה:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u tiktok --hp /home/tiktok

# שמור את הקונפיגורציה הנוכחית
pm2 save

# בדוק
pm2 list
```

---

## שלב 9: בדיקת Reboot (2 דקות)

```bash
# Restart את השרת
sudo reboot

# חכה 30 שניות, התחבר מחדש
ssh tiktok@YOUR_DROPLET_IP

# בדוק שPM2 עלה אוטומטית
pm2 status
# אמור להראות: online ✅

pm2 logs tiktok-scraper --lines 20
```

---

## שלב 10: ניטור (ongoing)

### בדיקות יומיות

```bash
# בדוק שהסקריפט רץ הבוקר
pm2 logs tiktok-scraper --lines 100 | grep "Pipeline completed"

# בדוק דוח אחרון (של אתמול!)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
cat backups/report-$YESTERDAY.txt

# או פשוט:
ls -lt backups/*.txt | head -3
```

### בדיקות שבועיות

```bash
# בדוק שהשירות רץ
pm2 status

# בדוק logs לשגיאות
pm2 logs tiktok-scraper --err --lines 50

# MongoDB storage usage
# Atlas UI → Database → Collections → View Metrics
```

---

## Troubleshooting על DO Droplet

### PM2 לא עולה אחרי reboot

```bash
# בדוק systemd service
systemctl status pm2-tiktok

# אם לא קיים, הרץ שוב:
pm2 startup
# הרץ את הפקודה שמוצגת
pm2 save
```

### MongoDB connection timeout

```bash
# בדוק שה-Droplet IP מאושר ב-Atlas
# Atlas → Network Access → Add Droplet IP

# קבל את ה-IP הציבורי של הדרופלט
curl ifconfig.me

# הוסף את ה-IP הזה ב-Atlas Network Access
```

### אין מקום בדיסק

```bash
# בדוק usage
df -h

# נקה logs ישנים
pm2 flush
cd ~/tiktok-scraper
rm -rf logs/*.log.*
find backups/ -name "*.json" -mtime +14 -delete
```

### Memory issues

```bash
# בדוק memory usage
pm2 monit

# PM2 יעשה restart ב-500MB (ecosystem.config.js)
# אם צריך יותר:
pm2 restart tiktok-scraper --max-memory-restart 1G
```

---

## אבטחה על DO

### 1. Firewall

```bash
# הגדר ufw
ufw allow OpenSSH
ufw allow 80/tcp    # אם תוסיף dashboard בעתיד
ufw allow 443/tcp
ufw enable

# בדוק
ufw status
```

### 2. SSH Hardening

```bash
# ערוך sshd_config
sudo nano /etc/ssh/sshd_config

# שנה:
PermitRootLogin no
PasswordAuthentication no  # אם יש לך SSH key

# Restart SSH
sudo systemctl restart sshd
```

### 3. MongoDB Network Access

ב-Atlas UI:
- לך ל-Network Access
- **מחק** את `0.0.0.0/0`
- **הוסף רק** את IP של הדרופלט שלך

### 4. Environment Variables

```bash
# וודא ש-.env לא נגיש לאחרים
chmod 600 .env

# בדוק
ls -la .env
# אמור להראות: -rw------- (רק הבעלים יכול לקרוא)
```

---

## Backup Strategy

### Local Backups (בדרופלט)

```bash
# הקוד כבר מנקה backups מעל 14 יום
# אבל אפשר לשמור גם ב-DO Spaces או S3

# לדוגמה: העתקה יומית ל-DO Spaces
# (צריך s3cmd)
s3cmd sync backups/ s3://my-bucket/tiktok-backups/
```

### MongoDB Backups

Atlas Free Tier כולל:
- **Automatic backups**: כל 24 שעות
- **Point-in-time recovery**: לא זמין ב-Free
- **Export**: ידני דרך UI

### Droplet Snapshots

מומלץ:
- Weekly snapshot של הדרופלט (עולה כ-$0.05/GB)
- DO Backups: $1.20/month (20% מעלות הדרופלט)

---

## Monitoring & Alerts

### PM2 Monitoring

```bash
# ריצה כל דקה - בדיקת health
pm2 status --no-color

# אם status != online, שלח alert
```

### External Monitoring (אופציונלי)

שירותים חינמיים:
- **UptimeRobot**: ping כל 5 דקות
- **Healthchecks.io**: webhook אחרי כל ריצה מוצלחת
- **PM2 Plus**: dashboard מובנה (חינמי ל-1 שרת)

---

## עדכון הקוד על DO

```bash
# SSH לשרת
ssh tiktok@YOUR_DROPLET_IP

# Pull שינויים
cd ~/tiktok-scraper
git pull origin main

# או העתק קבצים חדשים:
# (במקומי)
scp -r src/ tiktok@YOUR_DROPLET_IP:~/tiktok-scraper/

# בנה מחדש
npm run build

# Restart PM2
pm2 restart tiktok-scraper

# בדוק
pm2 logs tiktok-scraper --lines 50
```

---

## Cost Estimation

| שירות | תכנית | עלות חודשית |
|-------|-------|-------------|
| **DO Droplet** | Basic 1GB | $6 |
| **MongoDB Atlas** | Free M0 | $0 |
| **Apify** | Pay-as-you-go | ~$0.10-0.50 |
| **DO Backups** | Optional | $1.20 |
| **סה"כ** | | **~$6-8/month** |

---

## Checklist פריסה מלאה

- [ ] Droplet נוצר ורץ
- [ ] Node.js 22 מותקן
- [ ] PM2 מותקן
- [ ] משתמש `tiktok` נוצר (לא root)
- [ ] קוד הועתק לשרת
- [ ] `npm install` הושלם
- [ ] `.env` מוגדר עם credentials נכונים
- [ ] MongoDB Atlas מחובר ועובד
- [ ] `npm run build` הצליח
- [ ] בדיקה ידנית עברה (`RUN_ON_STARTUP=true npm run start`)
- [ ] PM2 מריץ את השירות (`pm2 start ecosystem.config.js`)
- [ ] PM2 status = online
- [ ] PM2 auto-startup מוגדר (`pm2 startup` + `pm2 save`)
- [ ] Reboot test עבר (השירות עלה אחרי reboot)
- [ ] Firewall מוגדר (ufw)
- [ ] MongoDB Network Access מוגבל ל-Droplet IP
- [ ] הדוח הראשון נוצר בהצלחה
- [ ] אין duplicates ב-MongoDB

---

## תחזוקה שוטפת

### יומי
```bash
# אוטומטי - אין צורך לעשות כלום!
```

### שבועי
```bash
# בדוק שהכל רץ
ssh tiktok@YOUR_DROPLET_IP
pm2 status
pm2 logs tiktok-scraper --lines 50 | grep ERROR
```

### חודשי
```bash
# עדכוני security
apt update && apt upgrade -y

# בדוק MongoDB storage
# Atlas UI → Database → View Metrics

# בדוק disk usage
df -h
du -sh ~/tiktok-scraper/backups
du -sh ~/tiktok-scraper/logs
```

---

## תמיכה

אם יש בעיה:

1. **בדוק PM2**: `pm2 logs tiktok-scraper --err`
2. **בדוק App Logs**: `cat ~/tiktok-scraper/logs/app.log | tail -100`
3. **בדוק MongoDB**: Atlas UI → Database → Browse Collections
4. **בדוק Apify**: https://console.apify.com/actors/runs

---

**הצלחה! המערכת רצה על DO Droplet! 🚀**
