# 🚀 Vercel Deployment Setup Guide

## 📋 Required Environment Variables for Vercel

You need to add these environment variables in your Vercel project settings.

### **Step 1: Get Your Shopify App Credentials**

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Find your "ab-price-test" app
3. Copy these values from the app settings:
   - **API Key** (also called Client ID)
   - **API Secret Key**

### **Step 2: Add Environment Variables to Vercel**

In your Vercel dashboard at **https://shopifypricetestapp-ab.vercel.app**:

#### **Go to Settings → Environment Variables**

Add these **5 required variables**:

```bash
# 1. Shopify API Key
SHOPIFY_API_KEY=beca6ad051b2ddeeaebd410aa5b32c12

# 2. Shopify API Secret (get from Partners Dashboard)
SHOPIFY_API_SECRET=your_secret_key_here

# 3. App URL (your Vercel URL)
SHOPIFY_APP_URL=https://shopifypricetestapp-ab.vercel.app

# 4. Required Scopes
SCOPES=write_products,read_products,write_script_tags,read_script_tags

# 5. Database URL (PostgreSQL)
DATABASE_URL=postgresql://username:password@host:5432/database
```

### **Step 3: Set Up Database**

Vercel doesn't include a database by default. You need to add one:

#### **Option A: Use Vercel Postgres (Recommended)**
1. In your Vercel project, go to **Storage** tab
2. Click **Create Database**
3. Select **Postgres**
4. Create the database
5. Copy the connection string
6. Add it as `DATABASE_URL` in Environment Variables

#### **Option B: Use External PostgreSQL**
- Sign up for [Neon](https://neon.tech) (free tier available)
- Create a new project
- Copy the connection string
- Add as `DATABASE_URL` in Vercel

### **Step 4: Run Database Migrations**

After setting up the database, you need to run Prisma migrations:

1. In Vercel dashboard, go to your project
2. Navigate to **Settings → Build & Development Settings**
3. Add this as your build command:
   ```bash
   npm run setup && npm run build
   ```

Or manually run in your terminal:
```bash
npx prisma migrate deploy
```

### **Step 5: Update Shopify App Configuration**

Update your app URL in Shopify Partners:

1. Go to [Partners Dashboard](https://partners.shopify.com)
2. Find "ab-price-test" app
3. Click **App setup**
4. Update these URLs:
   - **App URL**: `https://shopifypricetestapp-ab.vercel.app`
   - **Allowed redirection URLs**: `https://shopifypricetestapp-ab.vercel.app/auth/callback`
5. Save changes

### **Step 6: Redeploy**

After adding environment variables:

1. Go to **Deployments** tab in Vercel
2. Click **Redeploy** on the latest deployment
3. Wait for deployment to complete (2-3 minutes)

---

## 🔍 How to Verify It's Working

1. Visit your app URL: `https://shopifypricetestapp-ab.vercel.app`
2. You should see the A/B testing app interface
3. Try installing it on a test store
4. Test creating an A/B test

---

## ❌ Common Issues

### **Issue: "Invalid API Key"**
- **Solution**: Verify `SHOPIFY_API_KEY` is correct
- Get the key from Shopify Partners Dashboard

### **Issue: Database Connection Error**
- **Solution**: Ensure `DATABASE_URL` is set and correct
- Check that migrations have been run

### **Issue: "App URL Mismatch"**
- **Solution**: Update `SHOPIFY_APP_URL` in Vercel to match your Vercel URL
- Also update in Shopify Partners Dashboard

---

## ✅ Quick Checklist

Before deploying to Vercel:

- [ ] Vercel project created
- [ ] Environment variables added (5 variables)
- [ ] Database created and connected
- [ ] Prisma migrations run
- [ ] Shopify Partners app URL updated
- [ ] Vercel deployment successful
- [ ] App loads without errors

---

## 📞 Need Help?

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables are set
3. Ensure database is accessible
4. Check Shopify Partners app configuration

---

**Your app is deployed at: https://shopifypricetestapp-ab.vercel.app** 🎉

