#!/usr/bin/env node

/**
 * Script to ensure database tables exist
 * Uses db push to sync schema directly, bypassing migration issues
 */

import { execSync } from 'child_process';

console.log('🔧 Ensuring database tables exist...');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

console.log('✅ DATABASE_URL is set');
console.log('📋 Using db push to sync schema directly...');
console.log('   This will create all tables based on the current Prisma schema...');

try {
  // Use db push to sync schema - this bypasses migration history
  // and directly creates/updates tables based on the schema
  execSync('npx prisma db push --skip-generate --accept-data-loss', { 
    stdio: 'inherit',
    env: { ...process.env }
  });
  console.log('✅ Database schema synced successfully!');
  console.log('✅ All tables should now exist!');
  process.exit(0);
} catch (pushError) {
  console.error('❌ db push failed');
  const pushErrorOutput = (pushError.stderr?.toString() || '') + (pushError.stdout?.toString() || '') + (pushError.message || '');
  console.error('Error details:', pushErrorOutput);
  
  // If db push fails, try migrate deploy as fallback
  console.log('📋 Trying migrate deploy as fallback...');
  try {
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✅ Migrations applied successfully!');
    process.exit(0);
  } catch (migrateError) {
    console.error('❌ Both db push and migrate deploy failed');
    const migrateErrorOutput = (migrateError.stderr?.toString() || '') + (migrateError.stdout?.toString() || '') + (migrateError.message || '');
    console.error('Migrate error:', migrateErrorOutput);
    process.exit(1);
  }
}

