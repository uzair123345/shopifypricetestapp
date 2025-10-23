/**
 * A/B Price Testing Script - Manual Installation
 * Add this script to your theme.liquid file before </body>
 */

(function() {
    'use strict';
    
    const APP_URL = 'https://pound-teaches-convention-fort.trycloudflare.com';
    
    function getSessionId() {
        let sessionId = localStorage.getItem('ab_test_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('ab_test_session_id', sessionId);
        }
        return sessionId;
    }
    
    async function getTestPrice(productId, originalPrice) {
        try {
            const params = new URLSearchParams({
                productId: productId.toString(),
                originalPrice: originalPrice.toString(),
                sessionId: getSessionId(),
                shop: window.location.hostname
            });
            
            const response = await fetch(`${APP_URL}/api/storefront/get-price?${params}`);
            if (response.ok) {
                const data = await response.json();
                console.log('[A/B Test] API Response:', data);
                return data;
            }
        } catch (error) {
            console.error('[A/B Test] Error:', error);
        }
        return { price: originalPrice, isTestPrice: false };
    }
    
    function findPriceElements() {
        const selectors = ['.price', '.product-price', '.product__price', '.money'];
        const elements = [];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (el.textContent && el.textContent.includes('$') && !elements.includes(el)) {
                    elements.push(el);
                }
            });
        });
        return elements;
    }
    
    function updatePriceDisplay(testData) {
        if (!testData || !testData.isTestPrice) return;
        
        const priceElements = findPriceElements();
        console.log('[A/B Test] Found', priceElements.length, 'price elements');
        
        priceElements.forEach(element => {
            const currentText = element.textContent;
            const match = currentText.match(/\$?(\d+\.?\d*)/);
            
            if (match) {
                const currentPrice = parseFloat(match[1]);
                if (Math.abs(currentPrice - testData.price) > 0.01) {
                    // Update the price
                    const newText = currentText.replace(/\$?\d+\.?\d*/, '$' + testData.price.toFixed(2));
                    element.textContent = newText;
                    
                    // Add visual indicator
                    element.style.color = '#E63946';
                    element.style.fontWeight = 'bold';
                    element.setAttribute('data-ab-test', testData.variantName);
                    element.setAttribute('title', 'A/B Test: ' + testData.variantName);
                    
                    console.log('[A/B Test] Updated price from $' + currentPrice + ' to $' + testData.price);
                }
            }
        });
    }
    
    async function initializeABTest() {
        // Check if on product page
        if (!window.location.pathname.includes('/products/')) {
            console.log('[A/B Test] Not on product page');
            return;
        }
        
        // Get product ID
        let productId = null;
        if (window.ShopifyAnalytics?.meta?.product?.id) {
            productId = window.ShopifyAnalytics.meta.product.id;
        }
        
        if (!productId) {
            console.log('[A/B Test] Product ID not found');
            return;
        }
        
        // Get original price
        const priceElements = findPriceElements();
        if (priceElements.length === 0) {
            console.log('[A/B Test] No price elements found');
            return;
        }
        
        const match = priceElements[0].textContent.match(/\$?(\d+\.?\d*)/);
        if (!match) {
            console.log('[A/B Test] Could not extract price');
            return;
        }
        
        const originalPrice = parseFloat(match[1]);
        console.log('[A/B Test] Product ID:', productId, 'Original Price:', originalPrice);
        
        // Fetch test price
        const testData = await getTestPrice(productId, originalPrice);
        
        if (testData.isTestPrice) {
            console.log('[A/B Test] Applying test price:', testData.price, 'Variant:', testData.variantName);
            updatePriceDisplay(testData);
        } else {
            console.log('[A/B Test] No active test, using original price');
        }
    }
    
    // Watch for variant changes
    function watchForVariantChanges() {
        document.addEventListener('change', function(e) {
            if (e.target.name === 'id' || e.target.matches('select[data-index*="option"]')) {
                console.log('[A/B Test] Variant changed');
                setTimeout(initializeABTest, 100);
            }
        });
        
        // Poll for changes as backup
        setInterval(function() {
            const priceElements = findPriceElements();
            priceElements.forEach(element => {
                if (!element.getAttribute('data-ab-test')) {
                    const match = element.textContent.match(/\$?(\d+\.?\d*)/);
                    if (match) {
                        const currentPrice = parseFloat(match[1]);
                        // If price looks like original price and no test attribute, reinitialize
                        if (currentPrice === 25) { // Your original price
                            console.log('[A/B Test] Price reverted, reapplying test');
                            initializeABTest();
                        }
                    }
                }
            });
        }, 1000);
    }
    
    // Initialize
    function init() {
        console.log('[A/B Test] Script loaded');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initializeABTest();
                watchForVariantChanges();
            });
        } else {
            initializeABTest();
            watchForVariantChanges();
        }
    }
    
    init();
})();


