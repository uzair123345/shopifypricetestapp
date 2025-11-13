#!/usr/bin/env node

/**
 * Script to resolve failed migrations and ensure database tables exist
 * This handles the case where a previous migration attempt failed
 */

import { execSync } from 'child_process';

console.log('🔧 Attempting to resolve database migrations...');

try {
  // First, try normal migration deploy
  console.log('📋 Step 1: Trying prisma migrate deploy...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Migrations applied successfully!');
  process.exit(0);
} catch (error) {
  console.log('⚠️ migrate deploy failed, checking error...');
  
  const errorOutput = error.stdout?.toString() || error.stderr?.toString() || '';
  
  // Check if it's a failed migration error (P3009)
  if (errorOutput.includes('P3009') || errorOutput.includes('failed migrations')) {
    console.log('🔧 Detected failed migration error (P3009)');
    console.log('📋 Step 2: Using db push as fallback to sync schema...');
    
    try {
      // Use db push as fallback - it will create all tables based on schema
      execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
      console.log('✅ Database schema synced using db push!');
      process.exit(0);
    } catch (pushError) {
      console.error('❌ db push also failed:', pushError.message);
      process.exit(1);
    }
  } else {
    // Some other error, fail the build
    console.error('❌ Migration failed with unexpected error:', error.message);
    process.exit(1);
  }
}

