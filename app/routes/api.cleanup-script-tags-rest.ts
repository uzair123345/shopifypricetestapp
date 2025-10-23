import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    console.log("Starting script tag cleanup using GraphQL...");

    // First, list all script tags using GraphQL
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
    console.log("GraphQL response:", JSON.stringify(listJson, null, 2));

    const scriptTags = listJson.data?.scriptTags?.edges.map((edge: any) => edge.node) || [];
    console.log("Found script tags:", scriptTags.length);

    // Find all script tags that contain "ab-price-test"
    const abTestScripts = scriptTags.filter((tag: any) => 
      tag.src && tag.src.includes('ab-price-test')
    );

    console.log("Found A/B test script tags:", abTestScripts.length);
    console.log("A/B test script details:", abTestScripts.map((s: any) => ({ id: s.id, src: s.src })));
    
    let deletedCount = 0;
    const errors = [];

    // Delete all A/B test script tags using GraphQL
    for (const script of abTestScripts) {
      try {
        console.log(`Attempting to delete script tag: ${script.id} (${script.src})`);
        
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
        console.log(`Delete response for ${script.id}:`, JSON.stringify(deleteJson, null, 2));

        if (deleteJson.data?.scriptTagDelete?.userErrors?.length > 0) {
          console.error(`GraphQL errors for ${script.id}:`, deleteJson.data.scriptTagDelete.userErrors);
          errors.push({ 
            id: script.id, 
            error: deleteJson.data.scriptTagDelete.userErrors.map((e: any) => e.message).join(', ')
          });
        } else {
          deletedCount++;
          console.log(`Successfully deleted script tag: ${script.id}`);
        }
      } catch (error) {
        console.error(`Error deleting script tag ${script.id}:`, error);
        errors.push({ 
          id: script.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const result = {
      success: true,
      message: `Cleaned up ${deletedCount} script tags`,
      deletedCount,
      totalFound: abTestScripts.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log("Cleanup result:", result);

    return json(result);

  } catch (error) {
    console.error("Error cleaning up script tags:", error);
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
