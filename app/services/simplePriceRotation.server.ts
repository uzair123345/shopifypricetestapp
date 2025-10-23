import db from "../db.server";

export class SimplePriceRotation {
  
  /**
   * Rotate prices for all active tests
   * Simple approach: Update Shopify prices directly based on test variants
   */
  static async rotatePrices() {
    console.log('🔄 Starting simple price rotation...');
    
    try {
      // Get all active tests
      const activeTests = await db.aBTest.findMany({
        where: { status: 'active' },
        include: {
          variants: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      console.log(`Found ${activeTests.length} active tests`);

      for (const test of activeTests) {
        await this.rotateTestPrices(test);
      }

      console.log('✅ Simple price rotation completed');
    } catch (error) {
      console.error('❌ Error during simple price rotation:', error);
    }
  }

  /**
   * Rotate prices for a specific test
   */
  private static async rotateTestPrices(test: any) {
    const { id: testId, testType, variants } = test;
    
    console.log(`🔄 Rotating prices for test ${testId} (${testType})`);

    if (testType === 'multiple') {
      // Handle multiple product test
      await this.rotateMultipleProductTest(test);
    } else {
      // Handle single product test
      await this.rotateSingleProductTest(test);
    }
  }

  /**
   * Rotate prices for single product test
   */
  private static async rotateSingleProductTest(test: any) {
    const { id: testId, productId, variants } = test;
    
    // Simple rotation: Cycle through variants every 5 minutes
    const currentTime = new Date();
    const minutes = currentTime.getMinutes();
    
    // Determine which variant to show based on time
    let variantIndex;
    if (minutes % 15 < 5) {
      // First 5 minutes: Original price
      variantIndex = -1; // Use original price
    } else if (minutes % 15 < 10) {
      // Next 5 minutes: Test Variant 1
      variantIndex = 0;
    } else {
      // Last 5 minutes: Test Variant 2
      variantIndex = 1;
    }

    let targetPrice;
    let variantName;

    if (variantIndex === -1) {
      // Use original price (get from first variant's originalPrice)
      targetPrice = variants[0]?.originalPrice || variants[0]?.finalPrice;
      variantName = 'Original Price';
    } else {
      // Use test variant price
      const variant = variants[variantIndex];
      targetPrice = variant?.finalPrice;
      variantName = variant?.name || `Test Variant ${variantIndex + 1}`;
    }

    if (targetPrice) {
      console.log(`Updating product ${productId} to $${targetPrice} (${variantName})`);
      // Note: Actual Shopify API call would go here
      // For now, we'll just log the intended change
    }
  }

  /**
   * Rotate prices for multiple product test
   */
  private static async rotateMultipleProductTest(test: any) {
    const { id: testId, variants } = test;
    
    // Group variants by product
    const variantsByProduct = this.groupVariantsByProduct(variants);
    
    for (const [productId, productVariants] of variantsByProduct) {
      // Use the same rotation logic for each product
      const currentTime = new Date();
      const minutes = currentTime.getMinutes();
      
      let variantIndex;
      if (minutes % 15 < 5) {
        variantIndex = -1; // Original price
      } else if (minutes % 15 < 10) {
        variantIndex = 0; // Test Variant 1
      } else {
        variantIndex = 1; // Test Variant 2
      }

      let targetPrice;
      let variantName;

      if (variantIndex === -1) {
        targetPrice = productVariants[0]?.originalPrice || productVariants[0]?.finalPrice;
        variantName = 'Original Price';
      } else {
        const variant = productVariants[variantIndex];
        targetPrice = variant?.finalPrice;
        variantName = variant?.name || `Test Variant ${variantIndex + 1}`;
      }

      if (targetPrice) {
        console.log(`Updating product ${productId} to $${targetPrice} (${variantName})`);
        // Note: Actual Shopify API call would go here
      }
    }
  }

  /**
   * Group variants by product for multiple product tests
   */
  private static groupVariantsByProduct(variants: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    variants.forEach(variant => {
      const productId = variant.variantProductId;
      if (!grouped.has(productId)) {
        grouped.set(productId, []);
      }
      grouped.get(productId)!.push(variant);
    });
    
    return grouped;
  }
}
