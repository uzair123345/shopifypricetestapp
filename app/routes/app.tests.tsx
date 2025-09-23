import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useLocation, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Icon,
  EmptyState,
  ResourceList,
  ResourceItem,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get tests from database
  const tests = await db.aBTest.findMany({
    where: { shop: session.shop },
    include: {
      products: true,
      variants: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeTests = tests.map(test => ({
    id: test.id.toString(),
    title: test.title,
    productName: test.products[0]?.productTitle || "No Product",
    originalPrice: `$${test.basePrice.toFixed(2)}`,
    testPrice: test.variants.length > 0 ? `$${test.variants[0].price.toFixed(2)}` : "N/A",
    status: test.status,
    startDate: test.startedAt ? test.startedAt.toISOString().split('T')[0] : "Not Started",
    participants: 0, // This would come from analytics
    conversionRate: "0%", // This would come from analytics
  }));

  return json({ activeTests, shop: session.shop });
};

export default function ActiveTests() {
  const { activeTests, shop } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Check if we're in create mode
  const isCreateMode = searchParams.get("create") === "true";
  
  const searchParamsObj = new URLSearchParams(location.search);
  if (!searchParamsObj.get("shop") && shop) {
    searchParamsObj.set("shop", shop);
  }
  // Ensure we carry forward host if it exists; required for embedded apps
  const queryString = searchParamsObj.toString();
  const createUrl = `/app/tests?create=true${queryString ? `&${queryString}` : ""}`;

  // If in create mode, show the create page
  if (isCreateMode) {
    return (
      <Page>
        <TitleBar title="Create A/B Test" />
        <BlockStack gap="500">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Choose Test Type</Text>
              <InlineStack gap="400" wrap>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="start">
                      <Icon source="products" />
                      <Text as="h3" variant="headingMd">Single Product Test</Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Test different prices for a single product.
                    </Text>
                    <Button url={`/app/tests/new?type=single${location.search ? location.search : ""}`} variant="primary">
                      Continue
                    </Button>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="start">
                      <Icon source="analytics" />
                      <Text as="h3" variant="headingMd">Multiple Products Test</Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Test prices across multiple products at once.
                    </Text>
                    <Button url={`/app/tests/new?type=multiple${location.search ? location.search : ""}`}>
                      Continue
                    </Button>
                  </BlockStack>
                </Card>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Active Tests" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <InlineStack align="space-between">
              <BlockStack gap="200">
                <Text as="h1" variant="headingLg">
                  Active Tests
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Manage your price A/B tests and monitor their performance
                </Text>
              </BlockStack>
              <Button variant="primary" url={createUrl}>
                Create New Test
              </Button>
            </InlineStack>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            {activeTests.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No active tests yet"
                  action={{
                    content: "Create your first test",
                    url: createUrl,
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Start optimizing your product prices with data-driven A/B testing.</p>
                </EmptyState>
              </Card>
            ) : (
              <Card>
                <ResourceList
                  resourceName={{ singular: "test", plural: "tests" }}
                  items={activeTests}
                  renderItem={(item) => {
                    const { id, title, productName, originalPrice, testPrice, status, startDate, participants, conversionRate } = item;
                    return (
                      <ResourceItem
                        id={id}
                        url={`/app/tests/${id}`}
                        accessibilityLabel={`View details for ${title}`}
                      >
                        <InlineStack align="space-between">
                          <BlockStack gap="200">
                            <InlineStack gap="200" align="start">
                              <Text variant="bodyMd" fontWeight="bold" as="h3">
                                {title}
                              </Text>
                              <Badge tone={status === "active" ? "success" : status === "draft" ? "info" : "warning"}>
                                {status}
                              </Badge>
                            </InlineStack>
                            <InlineStack gap="400">
                              <Text as="p" variant="bodyMd" tone="subdued">
                                Product: {productName}
                              </Text>
                              <Text as="p" variant="bodyMd" tone="subdued">
                                Original: {originalPrice}
                              </Text>
                              <Text as="p" variant="bodyMd" tone="subdued">
                                Test: {testPrice}
                              </Text>
                              <Text as="p" variant="bodyMd" tone="subdued">
                                Started: {startDate}
                              </Text>
                            </InlineStack>
                          </BlockStack>
                          <BlockStack gap="200" align="end">
                            <Text as="p" variant="bodyMd" fontWeight="bold">
                              {participants} participants
                            </Text>
                            <Text as="p" variant="bodyMd" tone="subdued">
                              {conversionRate} conversion
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </ResourceItem>
                    );
                  }}
                />
              </Card>
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
