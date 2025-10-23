import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔍 Testing product ID: 10194192433418");
    
    // Test if this product ID exists
    const response = await admin.graphql(
      `#graphql
      query testProduct($id: ID!) {
        product(id: $id) {
          id
          title
          variants(first: 1) {
            nodes {
              id
              price
            }
          }
        }
      }`,
      { variables: { id: "gid://shopify/Product/10194192433418" } }
    );
    
    const responseData = await response.json();
    console.log("📋 Product query response:", responseData);
    
    if (responseData.errors) {
      return json({
        success: false,
        error: "Product not found",
        details: responseData.errors
      });
    }
    
    return json({
      success: true,
      product: responseData.data?.product,
      message: "Product found successfully"
    });
    
  } catch (error) {
    console.error("Error testing product ID:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

