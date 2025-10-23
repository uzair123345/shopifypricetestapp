import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    console.log("Debug: Checking script tags...");

    // List all script tags using GraphQL
    const response = await admin.graphql(
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

    const responseJson = await response.json();
    console.log("Debug: Full GraphQL response:", JSON.stringify(responseJson, null, 2));

    const scriptTags = responseJson.data?.scriptTags?.edges.map((edge: any) => edge.node) || [];
    console.log("Debug: Found script tags:", scriptTags.length);

    // Find all script tags that contain "ab-price-test"
    const abTestScripts = scriptTags.filter((tag: any) => 
      tag.src && tag.src.includes('ab-price-test')
    );

    console.log("Debug: A/B test script tags found:", abTestScripts.length);
    console.log("Debug: A/B test script details:", abTestScripts);

    return json({ 
      success: true, 
      totalScriptTags: scriptTags.length,
      abTestScripts: abTestScripts,
      allScriptTags: scriptTags,
      debugInfo: {
        graphqlResponse: responseJson,
        filteredCount: abTestScripts.length,
        filterCriteria: "src contains 'ab-price-test'"
      }
    });

  } catch (error) {
    console.error("Debug: Error checking script tags:", error);
    return json({ 
      success: false, 
      error: "Failed to debug script tags",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
