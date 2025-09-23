import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  Box,
  Divider,
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

export default function TestDetail() {
  const { abTest } = useLoaderData<typeof loader>();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge>Draft</Badge>;
      case "active":
        return <Badge tone="success">Active</Badge>;
      case "paused":
        return <Badge tone="warning">Paused</Badge>;
      case "completed":
        return <Badge tone="info">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const variantRows = abTest.variants.map((variant) => [
    variant.variantName,
    `$${variant.price.toFixed(2)}`,
    variant.discount ? `$${variant.discount.toFixed(2)}` : "-",
    `${variant.trafficPercent}%`,
  ]);

  return (
    <Page>
      <TitleBar title={`Test: ${abTest.title}`} />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <InlineStack align="space-between">
              <BlockStack gap="200">
                <Text as="h1" variant="headingLg">
                  {abTest.title}
                </Text>
                <InlineStack gap="200">
                  {getStatusBadge(abTest.status)}
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {abTest.testType === "single" ? "Single Product" : "Multiple Product"} Test
                  </Text>
                </InlineStack>
              </BlockStack>
              <InlineStack gap="200">
                <Button url="/app/tests" variant="secondary">
                  Back to Tests
                </Button>
                {abTest.status === "draft" && (
                  <Button variant="primary">
                    Start Test
                  </Button>
                )}
                {abTest.status === "active" && (
                  <Button variant="secondary">
                    Pause Test
                  </Button>
                )}
              </InlineStack>
            </InlineStack>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Test Overview
                </Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd">Status:</Text>
                    {getStatusBadge(abTest.status)}
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd">Type:</Text>
                    <Text as="p" variant="bodyMd">{abTest.testType}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd">Created:</Text>
                    <Text as="p" variant="bodyMd">{new Date(abTest.createdAt).toLocaleDateString()}</Text>
                  </InlineStack>
                  {abTest.startedAt && (
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd">Started:</Text>
                      <Text as="p" variant="bodyMd">{new Date(abTest.startedAt).toLocaleDateString()}</Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Products
                </Text>
                {abTest.products.map((product) => (
                  <Box key={product.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        {product.productTitle}
                      </Text>
                      <InlineStack gap="400">
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Handle: {product.productHandle}
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Base Price: ${product.basePrice.toFixed(2)}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Price Variants & Traffic Distribution
                </Text>

                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="bold">
                      Base Price (Original)
                    </Text>
                    <InlineStack gap="400">
                      <Text as="p" variant="bodyMd">${abTest.basePrice.toFixed(2)}</Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {abTest.baseTrafficPercent}% of traffic
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {abTest.variants.length > 0 && (
                  <>
                    <Divider />
                    <DataTable
                      columnContentTypes={['text', 'text', 'text', 'text']}
                      headings={['Variant Name', 'Price', 'Discount', 'Traffic %']}
                      rows={variantRows}
                    />
                  </>
                )}

                <Box padding="300" background="bg-surface-info" borderRadius="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd" fontWeight="bold">
                      Total Traffic Distribution:
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="bold">
                      {abTest.totalTrafficPercent}%
                    </Text>
                  </InlineStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
