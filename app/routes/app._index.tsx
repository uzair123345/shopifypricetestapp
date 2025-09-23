import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, Link as RemixLink, useLoaderData, useLocation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get test statistics from database
  const activeTests = await db.aBTest.count({
    where: { 
      shop: session.shop,
      status: "active" 
    },
  });

  const totalTests = await db.aBTest.count({
    where: { shop: session.shop },
  });

  const completedTests = await db.aBTest.count({
    where: { 
      shop: session.shop,
      status: "completed" 
    },
  });

  const productsUnderTest = await db.aBTestProduct.count({
    where: {
      abTest: {
        shop: session.shop,
        status: { in: ["active", "paused"] }
      }
    },
  });

  return json({
    stats: {
      activeTests,
      totalTests,
      completedTests,
      productsUnderTest,
    }
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const { stats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const location = useLocation();

  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  return (
    <Page>
      <TitleBar title="AB Test Price Optimizer" />
      <BlockStack gap="500">
        {/* Main Header */}
        <Layout>
          <Layout.Section>
            <BlockStack gap="300">
              <InlineStack gap="200" align="start">
                <Box padding="200">
                  <Icon source="analytics" />
                </Box>
                <BlockStack gap="100">
                  <Text as="h1" variant="headingLg">
                    AB Test Price Optimizer
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Optimize your product prices with data-driven A/B testing
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* Main Content Layout */}
        <Layout>
          {/* Getting Started Section */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" align="start">
                  <Box padding="200">
                    <Icon source="rocket" />
                  </Box>
                  <Text as="h2" variant="headingMd">
                    Getting Started
                  </Text>
                </InlineStack>
                <Text variant="bodyMd" as="p">
                  Welcome to AB Test Price Optimizer! Here's how to get started:
                </Text>
                <List type="number">
                  <List.Item>Set up your first price test for a product</List.Item>
                  <List.Item>Configure test parameters and target audience</List.Item>
                  <List.Item>Monitor results and optimize based on data</List.Item>
                </List>
                <Button
                  variant="primary"
                  size="large"
                  url={`/app/tests/create${location.search}`}
                >
                  Create Your First Test
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Feature Cards */}
          <Layout.Section>
            <BlockStack gap="400">
              <Layout>
                <Layout.Section variant="oneThird">
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack gap="200" align="start">
                        <Box padding="200">
                          <Icon source="checkmark" />
                        </Box>
                        <BlockStack gap="100">
                          <Text as="h3" variant="headingMd">
                            Active Tests
                          </Text>
                          <Text variant="bodyMd" as="p" tone="subdued">
                            Create and manage your price A/B tests
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      <Button variant="secondary" url="/app/tests">
                        View Tests
                      </Button>
                    </BlockStack>
                  </Card>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack gap="200" align="start">
                        <Box padding="200">
                          <Icon source="analytics" />
                        </Box>
                        <BlockStack gap="100">
                          <Text as="h3" variant="headingMd">
                            Analytics
                          </Text>
                          <Text variant="bodyMd" as="p" tone="subdued">
                            View test results and performance metrics
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      <Button variant="secondary" url="/app/analytics">
                        View Analytics
                      </Button>
                    </BlockStack>
                  </Card>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack gap="200" align="start">
                        <Box padding="200">
                          <Icon source="products" />
                        </Box>
                        <BlockStack gap="100">
                          <Text as="h3" variant="headingMd">
                            Products
                          </Text>
                          <Text variant="bodyMd" as="p" tone="subdued">
                            Manage products available for testing
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      <Button variant="secondary" url="/app/products">
                        View Products
                      </Button>
                    </BlockStack>
                  </Card>
                </Layout.Section>
              </Layout>

              {/* Quick Overview Section */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Quick Overview
                  </Text>
                  <Layout>
                    <Layout.Section variant="oneThird">
                      <BlockStack gap="200" align="center">
                        <Text as="h3" variant="headingLg">
                          {stats.activeTests}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Active Tests
                        </Text>
                      </BlockStack>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <BlockStack gap="200" align="center">
                        <Text as="h3" variant="headingLg">
                          {stats.productsUnderTest}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Products Under Test
                        </Text>
                      </BlockStack>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <BlockStack gap="200" align="center">
                        <Text as="h3" variant="headingLg">
                          {stats.completedTests}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Completed Tests
                        </Text>
                      </BlockStack>
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
