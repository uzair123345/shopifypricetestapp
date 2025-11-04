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
    let APP_URL = window.AB_PRICE_TEST_APP_URL || 'https://attempts-clarke-serving-rules.trycloudflare.com';
    const DEBUG_MODE = true;
    
    // Try to detect the correct tunnel URL from the script tag
    function detectAppUrl() {
        // First, try to get from script tag (most reliable)
        const scriptTags = document.querySelectorAll('script[src*="ab-price-test"]');
        if (scriptTags.length > 0) {
            const scriptSrc = scriptTags[0].src;
            const match = scriptSrc.match(/^(https:\/\/[^\/]+)/);
            if (match) {
                const detectedUrl = match[1];
                // Only use if it's a valid trycloudflare.com URL
                if (detectedUrl.includes('trycloudflare.com')) {
                    APP_URL = detectedUrl;
                    log('✅ Detected APP_URL from script tag:', APP_URL);
                    return;
                } else {
                    log('⚠️ Script tag has URL but it\'s not a cloudflare tunnel:', detectedUrl);
                }
            }
        }
        
        // Try to get from current page URL if it's a cloudflare tunnel
        try {
            if (window.location.href.includes('trycloudflare.com')) {
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
            if (window.location.origin.includes('trycloudflare.com')) {
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
                if (parentUrl.includes('trycloudflare.com')) {
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
            log('💡 Please update the script tag in your Shopify theme with the current tunnel URL');
            console.warn('[A/B Price Test] URL detection failed. Please update script tag with current tunnel URL.');
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
            console.error('[A/B Price Test] Cannot track - productId is missing');
            return;
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
            console.error('[A/B Price Test] 1. Is your dev server running?');
            console.error('[A/B Price Test] 2. Has the tunnel URL changed?');
            console.error('[A/B Price Test] 3. Is the script tag installed in your Shopify theme?');
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
        
        // CRITICAL: Pick the price that's MOST DIFFERENT from original (most likely to be test price)
        // But only if we found prices that differ from base
        let actualDisplayedPrice = null;
        const pricesWithDiff = allFoundPrices.map(p => ({
            ...p,
            diffFromOriginal: Math.abs(p.price - originalPrice)
        })).filter(p => p.diffFromOriginal > 0.01); // Filter out prices that match base
        
        if (pricesWithDiff.length > 0) {
            // Found prices that differ from base - use the one with largest difference
            // But also check if any are significantly different (more than $0.10)
            const significantDiff = pricesWithDiff.filter(p => p.diffFromOriginal > 0.10);
            if (significantDiff.length > 0) {
                // Use the price with the largest difference (most likely to be test price)
                actualDisplayedPrice = significantDiff.sort((a, b) => b.diffFromOriginal - a.diffFromOriginal)[0].price;
                log(`✅ Selected test price (most different from base): $${actualDisplayedPrice} (diff: $${significantDiff[0].diffFromOriginal.toFixed(2)})`);
            } else {
                // Small differences, use the one with largest difference anyway
                actualDisplayedPrice = pricesWithDiff.sort((a, b) => b.diffFromOriginal - a.diffFromOriginal)[0].price;
                log(`✅ Selected test price (smallest difference found): $${actualDisplayedPrice}`);
            }
        } else {
            // No prices found that differ from base - likely viewing base price
            // Use the most recent/frequent price found, or originalPrice
            if (allFoundPrices.length > 0) {
                // Find the price that appears most frequently
                const priceFrequency = {};
                allFoundPrices.forEach(p => {
                    const key = p.price.toFixed(2);
                    priceFrequency[key] = (priceFrequency[key] || 0) + 1;
                });
                const mostFrequent = Object.entries(priceFrequency).sort((a, b) => b[1] - a[1])[0];
                actualDisplayedPrice = parseFloat(mostFrequent[0]);
                log(`✅ Selected most frequent price (likely base): $${actualDisplayedPrice} (appeared ${mostFrequent[1]} times)`);
            } else {
                actualDisplayedPrice = originalPrice;
                log('⚠️ No prices found, using originalPrice:', originalPrice);
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
                    // CRITICAL FIX: Use the server-assigned variant directly instead of trying to detect from DOM
                    // The server already knows which variant was assigned based on traffic distribution
                    // This is the most reliable way to track views correctly
                    const allVariants = testData.allVariants || [];
                    const serverPrice = testData.price; // Server-assigned price
                    let assignedVariantId = null;
                    let assignedPrice = serverPrice || originalPrice;
                    
                    log('🔍 Server response:', {
                        serverAssignedPrice: serverPrice,
                        variant: testData.variant,
                        variantName: testData.variantName,
                        allVariants: allVariants.map(v => ({ name: v.variantName, price: v.price, id: v.id, isBase: v.isBaseVariant }))
                    });
                    
                    // Check if server returned the assigned variant directly
                    if (testData.variant && testData.variant.id !== undefined) {
                        // Server assigned a specific variant - USE IT DIRECTLY
                        const assignedVariant = testData.variant;
                        assignedVariantId = assignedVariant.id === 0 ? null : assignedVariant.id;
                        assignedPrice = assignedVariant.price;
                        log('✅ Using server-assigned variant directly:', {
                            variantName: assignedVariant.variantName,
                            variantId: assignedVariant.id,
                            price: assignedVariant.price
                        });
                        trackView(productId, testData.testId, assignedVariantId, assignedPrice);
                        return; // Exit early - we're done!
                    } else if (testData.variantName && serverPrice) {
                        // Server returned variant name and price - match to variant by name
                        const matchedVariant = allVariants.find(v => v.variantName === testData.variantName);
                        if (matchedVariant) {
                            assignedVariantId = matchedVariant.id === 0 ? null : matchedVariant.id;
                            assignedPrice = matchedVariant.price;
                            log('✅ Matched server variant name to variant:', {
                                variantName: matchedVariant.variantName,
                                variantId: matchedVariant.id,
                                price: matchedVariant.price
                            });
                            trackView(productId, testData.testId, assignedVariantId, assignedPrice);
                            return; // Exit early
                        }
                    }
                    
                    // Fallback: Match server price to variant
                    if (serverPrice) {
                        const matchedVariant = allVariants.find(v => Math.abs(v.price - serverPrice) < 0.01);
                        if (matchedVariant) {
                            const isBase = matchedVariant.isBaseVariant === true || matchedVariant.id === 0 || matchedVariant.variantName === "Base Price";
                            assignedVariantId = isBase ? null : (matchedVariant.id === 0 ? null : matchedVariant.id);
                            assignedPrice = matchedVariant.price;
                            log('✅ Matched server price to variant:', {
                                variantName: matchedVariant.variantName,
                                variantId: matchedVariant.id,
                                price: matchedVariant.price,
                                isBase: isBase
                            });
                            trackView(productId, testData.testId, assignedVariantId, assignedPrice);
                            return; // Exit early
                        }
                    }
                    
                    // Last resort: Use server price but track as base
                    log('⚠️ Could not match server data to variant, using server price and tracking as base');
                    trackView(productId, testData.testId, null, serverPrice || originalPrice);
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
            log('Error checking test info for product page:', error);
            console.error('[A/B Price Test] Network error:', error);
            log('This might be due to network issues or wrong APP_URL');
            
            // Still track the view even if API fails
            trackView(productId, null, null, originalPrice);
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
            
            // Get test info for conversion tracking
            try {
                const sessionId = getSessionId();
                const shop = getShopDomain();
                const testInfoUrl = `${APP_URL}/api/storefront/get-price?productId=${productId}&originalPrice=${currentPrice}&sessionId=${sessionId}&shop=${shop}`;
                
                const response = await fetch(testInfoUrl);
                if (response.ok) {
                    const testData = await response.json();
                    
                    if (testData.isTestPrice && testData.testId && testData.variant) {
                        // Track conversion with test info
                        // Note: If variant.id is 0, it's a virtual base variant, use null instead
                        const variantId = testData.variant.id === 0 ? null : testData.variant.id;
                        trackConversion(productId, testData.testId, variantId, currentPrice, testData.price || currentPrice);
                        log('Tracked conversion with test info - Product:', productId, 'Test:', testData.testId, 'Variant:', variantId, 'Price:', testData.price);
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
