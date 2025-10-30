#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schemaPath = join(__dirname, '..', 'prisma', 'schema.prisma');
const deploySchemaPath = join(__dirname, '..', 'prisma', 'schema.prisma.deploy');

// Check if we're in production/Vercel environment
// Vercel automatically sets VERCEL=1 and VERCEL_ENV
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const isProduction = process.env.NODE_ENV === 'production';
const hasPostgresUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql://');

console.log('🔧 Preparing Prisma schema for deployment...');
console.log(`   Environment: ${isVercel ? 'Vercel' : isProduction ? 'Production' : 'Local'}`);
console.log(`   VERCEL=${process.env.VERCEL || 'not set'}`);
console.log(`   VERCEL_ENV=${process.env.VERCEL_ENV || 'not set'}`);
console.log(`   NODE_ENV=${process.env.NODE_ENV || 'not set'}`);
console.log(`   DATABASE_URL present: ${!!process.env.DATABASE_URL}`);
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  const maskedUrl = dbUrl.substring(0, 20) + '...' + dbUrl.substring(dbUrl.length - 10);
  console.log(`   DATABASE_URL: ${maskedUrl}`);
}
console.log(`   DATABASE_URL type: ${hasPostgresUrl ? 'PostgreSQL' : process.env.DATABASE_URL ? 'Other' : 'None'}`);

// Use PostgreSQL if:
// 1. DATABASE_URL is present and is PostgreSQL
// 2. We're on Vercel (always use PostgreSQL for Vercel)
// 3. We're in production environment
const shouldUsePostgres = hasPostgresUrl || isVercel || isProduction;

if (shouldUsePostgres) {
  console.log('📋 Using PostgreSQL schema for deployment...');
  
  if (!existsSync(deploySchemaPath)) {
    console.error(`❌ Error: schema.prisma.deploy not found at ${deploySchemaPath}`);
    process.exit(1);
  }
  
  const deploySchema = readFileSync(deploySchemaPath, 'utf-8');
  
  // Verify the schema content
  if (!deploySchema.includes('provider = "postgresql"')) {
    console.error('❌ Error: deploy schema does not contain PostgreSQL provider!');
    process.exit(1);
  }
  
  writeFileSync(schemaPath, deploySchema, 'utf-8');
  console.log('✅ Schema swapped to PostgreSQL');
  
  // Verify the swap worked
  const swappedSchema = readFileSync(schemaPath, 'utf-8');
  if (swappedSchema.includes('provider = "postgresql"')) {
    console.log('✅ Verification: Schema file contains PostgreSQL provider');
  } else {
    console.error('❌ Verification FAILED: Schema file still contains SQLite!');
    process.exit(1);
  }
} else {
  console.log('📋 Using SQLite schema for local development...');
  
  // Verify SQLite schema
  const currentSchema = readFileSync(schemaPath, 'utf-8');
  if (currentSchema.includes('provider = "sqlite"')) {
    console.log('✅ Confirmed: Using SQLite schema');
  }
}

console.log('✨ Schema preparation complete!');

