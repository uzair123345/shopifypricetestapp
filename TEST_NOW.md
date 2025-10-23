# 🧪 Test A/B Pricing RIGHT NOW

## Your App URL
✅ **https://setting-represent-manufacturing-jaguar.trycloudflare.com**

I've already updated both scripts with this URL!

---

## Quick Console Test (2 Minutes)

### Step 1: Open Your Product Page
1. Go to: **https://dev-bio-restore.myshopify.com/products/example-pants**
2. Enter password: **tivaol**
3. Wait for the page to load

### Step 2: Open Developer Console
- Press **F12** on your keyboard
- Or right-click anywhere → **Inspect**
- Click the **Console** tab at the top

### Step 3: Run the Test
1. Open this file in your editor: **`public/test-ab-integration.js`**
2. Press **Ctrl+A** (select all)
3. Press **Ctrl+C** (copy)
4. Go back to your browser console
5. Click in the console area
6. Press **Ctrl+V** (paste)
7. Press **Enter**

### Step 4: Check the Results
You should see output like this:

✅ **If it's working:**
```
🧪 Starting A/B Price Test Integration Test...

Test 1: Checking API connection...
✅ API is reachable!

Test 2: Detecting product information...
✅ Product ID found: 8973884563722
✅ Price found: 29.99

Test 3: Fetching test price from API...
✅ API Response: {...}
🎉 SUCCESS! You are in an A/B test!
```

❌ **If there's an error:**
- Check that `npm run dev` is still running
- Check the error message in the console
- Try refreshing the page and running the test again

---

## What to Test

### Test 1: Different Prices for Different Sessions
1. Open the product in **Chrome (Incognito)**
2. Enter password, open console, check what price you get
3. Open the product in **Firefox (Private)**
4. Enter password, open console, check what price you get
5. Open the product in **Edge (InPrivate)**
6. Enter password, open console, check what price you get

Each browser should potentially see a different price based on your A/B test settings!

### Test 2: Same Session = Same Price
1. Open product in Chrome Incognito
2. Note the price you get
3. Navigate to another page
4. Come back to the product page
5. You should get the SAME price (session consistency)

---

## Add to Theme (For Automatic Testing)

Once the console test works, add it permanently to your theme:

1. Go to: **https://admin.shopify.com/store/dev-bio-restore/themes**
2. Click **⋮** (three dots) → **Edit code**
3. Under **Assets**, click **Add a new asset**
4. Choose **Create a blank file**
5. Name it: **`ab-price-test.js`**
6. Copy the contents of **`public/ab-price-test.js`** and paste it
7. Click **Save**
8. Go to **Layout** → **theme.liquid**
9. Find the `</head>` closing tag (around line 50-100)
10. Add this line RIGHT BEFORE `</head>`:
    ```liquid
    {{ 'ab-price-test.js' | asset_url | script_tag }}
    ```
11. Click **Save**

Now the A/B testing will work automatically on every product page visit!

---

## Verify It's Working

After adding to theme:

1. Open product in new private window
2. Enter password: **tivaol**
3. Open console (F12)
4. You should see debug logs automatically:
   ```
   [A/B Price Test] Initializing price testing for product...
   [A/B Price Test] Received price data...
   ```
5. The price on the page should update automatically!

---

## Create a Test in Admin

To actually see different prices:

1. Go to your app admin: **https://admin.shopify.com/store/dev-bio-restore/apps/ab-price-test-1/**
2. Click **Active Tests**
3. Click **Create Your First Test**
4. Select test type: **Single Product Test**
5. Select the product: **Example Pants** (or whichever product you want)
6. Set up variants:
   - Variant 1: 10% off (price: $26.99 if original is $29.99)
   - Variant 2: 20% off (price: $23.99 if original is $29.99)
7. Set traffic distribution:
   - Base (original): 34%
   - Variant 1: 33%
   - Variant 2: 33%
8. Click **Create Test**

Now when you visit the product page in different browsers/sessions, you'll see different prices!

---

## Quick Troubleshooting

### Console shows "Cannot reach API"
- Run `npm run dev` in your terminal
- Wait for it to fully start
- Try the test again

### Console shows "Product ID not found"
- Make sure you're on a product page (not home page or collections)
- Try: https://dev-bio-restore.myshopify.com/products/example-pants

### Prices not changing
- Make sure you have an active A/B test created for this product
- Try different browsers/incognito windows
- Clear localStorage and try again

### Script not loading in theme
- Verify the file exists in Assets
- Check that the script tag is correctly placed in theme.liquid
- Clear your browser cache

---

## Expected Results

With a test configured for 34% / 33% / 33% distribution:

- **~34% of visitors** see original price ($29.99)
- **~33% of visitors** see variant 1 price ($26.99)
- **~33% of visitors** see variant 2 price ($23.99)

Each visitor is consistently assigned to one variant based on their session ID!

---

## 🎉 You're All Set!

Files ready to use:
- ✅ `public/test-ab-integration.js` - Console test (URL updated)
- ✅ `public/ab-price-test.js` - Full integration (URL updated, debug enabled)
- ✅ Dev server should be running

**Next step:** Open the product page and run the console test now!






