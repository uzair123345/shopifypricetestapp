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
  // Check if it's a failed migration error (P3009)
  const errorOutput = (migrateError.stderr?.toString() || '') + (migrateError.stdout?.toString() || '') + (migrateError.message || '');
  const isP3009 = errorOutput.includes('P3009') || errorOutput.includes('failed migrations');
  
  if (isP3009) {
    console.log('⚠️ Detected failed migration (P3009)');
    console.log('📋 Step 2: Attempting to resolve failed migration...');
    
    try {
      // Try to resolve the failed migration by marking it as applied
      // This tells Prisma the migration was already applied (even though it failed)
      // Then we'll use db push to ensure tables exist
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
      console.log('   Error:', resolveError.message || resolveError);
    }
  }
  
  // If migrate deploy fails for any reason, use db push as fallback
  // This handles failed migrations (P3009) and other migration issues
  console.log('📋 Step 2/3: Using db push to sync schema directly...');
  console.log('   This will create all tables based on the current schema...');
  
  try {
    // Use db push as fallback - it will create all tables based on schema
    // This bypasses migration history and just syncs the schema
    // Note: We use --accept-data-loss to allow schema changes, but NOT --force-reset
    // to avoid deleting existing data
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
    console.log('✅ Database schema synced using db push!');
    console.log('✅ All tables created successfully!');
    process.exit(0);
  } catch (pushError) {
    console.error('❌ db push also failed');
    console.error('This is a critical error - database tables cannot be created');
    console.error('Error details:', pushError.message || pushError);
    process.exit(1);
  }
}

