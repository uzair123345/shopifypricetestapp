# 🔍 Debug: Vercel "Resource Provisioning Failed" Error

## ❌ The Problem

Deployments are failing with **"Resource provisioning failed"** before the build even starts. This is a Vercel infrastructure issue, not a code issue.

## 🔍 Root Causes

This error typically happens when:

1. **Database is paused or unavailable** - Vercel tries to provision database connection during build
2. **Invalid DATABASE_URL** - Connection string is malformed or points to non-existent database
3. **Database connection limits** - Too many connections or rate limiting
4. **Vercel infrastructure issue** - Temporary Vercel service problem

## ✅ Step-by-Step Debugging

### Step 1: Check Database Status

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Click on your project: `shopifypricetestsplitapp`
   - Click **"Storage"** tab

2. **Check Database Status:**
   - Find your PostgreSQL database
   - Check if it shows **"Active"** or **"Paused"**
   - If paused, click **"Resume"** or **"Unpause"**

### Step 2: Verify DATABASE_URL

1. **Go to Settings → Environment Variables:**
   - Find `DATABASE_URL`
   - Click the eye icon 👁️ to reveal the value
   - **Check if it's valid:**
     - Should start with `postgres://` or `postgresql://`
     - Should NOT be a placeholder like `postgresql://username:password@host:5432/database`
     - Should contain actual credentials

2. **Test the Connection:**
   - Copy the `DATABASE_URL` value
   - Try connecting with a PostgreSQL client (pgAdmin, DBeaver, etc.)
   - If connection fails, the database might be down or credentials are wrong

### Step 3: Check Vercel Status

1. **Check Vercel Status Page:**
   - Visit: https://www.vercel-status.com/
   - Look for any ongoing incidents
   - Check if there are database-related issues

### Step 4: Try Manual Database Connection

If you have access to the database:

1. **Try connecting directly:**
   ```bash
   # Using psql (if installed)
   psql "YOUR_DATABASE_URL"
   ```

2. **If connection works:**
   - The issue is with Vercel's provisioning
   - Try redeploying after a few minutes

3. **If connection fails:**
   - Database might be paused/deleted
   - Credentials might be wrong
   - Network/firewall issue

## 🔧 Quick Fixes

### Fix 1: Resume Database (If Paused)

1. Go to **Storage** tab in Vercel
2. Find your database
3. Click **"Resume"** or **"Unpause"**
4. Wait 1-2 minutes
5. Redeploy

### Fix 2: Recreate DATABASE_URL

1. Go to **Storage** tab
2. Find your database
3. Click on it
4. Go to **"Settings"** tab
5. Copy the connection string
6. Go to **Settings → Environment Variables**
7. Update `DATABASE_URL` with the new connection string
8. Make sure it's checked for: ☑ Production ☑ Preview ☑ Development
9. Redeploy

### Fix 3: Create New Database

If the database is corrupted or can't be accessed:

1. **Create a new database:**
   - Go to **Storage** tab
   - Click **"Create Database"**
   - Select **"Postgres"**
   - Configure and create

2. **Connect to project:**
   - When prompted, set **Custom Prefix:** `DATABASE`
   - Click **"Connect"**

3. **Update environment variables:**
   - The new `DATABASE_URL` will be automatically added
   - Redeploy

4. **Create tables:**
   - After deployment, call: `https://shopifypricetestsplitapp.vercel.app/api/setup-database?secret=setup-database-2025`

## 🚨 Emergency Workaround

If deployments keep failing and you need the app working:

1. **Deploy without database operations:**
   - The build command is already set to skip database migrations
   - Build should complete successfully

2. **Create tables manually after deployment:**
   - Call: `https://shopifypricetestsplitapp.vercel.app/api/setup-database?secret=setup-database-2025`
   - This will create all tables

3. **App should work after tables are created**

## 📋 Checklist

- [ ] Database is not paused
- [ ] DATABASE_URL is valid and not a placeholder
- [ ] DATABASE_URL is checked for Production environment
- [ ] Can connect to database directly (if possible)
- [ ] Vercel status page shows no incidents
- [ ] Tried redeploying after 5-10 minutes

## 🆘 Still Failing?

If deployments still fail after trying all above:

1. **Contact Vercel Support:**
   - Go to: https://vercel.com/support
   - Explain: "Resource provisioning failed" error
   - Include deployment ID and timestamp

2. **Temporary Solution:**
   - Use the manual setup endpoint after each deployment
   - This is not ideal but keeps the app working

---

**Most Common Cause:** Database is paused or DATABASE_URL is invalid/placeholder.

