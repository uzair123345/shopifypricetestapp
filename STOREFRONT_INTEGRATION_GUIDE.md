# Shopify Storefront Integration Guide for A/B Price Testing

## Important Prerequisites

### 1. Development Store Password

Your development store is password-protected (as required by Shopify for dev stores):
- **Store URL:** https://dev-bio-restore.myshopify.com
- **Password:** `tivaol`

**Note:** The A/B testing script will work fine with the password. Visitors just need to enter the password first, then the script will run and modify prices as configured.

---

## Step 1: Get Your App Server URL

When you run `npm run dev`, look for output like this:

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│  Your app is running at:                             │
│  https://your-tunnel-url.trycloudflare.com           │
│                                                       │
└─────────────────────────────────────────────────────┘
```

Copy the URL (it will look something like: `https://triple-advertising-experienced-filters.trycloudflare.com`)

---

## Step 2: Update the A/B Testing Script

1. Open the file: `public/ab-price-test.js`
2. Find line 10:
   ```javascript
   const APP_URL = 'https://your-app-url.com'; // Replace with your actual app URL
   ```
3. Replace it with your actual app URL from Step 1:
   ```javascript
   const APP_URL = 'https://triple-advertising-experienced-filters.trycloudflare.com';
   ```
4. Optionally, enable debug mode for testing:
   ```javascript
   const DEBUG_MODE = true; // Set to true for debugging
   ```

---

## Step 3: Add the Script to Your Shopify Theme

### Method A: Using Theme Customizer (Recommended for Testing)

1. Go to **Online Store** → **Themes** in your Shopify admin
2. Click **Customize** on your current theme
3. Click on **Theme settings** (gear icon) at the bottom left
4. Click **Custom CSS** or find the **Additional Scripts** section
5. If there's no custom scripts section, you'll need to use Method B

### Method B: Edit theme.liquid File

1. Go to **Online Store** → **Themes**
2. Click the **⋮** (three dots) menu → **Edit code**
3. In the left sidebar, find and click **Layout** → **theme.liquid**
4. Scroll down to find the closing `</head>` tag
5. Add the following code **just before** `</head>`:

```html
<!-- A/B Price Testing Script -->
<script>
{{ 'ab-price-test.js' | asset_url | script_tag }}
</script>
```

6. Click **Save**

### Method C: Upload the Script as a Theme Asset

1. In the theme code editor (Online Store → Themes → Edit code)
2. In the left sidebar, under **Assets**, click **Add a new asset**
3. Choose **Create a blank file**
4. Name it: `ab-price-test.js`
5. Click **Create asset**
6. Copy the entire contents of your `public/ab-price-test.js` file
7. Paste it into the new file in Shopify
8. Update the `APP_URL` on line 10 with your actual app URL
9. Click **Save**
10. Then follow Method B to add the script tag to theme.liquid

---

## Step 4: Test the Integration

### A. Check Browser Console

1. Open your store in a **new private/incognito window**: https://dev-bio-restore.myshopify.com
2. Navigate to a product that has an active A/B test
3. Press **F12** to open Developer Tools
4. Go to the **Console** tab
5. If debug mode is enabled, you should see messages like:
   ```
   [A/B Price Test] Initializing price testing for product {productId: "...", originalPrice: ...}
   [A/B Price Test] Received price data {price: ..., isTestPrice: true, variantName: "..."}
   ```

### B. Verify Price Changes

1. Refresh the product page multiple times in different private windows
2. Some visitors should see the original price
3. Others should see the test variant prices
4. Test prices will have a small blue dot and "(Test Price)" indicator

### C. Test with Different Browsers/Devices

- Open the product in Chrome (private mode)
- Open the product in Firefox (private mode)
- Open the product in Safari (private mode)
- Each should potentially see different prices based on the traffic distribution

---

## Step 5: Verify Analytics Tracking

1. View a product page with an active test
2. Click "Add to Cart"
3. Go to your app: https://admin.shopify.com/store/dev-bio-restore/apps/ab-price-test-1/
4. Click **Analytics** in the navigation
5. You should see:
   - View counts increasing
   - Conversion counts when you add to cart
   - Performance metrics for each variant

---

## Troubleshooting

### Problem: Prices don't change

**Solution 1:** Verify the APP_URL is correct
- Open browser console (F12)
- Look for network errors or CORS errors
- Make sure the URL matches your running dev server

**Solution 2:** Check product ID detection
- Enable DEBUG_MODE in the script
- Check console logs for product ID and price detection
- The script tries multiple methods to find the product data

### Problem: "CORS policy" errors in console

**Solution:** The app server needs to allow requests from your storefront
- Check that your dev server is running
- The API routes should handle CORS automatically

### Problem: Script not loading

**Solution:** Verify file upload
- In theme code editor, check that `ab-price-test.js` exists under **Assets**
- Check that the script tag in theme.liquid is correct
- Clear your browser cache and try again

### Problem: Wrong product ID

**Solution:** The script tries to auto-detect the product ID. You may need to customize it:
- Check what product IDs are in your A/B tests (in the admin app)
- Compare with what the script detects (in browser console with DEBUG_MODE on)
- You may need to adjust the product ID detection logic

---

## Testing Checklist

- [ ] Store password protection is disabled
- [ ] Dev server is running (`npm run dev`)
- [ ] APP_URL is updated in the script with your tunnel URL
- [ ] Script is uploaded to theme assets
- [ ] Script tag is added to theme.liquid
- [ ] Theme changes are saved
- [ ] Browser console shows no errors
- [ ] Product page loads successfully
- [ ] Debug logs appear in console (if DEBUG_MODE is true)
- [ ] Prices change for different sessions/browsers
- [ ] Analytics tracking works (views are recorded)
- [ ] Conversion tracking works (add to cart is recorded)

---

## Important Notes

### About Cloudflare Tunnels

When you run `npm run dev`, Shopify creates a temporary tunnel URL (e.g., `triple-advertising-experienced-filters.trycloudflare.com`). This URL:
- Changes every time you restart the dev server
- Is only active while your dev server is running
- Will need to be updated in the script each time it changes

**For production deployment**, you'll need to:
1. Deploy your app to a permanent server (e.g., Heroku, Vercel, Railway)
2. Update the APP_URL to your permanent URL
3. No longer need to update it with each restart

### About Product IDs

The script needs to match product IDs between:
- Your Shopify products (numeric IDs like `8973884563722`)
- Your A/B tests in the database

Make sure the product IDs in your A/B tests match the actual Shopify product IDs.

---

## Next Steps

After confirming the integration works:

1. **Create more tests** in the admin app
2. **Monitor analytics** to see which price variants perform better
3. **Adjust traffic distribution** based on results
4. **End underperforming tests** and keep winning variants
5. **Plan for production deployment** when ready to go live

---

## Need Help?

If you encounter issues:

1. Check browser console for errors (F12 → Console tab)
2. Check network tab for failed API requests (F12 → Network tab)
3. Enable DEBUG_MODE in the script for detailed logging
4. Verify your dev server is running and accessible
5. Make sure the store is not password-protected

