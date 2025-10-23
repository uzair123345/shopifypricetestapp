/**
 * A/B Price Testing Script for Shopify - Version 2
 * Handles variant changes and maintains consistent test prices
 */

(function() {
    'use strict';
    
    // Configuration
    const APP_URL = 'https://pound-teaches-convention-fort.trycloudflare.com';
    const DEBUG_MODE = true;
    
    // Store test price info
    let testPriceData = null;
    let lastProductId = null;
    
    // Debug logging
    function log(...args) {
        if (DEBUG_MODE) {
            console.log('[A/B Price Test]', ...args);
        }
    }
    
    // Get or create session ID
    function getSessionId() {
        let sessionId = localStorage.getItem('ab_test_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('ab_test_session_id', sessionId);
            log('Created new session ID:', sessionId);
        }
        return sessionId;
    }
    
    // Get shop domain
    function getShopDomain() {
        return window.Shopify?.shop || window.location.hostname;
    }
    
    // Fetch test price from API
    async function fetchTestPrice(productId, originalPrice) {
        const sessionId = getSessionId();
        const shop = getShopDomain();
        
        try {
            const params = new URLSearchParams({
                productId: productId.toString(),
                originalPrice: originalPrice.toString(),
                sessionId,
                shop
            });
            
            const response = await fetch(`${APP_URL}/api/storefront/get-price?${params}`);
            
            if (response.ok) {
                const data = await response.json();
                log('Fetched price data:', data);
                return data;
            } else {
                log('API error:', response.status);
            }
        } catch (error) {
            log('Error fetching test price:', error);
        }
        
        return { price: originalPrice, isTestPrice: false };
    }
    
    // Find all price elements on the page
    function findPriceElements() {
        const selectors = [
            '.price',
            '.product-price',
            '.product__price',
            '[data-price]',
            '.money',
            '.price-item--regular'
        ];
        
        const elements = [];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (el.textContent.includes('$') && !elements.includes(el)) {
                    elements.push(el);
                }
            });
        });
        
        return elements;
    }
    
    // Extract price from text
    function extractPrice(text) {
        const match = text.match(/\$?(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
    }
    
    // Update price display on page
    function updatePriceDisplay(newPrice) {
        if (!testPriceData || !testPriceData.isTestPrice) {
            log('No test price to apply');
            return;
        }
        
        const priceElements = findPriceElements();
        log('Found', priceElements.length, 'price elements');
        
        priceElements.forEach(element => {
            const currentText = element.textContent;
            const currentPrice = extractPrice(currentText);
            
            if (currentPrice && Math.abs(currentPrice - testPriceData.price) > 0.01) {
                // Update the price
                const newText = currentText.replace(/\$?\d+\.?\d*/, '$' + testPriceData.price.toFixed(2));
                element.textContent = newText;
                
                // Add visual indicator
                element.style.color = '#E63946';
                element.style.fontWeight = 'bold';
                element.setAttribute('data-ab-test', testPriceData.variantName);
                element.setAttribute('title', 'A/B Test: ' + testPriceData.variantName);
                
                log('Updated price from $' + currentPrice + ' to $' + testPriceData.price);
            }
        });
        
        // Also update in cart forms
        const priceInputs = document.querySelectorAll('input[name="price"], input[data-price]');
        priceInputs.forEach(input => {
            input.value = (testPriceData.price * 100).toString(); // Shopify uses cents
        });
    }
    
    // Initialize A/B testing for product
    async function initializeABTest() {
        // Check if on product page
        if (!window.location.pathname.includes('/products/')) {
            log('Not on product page');
            return;
        }
        
        // Get product ID
        let productId = null;
        if (window.ShopifyAnalytics?.meta?.product?.id) {
            productId = window.ShopifyAnalytics.meta.product.id;
        } else if (window.meta?.product?.id) {
            productId = window.meta.product.id;
        }
        
        if (!productId) {
            log('Product ID not found');
            return;
        }
        
        // Get original price from page
        const priceElements = findPriceElements();
        if (priceElements.length === 0) {
            log('No price elements found');
            return;
        }
        
        const originalPrice = extractPrice(priceElements[0].textContent);
        if (!originalPrice) {
            log('Could not extract price');
            return;
        }
        
        log('Product ID:', productId, 'Original Price:', originalPrice);
        
        // Fetch test price (only if product changed or first time)
        if (!testPriceData || lastProductId !== productId) {
            testPriceData = await fetchTestPrice(productId, originalPrice);
            lastProductId = productId;
        }
        
        // Apply test price
        if (testPriceData.isTestPrice) {
            log('Applying test price:', testPriceData.price, 'Variant:', testPriceData.variantName);
            updatePriceDisplay(testPriceData.price);
        } else {
            log('No active test, using original price');
        }
    }
    
    // Watch for variant changes
    function watchForVariantChanges() {
        // Method 1: Listen for Shopify's variant change events
        document.addEventListener('variant:change', function(event) {
            log('Variant changed (event):', event);
            setTimeout(updatePriceDisplay, 100);
        });
        
        // Method 2: Watch for variant selector changes
        const variantSelectors = document.querySelectorAll('[name="id"], select[data-index*="option"]');
        variantSelectors.forEach(selector => {
            selector.addEventListener('change', function() {
                log('Variant selector changed');
                setTimeout(updatePriceDisplay, 100);
            });
        });
        
        // Method 3: Watch for price changes in DOM
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.className && 
                    (mutation.target.className.includes('price') || 
                     mutation.target.className.includes('money'))) {
                    log('Price element changed in DOM');
                    setTimeout(updatePriceDisplay, 50);
                }
            });
        });
        
        // Observe price container
        const priceContainer = document.querySelector('.product__price, .product-price, .price');
        if (priceContainer) {
            observer.observe(priceContainer.parentElement || priceContainer, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
        
        // Method 4: Poll for changes every 500ms (backup)
        setInterval(function() {
            const priceElements = findPriceElements();
            priceElements.forEach(element => {
                const currentPrice = extractPrice(element.textContent);
                if (testPriceData && testPriceData.isTestPrice && 
                    currentPrice && Math.abs(currentPrice - testPriceData.price) > 0.01 &&
                    !element.getAttribute('data-ab-test')) {
                    log('Price reverted detected, reapplying test price');
                    updatePriceDisplay();
                }
            });
        }, 500);
    }
    
    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initializeABTest();
            watchForVariantChanges();
        });
    } else {
        initializeABTest();
        watchForVariantChanges();
    }
    
    // Re-initialize on AJAX page changes (for themes that use AJAX)
    document.addEventListener('shopify:section:load', function() {
        log('Section loaded, reinitializing');
        setTimeout(initializeABTest, 100);
    });
    
    log('A/B Price Testing script loaded');
})();



