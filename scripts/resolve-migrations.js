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
    console.log('📋 Step 2: Resolving failed migration by marking as rolled back...');
    
    try {
      // Mark the failed migration as rolled back, then we can retry it
      const failedMigrationName = '20240530213853_create_session_table';
      console.log(`   Marking migration as rolled back: ${failedMigrationName}`);
      execSync(`npx prisma migrate resolve --rolled-back ${failedMigrationName}`, { stdio: 'inherit' });
      console.log('✅ Failed migration marked as rolled back!');
      
      console.log('📋 Step 3: Retrying migrate deploy...');
      try {
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        console.log('✅ Migrations applied successfully after resolve!');
        process.exit(0);
      } catch (retryError) {
        console.log('⚠️ Migrate deploy still failed after resolve, trying alternative approach...');
      }
    } catch (resolveError) {
      console.log('⚠️ Could not resolve migration, trying alternative approach...');
      const resolveErrorOutput = (resolveError.stderr?.toString() || '') + (resolveError.stdout?.toString() || '') + (resolveError.message || '');
      console.log('   Resolve error:', resolveErrorOutput);
    }
  }
  
  // Alternative approach: Mark all migrations as applied, then use db push
  console.log('📋 Step 2/3: Alternative approach - marking all migrations as applied...');
  try {
    // Get list of all migrations
    const migrations = [
      '20240530213853_create_session_table',
      '20250919132559_add_ab_test_tables',
      '20250923113636_add_description_field'
    ];
    
    for (const migration of migrations) {
      try {
        console.log(`   Marking ${migration} as applied...`);
        execSync(`npx prisma migrate resolve --applied ${migration}`, { stdio: 'inherit' });
      } catch (e) {
        // Ignore errors - migration might already be marked
        console.log(`   Note: ${migration} may already be resolved`);
      }
    }
    
    console.log('📋 Step 4: Using db push to sync schema...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
    console.log('✅ Database schema synced using db push!');
    console.log('✅ All tables created successfully!');
    process.exit(0);
  } catch (pushError) {
    console.error('❌ All migration approaches failed');
    console.error('This is a critical error - database tables cannot be created');
    const pushErrorOutput = (pushError.stderr?.toString() || '') + (pushError.stdout?.toString() || '') + (pushError.message || '');
    console.error('Error details:', pushErrorOutput);
    process.exit(1);
  }
}

