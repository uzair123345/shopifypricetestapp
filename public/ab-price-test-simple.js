/**
 * A/B Price Testing Script - Analytics Only
 * This script only tracks analytics, prices are managed by Shopify directly
 */

// Prevent multiple script executions
if (window.ABPriceTestInitialized) {
    console.log('[A/B Price Test] Script already initialized, skipping...');
} else {
    window.ABPriceTestInitialized = true;

(function() {
    'use strict';
    
    // Configuration
    let APP_URL = window.AB_PRICE_TEST_APP_URL || 'https://shopifypricetestsplitapp.vercel.app';
    const DEBUG_MODE = true;
    
    // Try to detect the correct app URL from the script tag
    function detectAppUrl() {
        // First, try to get from script tag (most reliable)
        const scriptTags = document.querySelectorAll('script[src*="ab-price-test"]');
        if (scriptTags.length > 0) {
            const scriptSrc = scriptTags[0].src;
            const match = scriptSrc.match(/^(https:\/\/[^\/]+)/);
            if (match) {
                const detectedUrl = match[1];
                // Use detected URL if it's a valid app URL (Vercel or cloudflare tunnel)
                if (detectedUrl.includes('vercel.app') || detectedUrl.includes('trycloudflare.com')) {
                    APP_URL = detectedUrl;
                    log('✅ Detected APP_URL from script tag:', APP_URL);
                    return;
                } else {
                    log('⚠️ Script tag has URL but it\'s not recognized:', detectedUrl);
                }
            }
        }
        
        // Try to get from current page URL if it's a valid app URL
        try {
            if (window.location.href.includes('vercel.app') || window.location.href.includes('trycloudflare.com')) {
                const match = window.location.href.match(/^(https:\/\/[^\/]+)/);
                if (match) {
                    APP_URL = match[1];
                    log('✅ Detected APP_URL from current page URL:', APP_URL);
                    return;
                }
            }
        } catch (e) {
            // Ignore errors
        }
        
        // Try to get from window.location.origin
        try {
            if (window.location.origin.includes('vercel.app') || window.location.origin.includes('trycloudflare.com')) {
                APP_URL = window.location.origin;
                log('✅ Detected APP_URL from window.location.origin:', APP_URL);
                return;
            }
        } catch (e) {
            // Ignore errors
        }
        
        // Also try to get from window.location if we're in an iframe
        if (window.parent && window.parent !== window) {
            try {
                const parentUrl = window.parent.location.href;
                if (parentUrl.includes('vercel.app') || parentUrl.includes('trycloudflare.com')) {
                    const match = parentUrl.match(/^(https:\/\/[^\/]+)/);
                    if (match) {
                        APP_URL = match[1];
                        log('✅ Detected APP_URL from parent window:', APP_URL);
                        return;
                    }
                }
            } catch (e) {
                // Cross-origin access denied, ignore
            }
        }
        
        // If all detection methods failed, warn user
        if (APP_URL.includes('attempts-clarke-serving-rules') || APP_URL.includes('sandwich-measurement')) {
            log('⚠️ Using fallback APP_URL, but it may be incorrect:', APP_URL);
            log('💡 Please update the script tag in your Shopify theme with the correct app URL');
            console.warn('[A/B Price Test] URL detection failed. Please update script tag with correct app URL.');
        }
    }
    
    // Debug logging
    function log(...args) {
        if (DEBUG_MODE) {
            console.log('[A/B Price Test]', ...args);
        }
    }
    
    // Get session ID (reuse existing or create new)
    function getSessionId() {
        let sessionId = localStorage.getItem('ab_test_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('ab_test_session_id', sessionId);
            log('Generated new session ID:', sessionId);
        }
        return sessionId;
    }
    
    // Get shop domain
    function getShopDomain() {
        // Try multiple methods to get shop domain
        if (window.Shopify?.shop) {
            log('Found shop from window.Shopify.shop:', window.Shopify.shop);
            return window.Shopify.shop;
        }
        if (window.meta?.shop?.domain) {
            log('Found shop from window.meta.shop.domain:', window.meta.shop.domain);
            return window.meta.shop.domain;
        }
        // Try to extract from window.location
        if (window.location.hostname.includes('myshopify.com')) {
            log('Found shop from window.location.hostname:', window.location.hostname);
            return window.location.hostname;
        }
        // Try to extract from ShopifyAnalytics
        if (window.ShopifyAnalytics?.meta?.shop?.domain) {
            log('Found shop from ShopifyAnalytics.meta.shop.domain:', window.ShopifyAnalytics.meta.shop.domain);
            return window.ShopifyAnalytics.meta.shop.domain;
        }
        // Last resort: try to get from any script tag with shopify
        const shopifyScripts = document.querySelectorAll('script[src*="shopify"]');
        for (const script of shopifyScripts) {
            const src = script.getAttribute('src');
            const shopMatch = src?.match(/shop=([^&]+)/);
            if (shopMatch) {
                const detectedShop = decodeURIComponent(shopMatch[1]);
                log('Found shop from script tag:', detectedShop);
                return detectedShop;
            }
        }
        // Default fallback (but log a warning)
        const fallbackShop = 'dev-bio-restore.myshopify.com';
        log('⚠️ Could not detect shop domain, using fallback:', fallbackShop);
        console.warn('[A/B Price Test] Could not detect shop domain. Using fallback:', fallbackShop);
        return fallbackShop;
    }
    
    // Extract price from text
    function extractPrice(text) {
        const match = text.match(/\$?[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/[$,]/g, '')) : null;
    }
    
    // Extract numeric product ID from GID format or return as-is
    function extractProductId(productId) {
        if (!productId) return null;
        
        // If it's already just a number, return it
        if (/^\d+$/.test(productId)) {
            return productId;
        }
        
        // If it's a GID format (gid://shopify/Product/123456789), extract the numeric part
        const gidMatch = productId.match(/gid:\/\/shopify\/Product\/(\d+)/);
        if (gidMatch) {
            return gidMatch[1];
        }
        
        // Return as-is if it doesn't match expected formats
        return productId;
    }
    
    // Track which views have already been sent (prevent duplicates)
    const trackedViews = new Set();
    
    // Get unique view key for deduplication
    function getViewKey(productId, testId, variantId) {
        return `${productId}_${testId || 'none'}_${variantId || 'none'}_${window.location.pathname}`;
    }
    
    // Track product view (with deduplication)
    function trackView(productId, testId, variantId, price) {
        console.log('[A/B Price Test] trackView called:', {
            productId,
            testId,
            variantId,
            price,
            APP_URL,
            hasProductId: !!productId
        });
        
        if (!APP_URL) {
            log('❌ APP_URL not set, cannot track view');
            console.error('[A/B Price Test] Cannot track - APP_URL is missing');
            return;
        }
        
        if (!productId) {
            log('❌ Product ID missing, cannot track view');
            console.error('[A/B Price Test] ❌ Cannot track - productId is missing');
            return;
        }
        
        // Validate price
        if (!price || price <= 0) {
            log('⚠️ Invalid price, using default price of 0');
            price = 0;
        }
        
        // Check if we've already tracked this view
        const viewKey = getViewKey(productId, testId, variantId);
        if (trackedViews.has(viewKey)) {
            log('View already tracked, skipping:', viewKey);
            return;
        }
        
        // Mark as tracked
        trackedViews.add(viewKey);
        
        const sessionId = getSessionId();
        const shop = getShopDomain();
        
        const trackingData = {
            productId: productId,
            testId: testId,
            variantId: variantId,
            sessionId: sessionId,
            shop: shop,
            url: window.location.href,
            price: price
        };
        
        log('📊 Tracking view:', trackingData);
        log('📡 Sending to:', APP_URL + '/api/track-view');
        
        console.log('[A/B Price Test] About to send tracking request:', {
            url: APP_URL + '/api/track-view',
            data: trackingData
        });
        
        // Log the tracking attempt
        console.log('[A/B Price Test] 🚀 Attempting to track view:', {
            url: APP_URL + '/api/track-view',
            trackingData: trackingData,
            shopDetected: shop,
            sessionId: sessionId,
            productId: productId
        });
        
        fetch(APP_URL + '/api/track-view', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(trackingData)
        }).then(response => {
            log('📥 Track view response status:', response.status, response.statusText);
            log('📥 Track view response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                // If tracking failed, remove from tracked set so we can retry
                trackedViews.delete(viewKey);
                log('❌ Failed to track view:', response.status);
                return response.text().then(text => {
                    log('❌ Error response body:', text);
                    console.error('[A/B Price Test] ❌ Tracking failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        body: text,
                        url: APP_URL + '/api/track-view',
                        data: trackingData,
                        APP_URL: APP_URL,
                        shop: shop,
                        productId: productId
                    });
                });
            } else {
                log('✅ View tracked successfully:', viewKey);
                console.log('[A/B Price Test] ✅ View tracked successfully!', {
                    viewKey: viewKey,
                    productId: productId,
                    variantId: variantId,
                    testId: testId,
                    price: price
                });
                return response.json().then(data => {
                    log('✅ Track view response data:', data);
                    if (data.duplicate) {
                        log('⚠️ Duplicate view detected by server');
                        console.warn('[A/B Price Test] ⚠️ Duplicate view detected by server');
                    } else {
                        console.log('[A/B Price Test] ✅ View saved to database successfully!');
                    }
                }).catch(err => {
                    log('⚠️ Could not parse response JSON:', err);
                    console.warn('[A/B Price Test] ⚠️ Could not parse response JSON:', err);
                });
            }
        }).catch(error => {
            // On error, remove from tracked set so we can retry
            trackedViews.delete(viewKey);
            log('❌ Error tracking view:', error);
            console.error('[A/B Price Test] ❌ Network error tracking view:', {
                error: error.message,
                errorName: error.name,
                errorStack: error.stack,
                url: APP_URL + '/api/track-view',
                data: trackingData,
                APP_URL: APP_URL,
                shop: shop,
                productId: productId,
                possibleCauses: [
                    'APP_URL might be incorrect (check if tunnel URL changed)',
                    'CORS error (check if API allows cross-origin requests)',
                    'Network error (check if dev server is running)',
                    'Script not installed in theme (check Shopify theme)'
                ]
            });
        });
    }
    
    // Track conversion
    function trackConversion(productId, testId, variantId, originalPrice, testPrice) {
        if (!APP_URL) return;
        
        const sessionId = getSessionId();
        const shop = getShopDomain();
        
        fetch(APP_URL + '/api/track-conversion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: productId,
                testId: testId,
                variantId: variantId,
                sessionId: sessionId,
                shop: shop,
                url: window.location.href,
                originalPrice: originalPrice,
                testPrice: testPrice
            })
        }).catch(error => {
            log('Error tracking conversion:', error);
        });
    }
    
    // Initialize analytics tracking
    function initializeTracking() {
        // Prevent multiple initializations
        if (window.ABPriceTestTrackingInitialized) {
            log('Tracking already initialized, skipping...');
            return;
        }
        window.ABPriceTestTrackingInitialized = true;
        
        log('🚀 Initializing A/B test analytics tracking on page:', window.location.pathname);
        console.log('[A/B Price Test] 🚀 Initializing tracking...', {
            pathname: window.location.pathname,
            hostname: window.location.hostname,
            currentAPP_URL: APP_URL
        });
        
        // Detect app URL
        detectAppUrl();
        log('Final APP_URL after detection:', APP_URL);
        console.log('[A/B Price Test] Final APP_URL:', APP_URL);
        
        // Check if APP_URL is valid
        if (!APP_URL || APP_URL.includes('attempts-clarke-serving-rules') || APP_URL.includes('sandwich-measurement')) {
            console.error('[A/B Price Test] ⚠️ WARNING: APP_URL might be incorrect!', APP_URL);
            console.error('[A/B Price Test] ⚠️ Please check:');
            console.error('[A/B Price Test] 1. Is the script tag installed with the correct URL?');
            console.error('[A/B Price Test] 2. Is the app URL set correctly in Vercel?');
            console.error('[A/B Price Test] 3. Expected URL: https://shopifypricetestsplitapp.vercel.app');
        }
        
        // ONLY track views on product detail pages, NOT on listing pages
        // This ensures we only track when someone actually views a product page
        if (window.location.pathname.includes('/products/')) {
            log('✅ Product page detected, tracking product page view only');
            console.log('[A/B Price Test] ✅ Product page detected, will track view');
            trackProductPageView();
        } else {
            log('⚠️ Listing page detected, NOT tracking product views (only track on product detail pages)');
            console.log('[A/B Price Test] ⚠️ Not a product page, skipping view tracking');
        }
        
        // Setup cart conversion tracking
        setupCartTracking();
    }
    
    // Track product page view (when user visits a specific product page)
    async function trackProductPageView() {
        try {
            log('📊 Starting product page view tracking...');
            console.log('[A/B Price Test] 📊 Starting product page view tracking...');
            
            // Wait longer for page to fully load, test prices to be applied, and Shopify metadata to be available
            // Test prices might be applied dynamically, so we need to wait for them
            await new Promise(resolve => setTimeout(resolve, 1000)); // Increased from 500ms to 1000ms
        
        // Get product ID from Shopify metadata
        let productIdRaw = null;
        if (window.ShopifyAnalytics?.meta?.product?.id) {
            productIdRaw = String(window.ShopifyAnalytics.meta.product.id);
            log('Found product ID from ShopifyAnalytics.meta.product.id:', productIdRaw);
        } else if (window.meta?.product?.id) {
            productIdRaw = String(window.meta.product.id);
            log('Found product ID from window.meta.product.id:', productIdRaw);
        } else if (document.querySelector('[data-product-id]')) {
            productIdRaw = document.querySelector('[data-product-id]').getAttribute('data-product-id');
            log('Found product ID from data-product-id attribute:', productIdRaw);
        } else if (document.querySelector('form[action*="/cart/add"]')) {
            // Try to get from form action URL
            const form = document.querySelector('form[action*="/cart/add"]');
            const actionUrl = form.getAttribute('action');
            const productMatch = actionUrl.match(/products\/([^\/]+)/);
            if (productMatch) {
                log('Found product handle from form action:', productMatch[1]);
                // We need the numeric ID, not the handle, so this won't work directly
                // But we can log it for debugging
            }
        }
        
        // Extract numeric product ID from GID format
        const productId = extractProductId(productIdRaw);
        
        if (!productId) {
            log('❌ Product ID not found on product page');
            log('Debug info:', {
                hasShopifyAnalytics: !!window.ShopifyAnalytics,
                hasMeta: !!window.meta,
                hasDataProductId: !!document.querySelector('[data-product-id]'),
                url: window.location.href
            });
            console.error('[A/B Price Test] Cannot track view - Product ID not found');
            return;
        }
        
        log('✅ Extracted product ID:', productId, 'from raw:', productIdRaw);
        
        // Get original price from page - try multiple selectors
        let originalPrice = null;
        const priceSelectors = [
            '.price, .product-price, .money, [data-price]',
            '[itemprop="price"]',
            '.product__price',
            '.price-current',
            '.current-price'
        ];
        
        for (const selector of priceSelectors) {
            const priceElements = document.querySelectorAll(selector);
            for (const element of priceElements) {
                const price = extractPrice(element.textContent);
                if (price) {
                    originalPrice = price;
                    log('Found price from selector:', selector, 'Price:', price);
                    break;
                }
            }
            if (originalPrice) break;
        }
        
        if (!originalPrice) {
            log('❌ Original price not found on product page');
            log('Debug info:', {
                priceElementsFound: document.querySelectorAll('.price, .product-price, .money, [data-price]').length,
                url: window.location.href
            });
            console.error('[A/B Price Test] Cannot track view - Price not found');
            return;
        }
        
        // IMPORTANT: Get the ACTUAL displayed price from the page (this is what the user actually sees)
        // Strategy: Collect ALL unique prices found, then pick the one that's most different from base
        // This ensures we catch test prices even if they're applied late
        let allFoundPrices = [];
        let uniquePrices = new Set();
        
        // Try multiple times with small delays to catch dynamically updated prices
        // Test prices might be applied after page load, so we need to check multiple times
        for (let attempt = 0; attempt < 8; attempt++) { // Increased to 8 attempts
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, 400));
            }
            
            // Try multiple selectors to find price - prioritize more specific selectors
            const priceSelectors = [
                '.price--current, .price-current, .current-price',
                '.product__price, .product-price',
                '[data-product-price], [data-price]',
                '[itemprop="price"]',
                '.price, .money',
                '.product-price-current',
                '.price--regular',
                '.price-item--regular',
                '.product__price-current'
            ];
            
            for (const selector of priceSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const price = extractPrice(element.textContent);
                    if (price && price > 0) {
                        // Track all found prices for debugging
                        const priceKey = price.toFixed(2);
                        if (!uniquePrices.has(priceKey)) {
                            uniquePrices.add(priceKey);
                            allFoundPrices.push({
                                price: price,
                                selector: selector,
                                attempt: attempt + 1,
                                text: element.textContent.trim().substring(0, 50),
                                element: element
                            });
                        }
                    }
                }
            }
        }
        
        // Log all found prices for debugging
        if (allFoundPrices.length > 0) {
            log('📊 All unique prices found during detection:', allFoundPrices.map(p => ({
                price: p.price,
                selector: p.selector,
                attempt: p.attempt
            })));
            
            // Sort by price difference from original to see which ones are test prices
            const sortedPrices = allFoundPrices.map(p => ({
                ...p,
                diffFromOriginal: Math.abs(p.price - originalPrice)
            })).sort((a, b) => b.diffFromOriginal - a.diffFromOriginal);
            log('📊 Prices sorted by difference from original:', sortedPrices.map(p => ({
                price: p.price,
                diffFromOriginal: p.diffFromOriginal.toFixed(2)
            })));
        }
        
        // CRITICAL: Determine the actual displayed price
        // Strategy: Use the most frequent price found (most likely to be the actual displayed price)
        // Only use "most different" logic if we find prices that are SIGNIFICANTLY different (>$0.10)
        let actualDisplayedPrice = null;
        
        if (allFoundPrices.length === 0) {
            actualDisplayedPrice = originalPrice;
            log('⚠️ No prices found, using originalPrice:', originalPrice);
        } else {
            // Find the price that appears most frequently (most likely to be the actual displayed price)
            const priceFrequency = {};
            allFoundPrices.forEach(p => {
                const key = p.price.toFixed(2);
                priceFrequency[key] = (priceFrequency[key] || 0) + 1;
            });
            
            // Get prices sorted by frequency (most frequent first)
            const sortedByFrequency = Object.entries(priceFrequency)
                .map(([price, count]) => ({ price: parseFloat(price), count }))
                .sort((a, b) => b.count - a.count);
            
            // Check if any prices are significantly different from the original (likely test prices)
            const pricesWithDiff = allFoundPrices
                .map(p => ({ ...p, diffFromOriginal: Math.abs(p.price - originalPrice) }))
                .filter(p => p.diffFromOriginal > 0.10); // Only consider prices that differ by more than $0.10
            
            if (pricesWithDiff.length > 0) {
                // Found prices significantly different from base - likely test prices
                // Use the one with largest difference (most likely to be the test price being displayed)
                const significantDiff = pricesWithDiff.filter(p => p.diffFromOriginal > 0.10);
                if (significantDiff.length > 0) {
                    actualDisplayedPrice = significantDiff.sort((a, b) => b.diffFromOriginal - a.diffFromOriginal)[0].price;
                    log(`✅ Selected test price (significantly different from base): $${actualDisplayedPrice} (diff: $${significantDiff[0].diffFromOriginal.toFixed(2)})`);
                } else {
                    // Use most frequent price
                    actualDisplayedPrice = sortedByFrequency[0].price;
                    log(`✅ Selected most frequent price: $${actualDisplayedPrice} (appeared ${sortedByFrequency[0].count} times)`);
                }
            } else {
                // No prices significantly different from base - likely viewing base price
                // Use the most frequent price
                actualDisplayedPrice = sortedByFrequency[0].price;
                log(`✅ Selected most frequent price (likely base): $${actualDisplayedPrice} (appeared ${sortedByFrequency[0].count} times)`);
            }
        }
        
        // Final check
        const priceDiff = Math.abs(actualDisplayedPrice - originalPrice);
        if (priceDiff < 0.01) {
            log('✅ Final displayed price detected (matches base price):', actualDisplayedPrice, 'vs original:', originalPrice);
        } else {
            log('✅ Final displayed price detected (TEST PRICE):', actualDisplayedPrice, 'vs original:', originalPrice, 'difference:', priceDiff.toFixed(2));
        }
        
        log('📊 Starting tracking for product page view');
        log('Product ID:', productId);
        log('Original Price:', originalPrice);
        log('Actual Displayed Price:', actualDisplayedPrice);
        
        // Check for active test and track view with correct test/variant info
        try {
            const sessionId = getSessionId();
            const shop = getShopDomain();
            
            log('🔗 Session ID:', sessionId);
            log('🏪 Shop Domain:', shop);
            log('🌐 APP_URL:', APP_URL);
            
            const testInfoUrl = `${APP_URL}/api/storefront/get-price?productId=${productId}&originalPrice=${originalPrice}&sessionId=${sessionId}&shop=${shop}`;
            
            log('📡 Fetching test info from:', testInfoUrl);
            log('📋 Request details:', { 
                productId, 
                originalPrice, 
                actualDisplayedPrice, 
                sessionId, 
                shop, 
                APP_URL 
            });
            
            console.log('[A/B Price Test] About to fetch:', testInfoUrl);
            const response = await fetch(testInfoUrl);
            
            log('📥 Response status:', response.status, response.statusText);
            log('📥 Response OK?', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                log('❌ API Error Response:', errorText);
                console.error('[A/B Price Test] API request failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: testInfoUrl,
                    error: errorText
                });
            }
            
            if (response.ok) {
                const testData = await response.json();
                log('Test info response:', JSON.stringify(testData, null, 2));
                
                if (testData.isTestPrice && testData.testId) {
                    // CRITICAL: Read the FINAL displayed price RIGHT NOW (after all dynamic updates)
                    // This ensures we're reading the price at the exact moment we're tracking
                    // IMPORTANT: We'll get the server-assigned variant first, then use that to validate the price
                    const allVariants = testData.allVariants || [];
                    const serverPrice = testData.price;
                    const serverVariant = testData.variant;
                    
                    // Get expected price range from variants (to filter out unrelated prices)
                    const allVariantPrices = allVariants.map(v => v.price);
                    const minExpectedPrice = Math.min(...allVariantPrices, serverPrice || 0) - 5; // Allow $5 below minimum
                    const maxExpectedPrice = Math.max(...allVariantPrices, serverPrice || 0) + 5; // Allow $5 above maximum
                    
                    log(`🎯 Expected price range: $${minExpectedPrice.toFixed(2)} - $${maxExpectedPrice.toFixed(2)} (based on variants: ${allVariantPrices.join(', ')})`);
                    
                    let finalDisplayedPrice = null;
                    const finalPriceSelectors = [
                        '.price--current, .price-current, .current-price',
                        '.product__price, .product-price',
                        '[data-product-price], [data-price]',
                        '[itemprop="price"]'
                    ];
                    
                    // Collect all prices found, then filter by expected range
                    const allFoundPrices = [];
                    
                    // Try reading price multiple times (in case of dynamic updates)
                    for (let attempt = 0; attempt < 3; attempt++) {
                        if (attempt > 0) {
                            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                        }
                        
                        for (const selector of finalPriceSelectors) {
                            const elements = document.querySelectorAll(selector);
                            for (const element of elements) {
                                const price = extractPrice(element.textContent);
                                if (price && price > 0) {
                                    allFoundPrices.push({
                                        price: price,
                                        selector: selector,
                                        attempt: attempt + 1,
                                        element: element
                                    });
                                }
                            }
                        }
                    }
                    
                    // Filter prices to only those within expected range (exclude unrelated prices like $25)
                    const validPrices = allFoundPrices.filter(p => 
                        p.price >= minExpectedPrice && p.price <= maxExpectedPrice
                    );
                    
                    log(`💰 Found ${allFoundPrices.length} prices total, ${validPrices.length} within expected range:`, {
                        allPrices: allFoundPrices.map(p => ({ price: p.price, selector: p.selector })),
                        validPrices: validPrices.map(p => ({ price: p.price, selector: p.selector }))
                    });
                    
                    // If we have valid prices, use the most frequent one (most likely to be the actual displayed price)
                    if (validPrices.length > 0) {
                        const priceFreq = {};
                        validPrices.forEach(p => {
                            const key = p.price.toFixed(2);
                            priceFreq[key] = (priceFreq[key] || 0) + 1;
                        });
                        const mostFrequent = Object.entries(priceFreq).sort((a, b) => b[1] - a[1])[0];
                        finalDisplayedPrice = parseFloat(mostFrequent[0]);
                        log(`✅ Selected most frequent valid price: $${finalDisplayedPrice} (appeared ${mostFrequent[1]} times)`);
                    } else {
                        // No valid prices found in expected range - try to use what we have
                        log(`⚠️ No valid prices in expected range, trying fallbacks...`);
                        
                        // First, try originalPrice if it's reasonable (even if outside expected range)
                        if (originalPrice && originalPrice > 0 && originalPrice < 1000) {
                            finalDisplayedPrice = originalPrice;
                            log(`✅ Using originalPrice from DOM (fallback): $${finalDisplayedPrice}`);
                        } else if (serverPrice && serverPrice > 0 && serverPrice < 1000) {
                            // Server price is reasonable, use it
                            finalDisplayedPrice = serverPrice;
                            log(`⚠️ Using server-assigned price (fallback): $${finalDisplayedPrice}`);
                        } else {
                            // Use the actual base price from variants as fallback (most likely what user sees)
                            const baseVariantPrice = allVariants.find(v => v.isBaseVariant || v.id === 0)?.price;
                            if (baseVariantPrice && baseVariantPrice > 0) {
                                finalDisplayedPrice = baseVariantPrice;
                                log(`⚠️ Using base variant price from server (fallback): $${finalDisplayedPrice}`);
                            } else if (actualDisplayedPrice && actualDisplayedPrice > 0 && actualDisplayedPrice < 1000) {
                                finalDisplayedPrice = actualDisplayedPrice;
                                log(`⚠️ Using earlier detected price (fallback): $${finalDisplayedPrice}`);
                            } else {
                                // Last resort - use server price even if outside range
                                finalDisplayedPrice = serverPrice || originalPrice || 0;
                                log(`⚠️ Using last resort price: $${finalDisplayedPrice}`);
                            }
                        }
                    }
                    
                    // Use the final displayed price if found, otherwise use the earlier detected price, or server price, or originalPrice
                    const priceToCompare = finalDisplayedPrice || actualDisplayedPrice || serverPrice || originalPrice;
                    
                    if (!priceToCompare || priceToCompare <= 0) {
                        log('❌ ERROR: No valid price found for comparison! Using server price as last resort.');
                        // Force use server price if available
                        if (serverPrice && serverPrice > 0) {
                            finalDisplayedPrice = serverPrice;
                            log(`⚠️ Using server price as fallback: $${serverPrice}`);
                        } else {
                            log('❌ CRITICAL: No price available at all! Cannot track view.');
                            return; // Exit - can't track without a price
                        }
                    }
                    
                    log(`💰 Final price comparison values: finalDisplayedPrice=$${finalDisplayedPrice}, actualDisplayedPrice=$${actualDisplayedPrice}, priceToCompare=$${priceToCompare}, serverPrice=$${serverPrice}`);
                    
                    // CRITICAL FIX: Match the ACTUAL displayed price to the correct variant
                    // The server assigns variants based on traffic, but we need to track based on what the user actually sees
                    // However, if price detection fails, we should trust the server-assigned variant
                    // allVariants, serverPrice, and serverVariant are already defined above
                    
                    // Get the ACTUAL base price from the server (not from DOM which might be wrong)
                    const baseVariant = allVariants.find(v => v.isBaseVariant === true || v.id === 0 || v.variantName === "Base Price");
                    const actualBasePrice = baseVariant ? baseVariant.price : originalPrice;
                    
                    log('🔍 Server response:', {
                        serverAssignedPrice: serverPrice,
                        earlierDetectedPrice: actualDisplayedPrice,
                        finalDisplayedPrice: priceToCompare,
                        originalPriceFromDOM: originalPrice,
                        actualBasePriceFromServer: actualBasePrice,
                        variant: testData.variant,
                        variantName: testData.variantName,
                        allVariants: allVariants.map(v => ({ name: v.variantName, price: v.price, id: v.id, isBase: v.isBaseVariant }))
                    });
                    
                    // STEP 1: Check if displayed price matches base price FROM SERVER (within $0.01 tolerance)
                    // Use the server's base price, not the DOM's originalPrice (which might already be a test price)
                    // Use the FINAL displayed price we just read
                    const priceDiffFromBase = Math.abs(priceToCompare - actualBasePrice);
                    if (priceDiffFromBase < 0.01) {
                        // User is seeing the base price - track as base price view (variantId: null)
                        log('✅ FINAL displayed price matches base price FROM SERVER - tracking as BASE PRICE view:', {
                            finalDisplayedPrice: priceToCompare,
                            earlierDetectedPrice: actualDisplayedPrice,
                            basePriceFromServer: actualBasePrice,
                            basePriceFromDOM: originalPrice,
                            difference: priceDiffFromBase.toFixed(2)
                        });
                        trackView(productId, testData.testId, null, actualBasePrice);
                        return; // Exit early - we're done!
                    }
                    
                    // STEP 1b: Check if displayed price matches DOM original price (user might be seeing actual base price)
                    // IMPORTANT: But FIRST check if it matches any test variant - prioritize test variants!
                    // Only treat as base if it matches DOM original AND is NOT close to any test variant
                    const priceDiffFromDOMOriginal = Math.abs(priceToCompare - originalPrice);
                    
                    // Check ALL variants first (including test variants) before deciding it's base
                    const allVariantsWithDiffs = allVariants.map(v => ({
                        variant: v,
                        diff: Math.abs(v.price - priceToCompare)
                    })).sort((a, b) => a.diff - b.diff);
                    
                    const closestVariantMatch = allVariantsWithDiffs[0];
                    
                    log('🔍 Price matching analysis:', {
                        priceToCompare: priceToCompare,
                        originalPrice: originalPrice,
                        actualBasePrice: actualBasePrice,
                        closestVariant: closestVariantMatch ? {
                            name: closestVariantMatch.variant.variantName,
                            price: closestVariantMatch.variant.price,
                            diff: closestVariantMatch.diff.toFixed(2),
                            isBase: closestVariantMatch.variant.isBaseVariant
                        } : null,
                        allVariants: allVariantsWithDiffs.map(v => ({
                            name: v.variant.variantName,
                            price: v.variant.price,
                            diff: v.diff.toFixed(2)
                        }))
                    });
                    
                    // If price matches DOM original AND closest match is NOT a test variant (or diff is large), it's base
                    if (priceDiffFromDOMOriginal < 0.01) {
                        // Check if the closest match is a test variant with small difference
                        const isCloseToTestVariant = closestVariantMatch && 
                            !closestVariantMatch.variant.isBaseVariant && 
                            closestVariantMatch.variant.id !== 0 &&
                            closestVariantMatch.variant.variantName !== "Base Price" &&
                            closestVariantMatch.diff < 0.50; // Within $0.50 of a test variant
                        
                        if (!isCloseToTestVariant) {
                            // Not close to any test variant, so it's the base price
                            log('✅ FINAL displayed price matches DOM original price (not close to test variants) - tracking as BASE PRICE view:', {
                                finalDisplayedPrice: priceToCompare,
                                earlierDetectedPrice: actualDisplayedPrice,
                                basePriceFromDOM: originalPrice,
                                basePriceFromServer: actualBasePrice,
                                differenceFromDOM: priceDiffFromDOMOriginal.toFixed(2),
                                differenceFromServer: priceDiffFromBase.toFixed(2),
                                closestVariantDiff: closestVariantMatch ? closestVariantMatch.diff.toFixed(2) : 'N/A'
                            });
                            trackView(productId, testData.testId, null, actualBasePrice);
                            return; // Exit early - we're done!
                        } else {
                            log('⚠️ FINAL displayed price matches DOM original but is close to a test variant - will match to variant instead');
                        }
                    }
                    
                    // STEP 2: Match displayed price to a test variant (within $0.01 tolerance for exact match)
                    // PRIORITIZE test variants - check them FIRST before base
                    // Use the FINAL displayed price we just read
                    const allTestVariants = allVariants.filter(v => !v.isBaseVariant && v.id !== 0 && v.variantName !== "Base Price");
                    
                    // First check test variants for exact match
                    let matchedVariant = allTestVariants.find(v => {
                        const priceDiff = Math.abs(v.price - priceToCompare);
                        return priceDiff < 0.01;
                    });
                    
                    // If no test variant match, check base variant
                    if (!matchedVariant) {
                        const baseVariant = allVariants.find(v => v.isBaseVariant || v.id === 0 || v.variantName === "Base Price");
                        if (baseVariant) {
                            const priceDiff = Math.abs(baseVariant.price - priceToCompare);
                            if (priceDiff < 0.01) {
                                matchedVariant = baseVariant;
                            }
                        }
                    }
                    
                    if (matchedVariant) {
                        const isBase = matchedVariant.isBaseVariant === true || matchedVariant.id === 0 || matchedVariant.variantName === "Base Price";
                        const variantId = isBase ? null : (matchedVariant.id === 0 ? null : matchedVariant.id);
                        
                        log('✅ FINAL displayed price matches variant exactly - tracking as view:', {
                            finalDisplayedPrice: priceToCompare,
                            earlierDetectedPrice: actualDisplayedPrice,
                            variantName: matchedVariant.variantName,
                            variantId: variantId,
                            variantPrice: matchedVariant.price,
                            isBase: isBase,
                            matchType: isBase ? 'BASE PRICE' : 'TEST VARIANT'
                        });
                        trackView(productId, testData.testId, variantId, matchedVariant.price);
                        return; // Exit early
                    }
                    
                    // STEP 3: If no exact match, find the closest variant (within $1.00 tolerance for better matching)
                    // Prioritize test variants over base price
                    // Use the FINAL displayed price we just read
                    // allTestVariants already defined above
                    let closestVariant = null;
                    let closestDiff = Infinity;
                    
                    // First, try to find closest test variant (within $1.00)
                    for (const variant of allTestVariants) {
                        const diff = Math.abs(variant.price - priceToCompare);
                        if (diff < closestDiff && diff < 1.00) {
                            closestDiff = diff;
                            closestVariant = variant;
                        }
                    }
                    
                    // If no test variant found, check base variant
                    if (!closestVariant) {
                        const baseVariant = allVariants.find(v => v.isBaseVariant || v.id === 0 || v.variantName === "Base Price");
                        if (baseVariant) {
                            const diff = Math.abs(baseVariant.price - priceToCompare);
                            if (diff < 1.00) {
                                closestDiff = diff;
                                closestVariant = baseVariant;
                            }
                        }
                    }
                    
                    if (closestVariant) {
                        const isBase = closestVariant.isBaseVariant === true || closestVariant.id === 0 || closestVariant.variantName === "Base Price";
                        const variantId = isBase ? null : (closestVariant.id === 0 ? null : closestVariant.id);
                        
                        log('✅ FINAL displayed price closest to variant (within $1.00) - tracking as VARIANT view:', {
                            finalDisplayedPrice: priceToCompare,
                            earlierDetectedPrice: actualDisplayedPrice,
                            variantName: closestVariant.variantName,
                            variantId: variantId,
                            variantPrice: closestVariant.price,
                            difference: closestDiff.toFixed(2),
                            isBase: isBase
                        });
                        trackView(productId, testData.testId, variantId, closestVariant.price);
                        return; // Exit early
                    }
                    
                    // STEP 4: If displayed price doesn't match any variant within $1.00, check if it's significantly closer to base
                    // Only track as base if it's MUCH closer to base than to any test variant (difference > $2.00)
                    const minDiffToTestVariant = allTestVariants.length > 0 
                        ? Math.min(...allTestVariants.map(v => Math.abs(v.price - priceToCompare)))
                        : Infinity;
                    
                    // Only track as base if:
                    // 1. Price is significantly closer to base than to any test variant (difference > $2.00)
                    // 2. AND price is within $2.00 of base price
                    const diffBetweenBaseAndTest = minDiffToTestVariant - priceDiffFromBase;
                    if (diffBetweenBaseAndTest > 2.00 && priceDiffFromBase < 2.00) {
                        log('⚠️ FINAL displayed price significantly closer to base than test variants - tracking as BASE PRICE view:', {
                            finalDisplayedPrice: priceToCompare,
                            earlierDetectedPrice: actualDisplayedPrice,
                            basePriceFromServer: actualBasePrice,
                            basePriceFromDOM: originalPrice,
                            differenceFromBase: priceDiffFromBase.toFixed(2),
                            minDiffToTestVariant: minDiffToTestVariant.toFixed(2),
                            diffBetweenBaseAndTest: diffBetweenBaseAndTest.toFixed(2)
                        });
                        trackView(productId, testData.testId, null, actualBasePrice);
                        return; // Exit early
                    }
                    
                    // STEP 5: Check if price is closer to base OR test variants
                    // CRITICAL: Only track as base if price is MUCH closer to base than to ANY test variant
                    // Otherwise, prefer test variants (they're more specific)
                    const allTestVariantsForFallback = allVariants.filter(v => !v.isBaseVariant && v.id !== 0 && v.variantName !== "Base Price");
                    const minDiffToTestVariantForFallback = allTestVariantsForFallback.length > 0 
                        ? Math.min(...allTestVariantsForFallback.map(v => Math.abs(v.price - priceToCompare)))
                        : Infinity;
                    
                    // Only track as base if:
                    // 1. Price is significantly closer to base (difference > $1.00)
                    // 2. AND price is within $2 of base
                    // This prevents incorrectly tracking test variant views as base
                    const diffBetweenBaseAndTestForFallback = minDiffToTestVariantForFallback - priceDiffFromBase;
                    if (diffBetweenBaseAndTestForFallback > 1.00 && priceDiffFromBase < 2.00) {
                        log('✅ Price is significantly closer to base than test variants - tracking as BASE PRICE view:', {
                            finalDisplayedPrice: priceToCompare,
                            basePrice: actualBasePrice,
                            priceDiffFromBase: priceDiffFromBase.toFixed(2),
                            minDiffToTestVariant: minDiffToTestVariantForFallback.toFixed(2),
                            diffBetweenBaseAndTest: diffBetweenBaseAndTestForFallback.toFixed(2)
                        });
                        trackView(productId, testData.testId, null, actualBasePrice);
                        return; // Exit early
                    }
                    
                    // If price is closer to a test variant, use that instead
                    if (minDiffToTestVariantForFallback < priceDiffFromBase && minDiffToTestVariantForFallback < 2.00) {
                        const closestTestVariant = allTestVariantsForFallback.find(v => 
                            Math.abs(v.price - priceToCompare) === minDiffToTestVariantForFallback
                        );
                        if (closestTestVariant) {
                            const variantId = closestTestVariant.id === 0 ? null : closestTestVariant.id;
                            log('✅ Price is closer to test variant than base - tracking as TEST VARIANT view:', {
                                finalDisplayedPrice: priceToCompare,
                                variantName: closestTestVariant.variantName,
                                variantPrice: closestTestVariant.price,
                                variantId: variantId,
                                diffFromVariant: minDiffToTestVariantForFallback.toFixed(2),
                                diffFromBase: priceDiffFromBase.toFixed(2)
                            });
                            trackView(productId, testData.testId, variantId, closestTestVariant.price);
                            return; // Exit early
                        }
                    }
                    
                    // STEP 6: Final fallback - use server-assigned variant ONLY if it matches the displayed price closely
                    log('⚠️ Could not match FINAL displayed price to any variant, checking server-assigned variant:', {
                        finalDisplayedPrice: priceToCompare,
                        earlierDetectedPrice: actualDisplayedPrice,
                        serverPrice: serverPrice,
                        serverVariant: serverVariant,
                        serverVariantName: testData.variantName,
                        priceDiffFromBase: priceDiffFromBase.toFixed(2),
                        minDiffToTestVariant: minDiffToTestVariantForFallback.toFixed(2)
                    });
                    
                    if (serverVariant && serverVariant.id !== undefined) {
                        const assignedVariant = serverVariant;
                        const serverVariantPriceDiff = Math.abs(assignedVariant.price - priceToCompare);
                        
                        // Only use server variant if its price is close to detected price (within $2)
                        // Otherwise, default to base price (safer assumption)
                        if (serverVariantPriceDiff < 2.00) {
                            const isBase = assignedVariant.isBaseVariant === true || assignedVariant.id === 0 || assignedVariant.variantName === "Base Price" || assignedVariant.variantName === "Original Price";
                            const variantId = isBase ? null : (assignedVariant.id === 0 ? null : assignedVariant.id);
                            
                            log(`✅ Using server-assigned variant (price matches closely): ${assignedVariant.variantName} (ID: ${variantId}, isBase: ${isBase}, price: $${assignedVariant.price}, diff: $${serverVariantPriceDiff.toFixed(2)})`);
                            trackView(productId, testData.testId, variantId, assignedVariant.price);
                        } else {
                            // Server variant price doesn't match detected price - default to base
                            log(`⚠️ Server variant price ($${assignedVariant.price}) doesn't match detected price ($${priceToCompare}), defaulting to BASE PRICE`);
                            trackView(productId, testData.testId, null, actualBasePrice);
                        }
                    } else if (serverPrice && Math.abs(serverPrice - priceToCompare) < 2.00) {
                        // Server returned a price that matches detected price - try to match to variant
                        const matchedVariantByPrice = allVariants.find(v => Math.abs(v.price - serverPrice) < 0.01);
                        if (matchedVariantByPrice) {
                            const isBase = matchedVariantByPrice.isBaseVariant === true || matchedVariantByPrice.id === 0;
                            const variantId = isBase ? null : (matchedVariantByPrice.id === 0 ? null : matchedVariantByPrice.id);
                            log(`✅ Matched server price $${serverPrice} to variant: ${matchedVariantByPrice.variantName} (ID: ${variantId})`);
                            trackView(productId, testData.testId, variantId, matchedVariantByPrice.price);
                        } else {
                            log(`⚠️ Could not match server price $${serverPrice} to any variant, tracking as base`);
                            trackView(productId, testData.testId, null, actualBasePrice);
                        }
                    } else {
                        // No good match - use server-assigned variant if available, otherwise default to base
                        if (serverVariant && serverVariant.id !== undefined) {
                            const assignedVariant = serverVariant;
                            const isBase = assignedVariant.isBaseVariant === true || assignedVariant.id === 0 || assignedVariant.variantName === "Base Price" || assignedVariant.variantName === "Original Price";
                            const variantId = isBase ? null : (assignedVariant.id === 0 ? null : assignedVariant.id);
                            log(`⚠️ No price match, using server-assigned variant as fallback: ${assignedVariant.variantName} (ID: ${variantId})`);
                            trackView(productId, testData.testId, variantId, assignedVariant.price);
                        } else {
                            log(`⚠️ No reliable match found, defaulting to BASE PRICE`);
                            trackView(productId, testData.testId, null, actualBasePrice);
                        }
                    }
                    return; // Exit early
                } else {
                    // No active test - still track the view (for base price analytics)
                    log('⚠️ No active test for product page:', productId, 'Response:', testData);
                    trackView(productId, null, null, originalPrice);
                }
            } else {
                // API returned error - but we still got testData from earlier, try to use it
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch (e) {
                    // Body already read, ignore
                }
                
                log('❌ Failed to check test info for product page:', response.status, errorText);
                console.error('[A/B Price Test] API error - will try to track without variant info:', {
                    status: response.status,
                    error: errorText,
                    productId,
                    displayedPrice: actualDisplayedPrice
                });
                
                // Still track the view, but without test/variant info
                // This ensures we at least capture that someone visited the page
                trackView(productId, null, null, originalPrice);
            }
        } catch (error) {
            log('❌ Error checking test info for product page:', error);
            console.error('[A/B Price Test] ❌ Network/Error:', error);
            console.error('[A/B Price Test] Error stack:', error.stack);
            log('This might be due to network issues or wrong APP_URL');
            
            // Still track the view even if API fails - ALWAYS track something
            if (productId) {
                log('⚠️ Tracking view without test info due to error');
                trackView(productId, null, null, originalPrice || 0);
            } else {
                console.error('[A/B Price Test] ❌ CRITICAL: Cannot track - productId is missing');
            }
        }
    } catch (error) {
        // Outer try-catch for the entire function
        log('❌ Error in trackProductPageView:', error);
        console.error('[A/B Price Test] ❌ Fatal error in trackProductPageView:', error);
        console.error('[A/B Price Test] Error stack:', error.stack);
    }
}
    
    // Track product view with test/variant detection
    
    // Setup cart conversion tracking
    function setupCartTracking() {
        document.addEventListener('submit', async function(e) {
            const form = e.target;
            if (!form.action || !form.action.includes('/cart/add')) return;
            
            // Let the form submit normally, just track the conversion
            const formData = new FormData(form);
            const variantId = formData.get('id');
            
            // Find the product ID
            let productIdRaw = form.getAttribute('data-product-id') || 
                           document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
            
            // Try to get from Shopify metadata if on product page
            if (!productIdRaw && window.location.pathname.includes('/products/')) {
                if (window.ShopifyAnalytics?.meta?.product?.id) {
                    productIdRaw = String(window.ShopifyAnalytics.meta.product.id);
                } else if (window.meta?.product?.id) {
                    productIdRaw = String(window.meta.product.id);
                }
            }
            
            // Extract numeric product ID from GID format
            const productId = extractProductId(productIdRaw);
            
            if (!productId) return;
            
            // Get current price from the page
            const priceElements = document.querySelectorAll('.price, .product-price, .money');
            let currentPrice = null;
            for (const element of priceElements) {
                const price = extractPrice(element.textContent);
                if (price) {
                    currentPrice = price;
                    break;
                }
            }
            
            if (!currentPrice) return;
            
            // Get test info for conversion tracking - use same logic as view tracking
            try {
                const sessionId = getSessionId();
                const shop = getShopDomain();
                const testInfoUrl = `${APP_URL}/api/storefront/get-price?productId=${productId}&originalPrice=${currentPrice}&sessionId=${sessionId}&shop=${shop}`;
                
                const response = await fetch(testInfoUrl);
                if (response.ok) {
                    const testData = await response.json();
                    
                    if (testData.isTestPrice && testData.testId) {
                        // Match the displayed price to the correct variant (same logic as view tracking)
                        const allVariants = testData.allVariants || [];
                        const baseVariant = allVariants.find(v => v.isBaseVariant === true || v.id === 0 || v.variantName === "Base Price");
                        const actualBasePrice = baseVariant ? baseVariant.price : currentPrice;
                        
                        // Check if current price matches base price
                        const priceDiffFromBase = Math.abs(currentPrice - actualBasePrice);
                        if (priceDiffFromBase < 0.01) {
                            // Base price conversion
                            trackConversion(productId, testData.testId, null, currentPrice, actualBasePrice);
                            log('✅ Tracked BASE PRICE conversion - Product:', productId, 'Test:', testData.testId, 'Price:', actualBasePrice);
                            return;
                        }
                        
                        // Try to match to test variants
                        const matchedVariant = allVariants.find(v => {
                            const priceDiff = Math.abs(v.price - currentPrice);
                            return priceDiff < 0.01;
                        });
                        
                        if (matchedVariant) {
                            const isBase = matchedVariant.isBaseVariant === true || matchedVariant.id === 0 || matchedVariant.variantName === "Base Price";
                            const variantId = isBase ? null : (matchedVariant.id === 0 ? null : matchedVariant.id);
                            trackConversion(productId, testData.testId, variantId, currentPrice, matchedVariant.price);
                            log('✅ Tracked TEST VARIANT conversion - Product:', productId, 'Test:', testData.testId, 'Variant:', variantId, 'Price:', matchedVariant.price);
                        } else {
                            // Fallback to server-assigned variant
                            if (testData.variant && testData.variant.id !== undefined) {
                                const assignedVariant = testData.variant;
                                const isBase = assignedVariant.isBaseVariant === true || assignedVariant.id === 0 || assignedVariant.variantName === "Base Price" || assignedVariant.variantName === "Original Price";
                                const variantId = isBase ? null : (assignedVariant.id === 0 ? null : assignedVariant.id);
                                trackConversion(productId, testData.testId, variantId, currentPrice, assignedVariant.price);
                                log('✅ Tracked conversion with server-assigned variant - Product:', productId, 'Test:', testData.testId, 'Variant:', variantId, 'Price:', assignedVariant.price);
                            } else {
                                trackConversion(productId, testData.testId, null, currentPrice, actualBasePrice);
                                log('✅ Tracked conversion as base price (fallback) - Product:', productId, 'Test:', testData.testId, 'Price:', actualBasePrice);
                            }
                        }
                    } else {
                        // Track conversion without test info
                        trackConversion(productId, null, null, currentPrice, currentPrice);
                        log('Tracked conversion without test info - Product:', productId, 'Price:', currentPrice);
                    }
                } else {
                    trackConversion(productId, null, null, currentPrice, currentPrice);
                    log('Tracked conversion (API failed) - Product:', productId, 'Price:', currentPrice);
                }
            } catch (error) {
                log('Error getting test info for conversion:', error);
                trackConversion(productId, null, null, currentPrice, currentPrice);
            }
        });
    }
    
    // Initialize when DOM is ready
    function init() {
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // Add a small delay to ensure Shopify metadata is loaded
                setTimeout(initializeTracking, 100);
            });
        } else {
            // Page already loaded, but wait a bit for Shopify metadata
            setTimeout(initializeTracking, 100);
        }
        
        // Also try on window load (in case DOMContentLoaded already fired)
        window.addEventListener('load', () => {
            // Only initialize if we haven't already
            if (!window.ABPriceTestTrackingInitialized) {
                window.ABPriceTestTrackingInitialized = true;
                log('Initializing tracking from window.load event');
                setTimeout(initializeTracking, 200);
            }
        }, { once: true });
    }
    
    // Start
    init();
    
})();

} // End of guard
