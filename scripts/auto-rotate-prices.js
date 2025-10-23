const https = require('https');
const http = require('http');

// Your app URL - replace with your actual Cloudflare tunnel URL
const APP_URL = 'https://pcs-exclude-receipt-projects.trycloudflare.com';

console.log('🔄 Starting automatic price rotation cron job...');
console.log(`📡 Calling: ${APP_URL}/api/auto-rotate-prices`);

function callPriceRotation() {
  const url = `${APP_URL}/api/auto-rotate-prices`;
  
  const protocol = url.startsWith('https') ? https : http;
  
  const req = protocol.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Price-Rotation-Cron/1.0'
    }
  }, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        const timestamp = new Date().toLocaleTimeString();
        
        if (result.success) {
          console.log(`✅ [${timestamp}] Auto-rotation successful: ${result.message}`);
        } else {
          console.log(`❌ [${timestamp}] Auto-rotation failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ [${timestamp}] Failed to parse response:`, error.message);
      }
    });
  });
  
  req.on('error', (error) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`❌ [${timestamp}] Request failed:`, error.message);
  });
  
  req.end();
}

// Call immediately
callPriceRotation();

// Then call every minute (60,000 milliseconds)
setInterval(callPriceRotation, 60000);

console.log('⏰ Cron job started - will rotate prices every minute');
console.log('🛑 Press Ctrl+C to stop');



