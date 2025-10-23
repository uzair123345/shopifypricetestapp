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
      price
    } = body;

    if (!productId || !sessionId || !shop) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Use the provided testId and variantId
    const abTestId = testId || null;
    const finalVariantId = variantId || null;

    // Store the view event in the database
    await db.viewEvent.create({
      data: {
        productId,
        variantId: finalVariantId,
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

    console.log("View tracked:", {
      productId,
      price,
      sessionId,
      customerId,
      shop,
      url,
      variantId: finalVariantId,
      abTestId
    });

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
