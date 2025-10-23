import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ShopifyPriceUpdater } from "../services/shopifyPriceUpdater.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    console.log("🔄 Manual auto-rotation triggered for shop:", session.shop);
    
    // Run price rotation for this shop
    const priceUpdater = new ShopifyPriceUpdater();
    const result = await ShopifyPriceUpdater.rotateAllActiveTests(admin);
    
    console.log("✅ Manual auto-rotation completed:", result);
    
    return json({
      success: true,
      message: "Auto-rotation completed successfully",
      result: result
    });
  } catch (error) {
    console.error("❌ Manual auto-rotation error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
