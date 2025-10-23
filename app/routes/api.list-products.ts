import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔍 Listing all products...");
    
    // List first 10 products
    const response = await admin.graphql(
      `#graphql
      query listProducts($first: Int!) {
        products(first: $first) {
          nodes {
            id
            title
            variants(first: 1) {
              nodes {
                id
                price
              }
            }
          }
        }
      }`,
      { variables: { first: 10 } }
    );
    
    const responseData = await response.json();
    console.log("📋 Products response:", responseData);
    
    return json({
      success: true,
      products: responseData.data?.products?.nodes || [],
      message: `Found ${responseData.data?.products?.nodes?.length || 0} products`
    });
    
  } catch (error) {
    console.error("Error listing products:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

