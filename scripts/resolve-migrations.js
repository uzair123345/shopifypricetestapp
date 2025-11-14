#!/usr/bin/env node

/**
 * Script to ensure database tables exist
 * Uses db push to sync schema directly, bypassing migration issues
 * This script is designed to not fail the build if database is temporarily unavailable
 */

import { execSync } from 'child_process';

console.log('🔧 Ensuring database tables exist...');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL environment variable is not set!');
  console.warn('⚠️ Skipping database migration - tables will need to be created manually or at runtime');
  console.warn('⚠️ Build will continue, but app may fail at runtime if tables are missing');
  process.exit(0); // Don't fail the build
}

console.log('✅ DATABASE_URL is set');
console.log('📋 Using db push to sync schema directly...');
console.log('   This will create all tables based on the current Prisma schema...');

try {
  // Use db push to sync schema - this bypasses migration history
  // and directly creates/updates tables based on the schema
  // Set a timeout to prevent hanging
  execSync('npx prisma db push --skip-generate --accept-data-loss', { 
    stdio: 'inherit',
    env: { ...process.env },
    timeout: 60000, // 60 second timeout
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  });
  console.log('✅ Database schema synced successfully!');
  console.log('✅ All tables should now exist!');
  process.exit(0);
} catch (pushError) {
  console.warn('⚠️ db push failed - this may be due to database connectivity during build');
  const pushErrorOutput = (pushError.stderr?.toString() || '') + (pushError.stdout?.toString() || '') + (pushError.message || '');
  console.warn('Error details:', pushErrorOutput);
  
  // If db push fails, try migrate deploy as fallback
  console.log('📋 Trying migrate deploy as fallback...');
  try {
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env },
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024
    });
    console.log('✅ Migrations applied successfully!');
    process.exit(0);
  } catch (migrateError) {
    console.warn('⚠️ Both db push and migrate deploy failed');
    const migrateErrorOutput = (migrateError.stderr?.toString() || '') + (migrateError.stdout?.toString() || '') + (migrateError.message || '');
    console.warn('Migrate error:', migrateErrorOutput);
    console.warn('');
    console.warn('⚠️ WARNING: Database tables could not be created during build');
    console.warn('⚠️ The build will continue, but the app may fail at runtime');
    console.warn('⚠️ You may need to run migrations manually or check database connectivity');
    console.warn('');
    // Don't fail the build - let it continue
    // Tables can be created at runtime or manually
    process.exit(0);
  }
}

