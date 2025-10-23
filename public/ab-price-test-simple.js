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
        const scriptTags = document.querySelectorAll('script[src*="ab-price-test"]');
        if (scriptTags.length > 0) {
            const scriptSrc = scriptTags[0].src;
            const match = scriptSrc.match(/^(https:\/\/[^\/]+)/);
            if (match) {
                APP_URL = match[1];
                log('Detected APP_URL from script tag:', APP_URL);
            }
        }
    }
    
    // Debug logging
    function log(...args) {
        if (DEBUG_MODE) {
            console.log('[A/B Price Test]', ...args);
        }
    }
    
    // Get session ID
    function getSessionId() {
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('ab_test_session_id', sessionId);
        log('Generated new session ID:', sessionId);
        return sessionId;
    }
    
    // Get shop domain
    function getShopDomain() {
        return window.Shopify?.shop || 'dev-bio-restore.myshopify.com';
    }
    
    // Extract price from text
    function extractPrice(text) {
        const match = text.match(/\$?[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/[$,]/g, '')) : null;
    }
    
    // Track product view
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
        log('Initializing A/B test analytics tracking on page:', window.location.pathname);
        
        // Detect app URL
        detectAppUrl();
        
        // Find all product elements
        const productElements = document.querySelectorAll('[data-product-id], .product-card, .product-item, .grid-product');
        
        if (productElements.length === 0) {
            log('No product elements found on page');
            return;
        }
        
        log('Found', productElements.length, 'product elements');
        
        // Track each product view
        productElements.forEach(productElement => {
            trackProductView(productElement);
        });
        
        // Setup cart conversion tracking
        setupCartTracking();
    }
    
    // Track product view
    function trackProductView(productElement) {
        // Get product ID
        let productId = productElement.getAttribute('data-product-id') ||
                       productElement.getAttribute('data-product') ||
                       productElement.querySelector('[data-product-id]')?.getAttribute('data-product-id');
        
        if (!productId) return;
        
        // Get current price
        const priceElements = productElement.querySelectorAll('.price, .product-price, .money, [data-price]');
        let currentPrice = null;
        
        for (const element of priceElements) {
            const price = extractPrice(element.textContent);
            if (price) {
                currentPrice = price;
                break;
            }
        }
        
        if (!currentPrice) return;
        
        log('Tracking product view:', productId, 'Current Price:', currentPrice);
        
        // Track the view
        trackView(productId, null, null, currentPrice);
    }
    
    // Setup cart conversion tracking
    function setupCartTracking() {
        document.addEventListener('submit', async function(e) {
            const form = e.target;
            if (!form.action || !form.action.includes('/cart/add')) return;
            
            // Let the form submit normally, just track the conversion
            const formData = new FormData(form);
            const variantId = formData.get('id');
            
            // Find the product ID
            let productId = form.getAttribute('data-product-id') || 
                           document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
            
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
            
            // Track conversion
            trackConversion(productId, null, variantId, currentPrice, currentPrice);
            log('Tracked conversion for product:', productId, 'Price:', currentPrice);
        });
    }
    
    // Initialize when DOM is ready
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeTracking);
        } else {
            initializeTracking();
        }
    }
    
    // Start
    init();
    
})();

} // End of guard
