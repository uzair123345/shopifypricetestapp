import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: { request: Request }) {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔍 Checking test data in database...");
    
    // Get all tests (not just active ones)
    const allTests = await db.aBTest.findMany({
      include: { variants: true }
    });
    
    console.log(`🔍 Found ${allTests.length} total tests`);
    
    // Get active tests
    const activeTests = await db.aBTest.findMany({
      where: { status: "active" },
      include: { variants: true }
    });
    
    console.log(`🔍 Found ${activeTests.length} active tests`);
    
    return json({ 
      success: true, 
      message: "Test data retrieved",
      details: {
        totalTests: allTests.length,
        activeTestsCount: activeTests.length,
        allTests: allTests.map(test => ({
          id: test.id,
          title: test.title,
          status: test.status,
          productId: test.productId,
          variants: test.variants.map(v => ({
            id: v.id,
            variantName: v.variantName,
            variantId: v.variantId,
            variantProductId: v.variantProductId
          }))
        })),
        activeTests: activeTests.map(test => ({
          id: test.id,
          title: test.title,
          status: test.status,
          productId: test.productId,
          variants: test.variants.map(v => ({
            id: v.id,
            variantName: v.variantName,
            variantId: v.variantId,
            variantProductId: v.variantProductId
          }))
        }))
      }
    });
    
  } catch (error) {
    console.error("Error checking test data:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      details: error
    });
  }
}



