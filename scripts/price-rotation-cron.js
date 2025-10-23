// Price Rotation Cron Job
// This script calls the price rotation API every 5 minutes

const https = require('https');
const http = require('http');

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const CRON_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

console.log('🔄 Starting Price Rotation Cron Job');
console.log('APP_URL:', APP_URL);
console.log('Interval:', CRON_INTERVAL / 1000, 'seconds');

// Function to call the price rotation API
async function callPriceRotationAPI() {
    return new Promise((resolve, reject) => {
        const url = new URL(`${APP_URL}/api/price-updater`);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            timeout: 30000 // 30 second timeout
        };

        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('✅ Price rotation completed:', response);
                    resolve(response);
                } catch (error) {
                    console.error('❌ Error parsing response:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request error:', error);
            reject(error);
        });

        req.on('timeout', () => {
            console.error('❌ Request timeout');
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Run price rotation
async function runPriceRotation() {
    const timestamp = new Date().toISOString();
    console.log(`\n🔄 [${timestamp}] Running price rotation...`);
    
    try {
        await callPriceRotationAPI();
        console.log(`✅ [${timestamp}] Price rotation completed successfully`);
    } catch (error) {
        console.error(`❌ [${timestamp}] Price rotation failed:`, error.message);
    }
}

// Start the cron job
console.log('⏰ Starting price rotation cron job...');

// Run immediately
runPriceRotation();

// Then run every 5 minutes
setInterval(runPriceRotation, CRON_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down price rotation cron job...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down price rotation cron job...');
    process.exit(0);
});

console.log('✅ Price rotation cron job started successfully');
console.log('Press Ctrl+C to stop');
