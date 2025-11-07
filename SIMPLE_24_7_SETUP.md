# 🚀 Simple 24/7 Auto-Rotation Setup (5 Minutes)

## ✅ What You Need

For **24/7 automatic rotation** (even when your computer is off), you need a **free external cron service**. This is the **only way** to run scheduled tasks on Vercel free plan.

---

## 📋 Step-by-Step Setup (5 Minutes)

### Step 1: Add CRON_SECRET to Vercel (2 minutes)

1. **Go to:** https://vercel.com/shopifypricetestapp-ab/settings/environment-variables
2. **Click "+ Add"**
3. **Add this:**
   - **Key:** `CRON_SECRET`
   - **Value:** `ab-price-test-2024-secret-key` (or any random string)
   - **Select:** ☑ Production ☑ Preview ☑ Development
4. **Click "Save"**
5. **Redeploy** your app (go to Deployments → Click "..." → "Redeploy")

---

### Step 2: Set Up Free Cron Service (3 minutes)

#### **Option A: cron-job.org (Recommended - Easiest)**

1. **Go to:** https://cron-job.org/
2. **Click "Sign up"** (free, no credit card)
3. **Create account** (takes 30 seconds)
4. **Click "Create cronjob"**
5. **Fill in:**
   - **Title:** `A/B Price Test Rotation`
   - **Address (URL):** 
     ```
     https://shopifypricetestapp-ab.vercel.app/api/cron/rotate-prices
     ```
   - **Schedule:** Select **"Every minute"** (or `*/1 * * * *`)
   - **Request Method:** `GET`
   - **Request Headers:** Click "Add Header"
     - **Header Name:** `x-cron-token`
     - **Header Value:** `ab-price-test-2024-secret-key` (same as CRON_SECRET)
   - **Status:** `Enabled` ✅
6. **Click "Create"**

**Done!** Your rotation will now run 24/7 automatically! 🎉

---

#### **Option B: EasyCron (Alternative)**

1. **Go to:** https://www.easycron.com/
2. **Sign up** (free)
3. **Click "Add Cron Job"**
4. **Fill in:**
   - **Cron Job Name:** `A/B Price Test`
   - **URL:** `https://shopifypricetestapp-ab.vercel.app/api/cron/rotate-prices`
   - **Schedule:** `*/1 * * * *` (every 1 minute)
   - **HTTP Method:** `GET`
   - **HTTP Headers:** 
     ```
     x-cron-token: ab-price-test-2024-secret-key
     ```
5. **Click "Add"**

---

### Step 3: Test It (30 seconds)

1. **In cron-job.org**, click **"Run now"** on your cron job
2. **Check Vercel logs:**
   - Go to: https://vercel.com/shopifypricetestapp-ab/logs
   - You should see: `🔄 [Vercel Cron] Price rotation cron job triggered`
3. **Check your app:**
   - Go to Analytics page
   - Prices should rotate based on your interval setting

---

## ✅ Verification Checklist

- [ ] `CRON_SECRET` added to Vercel
- [ ] App redeployed after adding `CRON_SECRET`
- [ ] Cron service account created
- [ ] Cron job created with correct URL
- [ ] `x-cron-token` header set correctly
- [ ] Cron job enabled
- [ ] Tested manually - logs show rotation
- [ ] Auto-rotation enabled in app settings

---

## 🎯 How It Works

1. **Cron service calls your endpoint** every minute
2. **Your app checks** if rotation is needed (based on your interval setting)
3. **If it's time**, prices rotate automatically
4. **If not**, it skips (respects your interval)

**Example:**
- You set rotation interval to **5 minutes**
- Cron calls every **1 minute**
- App rotates prices every **5 minutes** (skips the other 4 calls)

---

## 🔒 Security

- The `CRON_SECRET` ensures only authorized services can trigger rotation
- Never share your secret publicly
- If compromised, generate a new one and update both Vercel and cron service

---

## 💡 Pro Tips

1. **Set rotation interval** in app settings (Settings page)
   - The cron can call every minute, but your app will only rotate at your chosen interval
   
2. **Monitor logs** occasionally:
   - Vercel Dashboard → Logs
   - You'll see rotation activity

3. **Test rotation:**
   - Use "Manual Price Rotation" button to test immediately
   - Check Analytics to see if prices changed

---

## 🎉 You're Done!

Once set up, your prices will rotate **24/7 automatically**, even when:
- ✅ Your computer is off
- ✅ Admin panel is closed
- ✅ You're not logged in

**No manual tasks needed!** 🚀

---

## ❓ Troubleshooting

**Rotation not working?**
1. Check Vercel logs for errors
2. Verify `CRON_SECRET` matches in both places
3. Test cron job manually (click "Run now")
4. Check that auto-rotation is enabled in app settings

**Need help?** Check the logs in Vercel dashboard - they show exactly what's happening!

