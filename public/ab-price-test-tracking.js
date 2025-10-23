// A/B Price Test - Tracking Only Script
// This script only tracks views and conversions, prices are managed by Shopify rotation
(function() {
    'use strict';
    
    // Configuration
    const DEBUG_MODE = true;
    let APP_URL = '';
    
    // Logging function
    function log(...args) {
        if (DEBUG_MODE) {
            console.log('[A/B Price Test]', ...args);
        }
    }
    
    // Get session ID (for consistent tracking)
    function getSessionId() {
        let sessionId = localStorage.getItem('ab_test_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('ab_test_session_id', sessionId);
            log('Created session ID:', sessionId);
        }
        return sessionId;
    }
    
    // Get shop domain
    function getShopDomain() {
        return window.Shopify?.shop || window.location.hostname;
    }
    
    // Detect app URL from script tag
    function detectAppUrl() {
        const scriptTag = document.querySelector('script[src*="ab-price-test"]');
        if (scriptTag) {
            const src = scriptTag.src;
            const match = src.match(/https:\/\/[^\/]+/);
            if (match) {
                APP_URL = match[0];
                log('Detected APP_URL from script tag:', APP_URL);
            }
        }
    }
    
    // Extract price from text
    function extractPrice(text) {
        const match = text.match(/\$?(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
    }
    
    // Track view event
    function trackView(productId, testId, variantId, price) {
        if (!APP_URL) return;
        
        const sessionId = getSessionId();
        const shop = getShopDomain();
        
        fetch(APP_URL + '/api/track-view', {
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
                price: price
            })
        }).catch(error => {
            log('Error tracking view:', error);
        });
    }
    
    // Track conversion event
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
    
    // Check if product has active test
    async function checkActiveTest(productId, currentPrice) {
        if (!APP_URL) return null;
        
        try {
            const sessionId = getSessionId();
            const shop = getShopDomain();
            
            const response = await fetch(
                `${APP_URL}/api/storefront/get-price?productId=${productId}&originalPrice=${currentPrice}&sessionId=${sessionId}&shop=${shop}`
            );
            
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            log('Error checking active test:', error);
        }
        
        return null;
    }
    
    // Track product view for analytics
    async function trackProductView(productElement) {
        // Get product ID from various possible attributes
        let productId = productElement.getAttribute('data-product-id') ||
                       productElement.getAttribute('data-product') ||
                       productElement.querySelector('[data-product-id]')?.getAttribute('data-product-id');
        
        if (!productId) {
            const link = productElement.querySelector('a[href*="/products/"]');
            if (link) {
                const match = link.href.match(/\/products\/([^\/\?]+)/);
                if (match) {
                    // Skip products without IDs for now
                    return;
                }
            }
        }
        
        // Find price elements within this product
        const priceElements = productElement.querySelectorAll('.price, .product-price, .money, [data-price]');
        
        if (priceElements.length === 0) {
            return;
        }
        
        // Extract current price (this is now the actual Shopify price)
        const currentPrice = extractPrice(priceElements[0].textContent);
        if (!currentPrice) {
            return;
        }
        
        log('Tracking product view:', productId, 'Current Price:', currentPrice);
        
        // If we have a product ID, check if there's an active test and track the view
        if (productId) {
            const testData = await checkActiveTest(productId, currentPrice);
            
            // Track view if there's an active test
            if (testData && testData.isTestPrice && testData.testId) {
                trackView(productId, testData.testId, testData.variant.id, currentPrice);
                log('Tracked view for product:', productId, 'Variant:', testData.variantName, 'Price:', currentPrice);
            } else {
                log('No active test for product:', productId);
            }
        }
    }
    
    // Initialize tracking for all products on the page
    async function initializeTracking() {
        log('Initializing A/B test tracking on page:', window.location.pathname);
        
        // Detect app URL first
        detectAppUrl();
        
        // Find all product elements on the page
        const productElements = document.querySelectorAll('[data-product-id], .product-card, .product-item, .grid-product');
        
        if (productElements.length === 0) {
            log('No product elements found on page');
            return;
        }
        
        log('Found', productElements.length, 'product elements');
        
        // Process each product for tracking
        for (const productElement of productElements) {
            await trackProductView(productElement);
        }
    }
    
    // Handle cart conversion tracking
    function setupConversionTracking() {
        document.addEventListener('submit', async function(e) {
            const form = e.target;
            if (!form.action || !form.action.includes('/cart/add')) return;
            
            // Let the form submit normally, but track the conversion
            const formData = new FormData(form);
            const variantId = formData.get('id');
            const quantity = formData.get('quantity') || 1;
            
            // Find the product ID from the form or page
            let productId = form.getAttribute('data-product-id') || 
                           document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
            
            if (!productId) {
                return;
            }
            
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
            
            if (!currentPrice) {
                return;
            }
            
            try {
                // Check if there's an active test for this product
                const testData = await checkActiveTest(productId, currentPrice);
                
                if (testData && testData.isTestPrice && testData.testId) {
                    // Track conversion event
                    trackConversion(productId, testData.testId, testData.variant.id, currentPrice, currentPrice);
                    log('Tracked conversion for product:', productId, 'Variant:', testData.variantName, 'Price:', currentPrice);
                }
            } catch (error) {
                log('Error tracking conversion:', error);
            }
        });
    }
    
    // Initialize when page loads
    function init() {
        log('A/B Price Test tracking script loaded');
        
        // Run immediately and also on DOM ready
        initializeTracking();
        setupConversionTracking();
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                // Run again after DOM is ready
                setTimeout(initializeTracking, 100);
            });
        }
        
        // Also run after a short delay to catch any dynamic content
        setTimeout(initializeTracking, 500);
        setTimeout(initializeTracking, 1000);
    }
    
    // Initialize
    init();
    
    // Re-initialize on AJAX page changes
    document.addEventListener('shopify:section:load', function() {
        log('Section loaded, reinitializing tracking');
        setTimeout(initializeTracking, 100);
    });
    
})();
