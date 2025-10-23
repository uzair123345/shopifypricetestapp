import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import scheduler from "../services/autoRotationScheduler.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  try {
    const status = scheduler.getStatus();
    
    return json({
      success: true,
      scheduler: {
        isRunning: status.isRunning,
        hasInterval: status.hasInterval
      },
      message: status.isRunning 
        ? "Auto-rotation scheduler is running" 
        : "Auto-rotation scheduler is not running"
    });
  } catch (error) {
    console.error("Error checking scheduler status:", error);
    return json({
      success: false,
      error: "Failed to check scheduler status"
    }, { status: 500 });
  }
};


