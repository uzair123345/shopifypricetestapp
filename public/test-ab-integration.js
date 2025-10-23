/**
 * Quick Test Script for A/B Price Testing
 * 
 * To use this:
 * 1. Go to your product page: https://dev-bio-restore.myshopify.com/products/example-pants
 * 2. Enter store password: tivaol
 * 3. Press F12 to open Developer Tools
 * 4. Go to Console tab
 * 5. Copy and paste this entire script
 * 6. Press Enter
 * 
 * Replace APP_URL below with your actual tunnel URL from 'npm run dev'
 */

(async function testABIntegration() {
    console.log('🧪 Starting A/B Price Test Integration Test...\n');
    
    // ⚠️ UPDATE THIS WITH YOUR TUNNEL URL FROM 'npm run dev' ⚠️
    const APP_URL = 'https://pound-teaches-convention-fort.trycloudflare.com';
    
    if (APP_URL.includes('your-tunnel-url')) {
        console.error('❌ ERROR: Please update APP_URL with your actual tunnel URL!');
        console.log('📝 Look for the URL in your terminal after running "npm run dev"');
        return;
    }
    
    // Test 1: Check if API is reachable
    console.log('Test 1: Checking API connection...');
    try {
        const response = await fetch(`${APP_URL}/api/storefront/test-connection`);
        const data = await response.json();
        if (data.success) {
            console.log('✅ API is reachable!', data);
        } else {
            console.error('❌ API responded but with error:', data);
        }
    } catch (error) {
        console.error('❌ Cannot reach API:', error);
        console.log('💡 Make sure your dev server is running with "npm run dev"');
        return;
    }
    
    // Test 2: Get product info from current page
    console.log('\nTest 2: Detecting product information...');
    let productId = null;
    let originalPrice = null;
    
    // Try to get product ID
    if (window.ShopifyAnalytics?.meta?.product?.id) {
        productId = window.ShopifyAnalytics.meta.product.id.toString();
        console.log('✅ Product ID found:', productId);
    } else {
        console.log('⚠️ Product ID not found in ShopifyAnalytics');
        console.log('Available data:', window.ShopifyAnalytics);
    }
    
    // Try to get price
    const priceSelectors = [
        '.price',
        '.product-price',
        '[data-price]',
        '.money'
    ];
    
    for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.includes('$')) {
            const priceMatch = element.textContent.match(/\$(\d+\.?\d*)/);
            if (priceMatch) {
                originalPrice = parseFloat(priceMatch[1]);
                console.log('✅ Price found:', originalPrice, 'from selector:', selector);
                break;
            }
        }
    }
    
    if (!originalPrice) {
        console.log('⚠️ Could not auto-detect price');
        originalPrice = 29.99; // Default for testing
        console.log('💡 Using default price for testing:', originalPrice);
    }
    
    // Test 3: Get test price from API
    if (productId && originalPrice) {
        console.log('\nTest 3: Fetching test price from API...');
        
        const sessionId = 'test_' + Date.now();
        const shop = 'dev-bio-restore.myshopify.com';
        
        try {
            const params = new URLSearchParams({
                productId,
                originalPrice: originalPrice.toString(),
                sessionId,
                shop
            });
            
            const response = await fetch(`${APP_URL}/api/storefront/get-price?${params}`);
            const data = await response.json();
            
            console.log('✅ API Response:', data);
            
            if (data.isTestPrice) {
                console.log('🎉 SUCCESS! You are in an A/B test!');
                console.log('   - Test Price:', data.price);
                console.log('   - Variant:', data.variantName);
                console.log('   - Original Price:', originalPrice);
                console.log('   - Discount:', ((originalPrice - data.price) / originalPrice * 100).toFixed(1) + '%');
            } else {
                console.log('ℹ️ No active test for this product or you got the control group (original price)');
                console.log('   - Price:', data.price);
            }
        } catch (error) {
            console.error('❌ Error fetching test price:', error);
        }
    } else {
        console.log('\n⚠️ Skipping Test 3 - missing product ID or price');
    }
    
    // Test 4: Check session ID generation
    console.log('\nTest 4: Testing session ID...');
    let sessionId = localStorage.getItem('ab_test_session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('ab_test_session_id', sessionId);
        console.log('✅ Created new session ID:', sessionId);
    } else {
        console.log('✅ Existing session ID:', sessionId);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log('App URL:', APP_URL);
    console.log('Product ID:', productId || 'Not detected');
    console.log('Original Price:', originalPrice ? '$' + originalPrice : 'Not detected');
    console.log('Session ID:', sessionId);
    console.log('\n💡 Next Steps:');
    console.log('1. If tests passed, the integration is working!');
    console.log('2. Create an A/B test in your admin app for this product');
    console.log('3. Refresh this page in different browsers to see different prices');
    console.log('4. Add the ab-price-test.js script to your theme for automatic testing');
    
})();

