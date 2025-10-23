import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { SimplePriceRotation } from "../services/simplePriceRotation.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('🧪 Testing price rotation...');
  
  try {
    await SimplePriceRotation.rotatePrices();
    
    return json({ 
      success: true, 
      message: 'Price rotation test completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error during price rotation test:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
};
