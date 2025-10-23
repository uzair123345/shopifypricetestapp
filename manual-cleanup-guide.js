/**
 * Manual Script Tag Cleanup - Direct Approach
 * This script will help you manually clean up script tags
 */

console.log("🔧 Manual Script Tag Cleanup Guide");
console.log("");
console.log("Since the automated cleanup is failing, here's how to fix it manually:");
console.log("");
console.log("STEP 1: Check what script tags exist");
console.log("Go to: https://dev-bio-restore.myshopify.com/admin/settings/notifications");
console.log("Look for any script tags with 'ab-price-test' in the URL");
console.log("");
console.log("STEP 2: Use Shopify Admin API directly");
console.log("1. Go to: https://dev-bio-restore.myshopify.com/admin/apps/ab-price-test-1");
console.log("2. Open browser console (F12)");
console.log("3. Run this code:");
console.log("");
console.log(`
// Check existing script tags
fetch('/admin/api/2023-10/graphql.json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': window.Shopify?.rpc?.accessToken || 'your-token'
  },
  body: JSON.stringify({
    query: \`
      query getScriptTags {
        scriptTags(first: 50) {
          edges {
            node {
              id
              src
              displayScope
            }
          }
        }
      }
    \`
  })
}).then(r => r.json()).then(data => {
  console.log('Script tags:', data);
  const abTestScripts = data.data?.scriptTags?.edges
    .map(edge => edge.node)
    .filter(tag => tag.src && tag.src.includes('ab-price-test'));
  console.log('A/B test scripts found:', abTestScripts);
});
`);
console.log("");
console.log("STEP 3: Alternative - Use App Settings");
console.log("1. Go to Settings page in your app");
console.log("2. Try 'Remove Script' button first");
console.log("3. Then try 'Install Script Automatically'");
console.log("");
console.log("STEP 4: If all else fails - Manual Theme Edit");
console.log("1. Go to: https://dev-bio-restore.myshopify.com/admin/themes");
console.log("2. Edit your active theme");
console.log("3. Go to theme.liquid file");
console.log("4. Remove any lines containing 'ab-price-test'");
console.log("5. Save the theme");
console.log("");
console.log("This should resolve the console errors and allow proper script installation.");

