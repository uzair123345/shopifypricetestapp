import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ShopifyPriceUpdater } from "../services/shopifyPriceUpdater.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    console.log("🔄 Reset prices triggered for shop:", session.shop);
    
    // Get all active tests for this shop
    const activeTests = await db.aBTest.findMany({
      where: { 
        shop: session.shop,
        status: "active" 
      },
      include: { 
        products: true,
        variants: true 
      },
    });

    console.log(`Found ${activeTests.length} active tests to reset`);

    if (activeTests.length === 0) {
      return json({
        success: true,
        message: "No active tests found to reset",
        resetTests: 0
      });
    }

    const results = [];
    const failures = [];

    // Reset prices for each active test
    for (const test of activeTests) {
      try {
        console.log(`Resetting prices for test ${test.id}: ${test.title}`);
        
        if (test.testType === "multiple") {
          // Multiple product test - reset each product individually
          for (const product of test.products) {
            const result = await ShopifyPriceUpdater.updateProductPrice(
              admin,
              session.shop,
              product.productId,
              await ShopifyPriceUpdater.resolveVariantGid(admin, product.productId),
              product.basePrice
            );
            
            if (result.success) {
              console.log(`✅ Reset product ${product.productId} to $${product.basePrice}`);
              results.push({ testId: test.id, productId: product.productId, price: product.basePrice });
            } else {
              console.error(`❌ Failed to reset product ${product.productId}:`, result.message);
              failures.push({ testId: test.id, productId: product.productId, error: result.message });
            }
          }
        } else {
          // Single product test - reset the first product
          const product = test.products[0];
          if (product) {
            const result = await ShopifyPriceUpdater.updateProductPrice(
              admin,
              session.shop,
              product.productId,
              await ShopifyPriceUpdater.resolveVariantGid(admin, product.productId),
              product.basePrice
            );
            
            if (result.success) {
              console.log(`✅ Reset product ${product.productId} to $${product.basePrice}`);
              results.push({ testId: test.id, productId: product.productId, price: product.basePrice });
            } else {
              console.error(`❌ Failed to reset product ${product.productId}:`, result.message);
              failures.push({ testId: test.id, productId: product.productId, error: result.message });
            }
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error resetting test ${test.id}:`, msg);
        failures.push({ testId: test.id, error: msg });
      }
    }

    const successCount = results.length;
    const failureCount = failures.length;

    console.log(`✅ Reset prices completed: ${successCount} successful, ${failureCount} failed`);

    return json({
      success: failureCount === 0,
      message: failureCount === 0 
        ? `Successfully reset prices for ${successCount} products` 
        : `Reset ${successCount} products successfully, ${failureCount} failed`,
      resetTests: activeTests.length,
      resetProducts: successCount,
      failures: failures,
      results: results
    });

  } catch (error) {
    console.error("❌ Reset prices error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
