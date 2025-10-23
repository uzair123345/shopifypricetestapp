import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
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
    const scriptTags = responseJson.data?.scriptTags?.edges.map((edge: any) => edge.node) || [];

    console.log("Currently installed script tags:", JSON.stringify(scriptTags, null, 2));

    return json({ success: true, scriptTags });
  } catch (error) {
    console.error("Error listing script tags:", error);
    return json({ success: false, error: "Failed to list script tags" }, { status: 500 });
  }
};
