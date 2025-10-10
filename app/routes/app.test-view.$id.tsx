import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form, useNavigate } from "@remix-run/react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

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

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  
  const testId = parseInt(params.id!);
  const formData = await request.formData();
  const action = formData.get("action") as string;

  try {
    if (action === "start") {
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "active",
          startedAt: new Date(),
        },
      });
    } else if (action === "pause") {
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "paused",
        },
      });
    } else if (action === "resume") {
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "active",
        },
      });
    }

    return redirect(`/app/test-view/${testId}`);
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
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Test Details</Text>

                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text']}
                  headings={['Product', 'Original Price', 'Test Price', 'Traffic %']}
                  rows={abTest.products.map((product, index) => {
                    const variant = abTest.variants[index] || abTest.variants[0];
                    return [
                      product.productTitle,
                      `$${product.basePrice.toFixed(2)}`,
                      variant ? `$${variant.price.toFixed(2)}` : 'N/A',
                      variant ? `${variant.trafficPercent}%` : 'N/A'
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
                          <Text as="h3" variant="headingSm">{variant.variantName}</Text>
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
    </Page>
  );
}

