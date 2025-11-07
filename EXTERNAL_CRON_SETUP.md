# 🔄 External Cron Service Setup for Auto-Rotation (Free Vercel Plan)

## ✅ Solution: Use External Cron Service

Since Vercel free plan doesn't support cron jobs, you can use a **free external cron service** to call your rotation endpoint automatically.

---

## 🚀 Quick Setup Guide

### Step 1: Get Your Cron Secret

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Key:** `CRON_SECRET`
   - **Value:** Generate a random secret (e.g., use: https://randomkeygen.com/)
   - **Example:** `abc123xyz789secret456`
   - Select: ☑ Production ☑ Preview ☑ Development
3. Click **Save**
4. **Redeploy** your app (so the new env var is available)

---

### Step 2: Choose a Free Cron Service

Here are recommended **free** cron services:

#### Option A: cron-job.org (Recommended - Free)
- **URL:** https://cron-job.org/
- **Free tier:** 1 job every 1 minute
- **No credit card required**

#### Option B: EasyCron
- **URL:** https://www.easycron.com/
- **Free tier:** 1 job every 5 minutes
- **No credit card required**

#### Option C: UptimeRobot
- **URL:** https://uptimerobot.com/
- **Free tier:** 50 monitors, 5-minute intervals
- **No credit card required**

---

### Step 3: Configure the Cron Job

#### For cron-job.org:

1. **Sign up** at https://cron-job.org/ (free account)
2. **Click "Create cronjob"**
3. **Fill in the details:**
   - **Title:** `A/B Price Test Auto-Rotation`
   - **Address (URL):** 
     ```
     https://shopifypricetestapp-ab.vercel.app/api/cron/rotate-prices
     ```
   - **Schedule:** 
     - Select **"Every minute"** (or your preferred interval)
     - Or use custom: `*/1 * * * *` (every 1 minute)
   - **Request Method:** `GET` or `POST`
   - **Request Headers:** Click "Add Header"
     - **Header Name:** `x-cron-token`
     - **Header Value:** `YOUR_CRON_SECRET` (the value you set in Vercel)
   - **Status:** `Enabled`
4. **Click "Create"**

#### For EasyCron:

1. **Sign up** at https://www.easycron.com/
2. **Click "Add Cron Job"**
3. **Fill in:**
   - **Cron Job Name:** `A/B Price Test Auto-Rotation`
   - **URL:** `https://shopifypricetestapp-ab.vercel.app/api/cron/rotate-prices`
   - **Schedule:** `*/1 * * * *` (every 1 minute)
   - **HTTP Method:** `GET`
   - **HTTP Headers:** 
     ```
     x-cron-token: YOUR_CRON_SECRET
     ```
4. **Click "Add"**

---

### Step 4: Test the Setup

1. **Manually trigger** the cron job from the service dashboard
2. **Check Vercel logs:**
   - Go to **Vercel Dashboard** → Your Project → **Logs**
   - You should see: `🔄 [Vercel Cron] Price rotation cron job triggered`
3. **Check your app:**
   - Go to **Analytics** page
   - Prices should rotate automatically based on your interval setting

---

## 🔒 Security Notes

- **Never share your `CRON_SECRET`** publicly
- The secret ensures only authorized cron services can trigger rotation
- If compromised, generate a new secret and update both Vercel and your cron service

---

## ⚙️ Advanced: Custom Rotation Intervals

The endpoint automatically respects your rotation interval settings:
- If you set "5 minutes" in app settings, it will only rotate every 5 minutes
- The cron service can call every minute, but the app will skip if not enough time has passed

**Recommended cron schedule:**
- **Every 1 minute:** `*/1 * * * *` (most flexible)
- **Every 5 minutes:** `*/5 * * * *` (if you use 5+ minute intervals)

---

## ✅ Verification Checklist

- [ ] `CRON_SECRET` added to Vercel environment variables
- [ ] App redeployed after adding `CRON_SECRET`
- [ ] External cron service account created
- [ ] Cron job created with correct URL
- [ ] `x-cron-token` header set with your secret
- [ ] Cron job enabled and running
- [ ] Tested manually - logs show rotation triggered
- [ ] Auto-rotation enabled in app settings

---

## 🎉 You're Done!

Once set up, your prices will rotate automatically based on your settings, even on the free Vercel plan!

**Note:** The warning message in the app will still show (it's just informational). Your auto-rotation will work perfectly with the external cron service.

