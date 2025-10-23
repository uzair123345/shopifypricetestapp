import { useState } from "react";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import {
  Card,
  Button,
  Text,
  Banner,
  Layout,
  Page,
  Spinner,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    console.log("🎯 Starting script tag cleanup (GraphQL)...");

    // Query up to 100 script tags via GraphQL
    const listResponse = await admin.graphql(
      `#graphql
      query listScriptTags($first: Int!) {
        scriptTags(first: $first) {
          edges {
            node { id src }
          }
        }
      }`,
      { variables: { first: 100 } }
    );

    const listJson = await listResponse.json();
    const allTags = (listJson?.data?.scriptTags?.edges || []).map((e: any) => e.node);
    console.log("📋 Found script tags:", allTags.length);

    // Only target the legacy storefront script, NOT the new simple analytics script
    const abTestScriptTags = allTags.filter(
      (tag: any) => tag.src && tag.src.includes('ab-price-test.js')
    );
    console.log("🎯 Found A/B test script tags:", abTestScriptTags.length);

    let deletedCount = 0;
    const errors: Array<{id: string; src?: string; error: string}> = [];

    for (const tag of abTestScriptTags) {
      try {
        const delResp = await admin.graphql(
          `#graphql
          mutation deleteScriptTag($id: ID!) {
            scriptTagDelete(id: $id) {
              deletedScriptTagId
              userErrors { field message }
            }
          }`,
          { variables: { id: tag.id } }
        );
        const delJson = await delResp.json();
        const userErrors = delJson?.data?.scriptTagDelete?.userErrors || [];
        if (userErrors.length > 0) {
          errors.push({ id: tag.id, src: tag.src, error: userErrors.map((e: any) => e.message).join(', ') });
          console.warn('❌ GraphQL userErrors for', tag.id, userErrors);
        } else {
          deletedCount++;
          console.log(`✅ Successfully deleted script tag: ${tag.id}`);
        }
      } catch (error) {
        errors.push({ id: tag.id, src: tag.src, error: error instanceof Error ? error.message : 'Unknown error' });
        console.error(`❌ Error deleting script tag ${tag.id}:`, error);
      }
    }

    const result = {
      success: true,
      message: `Cleaned up ${deletedCount} out of ${abTestScriptTags.length} A/B test script tags`,
      deletedCount,
      totalFound: abTestScriptTags.length,
      errors: errors.length > 0 ? errors : undefined,
      details: {
        foundScriptTags: abTestScriptTags.map((t: any) => ({ id: t.id, src: t.src })),
        deletedCount,
        failedDeletions: errors,
      },
    };

    console.log("🎉 Cleanup result:", result);

    return json({
      success: true,
      message: `Successfully cleaned up ${result.deletedCount} script tags!`,
      deletedCount: result.deletedCount,
      errors: result.errors,
      details: result.details,
    });
  } catch (error) {
    console.error("💥 Error cleaning up script tags (GraphQL):", error);
    return json({ 
      success: false, 
      message: "An error occurred while cleaning up script tags.",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export default function CleanupScripts() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="Cleanup Script Tags"
      subtitle="Remove all old A/B testing script tags that are causing errors"
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text variant="headingMd" as="h2">
                Script Tag Cleanup
              </Text>
              <div style={{ marginTop: "16px", marginBottom: "20px" }}>
                <Text variant="bodyMd" as="p">
                  The console errors you're seeing are caused by multiple old script tags 
                  trying to load the deleted `ab-price-test.js` file from expired Cloudflare URLs.
                </Text>
                <Text variant="bodyMd" as="p">
                  Click the button below to remove ALL A/B testing script tags and start fresh.
                </Text>
              </div>
              
              {actionData && (
                <div style={{ marginBottom: "20px" }}>
                  <Banner
                    status={actionData.success ? "success" : "critical"}
                    title={actionData.message}
                  />
                  {actionData.deletedCount && (
                    <div style={{ marginTop: "10px" }}>
                      <Text variant="bodyMd" as="p">
                        Removed {actionData.deletedCount} script tags.
                      </Text>
                    </div>
                  )}
                  {actionData.errors && actionData.errors.length > 0 && (
                    <div style={{ marginTop: "10px" }}>
                      <Text variant="bodyMd" as="p">Some errors occurred:</Text>
                      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                        {JSON.stringify(actionData.errors, null, 2)}
                      </pre>
                    </div>
                  )}
                  {actionData.details && (
                    <div style={{ marginTop: "10px" }}>
                      <Text variant="bodyMd" as="p">Details:</Text>
                      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                        {JSON.stringify(actionData.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              
              <Form method="post">
                <Button
                  submit
                  primary
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Cleaning Up..." : "Cleanup All Script Tags"}
                </Button>
              </Form>
              
              {isSubmitting && (
                <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Spinner size="small" />
                  <Text variant="bodySm" as="span">
                    Removing all A/B testing script tags...
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text variant="headingMd" as="h2">
                What This Will Do
              </Text>
              <div style={{ marginTop: "16px" }}>
                <BlockStack gap="4">
                  <Text variant="bodyMd" as="p">
                    • Remove ALL script tags containing "ab-price-test"
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Stop the console errors from expired URLs
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Allow you to install the new script cleanly
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Fix the price update issues
                  </Text>
                </BlockStack>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
