import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getDisplayPrice } from "../services/abTestService.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const originalPrice = parseFloat(url.searchParams.get("originalPrice") || "0");
    const shop = url.searchParams.get("shop");
    const sessionId = url.searchParams.get("sessionId") || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const customerId = url.searchParams.get("customerId");

    if (!productId || !originalPrice || !shop) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Create session object
    const session = {
      sessionId,
      customerId: customerId || undefined,
      shop
    };

    // Get the price to display
    const priceData = await getDisplayPrice(productId, originalPrice, session);

    // Also get all variants for this test so client can match displayed price
    let allVariants = [];
    if (priceData.isTestPrice && priceData.testId) {
      try {
        const test = await db.aBTest.findUnique({
          where: { id: priceData.testId },
          include: {
            products: true,
            variants: true
          }
        });
        
        if (test) {
          // Get all variants for this product (filter by productId if multiple product test)
          let productVariants = test.variants;
          if (test.testType === "multiple") {
            productVariants = test.variants.filter(v => 
              !v.variantProductId || v.variantProductId === productId
            );
          }
          
          // Add base variant (original price)
          // Get the actual base price from the product data (not originalPrice parameter which might be wrong)
          const productData = test.products.find(p => p.productId === productId);
          const actualBasePrice = productData?.basePrice || originalPrice;
          
          const baseVariant = {
            id: 0,
            variantName: "Base Price",
            price: actualBasePrice, // Use the actual base price from database
            isBaseVariant: true,
            trafficPercent: test.baseTrafficPercent || 50
          };
          allVariants = [baseVariant, ...productVariants];
          
          console.log(`[get-price] All variants for product ${productId}:`, allVariants.map(v => ({
            id: v.id,
            name: v.variantName,
            price: v.price,
            isBase: v.isBaseVariant
          })));
        }
      } catch (error) {
        console.error(`[get-price] Error fetching variants for test ${priceData.testId}:`, error);
        // Don't fail the entire request if we can't get variants - client can still track
        allVariants = [];
      }
    }

    return json({
      ...priceData,
      allVariants: allVariants // Include all variants for price matching
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  } catch (error) {
    console.error("Error in storefront get-price API:", error);
    return json({ error: "Internal server error" }, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }
  
  return json({ success: true });
};

