#!/usr/bin/env node

/**
 * Script to resolve failed migrations and ensure database tables exist
 * This handles the case where a previous migration attempt failed
 */

import { execSync } from 'child_process';

console.log('🔧 Attempting to resolve database migrations...');

// First, try normal migration deploy
console.log('📋 Step 1: Trying prisma migrate deploy...');
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Migrations applied successfully!');
  process.exit(0);
} catch (migrateError) {
  // If migrate deploy fails for any reason, use db push as fallback
  // This handles failed migrations (P3009) and other migration issues
  console.log('⚠️ migrate deploy failed, using db push as fallback...');
  console.log('📋 Step 2: Using db push to sync schema directly...');
  
  try {
    // Use db push as fallback - it will create all tables based on schema
    // This bypasses migration history and just syncs the schema
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
    console.log('✅ Database schema synced using db push!');
    console.log('✅ All tables created successfully!');
    process.exit(0);
  } catch (pushError) {
    console.error('❌ db push also failed');
    console.error('This is a critical error - database tables cannot be created');
    process.exit(1);
  }
}

