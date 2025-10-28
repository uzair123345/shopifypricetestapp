# 🚨 ADD THESE 4 VARIABLES TO FIX "Application Error"

## The Problem:

You're missing these environment variables:
1. `SHOPIFY_API_KEY`
2. `SHOPIFY_API_SECRET`
3. `SHOPIFY_APP_URL`
4. `SCOPES`

---

## ✅ Add These NOW:

### Step 1: Go to Environment Variables

1. **Go to:** https://vercel.com/shopifypricetestapp-ab/settings/environment-variables
2. Click **"+ Add"** button

---

### Step 2: Add Variable 1

```
Key: SHOPIFY_API_KEY
Value: beca6ad051b2ddeeaebd410aa5b32c12
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

---

### Step 3: Add Variable 2

First, get your Shopify secret:
1. Go to: https://partners.shopify.com
2. Click "ab-price-test" app
3. Go to "App credentials"
4. Copy "Client secret"

Then in Vercel:
```
Key: SHOPIFY_API_SECRET
Value: <paste the secret you copied>
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

---

### Step 4: Add Variable 3

```
Key: SHOPIFY_APP_URL
Value: https://shopifypricetestapp-ab.vercel.app
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

---

### Step 5: Add Variable 4

```
Key: SCOPES
Value: write_products,read_products,write_script_tags,read_script_tags
Select: ☑ Production ☑ Preview ☑ Development
Click Save
```

---

### Step 6: Redeploy

1. Go to **"Deployments"** tab
2. Click **"Redeploy"** button
3. Wait 2-3 minutes
4. Visit: https://shopifypricetestapp-ab.vercel.app

---

## ✅ After Adding These:

Your app will work! No more "Application Error"! 🎉

---

**Just follow steps 1-6 above and add the 4 missing variables!**

