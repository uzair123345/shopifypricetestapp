# Quick Test Guide - A/B Price Testing

## 🚀 Quick Start (5 Minutes)

### Step 1: Get Your Tunnel URL
Look at your terminal where `npm run dev` is running. You'll see something like:
```
https://some-words-here.trycloudflare.com
```
**Copy this URL!** ✏️

---

### Step 2: Quick Console Test

1. **Open your product page:**
   - Go to: https://dev-bio-restore.myshopify.com/products/example-pants
   - Enter password: `tivaol`

2. **Open Developer Console:**
   - Press `F12` (or right-click → Inspect)
   - Click the **Console** tab

3. **Run the test script:**
   - Open the file: `public/test-ab-integration.js`
   - Replace line 19 with your tunnel URL:
     ```javascript
     const APP_URL = 'https://your-actual-tunnel-url.trycloudflare.com';
     ```
   - Copy the ENTIRE script
   - Paste it into the browser console
   - Press Enter

4. **Check the results:**
   - ✅ If you see green checkmarks - it's working!
   - ❌ If you see red X marks - there's an issue (check the error messages)

---

### Step 3: Full Integration (For Automatic Testing)

Once the console test works, add it to your theme:

1. **Go to theme editor:**
   - https://admin.shopify.com/store/dev-bio-restore/themes
   - Click **⋮** → **Edit code**

2. **Upload the script:**
   - Click **Add a new asset**
   - Create file: `ab-price-test.js`
   - Copy content from `public/ab-price-test.js`
   - **Update line 10** with your tunnel URL
   - **Set DEBUG_MODE = true** on line 11 (for testing)
   - Save

3. **Add to theme:**
   - Open **Layout** → **theme.liquid**
   - Find `</head>`
   - Add this line BEFORE it:
     ```liquid
     {{ 'ab-price-test.js' | asset_url | script_tag }}
     ```
   - Save

4. **Test it:**
   - Open product page in a new private window
   - Enter password
   - Press F12 → Console
   - You should see automatic price testing logs!

---

## 🧪 What You Should See

### Console Test Output (if working):
```
🧪 Starting A/B Price Test Integration Test...

Test 1: Checking API connection...
✅ API is reachable! {success: true, ...}

Test 2: Detecting product information...
✅ Product ID found: 8973884563722
✅ Price found: 29.99

Test 3: Fetching test price from API...
✅ API Response: {price: 25.99, isTestPrice: true, ...}
🎉 SUCCESS! You are in an A/B test!
```

### With Full Integration:
Different browsers/sessions will see different prices automatically!

---

## ⚡ Quick Checklist

Before testing:
- [ ] Dev server is running (`npm run dev`)
- [ ] You have your tunnel URL copied
- [ ] Store password is ready: `tivaol`

For console test:
- [ ] Updated APP_URL in test script
- [ ] Pasted script in browser console
- [ ] Got green checkmarks ✅

For full integration:
- [ ] Uploaded script to theme assets
- [ ] Updated APP_URL in uploaded script
- [ ] Added script tag to theme.liquid
- [ ] Tested in private browser window

---

## 🐛 Quick Troubleshooting

### "Cannot reach API" error
- ✓ Check dev server is still running
- ✓ Check tunnel URL is correct
- ✓ Check tunnel URL doesn't have trailing slash

### "Product ID not found"
- ✓ Make sure you're on a product page
- ✓ Try a different product
- ✓ Check the product ID in your admin app

### Prices not changing
- ✓ Make sure you have an active A/B test for this product
- ✓ Try clearing localStorage and refreshing
- ✓ Try a different browser/incognito window

---

## 📞 Your Store Info

- **Admin:** https://admin.shopify.com/store/dev-bio-restore/apps/ab-price-test-1/
- **Store:** https://dev-bio-restore.myshopify.com
- **Password:** `tivaol`
- **Test Product:** https://dev-bio-restore.myshopify.com/products/example-pants

---

## 🎯 Expected Behavior

1. **First visitor** (Session A): Sees original price ($29.99)
2. **Second visitor** (Session B): Sees test variant 1 ($25.99)
3. **Third visitor** (Session C): Sees test variant 2 ($22.99)
4. **Same visitor returning**: Always sees the same price (consistent session)

The traffic distribution is based on the percentages you set in the test!






