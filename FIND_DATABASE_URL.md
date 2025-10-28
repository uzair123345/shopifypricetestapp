# 🔍 How to Find Your Database URL in Vercel

## The Database URL is Already in Your Project!

Since you clicked "Connect" on the database, Vercel automatically added the connection string to your environment variables.

---

## How to Find It:

### **Method 1: Environment Variables (Easiest)**

1. Go to your Vercel project
2. Click **"Settings"** (top menu)
3. Click **"Environment Variables"** (left sidebar)
4. Look for `DATABASE_URL` or `POSTGRES_URL`
5. Click on it to see the full connection string
6. Copy it!

It looks like:
```
postgresql://default:[password]@ep-abc123.us-east-1.postgres.vercel-storage.com:5432/verceldb
```

---

### **Method 2: Storage Tab**

1. Go to **"Storage"** tab
2. Click on **"prisma-postgres-price-test"**
3. You'll see a **".env.local"** section
4. Copy the `DATABASE_URL` value from there

---

### **Method 3: From the Database Page**

1. Go to **"Storage"** tab
2. Click on **"prisma-postgres-price-test"**
3. Click **".env.local"** tab
4. You'll see multiple variables including `DATABASE_URL`

---

## What If You Don't See It?

If `DATABASE_URL` is not visible:

1. Go to **"Storage"** → **"prisma-postgres-price-test"**
2. Look at the **"Connection String"** at the top
3. Copy that string
4. That's your database URL!

---

## Important: Don't Copy Into Custom Prefix!

The **"Custom Prefix"** field is NOT where you enter the URL!

- ❌ **Custom Prefix:** Should be something like `DATABASE` or `POSTGRES` (just letters/numbers)
- ✅ **The URL:** Is already stored in Vercel environment variables (you don't need to paste it anywhere manually)

---

## The Real Problem:

You're getting "Application Error" because you're missing OTHER environment variables, not the database URL.

You need to add:

1. ✅ `DATABASE_URL` - Already there! (automatic from database connection)
2. ❌ `SHOPIFY_API_KEY` - Missing!
3. ❌ `SHOPIFY_API_SECRET` - Missing!
4. ❌ `SHOPIFY_APP_URL` - Missing!
5. ❌ `SCOPES` - Missing!

---

**The database URL is already configured. You need to add the other 4 Shopify variables to fix the application error.**

