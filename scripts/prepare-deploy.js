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
const hasPostgresUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql://');

console.log('🔧 Preparing Prisma schema for deployment...');
console.log(`   Environment: ${isVercel ? 'Vercel' : 'Local'}`);
console.log(`   VERCEL=${process.env.VERCEL}`);
console.log(`   VERCEL_ENV=${process.env.VERCEL_ENV}`);
console.log(`   DATABASE_URL present: ${!!process.env.DATABASE_URL}`);
console.log(`   DATABASE_URL type: ${hasPostgresUrl ? 'PostgreSQL' : process.env.DATABASE_URL ? 'Other' : 'None'}`);

// On Vercel, always use PostgreSQL (even if DATABASE_URL isn't available at build time)
// It will be available at runtime
if (hasPostgresUrl || isVercel) {
  console.log('📋 Using PostgreSQL schema for deployment...');
  
  if (existsSync(deploySchemaPath)) {
    const deploySchema = readFileSync(deploySchemaPath, 'utf-8');
    writeFileSync(schemaPath, deploySchema, 'utf-8');
    console.log('✅ Schema swapped to PostgreSQL');
  } else {
    console.error('❌ Error: schema.prisma.deploy not found');
    process.exit(1);
  }
} else {
  console.log('📋 Using SQLite schema for local development...');
}

console.log('✨ Schema preparation complete!');

