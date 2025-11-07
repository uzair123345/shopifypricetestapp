/**
 * Vercel Cron Job endpoint for price rotation
 * This runs on a schedule (every minute) on Vercel serverless
 * Configure in vercel.json with:
 * {
 *   "crons": [{
 *     "path": "/api/cron/rotate-prices",
 *     "schedule": "* * * * *" // Every minute
 *   }]
 * }
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { ShopifyPriceUpdater } from "../services/shopifyPriceUpdater.server";
import { unauthenticated } from "../shopify.server";

// Verify the request is from Vercel Cron or external cron service
function verifyCronRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const cronToken = request.headers.get("x-cron-token");
  
  // Check for Vercel Cron (authorization header)
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  
  // Check for external cron service (x-cron-token header)
  if (cronSecret && cronToken === cronSecret) {
    return true;
  }
  
  // Allow if no secret is set (for local testing)
  if (!cronSecret) {
    console.log("[cron] ⚠️ CRON_SECRET not set, allowing request (for local testing)");
    return true;
  }
  
  return false;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Verify this is a valid cron request
  if (!verifyCronRequest(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔄 [Vercel Cron] Price rotation cron job triggered`);

  try {
    // Get all shops with auto-rotation enabled and their rotation intervals
    const shopsWithAutoRotation = await db.settings.findMany({
      where: { auto_rotation_enabled: true },
      select: { 
        shop: true,
        rotation_interval_minutes: true,
        last_rotated_at: true
      }
    });

    if (shopsWithAutoRotation.length === 0) {
      console.log(`[${timestamp}] ⚠️ [Vercel Cron] No shops with auto-rotation enabled`);
      return json({ 
        success: true, 
        message: "No shops with auto-rotation enabled",
        shopsProcessed: 0 
      });
    }

    console.log(`[${timestamp}] 🔄 [Vercel Cron] Found ${shopsWithAutoRotation.length} shop(s) with auto-rotation enabled`);

    const results = [];
    
    // Process each shop
    for (const shopSetting of shopsWithAutoRotation) {
      const shop = shopSetting.shop;
      const intervalMinutes = shopSetting.rotation_interval_minutes || 1;
      const lastRotatedAt = shopSetting.last_rotated_at;
      const now = new Date();
      
      try {
        // Check if enough time has passed since last rotation
        if (lastRotatedAt) {
          const timeSinceLastRotation = now.getTime() - lastRotatedAt.getTime();
          const requiredIntervalMs = intervalMinutes * 60 * 1000;
          
          if (timeSinceLastRotation < requiredIntervalMs) {
            const remainingSeconds = Math.ceil((requiredIntervalMs - timeSinceLastRotation) / 1000);
            console.log(`[${timestamp}] ⏸️ [Vercel Cron] Skipping rotation for ${shop} - ${remainingSeconds}s remaining until next rotation (interval: ${intervalMinutes} min)`);
            results.push({ shop, success: true, status: "skipped", reason: `Not yet time (interval: ${intervalMinutes} min)` });
            continue;
          }
        }
        
        console.log(`[${timestamp}] 🔄 [Vercel Cron] Processing auto-rotation for shop: ${shop} (interval: ${intervalMinutes} min)`);
        
        // Get session for this shop
        const session = await db.session.findFirst({
          where: { shop: shop }
        });

        if (!session) {
          console.log(`[${timestamp}] ⚠️ [Vercel Cron] No session found for shop: ${shop}`);
          results.push({ shop, success: false, error: "No session found" });
          continue;
        }

        console.log(`[${timestamp}] ✅ [Vercel Cron] Session found for shop: ${shop}`);
        
        // Create admin client for this shop using unauthenticated.admin()
        // Pass the shop string directly - it will use sessionStorage to load the session
        const { admin } = await unauthenticated.admin(shop);

        console.log(`[${timestamp}] 🔄 [Vercel Cron] Running price rotation for shop: ${shop}`);
        // Run price rotation for this shop
        const result = await ShopifyPriceUpdater.rotateAllActiveTests(admin);

        // Update last_rotated_at timestamp after successful rotation
        await db.settings.update({
          where: { shop: shop },
          data: { last_rotated_at: now }
        });

        console.log(`[${timestamp}] ✅ [Vercel Cron] Auto-rotation completed for ${shop}`);
        results.push({ shop, success: true, result });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[${timestamp}] ❌ [Vercel Cron] Error processing auto-rotation for shop ${shop}:`, errorMsg);
        results.push({ shop, success: false, error: errorMsg });
      }
    }

    return json({ 
      success: true, 
      message: `Processed ${shopsWithAutoRotation.length} shop(s)`,
      results,
      timestamp 
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${timestamp}] ❌ [Vercel Cron] Error in price rotation cron job:`, errorMsg);
    return json({ 
      success: false, 
      error: errorMsg,
      timestamp 
    }, { status: 500 });
  }
};

// Also support POST for manual triggering
export const action = loader;



