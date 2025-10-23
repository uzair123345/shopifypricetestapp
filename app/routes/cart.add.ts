import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const productId = formData.get("id") as string;
    const quantity = formData.get("quantity") as string;
    const testPrice = formData.get("test_price") as string;
    const testVariant = formData.get("test_variant") as string;
    
    if (!productId) {
      return json({ error: "Product ID required" }, { status: 400 });
    }

    // Get the cart from the request
    const cartId = formData.get("cart_id") as string;
    
    // If we have a test price, we need to modify the cart item
    if (testPrice) {
      const price = parseFloat(testPrice);
      
      // Add the item to cart with the test price
      // This is a simplified approach - in production you'd want to:
      // 1. Create a cart item with the test price
      // 2. Store the original price and test variant info
      // 3. Handle checkout with the test price
      
      const cartResponse = await admin.rest.Cart.create({
        cart: {
          items: [{
            id: parseInt(productId),
            quantity: parseInt(quantity) || 1,
            properties: {
              _test_price: price.toString(),
              _test_variant: testVariant || 'Test Variant',
              _original_price: '0' // We'd need to fetch this
            }
          }]
        }
      });
      
      return json({
        success: true,
        cart: cartResponse.cart,
        test_price_applied: true,
        price: price
      });
    } else {
      // Normal cart add without test price
      const cartResponse = await admin.rest.Cart.create({
        cart: {
          items: [{
            id: parseInt(productId),
            quantity: parseInt(quantity) || 1
          }]
        }
      });
      
      return json({
        success: true,
        cart: cartResponse.cart
      });
    }
    
  } catch (error) {
    console.error("Error in cart add:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};



