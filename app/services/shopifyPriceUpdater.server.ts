import { authenticate } from "../shopify.server";
import db from "../db.server";

export class ShopifyPriceUpdater {
  private static toVariantGid(possibleId: any): string {
    if (!possibleId) return "";
    const idStr = String(possibleId);
    if (idStr.startsWith("gid://")) return idStr;
    if (/^\d+$/.test(idStr)) {
      return `gid://shopify/ProductVariant/${idStr}`;
    }
    return idStr;
  }

  private static toProductGid(possibleId: any): string {
    if (!possibleId) return "";
    const idStr = String(possibleId);
    if (idStr.startsWith("gid://")) return idStr;
    if (/^\d+$/.test(idStr)) {
      return `gid://shopify/Product/${idStr}`;
    }
    return idStr;
  }

  static async resolveVariantGid(admin: any, maybeVariantOrProductId: any): Promise<string> {
    const idStr = String(maybeVariantOrProductId || "");
    if (!idStr) return "";
    // If already a variant gid, return
    if (idStr.startsWith("gid://") && idStr.includes("ProductVariant")) return idStr;
    // If numeric or gid but product, fetch first variant id
    const productGid = this.toProductGid(idStr);
    try {
      const resp = await admin.graphql(
        `#graphql
        query getFirstVariant($id: ID!) {
          product(id: $id) {
            variants(first: 1) { nodes { id } }
          }
        }`,
        { variables: { id: productGid } }
      );
      const json = await resp.json();
      const nodes = json?.data?.product?.variants?.nodes || [];
      return nodes[0]?.id || "";
    } catch (e) {
      console.error("resolveVariantGid error for", productGid, e);
      return "";
    }
  }
  static async updateProductPrice(admin: any, shop: string, productId: string, variantId: string, newPrice: number) {
    try {
      console.log(`🔍 Updating price - productId: '${productId}', variantId: '${variantId}', newPrice: ${newPrice}`);
      
      // Convert product ID to GID
      const productGid = this.toProductGid(productId);
      console.log(`📦 Product GID: '${productGid}'`);
      
      // Convert variant ID to GID
      const variantGid = this.toVariantGid(variantId);
      console.log(`🔧 Variant GID: '${variantGid}'`);
      
      // Validate GIDs
      if (!productGid || !variantGid) {
        console.log(`❌ Invalid GIDs - productGid: '${productGid}', variantGid: '${variantGid}'`);
        return { success: false, message: `Invalid product or variant ID` };
      }
      
      console.log(`🚀 Updating variant ${variantGid} to price ${newPrice}`);
      
      const response = await admin.graphql(
        `#graphql
        mutation updateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id price }
            userErrors { field message }
          }
        }`,
        { 
          variables: { 
            productId: productGid,
            variants: [{ id: variantGid, price: String(newPrice) }]
          } 
        }
      );
      
      const json = await response.json();
      console.log(`📊 Update response:`, json);
      const errors = json?.data?.productVariantsBulkUpdate?.userErrors || [];
      if (errors.length) {
        return { success: false, message: `Variant ${variantGid}: ${errors.map((e: any) => e.message).join(", ")}` };
      }
      
      return { success: true, price: newPrice };
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error updating product price:`, msg);
      return { success: false, message: msg };
    }
  }

  static async rotateAllActiveTests(admin?: any) {
    console.log("Starting price rotation for all active tests...");
    try {
      const activeTests = await db.aBTest.findMany({
        where: { status: "active" },
        include: { 
          variants: true,
          products: true 
        },
      });

      console.log(`Found ${activeTests.length} active tests to rotate`);
      
      if (activeTests.length === 0) {
        return { success: false, rotatedTests: 0, error: "No active tests found. Please create and activate a test first." };
      }
      
      const failures: Array<{testId: number; message: string}> = [];
      for (const test of activeTests) {
        try {
          console.log(`Rotating test ${test.id}: ${test.title}`);
          await this.rotateTestPrices(test, admin);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failures.push({ testId: test.id, message: msg });
          console.error(`Error rotating test ${test.id}:`, msg);
        }
      }
      return { success: failures.length === 0, rotatedTests: activeTests.length, failures };
    } catch (error) {
      console.error("Error rotating test prices:", error);
      // Return a non-throwing response so callers can still show feedback
      return { success: false, rotatedTests: 0, error: error instanceof Error ? error.message : "Unknown error" } as any;
    }
  }

  static async rotateTestPrices(test: any, admin?: any) {
    console.log(`Rotating prices for test: ${test.name} (${test.testType || 'single'})`);
    
    // Default to 'single' if testType is empty or undefined
    const testType = test.testType || 'single';
    
    if (testType === 'multiple') {
      // Handle multiple product test
      return await this.rotateMultipleProductTest(test, admin);
    } else {
      // Handle single product test
      return await this.rotateSingleProductTest(test, admin);
    }
  }

  /**
   * Rotate prices for single product test
   */
  private static async rotateSingleProductTest(test: any, admin?: any) {
    console.log(`Rotating single product test: ${test.name}`);
    
    // Get the base price from the test's products
    const basePrice = test.products?.[0]?.basePrice || test.basePrice || 25.00;
    
    const allPrices = [
      { price: basePrice, name: "Base Price", trafficPercent: test.baseTrafficPercent || 50 },
      ...test.variants.map((v: any) => ({ 
        price: v.price,
        name: v.variantName,
        trafficPercent: v.trafficPercent 
      }))
    ];
    
    // Simple rotation: cycle through all prices every 1 minute (for testing)
    const now = new Date();
    const minutes = now.getMinutes();
    const rotationIndex = Math.floor(minutes / 1) % allPrices.length;
    
    const selectedPrice = allPrices[rotationIndex];
    
    if (!selectedPrice) {
      console.log(`No price found for rotation index ${rotationIndex}`);
      return;
    }

    console.log(`Selected price: ${selectedPrice.name} with price ${selectedPrice.price} (${selectedPrice.trafficPercent}% traffic)`);

    // Update the product price in Shopify
    const productId = test.productId || test.variants[0]?.variantProductId;
    
    if (!productId) {
      throw new Error("No productId found in test");
    }
    
    // Get the actual variant ID from Shopify
    const variantId = await this.resolveVariantGid(admin, productId);
    
    if (!variantId) {
      throw new Error(`Could not resolve variant ID for product ${productId}`);
    }
    
    console.log(`🔄 About to call updateProductPrice with:`);
    console.log(`   - test.shop: '${test.shop}'`);
    console.log(`   - productId: '${productId}'`);
    console.log(`   - variantId: '${variantId}'`);
    console.log(`   - selectedPrice.price: ${selectedPrice.price}`);
    
    const upd = await this.updateProductPrice(
      admin,
      test.shop,
      productId,
      variantId,
      selectedPrice.price
    );
    if (!upd?.success) {
      throw new Error(upd?.message || "Unknown update error");
    }

    console.log(`✅ Single product price update result:`, upd);
    
    return upd;
  }

  /**
   * Rotate prices for multiple product test
   */
  private static async rotateMultipleProductTest(test: any, admin?: any) {
    console.log(`Rotating multiple product test: ${test.name}`);
    
    // Group variants by product
    const variantsByProduct = new Map<string, any[]>();
    
    test.variants.forEach((variant: any) => {
      const productId = variant.variantProductId;
      if (productId) {
        if (!variantsByProduct.has(productId)) {
          variantsByProduct.set(productId, []);
        }
        variantsByProduct.get(productId)!.push(variant);
      }
    });

    console.log(`Found ${variantsByProduct.size} products in multiple product test`);

    const results = [];
    
    for (const [productId, productVariants] of variantsByProduct) {
      try {
        // Get the base price for this specific product
        const productData = test.products?.find((p: any) => p.productId === productId);
        const basePrice = productData?.basePrice || productVariants.find(v => v.isBaseVariant)?.price || 25.00;
        
        // Create price rotation for this product
        const allPrices = [
          { price: basePrice, name: "Base Price", trafficPercent: productData?.baseTrafficPercent || test.baseTrafficPercent || 50 },
          ...productVariants.filter(v => !v.isBaseVariant).map((v: any) => ({ 
            price: v.price,
            name: v.variantName,
            trafficPercent: v.trafficPercent 
          }))
        ];
        
        // Simple rotation: cycle through all prices every 1 minute (for testing)
        const now = new Date();
        const minutes = now.getMinutes();
        const rotationIndex = Math.floor(minutes / 1) % allPrices.length;
        
        const selectedPrice = allPrices[rotationIndex];
        
        if (!selectedPrice) {
          console.log(`No price found for product ${productId} rotation index ${rotationIndex}`);
          continue;
        }

        console.log(`Selected price for product ${productId}: ${selectedPrice.name} with price ${selectedPrice.price} (${selectedPrice.trafficPercent}% traffic)`);

        // Update the product price in Shopify
        // Get the actual variant ID from Shopify
        const variantId = await this.resolveVariantGid(admin, productId);
        
        if (!variantId) {
          throw new Error(`Could not resolve variant ID for product ${productId}`);
        }
        
        console.log(`🔄 About to call updateProductPrice with:`);
        console.log(`   - test.shop: '${test.shop}'`);
        console.log(`   - productId: '${productId}'`);
        console.log(`   - variantId: '${variantId}'`);
        console.log(`   - selectedPrice.price: ${selectedPrice.price}`);
        
        const upd = await this.updateProductPrice(
          admin,
          test.shop,
          productId,
          variantId,
          selectedPrice.price
        );
        if (!upd?.success) {
          throw new Error(upd?.message || "Unknown update error");
        }

        console.log(`✅ Product ${productId} price update result:`, upd);
        
        results.push({ productId, result: upd });
      } catch (error) {
        console.error(`❌ Error updating product ${productId}:`, error);
        results.push({ productId, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return results;
  }
}
