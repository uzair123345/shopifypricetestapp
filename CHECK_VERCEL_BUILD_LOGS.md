# 🔍 How to Check Vercel Build Logs

The runtime errors you're seeing suggest the schema swap might not be happening during the build. Let's verify:

## Steps to Check Build Logs:

### 1. Go to Vercel Dashboard
- Navigate to: https://vercel.com/dashboard
- Find your project: `shopifypricetestapp-ab`

### 2. Open Latest Deployment
- Click on the **Deployments** tab
- Find the most recent deployment (should show "Ready" or "Error")
- **Click on the deployment** to open its details

### 3. View Build Logs
- You'll see multiple tabs: "Overview", "Build Logs", "Runtime Logs"
- Click on **"Build Logs"** (NOT "Runtime Logs")

### 4. Look for Our Script Output
Scroll through the build logs and look for:

```
🔧 Preparing Prisma schema for deployment...
   Environment: Vercel
   VERCEL=1
   VERCEL_ENV=production
   DATABASE_URL present: true
   DATABASE_URL type: PostgreSQL
📋 Using PostgreSQL schema for deployment...
✅ Schema swapped to PostgreSQL
✅ Verification: Schema file contains PostgreSQL provider
✨ Schema preparation complete!
```

### 5. Check Prisma Generation
After the script output, you should see:
```
✔ Generated Prisma Client...
Datasource "db": PostgreSQL database...
```

---

## What to Look For:

### ✅ **If you see the script output:**
- The script is running correctly
- Check if it says "Environment: Vercel" or "Environment: Production"
- Verify it shows "✅ Schema swapped to PostgreSQL"

### ❌ **If you DON'T see the script output:**
- The script might not be running
- Check if `npm run setup:deploy` is in the build logs
- Verify the build command in `vercel.json`

### ⚠️ **If script runs but still SQLite errors:**
- Check if Prisma generate output shows "PostgreSQL database" or "SQLite database"
- If it shows SQLite, the schema swap might be getting overwritten

---

## Common Issues:

### Issue 1: Script Not Running
**Symptom:** No output from `prepare-deploy.js` in build logs

**Fix:** Check `vercel.json` buildCommand contains `npm run setup:deploy`

### Issue 2: DATABASE_URL Not Available at Build Time
**Symptom:** Script shows "DATABASE_URL present: false"

**Fix:** 
1. Go to Settings → Environment Variables
2. Edit `DATABASE_URL`
3. Make sure **Production** and **Preview** checkboxes are checked
4. This ensures it's available during build

### Issue 3: Schema Swap Not Persisting
**Symptom:** Script shows swap succeeded but Prisma still generates SQLite client

**Fix:** The updated script now clears Prisma cache before generating. If still happening, there might be a caching issue.

---

## After Checking Build Logs:

1. **If script output looks correct** → The issue might be runtime environment variables
2. **If script didn't run** → Check build command configuration
3. **If script ran but wrong schema** → We need to fix the script logic

**Please share what you see in the Build Logs!**

