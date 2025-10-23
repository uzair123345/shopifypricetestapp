import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: { request: Request }) {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔍 DEBUG: Starting price update debug...");
    
    // Get active tests
    const activeTests = await db.aBTest.findMany({
      where: { status: "active" },
      include: { variants: true }
    });
    
    console.log(`🔍 DEBUG: Found ${activeTests.length} active tests`);
    
    if (activeTests.length === 0) {
      return json({ success: false, error: "No active tests found" });
    }
    
    const test = activeTests[0];
    console.log(`🔍 DEBUG: Testing with test ID ${test.id}`);
    console.log(`🔍 DEBUG: Test data:`, JSON.stringify(test, null, 2));
    
    // Test GID conversion
    const productId = test.productId;
    const variantId = test.variants[0]?.variantId || "51655582908682";
    
    console.log(`🔍 DEBUG: Raw IDs from test data - productId: '${productId}', variantId: '${variantId}'`);
    
    // Convert to GIDs
    const productGid = `gid://shopify/Product/${productId}`;
    const variantGid = `gid://shopify/ProductVariant/${variantId}`;
    
    console.log(`🔍 DEBUG: Converted GIDs - productGid: '${productGid}', variantGid: '${variantGid}'`);
    
    // Check if this product actually exists in Shopify
    console.log(`🔍 DEBUG: Checking if product exists in Shopify...`);
    const checkQuery = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
        }
      }
    `;
    
    const checkResponse = await admin.graphql(checkQuery, {
      variables: { id: productGid }
    });
    
    const checkData = await checkResponse.json();
    console.log(`🔍 DEBUG: Product check result:`, JSON.stringify(checkData, null, 2));
    
    if (!checkData.data?.product) {
      return json({ 
        success: false, 
        error: "Product does not exist in Shopify", 
        details: {
          testId: test.id,
          productId,
          productGid,
          checkResponse: checkData
        }
      });
    }
    
    // Test GraphQL mutation (exact same as working test)
    const mutation = `#graphql
      mutation updateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id price }
          userErrors { field message }
        }
      }
    `;
    
    const variables = {
      productId: productGid,
      variants: [{ id: variantGid, price: "22.50" }]
    };
    
    console.log(`🔍 DEBUG: About to call GraphQL with:`, JSON.stringify(variables, null, 2));
    
    const response = await admin.graphql(mutation, { variables });
    const responseData = await response.json();
    
    console.log(`🔍 DEBUG: GraphQL response:`, JSON.stringify(responseData, null, 2));
    
    if (responseData.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
      return json({ 
        success: false, 
        error: "GraphQL errors", 
        details: responseData.data.productVariantsBulkUpdate.userErrors 
      });
    }
    
    return json({ 
      success: true, 
      message: "Debug successful", 
      details: {
        testId: test.id,
        productId,
        variantId,
        productGid,
        variantGid,
        graphqlResponse: responseData
      }
    });
    
  } catch (error) {
    console.error("🔍 DEBUG: Error occurred:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      details: error
    });
  }
}
