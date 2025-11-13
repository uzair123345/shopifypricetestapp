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
  // Capture both stdout and stderr to check for P3009 error
  let output = '';
  try {
    output = execSync('npx prisma migrate deploy', { 
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe']
    }).toString();
    console.log(output);
    console.log('✅ Migrations applied successfully!');
    process.exit(0);
  } catch (migrateError) {
    // Capture stderr which contains the error message
    const stderr = migrateError.stderr?.toString() || '';
    const stdout = migrateError.stdout?.toString() || '';
    const errorOutput = stderr + stdout + (migrateError.message || '');
    
    console.log('⚠️ migrate deploy failed');
    console.log('Error output:', stderr || stdout || migrateError.message);
    
    // Check if it's a failed migration error (P3009)
    if (errorOutput.includes('P3009') || 
        errorOutput.includes('failed migrations') || 
        errorOutput.includes('migrate found failed migrations')) {
      console.log('🔧 Detected failed migration error (P3009)');
      console.log('📋 Step 2: Using db push as fallback to sync schema...');
      
      try {
        // Use db push as fallback - it will create all tables based on schema
        execSync('npx prisma db push --skip-generate --accept-data-loss', { 
          stdio: 'inherit',
          encoding: 'utf8'
        });
        console.log('✅ Database schema synced using db push!');
        process.exit(0);
      } catch (pushError) {
        console.error('❌ db push also failed');
        console.error(pushError.message || pushError);
        process.exit(1);
      }
    } else {
      // Some other error, fail the build
      console.error('❌ Migration failed with unexpected error');
      console.error(errorOutput);
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Unexpected error in migration script:', error.message || error);
  process.exit(1);
}

