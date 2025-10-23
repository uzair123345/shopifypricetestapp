# Storefront Integration Guide

## Quick Setup (5 minutes)

To make A/B price testing work on your actual storefront, you need to add a small JavaScript snippet to your Shopify theme.

### Step 1: Get Your App URL
First, you need to find your app's URL. In your app dashboard, look at the browser address bar - it should be something like:
```
https://some-random-name.trycloudflare.com
```

### Step 2: Update the Script
1. Open the file `public/ab-price-test.js`
2. Find this line near the top:
   ```javascript
   const APP_URL = 'https://your-app-url.com'; // Replace with your actual app URL
   ```
3. Replace `https://your-app-url.com` with your actual app URL from Step 1

### Step 3: Add to Your Shopify Theme

#### Option A: Using Theme Editor (Recommended)
1. Go to your Shopify admin → **Online Store** → **Themes**
2. Click **Actions** → **Edit code** on your active theme
3. Open the **theme.liquid** file
4. Find the `</body>` tag (near the end of the file)
5. Add this line **just before** the `</body>` tag:
   ```liquid
   <script src="https://YOUR-APP-URL.com/ab-price-test.js"></script>
   ```
   Replace `YOUR-APP-URL.com` with your actual app URL
6. Save the file

#### Option B: Using Theme Settings
1. Go to your Shopify admin → **Online Store** → **Themes**
2. Click **Customize** on your active theme
3. Go to **Theme settings** → **Additional scripts**
4. Add this code in the **Footer** section:
   ```html
   <script src="https://YOUR-APP-URL.com/ab-price-test.js"></script>
   ```
   Replace `YOUR-APP-URL.com` with your actual app URL
5. Save

### Step 4: Test It
1. Create a test in your app with different prices
2. Start the test
3. Open your store in an incognito/private browser window
4. Visit the product page
5. Refresh the page multiple times - you should see different prices!

## How It Works

1. **Customer visits product page** → Script loads
2. **Script calls your app** → Gets the price for this customer
3. **Price is updated** → Customer sees test price or original price
4. **Tracking happens** → Views and conversions are recorded
5. **Analytics update** → You see results in your app dashboard

## Troubleshooting

### Still seeing original prices?
1. Check that your app URL is correct in the script
2. Make sure the script is loading (check browser console for errors)
3. Verify your test is active in the app dashboard
4. Try refreshing the page multiple times (different customers see different prices)

### Script not loading?
1. Check the URL in the script tag
2. Make sure your app is running
3. Look for JavaScript errors in browser console

### Want to see debug info?
1. Open `public/ab-price-test.js`
2. Change `const DEBUG_MODE = false;` to `const DEBUG_MODE = true;`
3. Refresh your app and redeploy
4. Check browser console for debug messages

## Advanced: Custom Integration

If you want more control, you can integrate the A/B testing directly into your theme's product template instead of using the external script.

The key is to call your app's API endpoint:
```
GET https://YOUR-APP-URL.com/api/storefront/get-price?productId=123&originalPrice=25.00&shop=your-shop.myshopify.com&sessionId=unique-session-id
```

This will return:
```json
{
  "price": 22.50,
  "variantName": "Test Variant 1",
  "isTestPrice": true
}
```

Then update your theme's price display accordingly.





