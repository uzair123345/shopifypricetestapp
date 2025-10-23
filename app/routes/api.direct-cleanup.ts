import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    console.log("🎯 Starting REST API script tag cleanup...");

    // First, get all script tags to see what we're working with
    const listResponse = await admin.rest.get({
      path: 'script_tags',
    });

    const scriptTags = await listResponse.json();
    console.log("📋 Found script tags:", scriptTags);

    // Filter for ab-price-test script tags
    const abTestScriptTags = scriptTags.script_tags.filter((tag: any) => 
      tag.src && tag.src.includes('ab-price-test')
    );

    console.log("🎯 Found A/B test script tags:", abTestScriptTags);
    
    let deletedCount = 0;
    const errors = [];

    // Delete each script tag using REST API
    for (const scriptTag of abTestScriptTags) {
      try {
        console.log(`🗑️ Deleting script tag ID: ${scriptTag.id}, src: ${scriptTag.src}`);
        
        const deleteResponse = await admin.rest.delete({
          path: `script_tags/${scriptTag.id}`,
        });

        console.log(`✅ Successfully deleted script tag: ${scriptTag.id}`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Error deleting script tag ${scriptTag.id}:`, error);
        errors.push({ 
          id: scriptTag.id, 
          src: scriptTag.src,
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const result = {
      success: true,
      message: `Cleaned up ${deletedCount} out of ${abTestScriptTags.length} A/B test script tags`,
      deletedCount,
      totalFound: abTestScriptTags.length,
      errors: errors.length > 0 ? errors : undefined,
      details: {
        foundScriptTags: abTestScriptTags.map(tag => ({ id: tag.id, src: tag.src })),
        deletedCount,
        failedDeletions: errors
      }
    };

    console.log("🎉 Cleanup result:", result);

    return json(result);

  } catch (error) {
    console.error("💥 Error in REST cleanup:", error);
    return json({ 
      success: false, 
      error: "Failed to cleanup script tags",
      details: error instanceof Error ? error.message : 'Unknown error'
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

