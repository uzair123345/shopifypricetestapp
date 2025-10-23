import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: { request: Request }) {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔍 Getting product variants for Example T-Shirt...");
    
    // Get the product by handle (since we know it's "example-shirt")
    const query = `
      query getProduct($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                sku
              }
            }
          }
        }
      }
    `;
    
    const response = await admin.graphql(query, {
      variables: { handle: "example-shirt" }
    });
    
    const data = await response.json();
    console.log("📊 Product data:", JSON.stringify(data, null, 2));
    
    if (!data.data?.productByHandle) {
      return json({ 
        success: false, 
        error: "Product not found",
        details: data
      });
    }
    
    const product = data.data.productByHandle;
    const variants = product.variants.edges.map((edge: any) => edge.node);
    
    return json({ 
      success: true, 
      message: "Product variants retrieved successfully",
      details: {
        productId: product.id,
        productTitle: product.title,
        variants: variants.map((v: any) => ({
          id: v.id,
          title: v.title,
          price: v.price,
          sku: v.sku
        }))
      }
    });
    
  } catch (error) {
    console.error("Error getting product variants:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      details: error
    });
  }
}

