import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // First, list all script tags
    const listResponse = await admin.graphql(
      `#graphql
      query getScriptTags {
        scriptTags(first: 50) {
          edges {
            node {
              id
              src
              displayScope
            }
          }
        }
      }`
    );

    const listJson = await listResponse.json();
    const scriptTags = listJson.data?.scriptTags?.edges.map((edge: any) => edge.node) || [];

    console.log("Found script tags:", scriptTags.length);

    // Find all script tags that contain "ab-price-test" (both old and new)
    const abTestScripts = scriptTags.filter(tag => 
      tag.src && tag.src.includes('ab-price-test')
    );

    console.log("Found A/B test script tags:", abTestScripts.length);
    
    let deletedCount = 0;
    const errors = [];

    // Delete all A/B test script tags
    for (const script of abTestScripts) {
      try {
        const deleteResponse = await admin.graphql(
          `#graphql
          mutation scriptTagDelete($id: ID!) {
            scriptTagDelete(id: $id) {
              deletedScriptTagId
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              id: script.id
            }
          }
        );

        const deleteJson = await deleteResponse.json();
        console.log(`Delete response for ${script.id}:`, deleteJson);

        if (deleteJson.data?.scriptTagDelete?.userErrors?.length > 0) {
          console.error(`GraphQL errors for ${script.id}:`, deleteJson.data.scriptTagDelete.userErrors);
          errors.push({ 
            id: script.id, 
            error: deleteJson.data.scriptTagDelete.userErrors.map((e: any) => e.message).join(', ')
          });
        } else {
          deletedCount++;
          console.log(`Successfully deleted script tag: ${script.id} (${script.src})`);
        }
      } catch (error) {
        console.error(`Error deleting script tag ${script.id}:`, error);
        errors.push({ id: script.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return json({ 
      success: true, 
      message: `Cleaned up ${deletedCount} script tags`,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Error cleaning up script tags:", error);
    return json({ 
      success: false, 
      error: "Failed to cleanup script tags" 
    }, { status: 500 });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
