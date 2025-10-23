# Manual Script Tag Cleanup Guide

Since the automated cleanup is failing, here's how to manually remove the old script tags:

## Method 1: Using Shopify Admin API (Recommended)

### Step 1: Get Your Script Tags
Open your browser and go to:
```
https://dev-bio-restore.myshopify.com/admin/api/2023-10/script_tags.json
```

This will show you all script tags in JSON format. Look for any that contain "ab-price-test" in the `src` field.

### Step 2: Delete Script Tags
For each script tag you want to delete, use this URL format:
```
DELETE https://dev-bio-restore.myshopify.com/admin/api/2023-10/script_tags/{SCRIPT_TAG_ID}.json
```

**Example:** If script tag ID is `275058983178`, the URL would be:
```
DELETE https://dev-bio-restore.myshopify.com/admin/api/2023-10/script_tags/275058983178.json
```

### Step 3: Using Browser Developer Tools
1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Run this JavaScript code:

```javascript
// Get all script tags
fetch('https://dev-bio-restore.myshopify.com/admin/api/2023-10/script_tags.json')
  .then(response => response.json())
  .then(data => {
    console.log('All script tags:', data.script_tags);
    
    // Find ab-price-test script tags
    const abTestTags = data.script_tags.filter(tag => 
      tag.src && tag.src.includes('ab-price-test')
    );
    
    console.log('A/B test script tags to delete:', abTestTags);
    
    // Delete each one
    abTestTags.forEach(tag => {
      fetch(`https://dev-bio-restore.myshopify.com/admin/api/2023-10/script_tags/${tag.id}.json`, {
        method: 'DELETE'
      })
      .then(response => {
        if (response.ok) {
          console.log(`✅ Deleted script tag ${tag.id}`);
        } else {
          console.log(`❌ Failed to delete script tag ${tag.id}`);
        }
      });
    });
  });
```

## Method 2: Using Shopify Admin Interface

### Step 1: Access Script Tags
1. Go to your Shopify Admin
2. Navigate to **Settings** → **Notifications**
3. Look for any script tags related to "ab-price-test"

### Step 2: Remove Script Tags
1. If you find any script tags, delete them manually
2. Or go to **Online Store** → **Themes** → **Actions** → **Edit code**
3. Look in `theme.liquid` for any script tags containing "ab-price-test"
4. Remove those lines

## Method 3: Direct Theme Edit

### Step 1: Edit Theme
1. Go to **Online Store** → **Themes**
2. Click **Actions** → **Edit code**
3. Open `theme.liquid`

### Step 2: Find and Remove Script Tags
Look for lines like:
```html
<script src="https://old-cloudflare-url.trycloudflare.com/ab-price-test.js"></script>
```

Delete any lines containing "ab-price-test" in the src attribute.

## Method 4: Using Shopify CLI (If Available)

If you have Shopify CLI installed:
```bash
shopify app generate extension
```

Then use the Shopify CLI to manage script tags.

## Verification

After cleanup, verify by:
1. Going to your storefront
2. Opening browser Developer Tools
3. Checking the Console tab for any "ab-price-test" errors
4. The errors should be gone!

## Next Steps After Cleanup

1. **Install new script**: Go to your app's Settings page
2. **Click "Install Script Automatically"** to install the new script
3. **Test price rotation**: Go to "Update Prices" page and test

---

**Note:** The script tag IDs we found earlier were:
- `275058983178`
- `275059015946` 
- `275059081482`
- `275059212554`
- `275064520970`

You can delete these specific IDs using Method 1 above.

