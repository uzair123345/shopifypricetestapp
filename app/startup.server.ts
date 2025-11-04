// Auto-start the auto-rotation scheduler for shops with it enabled
// NOTE: This only works in environments with persistent processes (local dev, traditional servers)
// On Vercel serverless, avoiding background tasks here; use Vercel Cron Jobs instead
import scheduler from './services/autoRotationScheduler.server';
import db from './db.server';

// Check if we're in a serverless environment
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_NAME;

// Start scheduler on server startup (only for non-serverless environments)
if (!isServerless) {
  console.log("🚀 [Startup] Initializing auto-rotation scheduler check...");
  
  // Use setImmediate to ensure this runs after the server starts
  setImmediate(async () => {
    // Add a small delay to ensure database is ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      console.log("🚀 [Startup] Checking for shops with auto-rotation enabled...");
      const shopsWithAutoRotation = await db.settings.findMany({
        where: { auto_rotation_enabled: true },
        select: { shop: true }
      });

      console.log(`🚀 [Startup] Found ${shopsWithAutoRotation.length} shop(s) with auto-rotation enabled`);
      
      if (shopsWithAutoRotation.length > 0) {
        console.log(`🚀 [Startup] Starting auto-rotation scheduler for shops:`, shopsWithAutoRotation.map(s => s.shop));
        await scheduler.start();
        console.log("✅ [Startup] Auto-rotation scheduler started successfully!");
        console.log("✅ [Startup] Scheduler will run every 60 seconds");
      } else {
        console.log("ℹ️ [Startup] No shops with auto-rotation enabled, scheduler not started");
        console.log("ℹ️ [Startup] Enable auto-rotation in Settings to start the scheduler");
      }
    } catch (error) {
      console.error("❌ [Startup] Error starting auto-rotation scheduler:", error);
      console.error("❌ [Startup] Error details:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error("❌ [Startup] Stack:", error.stack);
      }
    }
  });
} else {
  console.log("ℹ️ [Serverless] Skipping scheduler auto-start (use Vercel Cron Jobs for scheduled tasks)");
}

