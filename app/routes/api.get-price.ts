import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getDisplayPrice } from "../services/abTestService.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { productId, originalPrice, sessionId, customerId, shop } = body;

    if (!productId || !originalPrice || !sessionId || !shop) {
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

    return json(priceData);
  } catch (error) {
    console.error("Error in get-price API:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};



