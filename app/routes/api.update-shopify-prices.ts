import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ShopifyPriceUpdater } from "../services/shopifyPriceUpdater.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🎯 Manual price rotation triggered");
    
    // Rotate all active test prices using the authenticated Admin client
    const result = await ShopifyPriceUpdater.rotateAllActiveTests(admin);

    if (result && (result as any).success !== false) {
      return json({ 
        success: true, 
        message: "Shopify prices updated successfully",
        rotatedTests: (result as any).rotatedTests ?? 0,
        failures: (result as any).failures || []
      });
    }

    const failures = (result as any)?.failures || [];
    const errText = (result as any)?.error || (failures[0]?.message ? `First error: ${failures[0].message}` : "Rotation did not complete");
    return json({
      success: false,
      error: errText,
      rotatedTests: (result as any)?.rotatedTests ?? 0,
      failures
    }, { status: 200 });
  } catch (error: any) {
    try {
      if (error && typeof error === 'object' && 'text' in error && typeof error.text === 'function') {
        const body = await (error as Response).text();
        console.error("Error updating Shopify prices (Response):", body);
        return json({ success: false, error: `Failed to update Shopify prices: ${body}` }, { status: 500 });
      }
    } catch {}
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error updating Shopify prices:", msg);
    return json({ success: false, error: `Failed to update Shopify prices: ${msg}` }, { status: 500 });
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
