import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔍 Checking database tests and Shopify products...");
    
    // Get tests from database
    const tests = await db.aBTest.findMany({
      where: { status: "active" },
      include: { variants: true },
    });
    
    console.log("📋 Database tests:", tests);
    
    // Get products from Shopify
    const response = await admin.graphql(
      `#graphql
      query listProducts($first: Int!) {
        products(first: $first) {
          nodes {
            id
            title
            handle
            variants(first: 1) {
              nodes {
                id
                price
              }
            }
          }
        }
      }`,
      { variables: { first: 20 } }
    );
    
    const responseData = await response.json();
    const products = responseData.data?.products?.nodes || [];
    
    console.log("🛍️ Shopify products:", products);
    
    // Check if test product IDs exist in Shopify
    const testProductIds = tests.map(t => t.productId);
    const shopifyProductIds = products.map(p => p.id.replace('gid://shopify/Product/', ''));
    
    const missingProducts = testProductIds.filter(testId => 
      !shopifyProductIds.includes(testId)
    );
    
    return json({
      success: true,
      databaseTests: tests.map(t => ({
        id: t.id,
        name: t.name,
        productId: t.productId,
        status: t.status,
        variantsCount: t.variants.length
      })),
      shopifyProducts: products.map(p => ({
        id: p.id,
        numericId: p.id.replace('gid://shopify/Product/', ''),
        title: p.title,
        handle: p.handle,
        firstVariantPrice: p.variants.nodes[0]?.price || 'N/A'
      })),
      missingProducts: missingProducts,
      message: `Found ${tests.length} tests, ${products.length} Shopify products, ${missingProducts.length} missing products`
    });
    
  } catch (error) {
    console.error("Error checking products:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

