/**
 * Price Updater Cron Job
 * This script calls the price updater API every 5 minutes
 * Run this with: node scripts/price-updater-cron.js
 */

import fetch from 'node-fetch';

const APP_URL = process.env.SHOPIFY_APP_URL || 'https://relate-festival-such-stuart.trycloudflare.com';
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

console.log('🔄 Starting Price Updater Cron Job...');
console.log(`📡 App URL: ${APP_URL}`);
console.log(`⏰ Update interval: ${UPDATE_INTERVAL / 1000 / 60} minutes`);

async function updatePrices() {
  try {
    console.log(`\n🕐 ${new Date().toISOString()} - Running price update...`);
    
    const response = await fetch(`${APP_URL}/api/price-updater`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Price update successful:', result.message);
    } else {
      console.error('❌ Price update failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error calling price updater:', error.message);
  }
}

// Run immediately on start
updatePrices();

// Then run every 5 minutes
setInterval(updatePrices, UPDATE_INTERVAL);

console.log('🚀 Cron job started. Press Ctrl+C to stop.');



