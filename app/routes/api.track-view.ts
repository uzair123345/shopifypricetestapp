import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    console.log("[track-view] Method not allowed:", request.method);
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    console.log("[track-view] 📥 Received tracking request:", {
      productId: body.productId,
      testId: body.testId,
      variantId: body.variantId,
      shop: body.shop,
      url: body.url,
      price: body.price,
      sessionId: body.sessionId
    });
    
    const { 
      productId, 
      testId,
      variantId,
      sessionId, 
      customerId, 
      shop, 
      url, 
      price
    } = body;

    if (!productId || !sessionId || !shop) {
      console.log("[track-view] Missing required parameters:", { productId: !!productId, sessionId: !!sessionId, shop: !!shop });
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Use the provided testId and variantId
    const abTestId = testId || null;
    const finalVariantId = variantId || null;

    // Check for duplicate view in the last 1 minute (prevent multiple tracks from same session)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const existingView = await db.viewEvent.findFirst({
      where: {
        productId,
        variantId: finalVariantId,
        abTestId: abTestId || undefined,
        sessionId,
        shop,
        url,
        timestamp: {
          gte: oneMinuteAgo
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (existingView) {
      console.log("Duplicate view detected, skipping:", {
        productId,
        variantId: finalVariantId,
        abTestId,
        sessionId,
        url
      });
      return json({ success: true, duplicate: true }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    // IMPORTANT: Ensure base price views (when variant.id was 0) are stored with variantId = null
    // Double-check that if variantId is 0, we store it as null
    const finalVariantIdForDB = (finalVariantId === 0 || finalVariantId === null) ? null : finalVariantId;
    
    // Store the view event in the database
    const createdView = await db.viewEvent.create({
      data: {
        productId,
        variantId: finalVariantIdForDB,  // Use null if it was 0 or null
        abTestId,
        sessionId,
        customerId,
        shop,
        url,
        price,
        isTestPrice: !!abTestId, // true if we have a testId
        timestamp: new Date() // Use current time instead of invalid timestamp
      }
    });

    console.log("[track-view] ✅ View tracked successfully:", {
      viewId: createdView.id,
      productId,
      price,
      sessionId,
      customerId,
      shop,
      url,
      variantId: finalVariantIdForDB,  // Log the actual stored value
      abTestId,
      originalVariantId: variantId,  // Log what was received
      timestamp: new Date().toISOString()
    });
    
    // If this was a base price view, log it clearly
    if (finalVariantIdForDB === null && abTestId) {
      console.log("[track-view] 📊 BASE PRICE VIEW tracked:", {
        productId,
        abTestId,
        price,
        shop
      });
    }

    return json({ success: true }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  } catch (error) {
    console.error("Error in track-view API:", error);
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

export const loader = async ({ request }: ActionFunctionArgs) => {
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
