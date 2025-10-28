# 🔗 Connect Your App to Vercel - Complete Guide

## ✅ Your App is Already on Vercel!

Your app is deployed at: **https://shopifypricetestapp-ab.vercel.app**

You just need to add environment variables to make it work.

---

## 🚀 Steps to Connect Your App

### Step 1: Link Your Git Repository to Vercel

If not already connected:

1. Go to **[Vercel Dashboard](https://vercel.com/dashboard)**
2. Click **"Add New"** → **"Project"**
3. Import from **GitHub**
4. Find your repo: **"shopifypricetestapp"**
5. Click **"Import"**
6. Vercel will auto-detect settings

**OR** if already imported:

1. Go to your project in Vercel
2. Check that GitHub repo is connected under **"Settings"** → **"Git"**

---

### Step 2: Get Your DATABASE_URL

You need a PostgreSQL database connection string.

#### **Option A: Vercel Postgres (Easiest - FREE)** ⭐

1. In Vercel project, click **"Storage"** tab
2. Click **"Create Database"**
3. Select **"Postgres"**
4. Click **"Create"**
5. Wait 1-2 minutes
6. Click on the database name
7. You'll see **"Connection String"** - copy it!

It looks like:
```
postgres://default:password@ep-cool-name.us-east-1.postgres.vercel-storage.com:5432/verceldb
```

---

### Step 3: Get Your Shopify API Secret

1. Go to **[Shopify Partners Dashboard](https://partners.shopify.com)**
2. Login to your account
3. Click **"Apps"** → Find **"ab-price-test"**
4. Click on the app
5. Go to **"App credentials"** or **"API credentials"**
6. Copy the **"Client secret"**

---

### Step 4: Add Environment Variables to Vercel

1. Go to your Vercel project: **https://vercel.com/shopifypricetestapp-ab/settings/environment-variables**

2. Click **"+ Add"** button

3. Add these 5 variables one by one:

#### Variable 1:
```
Key: SHOPIFY_API_KEY
Value: beca6ad051b2ddeeaebd410aa5b32c12
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

#### Variable 2:
```
Key: SHOPIFY_API_SECRET
Value: <paste your secret from Step 3>
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

#### Variable 3:
```
Key: SHOPIFY_APP_URL
Value: https://shopifypricetestapp-ab.vercel.app
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

#### Variable 4:
```
Key: SCOPES
Value: write_products,read_products,write_script_tags,read_script_tags
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

#### Variable 5:
```
Key: DATABASE_URL
Value: <paste connection string from Step 2>
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

---

### Step 5: Update Shopify App Settings

1. Go to **[Shopify Partners Dashboard](https://partners.shopify.com)**
2. Find **"ab-price-test"** app
3. Click **"App setup"**
4. Update these URLs:
   - **App URL:** `https://shopifypricetestapp-ab.vercel.app`
   - **Allowed redirection URLs:** `https://shopifypricetestapp-ab.vercel.app/auth/callback`
5. **Save** changes

---

### Step 6: Redeploy Your App

1. In Vercel, go to **"Deployments"** tab
2. Click **"⋯"** (three dots) on latest deployment
3. Click **"Redeploy"**
4. Wait 2-3 minutes

---

### Step 7: Test the App

1. Visit: **https://shopifypricetestapp-ab.vercel.app**
2. Should show the A/B testing interface (not "Application Error")
3. Try creating a test!

---

## ✅ What Happens When You Connect

1. ✅ Your app code is on Vercel
2. ✅ Vercel runs your app
3. ✅ Your app connects to Shopify API
4. ✅ Your app connects to database
5. ✅ Both stores ("My Store" and "dev-bio-restore") use the same deployed app

---

## 📋 Quick Checklist

- [ ] Git repo connected to Vercel
- [ ] Database created (Vercel Postgres)
- [ ] DATABASE_URL copied
- [ ] SHOPIFY_API_SECRET copied
- [ ] All 5 environment variables added to Vercel
- [ ] Shopify Partners app URLs updated
- [ ] App redeployed
- [ ] App loads without errors

---

## 🆘 Still Getting "Application Error"?

Check deployment logs:
1. Go to **"Deployments"** tab
2. Click on the latest deployment
3. Click **"View Function Logs"**
4. Look for error messages
5. Common issues:
   - Missing environment variables
   - Database not connected

3. Why "Application Error" Appears:**
   - Your app is missing environment variables
   - Without these, the app can't run
   - Adding them fixes the error

After completing the steps above, both stores will:
- Run the latest code
- Share the same database
- Update automatically when you push changes to GitHub

---

**Next step:** Follow **Step 2** to create a database and get the `DATABASE_URL`. Reply when you have it.

