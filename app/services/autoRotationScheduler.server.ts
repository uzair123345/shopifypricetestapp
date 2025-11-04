import { PrismaClient } from '@prisma/client';
import { ShopifyPriceUpdater } from './shopifyPriceUpdater.server';
import { unauthenticated } from '../shopify.server';

const db = new PrismaClient();

export class AutoRotationScheduler {
  private static instance: AutoRotationScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): AutoRotationScheduler {
    if (!AutoRotationScheduler.instance) {
      AutoRotationScheduler.instance = new AutoRotationScheduler();
    }
    return AutoRotationScheduler.instance;
  }

  async start() {
    if (this.isRunning) {
      console.log("🔄 Auto-rotation scheduler is already running");
      return;
    }

    console.log("🚀 Starting auto-rotation scheduler...");
    this.isRunning = true;

    // Run immediately on start
    await this.runRotation();

    // Then run every minute
    this.intervalId = setInterval(async () => {
      await this.runRotation();
    }, 60000); // 60 seconds

    console.log("✅ Auto-rotation scheduler started (runs every 60 seconds)");
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("⏹️ Auto-rotation scheduler stopped");
  }

  private async runRotation() {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] 🔄 Auto-rotation scheduler running...`);
      
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
        console.log(`[${timestamp}] ⚠️ No shops with auto-rotation enabled`);
        return;
      }

      console.log(`[${timestamp}] 🔄 Found ${shopsWithAutoRotation.length} shop(s) with auto-rotation enabled`);
      
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
              console.log(`[${timestamp}] ⏸️ Skipping rotation for ${shop} - ${remainingSeconds}s remaining until next rotation (interval: ${intervalMinutes} min)`);
              continue;
            }
          }
          
          console.log(`[${timestamp}] 🔄 Processing auto-rotation for shop: ${shop} (interval: ${intervalMinutes} min)`);
          
          // Get session for this shop
          const session = await db.session.findFirst({
            where: { shop: shop }
          });

          if (!session) {
            console.log(`[${timestamp}] ⚠️ No session found for shop: ${shop}`);
            continue;
          }

          console.log(`[${timestamp}] ✅ Session found for shop: ${shop}`);
          
          // Create admin client for this shop using unauthenticated.admin()
          // Pass the shop string directly - it will use sessionStorage to load the session
          const { admin } = await unauthenticated.admin(shop);

          console.log(`[${timestamp}] 🔄 Running price rotation for shop: ${shop}`);
          // Run price rotation for this shop
          const result = await ShopifyPriceUpdater.rotateAllActiveTests(admin);

          // Update last_rotated_at timestamp after successful rotation
          await db.settings.update({
            where: { shop: shop },
            data: { last_rotated_at: now }
          });

          console.log(`[${timestamp}] ✅ Auto-rotation completed for ${shop}:`, result);
        } catch (error) {
          console.error(`[${timestamp}] ❌ Error processing auto-rotation for shop ${shop}:`, error);
        }
      }
      
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ❌ Error in auto-rotation scheduler:`, error);
    }
  }

  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: !!this.intervalId
    };
  }
}

// Export the scheduler instance for manual control
export default AutoRotationScheduler.getInstance();

