/**
 * Cart Price Adjustment Script
 * This script adjusts cart prices to match A/B test prices
 */

(function() {
    'use strict';
    
    const APP_URL = 'https://pound-teaches-convention-fort.trycloudflare.com';
    const DEBUG_MODE = true;
    
    function log(...args) {
        if (DEBUG_MODE) console.log('[Cart Price Adjust]', ...args);
    }
    
    // Get session ID
    function getSessionId() {
        let sessionId = localStorage.getItem('ab_test_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('ab_test_session_id', sessionId);
        }
        return sessionId;
    }
    
    // Get test price for a product
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
                return data;
            }
        } catch (error) {
            log('Error fetching test price:', error);
        }
        return { price: originalPrice, isTestPrice: false };
    }
    
    // Modify add to cart form to include test price
    function modifyAddToCartForm() {
        const addToCartForm = document.querySelector('form[action*="/cart/add"]');
        if (!addToCartForm) return;
        
        // Add hidden field for test price
        let testPriceField = addToCartForm.querySelector('input[name="test_price"]');
        if (!testPriceField) {
            testPriceField = document.createElement('input');
            testPriceField.type = 'hidden';
            testPriceField.name = 'test_price';
            addToCartForm.appendChild(testPriceField);
        }
        
        // Get product ID and current price
        const productId = window.ShopifyAnalytics?.meta?.product?.id;
        const priceElement = document.querySelector('.price, .product-price');
        if (!productId || !priceElement) return;
        
        const priceMatch = priceElement.textContent.match(/\$?(\d+\.?\d*)/);
        if (!priceMatch) return;
        
        const originalPrice = parseFloat(priceMatch[1]);
        
        // Get test price and set it
        getTestPrice(productId, originalPrice).then(testData => {
            if (testData.isTestPrice) {
                testPriceField.value = testData.price.toFixed(2);
                log('Set test price for cart:', testData.price);
            }
        });
    }
    
    // Intercept add to cart requests
    function interceptAddToCart() {
        document.addEventListener('submit', async function(e) {
            const form = e.target;
            if (!form.action || !form.action.includes('/cart/add')) return;
            
            // Get test price data
            const productId = window.ShopifyAnalytics?.meta?.product?.id;
            const priceElement = document.querySelector('.price, .product-price');
            
            if (!productId || !priceElement) return;
            
            const priceMatch = priceElement.textContent.match(/\$?(\d+\.?\d*)/);
            if (!priceMatch) return;
            
            const originalPrice = parseFloat(priceMatch[1]);
            const testData = await getTestPrice(productId, originalPrice);
            
            if (testData.isTestPrice) {
                // Add test price as a hidden field
                let testPriceField = form.querySelector('input[name="test_price"]');
                if (!testPriceField) {
                    testPriceField = document.createElement('input');
                    testPriceField.type = 'hidden';
                    testPriceField.name = 'test_price';
                    form.appendChild(testPriceField);
                }
                testPriceField.value = testData.price.toFixed(2);
                
                // Add test variant info
                let variantField = form.querySelector('input[name="test_variant"]');
                if (!variantField) {
                    variantField = document.createElement('input');
                    variantField.type = 'hidden';
                    variantField.name = 'test_variant';
                    form.appendChild(variantField);
                }
                variantField.value = testData.variantName || 'Test Variant';
                
                log('Modified cart submission with test price:', testData.price);
            }
        });
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            modifyAddToCartForm();
            interceptAddToCart();
        });
    } else {
        modifyAddToCartForm();
        interceptAddToCart();
    }
    
    log('Cart price adjustment script loaded');
})();


