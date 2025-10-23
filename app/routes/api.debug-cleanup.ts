import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    console.log("🔍 Step 1: Testing authentication...");
    
    // Test authentication step by step
    let admin;
    try {
      admin = await authenticate.admin(request);
      console.log("✅ Authentication successful");
    } catch (authError) {
      console.error("❌ Authentication failed:", authError);
      return json({ 
        success: false, 
        error: "Authentication failed",
        details: authError instanceof Error ? authError.message : 'Unknown auth error'
      }, { status: 401 });
    }

    console.log("🔍 Step 2: Testing REST API access...");
    
    // Test REST API access
    let scriptTags;
    try {
      const listResponse = await admin.rest.get({
        path: 'script_tags',
      });
      scriptTags = await listResponse.json();
      console.log("✅ REST API access successful");
      console.log("📋 Script tags count:", scriptTags.script_tags?.length || 0);
    } catch (apiError) {
      console.error("❌ REST API access failed:", apiError);
      return json({ 
        success: false, 
        error: "REST API access failed",
        details: apiError instanceof Error ? apiError.message : 'Unknown API error'
      }, { status: 500 });
    }

    console.log("🔍 Step 3: Filtering A/B test script tags...");
    
    // Filter for ab-price-test script tags
    const abTestScriptTags = scriptTags.script_tags.filter((tag: any) => 
      tag.src && tag.src.includes('ab-price-test')
    );

    console.log("✅ Found A/B test script tags:", abTestScriptTags.length);

    return json({
      success: true,
      message: "Debug test successful - all steps passed",
      steps: {
        authentication: "✅ Passed",
        restApiAccess: "✅ Passed", 
        filtering: "✅ Passed"
      },
      data: {
        totalScriptTags: scriptTags.script_tags.length,
        abTestScriptTags: abTestScriptTags.length,
        abTestTags: abTestScriptTags.map((tag: any) => ({
          id: tag.id,
          src: tag.src
        }))
      }
    });

  } catch (error) {
    console.error("💥 Unexpected error in debug test:", error);
    return json({ 
      success: false, 
      error: "Unexpected error",
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
};

export const loader = async ({ request }: ActionFunctionArgs) => {
  return json({ message: "Debug endpoint ready - use POST to test" });
};