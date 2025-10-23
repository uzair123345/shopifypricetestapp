// Test script for A/B Price Test Traffic Distribution
// Run this in your browser console to test different scenarios

console.log('🧪 A/B Price Test Traffic Distribution Test');

// Function to test traffic distribution
function testTrafficDistribution(productId = '10194192433418', originalPrice = 25) {
    console.log('Testing traffic distribution for product:', productId);
    console.log('Original price: $' + originalPrice);
    
    const results = {
        'Original Price ($25.00)': 0,
        'Test Variant 1 ($22.50)': 0,
        'Test Variant 2 ($20.00)': 0
    };
    
    const testCount = 100;
    
    for (let i = 0; i < testCount; i++) {
        // Generate a new session ID for each test
        const sessionId = 'test_' + i + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Simulate the hash generation logic
        const testSeed = sessionId.split('').reduce((hash, char) => {
            return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff;
        }, 0);
        
        const hashValue = Math.abs(testSeed) % 100;
        
        // Traffic distribution: 34% base, 33% each variant
        if (hashValue < 34) {
            results['Original Price ($25.00)']++;
        } else if (hashValue < 67) {
            results['Test Variant 1 ($22.50)']++;
        } else {
            results['Test Variant 2 ($20.00)']++;
        }
    }
    
    console.log('Traffic Distribution Results (100 tests):');
    Object.entries(results).forEach(([variant, count]) => {
        const percentage = ((count / testCount) * 100).toFixed(1);
        console.log(`${variant}: ${count} times (${percentage}%)`);
    });
    
    return results;
}

// Function to test current session
function testCurrentSession() {
    const sessionId = localStorage.getItem('ab_test_session_id') || 'no-session';
    console.log('Current session ID:', sessionId);
    
    // Simulate hash generation
    const testSeed = sessionId.split('').reduce((hash, char) => {
        return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff;
    }, 0);
    
    const hashValue = Math.abs(testSeed) % 100;
    console.log('Hash value:', hashValue);
    
    if (hashValue < 34) {
        console.log('🎯 You should see: Original Price ($25.00)');
    } else if (hashValue < 67) {
        console.log('🎯 You should see: Test Variant 1 ($22.50)');
    } else {
        console.log('🎯 You should see: Test Variant 2 ($20.00)');
    }
}

// Function to generate new session and test
function generateNewSession() {
    localStorage.removeItem('ab_test_session_id');
    console.log('Session cleared. Refresh the page to generate a new session.');
}

// Run tests
console.log('Running traffic distribution test...');
testTrafficDistribution();

console.log('\nTesting current session...');
testCurrentSession();

console.log('\nTo test with a new session, run: generateNewSession()');
console.log('Then refresh the page to see a different price.');

// Make functions available globally
window.testTrafficDistribution = testTrafficDistribution;
window.testCurrentSession = testCurrentSession;
window.generateNewSession = generateNewSession;
