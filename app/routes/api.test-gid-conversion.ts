import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🧪 Testing GID conversion step by step...");
    
    // Test the exact values from our debug results
    const productId = "10194192433418";
    const variantId = "51655582908682";
    
    console.log(`Input values: productId='${productId}', variantId='${variantId}'`);
    
    // Test GID conversion functions
    const toProductGid = (id: string) => {
      if (!id) return "";
      const idStr = String(id);
      if (idStr.startsWith("gid://")) return idStr;
      if (/^\d+$/.test(idStr)) {
        return `gid://shopify/Product/${idStr}`;
      }
      return idStr;
    };
    
    const toVariantGid = (id: string) => {
      if (!id) return "";
      const idStr = String(id);
      if (idStr.startsWith("gid://")) return idStr;
      if (/^\d+$/.test(idStr)) {
        return `gid://shopify/ProductVariant/${idStr}`;
      }
      return idStr;
    };
    
    const productGid = toProductGid(productId);
    const variantGid = toVariantGid(variantId);
    
    console.log(`Converted GIDs: productGid='${productGid}', variantGid='${variantGid}'`);
    
    // Test if the GIDs are valid
    if (!productGid || !variantGid) {
      return json({
        success: false,
        error: "GID conversion failed",
        details: {
          productId,
          variantId,
          productGid,
          variantGid,
          productGidLength: productGid?.length || 0,
          variantGidLength: variantGid?.length || 0
        }
      });
    }
    
    // Test the actual GraphQL mutation
    console.log("🚀 Testing GraphQL mutation...");
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
          variants: [{ id: variantGid, price: "22.50" }]
        } 
      }
    );
    
    const jsonResponse = await response.json();
    console.log("📊 GraphQL response:", jsonResponse);
    
    const errors = jsonResponse?.data?.productVariantsBulkUpdate?.userErrors || [];
    if (errors.length) {
      return json({
        success: false,
        error: "GraphQL mutation failed",
        details: {
          productId,
          variantId,
          productGid,
          variantGid,
          graphqlErrors: errors
        }
      });
    }
    
    return json({
      success: true,
      message: "GID conversion and GraphQL mutation successful!",
      details: {
        productId,
        variantId,
        productGid,
        variantGid,
        updatedPrice: jsonResponse?.data?.productVariantsBulkUpdate?.productVariants?.[0]?.price
      }
    });
    
  } catch (error) {
    console.error("Error testing GID conversion:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
};


