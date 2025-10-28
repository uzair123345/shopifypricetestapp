# 🚀 Vercel Environment Setup - Step by Step

## **Quick Setup Instructions**

### **Step 1: Get Your Shopify API Secret** 🔑

1. Go to **[Shopify Partners Dashboard](https://partners.shopify.com)**
2. Login to your account
3. Find your **"ab-price-test"** app
4. Click on the app
5. Navigate to **"App Credentials"** or **"API credentials"**
6. Copy the **"Client secret"** or **"API Secret Key"**

---

### **Step 2: Set Up Database** 💾

You need a PostgreSQL database. Choose one:

#### **Option A: Vercel Postgres (Easiest)** ⭐

1. Go to your Vercel project: **https://shopifypricetestapp-ab.vercel.app**
2. Click **"Storage"** tab
3. Click **"Create Database"**
4. Select **"Postgres"**
5. Create the database (this takes 1-2 minutes)
6. Copy the **"Connection String"**
7. It will look like: `postgresql://username:password@host:5432/database`

#### **Option B: Neon Database (Free Forever)** 🌟

1. Go to **[Neon](https://neon.tech)** and sign up
2. Create a new project
3. Copy the connection string
4. Format: `postgresql://user:pass@host/database?sslmode=require`

#### **Option C: Supabase (Free Tier)**

1. Go to **[Supabase](https://supabase.com)** and sign up
2. Create a new project
3. Get the connection string from Settings → Database

---

### **Step 3: Add Environment Variables to Vercel** 🔧

1. Go to your Vercel project dashboard
2. Click **"Settings"** → **"Environment Variables"**
3. For **"Environments"**, select **"Production"**, **"Preview"**, and **"Development"**
4. Add these 5 variables:

#### **Add Variable 1:**
- **Key:** `SHOPIFY_API_KEY`
- **Value:** `beca6ad051b2ddeeaebd410aa5b32c12`

#### **Add Variable 2:**
- **Key:** `SHOPIFY_API_SECRET`
- **Value:** *(paste your secret from Step 1)*

#### **Add Variable 3:**
- **Key:** `SHOPIFY_APP_URL`
- **Value:** `https://shopifypricetestapp-ab.vercel.app`

#### **Add Variable 4:**
- **Key:** `SCOPES`
- **Value:** `write_products,read_products,write_script_tags,read_script_tags`

#### **Add Variable 5:**
- **Key:** `DATABASE_URL`
- **Value:** *(paste your database connection string from Step 2)*

5. Click **"Save"** for each variable

---

### **Step 4: Run Database Migrations** 🗄️

After adding environment variables, you need to set up your database tables:

1. In Vercel dashboard, go to **"Deployments"** tab
2. Click on your latest deployment
3. Click **"Redeploy"** button
4. Or, better - go to **"Settings"** → **"Build & Development Settings"**
5. Add this as your **"Build Command"**:
   ```
   npx prisma migrate deploy && npm run build
   ```

---

### **Step 5: Update Shopify App Settings** 🔗

Update your app URL in Shopify Partners:

1. Go to **[Shopify Partners Dashboard](https://partners.shopify.com)**
2. Find **"ab-price-test"** app
3. Click **"App setup"**
4. Update these URLs:
   - **App URL:** `https://shopifypricetestapp-ab.vercel.app`
   - **Allowed redirection URLs:** `https://shopifypricetestapp-ab.vercel.app/auth/callback`
5. **Save** changes

---

### **Step 6: Redeploy** 🚀

1. Go to **"Deployments"** tab in Vercel
2. Click **"⋯"** (three dots) on the latest deployment
3. Click **"Redeploy"**
4. Wait 2-3 minutes for deployment
5. Visit **https://shopifypricetestapp-ab.vercel.app**

---

## ✅ **Verify It's Working**

1. Visit: **https://shopifypricetestapp-ab.vercel.app**
2. You should see the A/B testing app interface
3. If you see "Example Domain" or auth errors:
   - Check that all environment variables are set correctly
   - Verify `SHOPIFY_APP_URL` matches your Vercel URL
   - Check deployment logs for errors

---

## 📋 **Quick Reference - Your Values**

```bash
SHOPIFY_API_KEY=beca6ad051b2ddeeaebd410aa5b32c12
SHOPIFY_API_SECRET=<get from Shopify Partners>
SHOPIFY_APP_URL=https://shopifypricetestapp-ab.vercel.app
SCOPES=write_products,read_products,write_script_tags,read_script_tags
DATABASE_URL=<get from Vercel Postgres / Neon / Supabase>
```

---

## 🆘 **Common Issues**

### **"Invalid API Key" Error**
→ Check that `SHOPIFY_API_KEY` is correct in Vercel

### **Database Connection Error**
→ Make sure `DATABASE_URL` is set and migrations have run

### **"App URL Mismatch"**
→ Update `SHOPIFY_APP_URL` in Vercel to match your Vercel domain

### **Still Seeing "Example Domain"**
→ Verify all 5 environment variables are added in Vercel
→ Redeploy the app after adding variables

---

## 📞 **Need Help?**

Check these resources:
- Vercel logs: **https://vercel.com/dashboard**
- Deployment logs in Vercel project
- Check that all 5 environment variables are set

---

**Your app is ready to deploy! Follow steps 1-6 above.** 🎉

