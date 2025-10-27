# 🧪 Live Store Testing Guide

## ✅ How to Test Your A/B Price Testing App on a Live Store

### **Prerequisites:**
1. ✅ App is installed on your Shopify store
2. ✅ At least one active A/B test is created
3. ✅ Storefront is accessible

---

## **Testing Steps:**

### **Step 1: Check Active Tests**
1. Open your app in Shopify Admin
2. Navigate to **"Tests"** page
3. Verify you have **at least one active test** running
4. Note which products are being tested

### **Step 2: Visit Your Storefront**
1. Go to your Shopify store's public URL (not admin)
2. Example: `https://your-store.myshopify.com`
3. Navigate to a product page that's part of an active test

### **Step 3: Verify Price Testing**
Your A/B testing is working if:
- ✅ Different visitors see different prices (you won't see this yourself due to session persistence)
- ✅ Prices automatically rotate every minute (if auto-rotation is enabled)
- ✅ Prices in Shopify Admin match one of your test variants

### **Step 4: Test Price Rotation Manually**
1. Go to **"Settings"** in your app
2. Click **"Manual Price Rotation"** button
3. This will update product prices based on performance
4. Refresh your storefront to see updated prices

### **Step 5: View Analytics**
1. Go to **"Analytics"** page in your app
2. You should see:
   - Product views tracked
   - Conversion data (when customers purchase)
   - Revenue from test variants
   - Performance comparison

---

## **Common Issues & Solutions**

### **Issue: Prices Not Updating**
**Solution:** 
- Check if auto-rotation is enabled in Settings
- Verify the test is "active" status
- Try manual rotation from Settings page

### **Issue: Analytics Showing Zero**
**Solution:**
- Analytics populate when real visitors view products
- Visit your storefront multiple times
- Complete a test purchase to generate conversion data

### **Issue: "Example Domain" Error**
**Solution:**
- This means the app isn't deployed yet
- Deploy to Railway/Heroku/Vercel first
- Update app URL in Shopify Partners dashboard

---

## **Testing Checklist**

Before launching:
- [ ] App is deployed to production
- [ ] App URL is set in Shopify Partners
- [ ] At least one active test is created
- [ ] Test products are published on storefront
- [ ] Auto-rotation is enabled (or manual rotation works)
- [ ] Analytics page loads without errors

---

## **How the Testing Works**

1. **Price Rotation:** Every minute, the app analyzes which variant performs best and updates Shopify product prices
2. **Analytics Tracking:** The script on your storefront tracks when customers view products and make purchases
3. **A/B Testing:** Different customers may see different prices based on traffic allocation
4. **Performance Optimization:** Over time, prices shift toward the best-converting variants

---

## **Quick Test Commands**

### **Check if App is Working:**
```bash
# Visit your store
https://your-store.myshopify.com

# Open browser console (F12)
# Look for: "[A/B Price Test]" messages
```

### **Force Price Rotation:**
1. Open app → Settings
2. Click "Manual Price Rotation"
3. Wait 5 seconds
4. Refresh storefront to see new price

### **View All Active Tests:**
1. Open app → Tests
2. See all tests with status badges
3. Click a test to see details

---

## **Need Help?**

If you encounter issues:
1. Check browser console for errors
2. Verify app settings in Shopify Admin
3. Ensure at least one test is "active"
4. Try manual price rotation

---

**Your app is ready to test! Start by creating an active A/B test, then visit your storefront to see it in action.** 🚀


