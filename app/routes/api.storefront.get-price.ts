import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getDisplayPrice } from "../services/abTestService.server";

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

    return json(priceData, {
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

