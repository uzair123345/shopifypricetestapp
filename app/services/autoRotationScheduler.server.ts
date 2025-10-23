import { PrismaClient } from '@prisma/client';
import { ShopifyPriceUpdater } from './shopifyPriceUpdater.server';
import shopify from '../shopify.server';

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
      console.log("🔄 Auto-rotation scheduler running...");
      
      // Since we can't access localStorage from server, we'll always run auto-rotation
      // when the scheduler is active (which means user has enabled it)
      console.log("🔄 Running auto-rotation for all active tests...");
      
      // Get the current shop
      const currentShop = "dev-bio-restore.myshopify.com";
      
      try {
        console.log(`🔄 Processing auto-rotation for shop: ${currentShop}`);
        
        // Get session for this shop
        const session = await db.session.findFirst({
          where: { shop: currentShop }
        });

        if (!session) {
          console.log(`⚠️ No session found for shop: ${currentShop}`);
          return;
        }

        // Create admin client for this shop
        const adminClient = shopify.rest.resources.Session.fromSession(session);

        // Run price rotation for this shop
        const result = await ShopifyPriceUpdater.rotateAllActiveTests(adminClient);

        console.log(`✅ Auto-rotation completed for ${currentShop}:`, result);
      } catch (error) {
        console.error(`❌ Error processing auto-rotation for shop ${currentShop}:`, error);
      }
      
    } catch (error) {
      console.error("❌ Error in auto-rotation scheduler:", error);
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

