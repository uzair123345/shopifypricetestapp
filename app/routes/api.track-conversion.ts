import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { 
      productId, 
      testId, 
      variantId, 
      sessionId, 
      customerId, 
      shop, 
      url, 
      originalPrice, 
      testPrice 
    } = body;

    if (!productId || !sessionId || !shop) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Use the provided testId and variantId directly
    const abTestId = testId || null;
    const finalVariantId = variantId || null;
    const price = testPrice || originalPrice;
    const isTestPrice = !!testId;

    // Store the conversion event in the database
    await db.conversionEvent.create({
      data: {
        productId,
        variantId: finalVariantId,
        abTestId,
        sessionId,
        customerId,
        shop,
        url,
        price,
        orderValue: price, // For now, use price as order value
        timestamp: new Date()
      }
    });

    console.log("Conversion tracked:", {
      productId,
      testId,
      variantId: finalVariantId,
      price,
      isTestPrice,
      sessionId,
      customerId,
      shop,
      url,
      originalPrice,
      testPrice
    });

    return json({ success: true }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  } catch (error) {
    console.error("Error in track-conversion API:", error);
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
