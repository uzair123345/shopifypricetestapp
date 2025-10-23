import { authenticate } from "../shopify.server";
import db from "../db.server";

export class PriceRotationService {
  static async rotatePrices() {
    console.log("Starting price rotation...");
    
    try {
      // Get all active tests
      const activeTests = await db.aBTest.findMany({
        where: {
          status: "active"
        },
        include: {
          variants: true
        }
      });

      console.log(`Found ${activeTests.length} active tests`);

      for (const test of activeTests) {
        await this.rotateTestPrices(test);
      }

      console.log("Price rotation completed successfully");
    } catch (error) {
      console.error("Error in price rotation:", error);
      throw error;
    }
  }

  static async rotateTestPrices(test: any) {
    console.log(`Rotating prices for test ${test.id}: ${test.name}`);
    
    // Get current time-based rotation index
    const rotationIndex = this.getCurrentRotationIndex();
    const variant = test.variants[rotationIndex % test.variants.length];
    
    if (!variant) {
      console.log(`No variant found for rotation index ${rotationIndex}`);
      return;
    }

    console.log(`Using variant: ${variant.name} with price ${variant.finalPrice}`);

    // Update Shopify product price
    await this.updateShopifyProductPrice(test.shop, test.productId, variant.finalPrice);
    
    // Store the current rotation state
    await db.aBTest.update({
      where: { id: test.id },
      data: {
        currentVariantId: variant.id,
        lastRotationAt: new Date()
      }
    });
  }

  static getCurrentRotationIndex(): number {
    // Rotate every 5 minutes (300 seconds)
    const now = new Date();
    const minutes = now.getMinutes();
    const rotationInterval = 5; // 5 minutes
    return Math.floor(minutes / rotationInterval);
  }

  static async updateShopifyProductPrice(shop: string, productId: string, newPrice: number) {
    try {
      // This would need to be implemented with proper Shopify API authentication
      // For now, we'll log what should happen
      console.log(`Would update product ${productId} in shop ${shop} to price ${newPrice}`);
      
      // TODO: Implement actual Shopify Admin API call to update product price
      // This requires proper authentication and API calls
      
    } catch (error) {
      console.error(`Error updating product price for ${productId}:`, error);
      throw error;
    }
  }
}