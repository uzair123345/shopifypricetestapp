import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    console.log("🔍 Checking active tests...");
    
    const activeTests = await db.aBTest.findMany({
      where: { status: "active" },
      include: { variants: true },
    });

    console.log(`Found ${activeTests.length} active tests`);
    
    return json({
      success: true,
      activeTestsCount: activeTests.length,
      tests: activeTests.map(test => ({
        id: test.id,
        name: test.name,
        productId: test.productId,
        status: test.status,
        variantsCount: test.variants.length,
        variants: test.variants.map(v => ({
          id: v.id,
          variantId: v.variantId,
          variantProductId: v.variantProductId,
          finalPrice: v.finalPrice,
          name: v.name
        }))
      }))
    });
  } catch (error) {
    console.error("Error checking tests:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const loader = async ({ request }: ActionFunctionArgs) => {
  return json({ message: "Test check endpoint ready" });
};
