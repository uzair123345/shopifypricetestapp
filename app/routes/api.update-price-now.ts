import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin, session } = await authenticate.admin(request);
    
    console.log(`🔄 Update Price Now triggered for shop: ${session.shop}`);
    
    // Get all active tests
    const activeTests = await db.aBTest.findMany({
      where: {
        shop: session.shop,
        status: "active"
      },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    console.log(`Found ${activeTests.length} active tests`);
    
    let updatedCount = 0;
    
    for (const test of activeTests) {
      console.log(`Processing test ${test.id}: ${test.title}`);
      
      if (test.testType === 'single') {
        const updated = await updateSingleProductPrice(admin, test);
        if (updated) updatedCount++;
      } else if (test.testType === 'multiple') {
        const updated = await updateMultipleProductPrices(admin, test);
        updatedCount += updated;
      }
    }
    
    return json({ 
      success: true, 
      message: `Updated prices for ${updatedCount} products`,
      testsProcessed: activeTests.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error during price update:", error);
    return json({ 
      error: "Failed to update prices",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

// Update single product price
async function updateSingleProductPrice(admin: any, test: any): Promise<boolean> {
  try {
    const { productId, variants } = test;
    
    // Use the first test variant price
    const testVariant = variants[0];
    if (testVariant && testVariant.finalPrice) {
      await updateShopifyProductPrice(admin, productId, testVariant.finalPrice);
      console.log(`✅ Updated product ${productId} to $${testVariant.finalPrice} (${testVariant.name})`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error updating single product price:`, error);
    return false;
  }
}

// Update multiple product prices
async function updateMultipleProductPrices(admin: any, test: any): Promise<number> {
  let updatedCount = 0;
  
  try {
    const { variants } = test;
    
    // Group variants by product
    const variantsByProduct = new Map();
    variants.forEach(variant => {
      const productId = variant.variantProductId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId).push(variant);
    });
    
    // Update each product with its first test variant
    for (const [productId, productVariants] of variantsByProduct) {
      const testVariant = productVariants[0];
      if (testVariant && testVariant.finalPrice) {
        await updateShopifyProductPrice(admin, productId, testVariant.finalPrice);
        console.log(`✅ Updated product ${productId} to $${testVariant.finalPrice} (${testVariant.name})`);
        updatedCount++;
      }
    }
    
    return updatedCount;
  } catch (error) {
    console.error(`Error updating multiple product prices:`, error);
    return updatedCount;
  }
}

// Update product price in Shopify
async function updateShopifyProductPrice(admin: any, productId: string, newPrice: number) {
  try {
    // Get the product using REST API
    const product = await admin.rest.resources.Product.find({
      session: admin.session,
      id: productId
    });

    if (product && product.variants && product.variants.length > 0) {
      // Update the first variant's price
      const variant = product.variants[0];
      
      await admin.rest.resources.ProductVariant.update({
        session: admin.session,
        id: variant.id,
        variant: {
          price: newPrice.toString()
        }
      });

      console.log(`✅ Successfully updated product ${productId} variant ${variant.id} price to $${newPrice}`);
    } else {
      console.log(`❌ Product ${productId} not found or has no variants`);
    }
    
  } catch (error) {
    console.error(`❌ Error updating Shopify product ${productId}:`, error);
    throw error;
  }
}
