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
  // Get error output
  const errorOutput = (migrateError.stderr?.toString() || '') + (migrateError.stdout?.toString() || '') + (migrateError.message || '');
  const isP3009 = errorOutput.includes('P3009') || errorOutput.includes('failed migrations');
  
  if (isP3009) {
    console.log('⚠️ Detected failed migration (P3009)');
    console.log('📋 Step 2: Attempting to resolve failed migration...');
    
    try {
      // Try to resolve the failed migration by marking it as applied
      const failedMigrationName = '20240530213853_create_session_table';
      console.log(`   Marking migration as applied: ${failedMigrationName}`);
      execSync(`npx prisma migrate resolve --applied ${failedMigrationName}`, { stdio: 'inherit' });
      console.log('✅ Failed migration marked as applied!');
      
      console.log('📋 Step 3: Retrying migrate deploy...');
      try {
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        console.log('✅ Migrations applied successfully after resolve!');
        process.exit(0);
      } catch (retryError) {
        console.log('⚠️ Migrate deploy still failed after resolve, using db push...');
      }
    } catch (resolveError) {
      console.log('⚠️ Could not resolve migration, using db push as fallback...');
      const resolveErrorOutput = (resolveError.stderr?.toString() || '') + (resolveError.stdout?.toString() || '') + (resolveError.message || '');
      console.log('   Error:', resolveErrorOutput);
    }
  }
  
  // If migrate deploy fails for any reason, use db push as fallback
  // IMPORTANT: db push sometimes says "already in sync" when tables don't exist
  // So we'll use --force-reset to ensure tables are actually created
  console.log('📋 Step 2/3: Using db push to sync schema directly...');
  console.log('   Note: Using --force-reset to ensure tables are created even if db push thinks they exist...');
  console.log('   ⚠️  This will reset the database schema (existing data may be lost)');
  
  try {
    // Use db push with --force-reset to force table creation
    // This is necessary because db push can incorrectly report "already in sync"
    // when tables don't actually exist
    execSync('npx prisma db push --skip-generate --accept-data-loss --force-reset', { stdio: 'inherit' });
    console.log('✅ Database schema synced using db push!');
    console.log('✅ All tables created successfully!');
    process.exit(0);
  } catch (pushError) {
    console.error('❌ db push also failed');
    console.error('This is a critical error - database tables cannot be created');
    const pushErrorOutput = (pushError.stderr?.toString() || '') + (pushError.stdout?.toString() || '') + (pushError.message || '');
    console.error('Error details:', pushErrorOutput);
    process.exit(1);
  }
}

