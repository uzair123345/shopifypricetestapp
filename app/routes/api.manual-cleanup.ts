import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    console.log("🎯 Starting manual script tag cleanup...");
    
    const { admin } = await authenticate.admin(request);
    console.log("✅ Authentication successful");

    // Get all script tags
    const listResponse = await admin.rest.get({
      path: 'script_tags',
    });

    const scriptTags = await listResponse.json();
    console.log("📋 Found script tags:", scriptTags.script_tags?.length || 0);

    // Filter for ab-price-test script tags
    const abTestScriptTags = scriptTags.script_tags.filter((tag: any) => 
      tag.src && tag.src.includes('ab-price-test')
    );

    console.log("🎯 Found A/B test script tags:", abTestScriptTags.length);
    
    let deletedCount = 0;
    const errors = [];

    // Delete each script tag
    for (const scriptTag of abTestScriptTags) {
      try {
        console.log(`🗑️ Deleting script tag ID: ${scriptTag.id}, src: ${scriptTag.src}`);
        
        await admin.rest.delete({
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

    console.log("🎉 Manual cleanup result:", result);
    return json(result);

  } catch (error) {
    console.error("💥 Error in manual cleanup:", error);
    return json({ 
      success: false, 
      error: "Failed to cleanup script tags",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const loader = async ({ request }: ActionFunctionArgs) => {
  return json({ message: "Manual cleanup endpoint ready" });
};


