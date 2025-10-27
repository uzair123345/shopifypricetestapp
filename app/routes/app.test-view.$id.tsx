import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form, useNavigate } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Layout,
  Badge,
  Banner,
  DataTable,
  Box,
  Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ShopifyPriceUpdater } from "../services/shopifyPriceUpdater.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const testId = parseInt(params.id!);
  
  const abTest = await db.aBTest.findUnique({
    where: { id: testId },
    include: {
      products: true,
      variants: true,
    },
  });

  if (!abTest) {
    throw new Response("Test not found", { status: 404 });
  }

  return json({ abTest });
};

// Helper function to reset prices for a specific test
async function resetTestPrices(admin: any, session: any, testId: number) {
  try {
    console.log(`🔄 Resetting prices for test ${testId}`);
    
    // Get the test with its products
    const test = await db.aBTest.findUnique({
      where: { id: testId },
      include: { products: true }
    });

    if (!test) {
      console.log(`❌ Test ${testId} not found`);
      return { success: false, message: "Test not found" };
    }

    const results = [];
    const failures = [];

    // Reset prices for each product in the test
    for (const product of test.products) {
      try {
        const variantId = await ShopifyPriceUpdater.resolveVariantGid(admin, product.productId);
        
        if (!variantId) {
          console.error(`❌ Could not resolve variant ID for product ${product.productId}`);
          failures.push({ productId: product.productId, error: "Could not resolve variant ID" });
          continue;
        }

        const result = await ShopifyPriceUpdater.updateProductPrice(
          admin,
          session.shop,
          product.productId,
          variantId,
          product.basePrice
        );

        if (result.success) {
          console.log(`✅ Reset product ${product.productId} to $${product.basePrice}`);
          results.push({ productId: product.productId, price: product.basePrice });
        } else {
          console.error(`❌ Failed to reset product ${product.productId}:`, result.message);
          failures.push({ productId: product.productId, error: result.message });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error resetting product ${product.productId}:`, msg);
        failures.push({ productId: product.productId, error: msg });
      }
    }

    return {
      success: failures.length === 0,
      message: failures.length === 0 
        ? `Successfully reset ${results.length} products` 
        : `Reset ${results.length} products, ${failures.length} failed`,
      results,
      failures
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error resetting test ${testId}:`, msg);
    return { success: false, message: msg };
  }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);
  
  const testId = parseInt(params.id!);
  const formData = await request.formData();
  const actionType = formData.get("action") as string;

  try {
    if (actionType === "start") {
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "active",
          startedAt: new Date(),
        },
      });
    } else if (actionType === "pause") {
      // Reset prices to original values when pausing
      console.log(`🔄 Pausing test ${testId} - resetting prices to original values`);
      const resetResult = await resetTestPrices(admin, session, testId);
      console.log(`Reset result:`, resetResult);
      
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "paused",
        },
      });
    } else if (actionType === "resume") {
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "active",
        },
      });
    } else if (actionType === "delete") {
      // Reset prices to original values before deleting
      console.log(`🔄 Deleting test ${testId} - resetting prices to original values`);
      const resetResult = await resetTestPrices(admin, session, testId);
      console.log(`Reset result:`, resetResult);
      
      // Delete the test and all related data
      await db.aBTest.delete({
        where: { id: testId },
      });
      
      // Get all auth query params from original request to preserve context
      const url = new URL(request.url);
      const query = new URLSearchParams(url.search);
      
      // Remove any test-specific params, keep auth params
      query.delete("action");
      query.delete("testId");
      
      const queryString = query.toString();
      const redirectUrl = `/app/tests${queryString ? `?${queryString}` : ""}`;
      
      console.log("🔄 Redirecting after delete to:", redirectUrl);
      return redirect(redirectUrl);
    }

    // Preserve auth context for all other redirects
    const url = new URL(request.url);
    const query = new URLSearchParams(url.search);
    query.delete("action"); // Remove action param
    
    const queryString = query.toString();
    const redirectUrl = `/app/test-view/${testId}${queryString ? `?${queryString}` : ""}`;
    
    console.log("🔄 Redirecting to:", redirectUrl);
    return redirect(redirectUrl);
  } catch (error) {
    console.error("Error updating test:", error);
    return json({ error: "Failed to update test" }, { status: 500 });
  }
};

export default function TestView() {
  const { abTest } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const isSubmitting = navigation.state === "submitting";
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    setShowDeleteModal(false);
    // Submit the hidden form
    const form = document.getElementById('delete-form') as HTMLFormElement;
    if (form) {
      form.submit();
    }
  }, []);

  if (!abTest) {
    return (
      <Page>
        <TitleBar title="Error" />
        <Card>
          <Text>Test data not found!</Text>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title={`Test: ${abTest.title}`} />
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <BlockStack gap="200">
                    <InlineStack gap="200" align="start">
                      <Text as="h1" variant="headingLg">
                        {abTest.title}
                      </Text>
                      <Badge tone={abTest.status === "active" ? "success" : abTest.status === "draft" ? "info" : "warning"}>
                        {abTest.status}
                      </Badge>
                    </InlineStack>
                    {abTest.description && (
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {abTest.description}
                      </Text>
                    )}
                  </BlockStack>
                  <InlineStack gap="200">
                    {abTest.status === "draft" && (
                      <Form method="post">
                        <input type="hidden" name="action" value="start" />
                        <Button
                          variant="primary"
                          submit
                          loading={isSubmitting}
                        >
                          Start Test
                        </Button>
                      </Form>
                    )}
                    {abTest.status === "active" && (
                      <Form method="post">
                        <input type="hidden" name="action" value="pause" />
                        <Button
                          variant="secondary"
                          submit
                          loading={isSubmitting}
                        >
                          Pause Test
                        </Button>
                      </Form>
                    )}
                    {abTest.status === "paused" && (
                      <Form method="post">
                        <input type="hidden" name="action" value="resume" />
                        <Button
                          variant="primary"
                          submit
                          loading={isSubmitting}
                        >
                          Resume Test
                        </Button>
                      </Form>
                    )}
                    <Button
                      variant="critical"
                      onClick={handleDeleteClick}
                      destructive
                    >
                      Delete Test
                    </Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {abTest.testType === "multiple" ? (
          // Multiple product test - show each product separately
          <BlockStack gap="400">
            {abTest.products.map((product, productIndex) => {
              // Get variants for this specific product
              const productVariants = abTest.variants.filter(variant => variant.variantProductId === product.productId);
              
              // Find the base variant (original price) for this product
              const baseVariant = productVariants.find(variant => variant.isBaseVariant);
              const testVariants = productVariants.filter(variant => !variant.isBaseVariant);
              
              return (
                <Layout key={product.id}>
                  <Layout.Section>
                    <Card>
                      <BlockStack gap="400">
                        <Text as="h2" variant="headingMd">{product.productTitle} ({productIndex + 1} of {abTest.products.length})</Text>
                        
                        <DataTable
                          columnContentTypes={['text', 'text', 'text']}
                          headings={['Product', 'Original Price', 'Traffic %']}
                          rows={[[
                            product.productTitle,
                            `$${product.basePrice.toFixed(2)}`,
                            `${(() => {
                              // For multiple product tests, calculate base traffic percentage
                              // Base traffic = 100% - sum of all variant traffic percentages
                              const variantTrafficSum = productVariants.reduce((sum, variant) => sum + variant.trafficPercent, 0);
                              const baseTrafficPercent = Math.max(0, 100 - variantTrafficSum);
                              return baseTrafficPercent;
                            })()}%`
                          ]]}
                        />

                        <Text as="h3" variant="headingMd">Test Variants</Text>
                        <BlockStack gap="300">
                          {/* Show base variant first */}
                          {baseVariant && (
                            <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                              <BlockStack gap="200">
                                <InlineStack align="space-between">
                                  <Text as="h3" variant="headingSm">Base Price</Text>
                                  <Badge tone="info">Base Variant</Badge>
                                </InlineStack>
                                <InlineStack gap="400">
                                  <Text as="p" variant="bodyMd">
                                    <strong>Price:</strong> ${baseVariant.price.toFixed(2)}
                                  </Text>
                                  <Text as="p" variant="bodyMd">
                                    <strong>Discount:</strong> {baseVariant.discount}%
                                  </Text>
                                  <Text as="p" variant="bodyMd">
                                    <strong>Traffic:</strong> {baseVariant.trafficPercent}%
                                  </Text>
                                </InlineStack>
                              </BlockStack>
                            </Box>
                          )}
                          
                          {/* Show test variants */}
                          {testVariants.map((variant, index) => (
                            <Box key={index} padding="400" background="bg-surface-secondary" borderRadius="200">
                              <BlockStack gap="200">
                                <InlineStack align="space-between">
                                  <Text as="h3" variant="headingSm">Test Variant {index + 1}</Text>
                                </InlineStack>
                                <InlineStack gap="400">
                                  <Text as="p" variant="bodyMd">
                                    <strong>Price:</strong> ${variant.price.toFixed(2)}
                                  </Text>
                                  <Text as="p" variant="bodyMd">
                                    <strong>Discount:</strong> {variant.discount}%
                                  </Text>
                                  <Text as="p" variant="bodyMd">
                                    <strong>Traffic:</strong> {variant.trafficPercent}%
                                  </Text>
                                </InlineStack>
                              </BlockStack>
                            </Box>
                          ))}
                        </BlockStack>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>
              );
            })}
          </BlockStack>
        ) : (
          // Single product test - show in original format
          <>
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Test Details</Text>

                    <DataTable
                      columnContentTypes={['text', 'text', 'text']}
                      headings={['Product', 'Original Price', 'Traffic %']}
                      rows={abTest.products.map((product, index) => {
                        return [
                          product.productTitle,
                          `$${product.basePrice.toFixed(2)}`,
                          `${abTest.baseTrafficPercent}%`
                        ];
                      })}
                    />
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>

            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Test Variants</Text>

                    <BlockStack gap="300">
                      {abTest.variants.map((variant, index) => (
                        <Box key={index} padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text as="h3" variant="headingSm">Test Variant {index + 1}</Text>
                              {variant.isBaseVariant && (
                                <Badge tone="info">Base Variant</Badge>
                              )}
                            </InlineStack>
                            <InlineStack gap="400">
                              <Text as="p" variant="bodyMd">
                                <strong>Price:</strong> ${variant.price.toFixed(2)}
                              </Text>
                              <Text as="p" variant="bodyMd">
                                <strong>Discount:</strong> {variant.discount}%
                              </Text>
                              <Text as="p" variant="bodyMd">
                                <strong>Traffic:</strong> {variant.trafficPercent}%
                              </Text>
                            </InlineStack>
                          </BlockStack>
                        </Box>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </>
        )}

        <Layout>
          <Layout.Section>
            <InlineStack align="end">
              <Button onClick={() => navigate("/app/tests")} variant="secondary">
                Back to Tests
              </Button>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal
        open={showDeleteModal}
        onClose={handleDeleteCancel}
        title="Delete Test"
        primaryAction={{
          content: "Delete Test",
          destructive: true,
          onAction: handleDeleteConfirm,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleDeleteCancel,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">
              Are you sure you want to delete the test "{abTest.title}"?
            </Text>
            <Text as="p" tone="subdued">
              This action cannot be undone. All test data including products, variants, and results will be permanently removed.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Hidden form for actual deletion */}
      {showDeleteModal && (
        <Form method="post" id="delete-form" style={{ display: 'none' }}>
          <input type="hidden" name="action" value="delete" />
        </Form>
      )}
    </Page>
  );
}

