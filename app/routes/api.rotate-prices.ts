import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { PriceRotationService } from "../services/priceRotationService.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    // Rotate prices
    await PriceRotationService.rotatePrices();
    
    return json({ 
      success: true, 
      message: "Prices rotated successfully" 
    });
  } catch (error) {
    console.error("Error rotating prices:", error);
    return json({ 
      success: false, 
      error: "Failed to rotate prices" 
    }, { status: 500 });
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
