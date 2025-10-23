import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin, session } = await authenticate.admin(request);
    
    console.log(`🔄 Manual price update triggered for shop: ${session.shop}`);
    
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
        // Single product test
        const updated = await updateSingleProductPrice(admin, test);
        if (updated) updatedCount++;
      } else if (test.testType === 'multiple') {
        // Multiple product test
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
    console.error("Error during manual price update:", error);
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
    
    // Simple rotation based on current time
    const currentTime = new Date();
    const minutes = currentTime.getMinutes();
    
    let targetPrice;
    let variantName;

    if (minutes % 15 < 5) {
      // First 5 minutes: Original price
      targetPrice = variants[0]?.originalPrice || variants[0]?.finalPrice;
      variantName = 'Original Price';
    } else if (minutes % 15 < 10) {
      // Next 5 minutes: Test Variant 1
      targetPrice = variants[0]?.finalPrice;
      variantName = variants[0]?.name || 'Test Variant 1';
    } else {
      // Last 5 minutes: Test Variant 2
      targetPrice = variants[1]?.finalPrice;
      variantName = variants[1]?.name || 'Test Variant 2';
    }

    if (targetPrice) {
      await updateShopifyProductPrice(admin, productId, targetPrice);
      console.log(`✅ Updated product ${productId} to $${targetPrice} (${variantName})`);
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
    
    // Update each product
    for (const [productId, productVariants] of variantsByProduct) {
      const currentTime = new Date();
      const minutes = currentTime.getMinutes();
      
      let targetPrice;
      let variantName;

      if (minutes % 15 < 5) {
        targetPrice = productVariants[0]?.originalPrice || productVariants[0]?.finalPrice;
        variantName = 'Original Price';
      } else if (minutes % 15 < 10) {
        targetPrice = productVariants[0]?.finalPrice;
        variantName = productVariants[0]?.name || 'Test Variant 1';
      } else {
        targetPrice = productVariants[1]?.finalPrice;
        variantName = productVariants[1]?.name || 'Test Variant 2';
      }

      if (targetPrice) {
        await updateShopifyProductPrice(admin, productId, targetPrice);
        console.log(`✅ Updated product ${productId} to $${targetPrice} (${variantName})`);
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
    // Convert product ID to Shopify GraphQL format
    const shopifyProductId = `gid://shopify/Product/${productId}`;
    
    // Get the product to find its variants
    const productResponse = await admin.graphql(`
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          variants(first: 10) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }
    `, {
      variables: { id: shopifyProductId }
    });
    
    const productData = await productResponse.json();
    
    if (productData.data?.product?.variants?.edges?.length > 0) {
      const variant = productData.data.product.variants.edges[0].node;
      
      // Update the first variant's price
      const updateResponse = await admin.graphql(`
        mutation productVariantUpdate($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          input: {
            id: variant.id,
            price: newPrice.toFixed(2)
          }
        }
      });
      
      const updateData = await updateResponse.json();
      
      if (updateData.data?.productVariantUpdate?.userErrors?.length > 0) {
        console.error(`❌ Error updating product ${productId}:`, updateData.data.productVariantUpdate.userErrors);
        throw new Error(`Failed to update product ${productId}: ${updateData.data.productVariantUpdate.userErrors[0].message}`);
      } else {
        console.log(`✅ Successfully updated product ${productId} price to $${newPrice}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error updating Shopify product ${productId}:`, error);
    throw error;
  }
}
