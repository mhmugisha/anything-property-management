# Vercel Cron Jobs Setup Guide

## 📅 Automated Cron Jobs Configured

Your property management system now has **two automated cron jobs** that run on schedule without requiring any user activity:

### 1. 🏠 **Monthly Invoice Generation**
- **Schedule:** `0 0 1 * *` (Midnight on the 1st of every month)
- **Endpoint:** `/api/invoices/generate-monthly`
- **What it does:**
  - Automatically generates rent invoices for all active leases
  - Creates invoices for the current month
  - Tracks management fees (percent or fixed)
  - Syncs with accounting ledger
  - Auto-applies advance payments to new invoices

### 2. 🔔 **Daily Landlord Payment Notifications**
- **Schedule:** `0 8 * * *` (8:00 AM every day)
- **Endpoint:** `/api/notifications/check-landlord-due-dates`
- **What it does:**
  - Checks for landlord payments due in 3 days
  - Creates notifications for admins
  - Calculates total amounts owed per landlord
  - Handles edge cases (month boundaries, Feb 29, etc.)
  - Prevents duplicate notifications

---

## 🚀 Deployment Instructions

### **Important:** These cron jobs only work in **production** on Vercel

1. **Deploy to production** (via Anything platform)
2. Wait 2-3 minutes for deployment to complete
3. Vercel will automatically register the cron jobs
4. No further configuration needed!

---

## ✅ How to Verify Cron Jobs Are Working

### **Option 1: Check Vercel Dashboard** (Recommended)
1. Go to your Vercel project dashboard
2. Click **Settings** → **Cron Jobs**
3. You should see two cron jobs listed:
   - `/api/invoices/generate-monthly` - Monthly at 00:00
   - `/api/notifications/check-landlord-due-dates` - Daily at 08:00

### **Option 2: Check Logs**
1. In Vercel dashboard, go to **Logs**
2. Look for entries like:
   ```
   [CRON] Monthly invoice generation triggered by Vercel Cron
   [CRON] Landlord due date check triggered by Vercel Cron
   ```

### **Option 3: Manual Test** (Before Production)
You can test the endpoints manually to verify they work:

**Test Invoice Generation:**
```bash
GET /api/invoices/generate-monthly
```
(Requires authentication - use your admin account)

**Test Notification Checker:**
```bash
GET /api/notifications/check-landlord-due-dates
```
(Requires authentication)

---

## 📊 Expected Behavior

### **Monthly Invoice Generation (1st of Month)**
- **Before midnight:** No invoices for current month exist
- **After midnight:** All active leases have invoices for current month
- **In logs:** You'll see counts of invoices created
- **In database:** `invoice_generation_runs` table tracks each monthly run

### **Daily Notification Checks (8:00 AM)**
- **3 days before landlord due date:** Notifications appear in bell icon
- **In dashboard:** "Landlord balances (due)" card updates
- **In logs:** Shows which landlords were checked and notified
- **In database:** `notifications` table has entries with `type = 'landlord_due'`

---

## 🐛 Troubleshooting

### **Problem: Cron jobs not running**

**Solution:**
1. Verify you deployed to production (not just saved changes)
2. Check `vercel.json` exists in `/apps/web/vercel.json`
3. Check Vercel dashboard → Settings → Cron Jobs
4. Wait 24 hours after deployment for first run

### **Problem: Invoices still generating on user activity**

**Solution:**
This is **normal and intentional**! The system uses a dual approach:
- Cron ensures invoices generate even with no activity
- On-demand generation ensures immediate consistency
- **Both can coexist** - the system prevents duplicates

### **Problem: Notifications not appearing in bell icon**

**Solution:**
1. Verify landlord has a due_date set
2. Check it's 3 days before that due date
3. Verify landlord has outstanding balance
4. Check if notification was already sent this month (no duplicates)
5. Look in database: `SELECT * FROM notifications WHERE type = 'landlord_due'`

### **Problem: Authentication errors in cron logs**

**Solution:**
The endpoints should detect Vercel Cron automatically via the `x-vercel-cron: 1` header. If you see auth errors:
1. Verify the `isVercelCronRequest()` function is present
2. Check Vercel is sending the header (should happen automatically)
3. Contact support if issue persists

---

## 🔐 Security Notes

- **Cron endpoints bypass authentication** when called by Vercel (via `x-vercel-cron` header)
- **Manual calls require authentication** (admin with "reports" or "notifications" permission)
- **Vercel Cron header can't be spoofed** from external requests (Vercel infrastructure only)

---

## 📝 Configuration Reference

### **Cron Schedule Format**
```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-7, Sunday = 0 or 7)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

### **Examples:**
- `0 0 1 * *` = Midnight on the 1st of every month
- `0 8 * * *` = 8:00 AM every day
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 0` = Midnight every Sunday

### **Modify Schedules:**
Edit `/apps/web/vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/invoices/generate-monthly",
      "schedule": "0 0 1 * *"  // Change this
    },
    {
      "path": "/api/notifications/check-landlord-due-dates",
      "schedule": "0 8 * * *"  // Or this
    }
  ]
}
```

Then redeploy to production.

---

## 🎯 Success Checklist

- [x] `vercel.json` created with cron configuration
- [x] Invoice generation endpoint accepts Vercel Cron requests
- [x] Notification checker endpoint accepts Vercel Cron requests
- [x] Deployed to production on Vercel
- [ ] Verified cron jobs appear in Vercel dashboard
- [ ] Waited for first cron run (1st of month or next morning)
- [ ] Checked logs for `[CRON]` entries
- [ ] Verified invoices generated automatically
- [ ] Verified notifications appearing in bell icon

---

## 💡 Pro Tips

1. **Don't disable on-demand generation** - It ensures consistency even between cron runs
2. **Set landlord due dates consistently** - Use the 1st anchor date (Jan 1, 2000) to set the day
3. **Monitor logs after deployment** - First few runs will show you if everything works
4. **Test notifications manually first** - Use the POST endpoint with `testDate` to simulate future dates
5. **Check database after first run** - Verify `invoice_generation_runs` and `notifications` tables

---

## 📞 Support

If cron jobs aren't working after 24 hours:
1. Check this guide's troubleshooting section
2. Review Vercel logs for error messages
3. Test endpoints manually (GET requests)
4. Verify database permissions (cron uses same DB credentials)
5. Contact Anything platform support with specific error messages

---

**Last Updated:** April 2026  
**Version:** 1.0
