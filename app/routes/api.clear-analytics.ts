import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    console.log("🗑️ Clearing all analytics data for shop:", session.shop);

    // Delete all view events for this shop
    const deletedViews = await db.viewEvent.deleteMany({
      where: { shop: session.shop }
    });

    // Delete all conversion events for this shop
    const deletedConversions = await db.conversionEvent.deleteMany({
      where: { shop: session.shop }
    });

    console.log(`✅ Deleted ${deletedViews.count} view events and ${deletedConversions.count} conversion events`);

    return json({ 
      success: true, 
      message: `Successfully cleared analytics data. Deleted ${deletedViews.count} views and ${deletedConversions.count} conversions.`,
      deletedViews: deletedViews.count,
      deletedConversions: deletedConversions.count
    });
  } catch (error) {
    console.error("❌ Error clearing analytics data:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
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





