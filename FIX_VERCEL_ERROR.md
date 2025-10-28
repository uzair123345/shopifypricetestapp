# 🔧 Fix Vercel Application Error - Step by Step

## The Error You're Seeing

**"Application Error"** on your Vercel app means:
- ❌ Missing environment variables
- ❌ App can't connect to database
- ❌ Missing API credentials

---

## ✅ Quick Fix (5 Minutes)

### Step 1: Add Missing Environment Variables

1. Go to: **[Vercel Dashboard](https://vercel.com/dashboard)**
2. Find your project **"ab-price-test"**
3. Click on the project
4. Go to **"Settings"** (top menu)
5. Click **"Environment Variables"** (left sidebar)

---

### Step 2: Add These 5 Variables

Click **"+ Add"** button and add each variable:

#### 1. First Variable
- **Key:** `SHOPIFY_API_KEY`
- **Value:** `beca6ad051b2ddeeaebd410aa5b32c12`
- Select: ☑ Production ☑ Preview ☑ Development
- Click **"Save"**

#### 2. Second Variable (GET THIS FROM SHOPIFY PARTNERS)
- Go to **[Shopify Partners](https://partners.shopify.com)**
- Find "ab-price-test" app
- Click "App credentials"
- Copy the **"Client secret"**

Then in Vercel:
- **Key:** `SHOPIFY_API_SECRET`
- **Value:** *(paste your secret)*
- Select: ☑ Production ☑ Preview ☑ Development
- Click **"Save"**

#### 3. Third Variable
- **Key:** `SHOPIFY_APP_URL`
- **Value:** `https://shopifypricetestapp-ab.vercel.app`
- Select: ☑ Production ☑ Preview ☑ Development
- Click **"Save"**

#### 4. Fourth Variable
- **Key:** `SCOPES`
- **Value:** `write_products,read_products,write_script_tags,read_script_tags`
- Select: ☑ Production ☑ Preview ☑ Development
- Click **"Save"**

#### 5. Fifth Variable (GET THIS FROM DATABASE)

You need a PostgreSQL database. Easiest way:

##### Option A: Use Vercel Postgres (Recommended)
1. In Vercel project, click **"Storage"** tab
2. Click **"Create Database"**
3. Select **"Postgres"**
4. Wait 1-2 minutes for it to create
5. Click on the database
6. Copy the **"Connection String"**

Then in Environment Variables:
- **Key:** `DATABASE_URL`
- **Value:** *(paste connection string)*
- Select: ☑ Production ☑ Preview ☑ Development
- Click **"Save"**

---

### Step 3: Create Database Tables

After adding database URL, run migrations:

1. In Vercel project, go to **"Deployments"** tab
2. Click **"⋯"** (three dots) on latest deployment
3. Click **"Redeploy"**
4. Wait 2-3 minutes

---

### Step 4: Update Shopify App Settings

1. Go to **[Shopify Partners](https://partners.shopify.com)**
2. Find "ab-price-test" app
3. Click **"App setup"**
4. Update these URLs:
   - **App URL:** `https://shopifypricetestapp-ab.vercel.app`
   - **Allowed redirection URLs:** `https://shopifypricetestapp-ab.vercel.app/auth/callback`
5. **Save** changes

---

### Step 5: Test the App

1. Visit: **https://shopifypricetestapp-ab.vercel.app**
2. Should show app interface (not error)
3. Try installing on a Shopify store

---

## 📋 Checklist

Before redeploying, make sure you have:

- [ ] Added 5 environment variables to Vercel
- [ ] Created database (Vercel Postgres or external)
- [ ] Updated `SHOPIFY_APP_URL` to match Vercel URL
- [ ] Updated Shopify Partners app settings
- [ ] Redeployed the app

---

## 🆘 Still Getting Error?

Check Vercel logs:
1. Go to **"Deployments"** tab
2. Click on the latest deployment
3. Check **"Build Logs"** or **"Function Logs"**
4. Look for error messages
5. Share the error with me

---

## 📞 Need Your Values?

I need from you:
1. ✅ Shopify API Secret (from Partners Dashboard)
2. ✅ Database Connection String (from Vercel Postgres or external DB)

Once you share these, I can give you the exact values to add!

---

**Follow steps 1-5 above and your app will be working!** 🚀

