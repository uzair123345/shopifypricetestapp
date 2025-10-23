import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { SimplePriceRotation } from "../services/simplePriceRotation.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log('🔄 Price rotation cron job triggered');
    
    // Trigger simple price rotation for all active tests
    await SimplePriceRotation.rotatePrices();
    
    return json({ 
      success: true, 
      message: 'Price rotation completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error during price rotation:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
};


// Optional: Add a cron job endpoint that can be called externally
export const action = async ({ request }: LoaderFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  
  // This endpoint can be called by external cron services
  return loader({ request } as LoaderFunctionArgs);
};



