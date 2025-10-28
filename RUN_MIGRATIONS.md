# 🗄️ Run Database Migrations on Vercel

## Your DATABASE_URL is Ready!

You now have:
- ✅ Database created
- ✅ `DATABASE_URL` environment variable set
- ✅ Connection string configured

Now you need to create the database tables.

---

## How to Run Migrations:

### **Option 1: Let Vercel Do It Automatically** (Easiest) ⭐

I've already set up your `vercel.json` file with automatic migrations.

Just **redeploy** your app:

1. Go to **"Deployments"** tab in Vercel
2. Click **"⋯"** (three dots) on the latest deployment
3. Click **"Redeploy"**
4. Vercel will automatically run migrations during build
5. Wait 2-3 minutes

---

### **Option 2: Manual Migration Command**

If automatic doesn't work:

1. Go to your **Vercel project** dashboard
2. Go to **"Settings"** → **"Build & Development Settings"**
3. Find **"Build Command"** field
4. Set it to:
   ```
   npx prisma migrate deploy && npm run build
   ```
5. **Save**
6. Go to **"Deployments"** and **"Redeploy"**

---

## After Migrations Run:

Your database will have these tables:
- ✅ `Session` - for storing shop sessions
- ✅ `ABTest` - for storing test data
- ✅ `ABTestProduct` - for storing products in tests
- ✅ `ABTestVariant` - for storing test variants
- ✅ `ViewEvent` - for tracking product views
- ✅ `ConversionEvent` - for tracking conversions
- ✅ `Settings` - for storing app settings

---

## Verify It's Working:

1. Visit: **https://shopifypricetestapp-ab.vercel.app**
2. You should see the A/B testing app interface
3. No more "Application Error"! 🎉

---

**Just redeploy your app and migrations will run automatically!** 🚀

