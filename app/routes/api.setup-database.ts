/**
 * API endpoint to manually create database tables
 * Call this after deployment if tables don't exist
 * Usage: GET /api/setup-database?secret=YOUR_SECRET
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { execSync } from "child_process";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Simple secret check (you can set this in Vercel env vars)
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret = process.env.SETUP_SECRET || "setup-database-2025";
  
  if (secret !== expectedSecret) {
    return json({ error: "Unauthorized. Provide ?secret=YOUR_SECRET" }, { status: 401 });
  }

  try {
    console.log("🔧 Starting database setup...");
    
    // Try db push first
    try {
      console.log("📋 Attempting db push...");
      execSync("npx prisma db push --skip-generate --accept-data-loss", {
        stdio: "inherit",
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024
      });
      console.log("✅ Database tables created successfully!");
      return json({ 
        success: true, 
        message: "Database tables created successfully using db push" 
      });
    } catch (pushError) {
      console.log("⚠️ db push failed, trying migrate deploy...");
      
      // Try migrate deploy as fallback
      try {
        execSync("npx prisma migrate deploy", {
          stdio: "inherit",
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024
        });
        console.log("✅ Migrations applied successfully!");
        return json({ 
          success: true, 
          message: "Database tables created successfully using migrate deploy" 
        });
      } catch (migrateError) {
        const errorMsg = migrateError instanceof Error ? migrateError.message : String(migrateError);
        console.error("❌ Both methods failed:", errorMsg);
        return json({ 
          success: false, 
          error: "Failed to create tables. Check logs for details.",
          details: errorMsg
        }, { status: 500 });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Database setup failed:", errorMsg);
    return json({ 
      success: false, 
      error: "Database setup failed",
      details: errorMsg
    }, { status: 500 });
  }
};

