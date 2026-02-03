/**
 * PM2 Ecosystem Configuration
 * 
 * This file configures PM2 process manager for the TikTok scraper.
 * PM2 keeps the scheduler running 24/7 and auto-restarts on crashes.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 logs tiktok-scraper
 *   pm2 status
 *   pm2 restart tiktok-scraper
 *   pm2 stop tiktok-scraper
 */

module.exports = {
  apps: [
    {
      name: 'tiktok-scraper',
      script: './dist/index.js',
      
      // Environment
      env: {
        NODE_ENV: 'production',
      },
      
      // Process management
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      // Restart delay
      restart_delay: 5000,
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Log rotation
      max_size: '10M',
      max_files: 5,
      
      // Advanced options
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      
      // Cron restart (optional - restart daily at 6:55 AM as safety measure)
      // cron_restart: '55 6 * * *',
    },
  ],
};
