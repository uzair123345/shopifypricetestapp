# ⚠️ IMPORTANT: Ensure DATABASE_URL is Available at Build Time

The script will automatically detect Vercel and use PostgreSQL schema, but **DATABASE_URL must be available during the build process** for migrations to run.

## Steps to Fix:

### 1. Go to Vercel Project Settings
- Navigate to your project: https://vercel.com/dashboard
- Select your project: `shopifypricetestapp-ab`

### 2. Go to Environment Variables
- Click **Settings** → **Environment Variables**

### 3. Check DATABASE_URL Configuration
Find `DATABASE_URL` in your environment variables list.

### 4. Ensure Build-Time Access
For `DATABASE_URL`, make sure it's checked for:
- ✅ **Production** (for production builds)
- ✅ **Preview** (for preview deployments)  
- ✅ **Development** (if needed)

**Important:** The checkbox for "Build Time" should be included automatically when you select Production/Preview, but verify it's there.

### 5. If DATABASE_URL is Missing Build-Time Access
1. Click on `DATABASE_URL` to edit
2. Make sure **Production**, **Preview**, and **Development** are all checked
3. Save the changes

### 6. Redeploy
- Go to **Deployments** tab
- Click **...** (three dots) on the latest deployment
- Click **Redeploy**

---

## What the Fix Does:

1. **`scripts/prepare-deploy.js`** automatically detects Vercel environment (`VERCEL=1`)
2. Swaps `schema.prisma` to use PostgreSQL
3. Generates Prisma client for PostgreSQL
4. Runs migrations (requires DATABASE_URL at build time)

---

## Expected Build Logs:

After redeploying, you should see in the build logs:

```
🔧 Preparing Prisma schema for deployment...
   Environment: Vercel
   VERCEL=1
   VERCEL_ENV=production
   DATABASE_URL present: true
   DATABASE_URL type: PostgreSQL
📋 Using PostgreSQL schema for deployment...
✅ Schema swapped to PostgreSQL
✨ Schema preparation complete!
✔ Generated Prisma Client...
Datasource "db": PostgreSQL database...
Running migrations...
✔ Applied migrations...
```

---

## If Build Still Fails:

1. **Check Build Logs** - Look for the output from `prepare-deploy.js`
2. **Verify DATABASE_URL Format** - Should start with `postgresql://`
3. **Check Database Connection** - Ensure your PostgreSQL database is accessible
4. **Verify Database Tables** - Check if migrations actually ran

---

**After ensuring DATABASE_URL is available at build time and redeploying, the app should work!**

