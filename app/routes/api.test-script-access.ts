import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔍 Testing script tag access...");
    
    // Simple test to see if we can access script tags
    const response = await admin.graphql(`
      query testScriptTags {
        scriptTags(first: 5) {
          edges {
            node {
              id
              src
            }
          }
        }
      }
    `);
    
    const data = await response.json();
    console.log("✅ Script tag test successful:", data);
    
    return json({
      success: true,
      message: "Script tag access is working",
      scriptTags: data.data?.scriptTags?.edges?.map((edge: any) => edge.node) || [],
      debug: {
        hasData: !!data.data,
        hasScriptTags: !!data.data?.scriptTags,
        edgeCount: data.data?.scriptTags?.edges?.length || 0
      }
    });
    
  } catch (error) {
    console.error("❌ Script tag test failed:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
};