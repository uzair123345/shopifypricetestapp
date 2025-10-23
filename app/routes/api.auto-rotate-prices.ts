import { authenticate } from "../shopify.server";
import { ShopifyPriceUpdater } from "../services/shopifyPriceUpdater.server";

export async function action({ request }: { request: Request }) {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔄 Starting automatic price rotation...");
    
    // Call the price updater service
    const result = await ShopifyPriceUpdater.rotateAllActiveTests(admin);
    
    console.log("📊 Auto rotation result:", result);
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.success 
        ? `Auto-updated prices for ${result.rotatedTests} tests`
        : `Auto-update failed: ${result.error}`,
      rotatedTests: result.rotatedTests,
      failures: result.failures || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error("Error in auto price rotation:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



