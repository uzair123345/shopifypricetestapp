# 🚨 IMMEDIATE FIX - Copy These Commands

## What You Need to Do RIGHT NOW:

### Step 1: Go to Vercel Settings

Click here: **https://vercel.com/shopifypricetestapp-ab/settings/environment-variables**

### Step 2: Add These Variables

Click **"+ Add"** button and add each one:

#### Variable 1
```
Key: SHOPIFY_API_KEY
Value: beca6ad051b2ddeeaebd410aa5b32c12
```

#### Variable 2 (YOU NEED TO GET THIS)
Go to: https://partners.shopify.com
- Find "ab-price-test" app
- Click "App credentials" 
- Copy "Client secret"

Then add:
```
Key: SHOPIFY_API_SECRET
Value: <paste the secret you copied>
```

#### Variable 3
```
Key: SHOPIFY_APP_URL
Value: https://shopifypricetestapp-ab.vercel.app
```

#### Variable 4
```
Key: SCOPES
Value: write_products,read_products,write_script_tags,read_script_tags
```

#### Variable 5 - GET THIS FROM VERCEL:
1. In Vercel dashboard, click "Storage" tab
2. Click "Create Database"
3. Select "Postgres"
4. Wait 1-2 minutes
5. Click on the database
6. Copy "Connection String"

Then add:
```
Key: DATABASE_URL
Value: <paste the connection string>
```

---

## ✅ After Adding Variables:

1. Go to "Deployments" tab
2. Click "Redeploy" button
3. Wait 2-3 minutes
4. Visit: https://shopifypricetestapp-ab.vercel.app
5. Should work now! 🎉

---

**That's it! Follow these steps and your app will be working in 10 minutes!**

