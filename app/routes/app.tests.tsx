import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Mock data for now - in a real app, this would come from your database
  const activeTests = [
    {
      id: "1",
      productName: "Premium Wireless Headphones",
      originalPrice: "$199.99",
      testPrice: "$179.99",
      status: "active",
      startDate: "2024-01-15",
      participants: 1250,
      conversionRate: "12.5%",
    },
    {
      id: "2", 
      productName: "Smart Fitness Watch",
      originalPrice: "$299.99",
      testPrice: "$249.99",
      status: "paused",
      startDate: "2024-01-10",
      participants: 890,
      conversionRate: "8.2%",
    },
  ];

  return json({ activeTests });
};

export default function ActiveTests() {
  const { activeTests } = useLoaderData<typeof loader>();

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
              <Button variant="primary">
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
                    onAction: () => {},
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
                    const { id, productName, originalPrice, testPrice, status, startDate, participants, conversionRate } = item;
                    return (
                      <ResourceItem
                        id={id}
                        url={`/app/tests/${id}`}
                        accessibilityLabel={`View details for ${productName}`}
                      >
                        <InlineStack align="space-between">
                          <BlockStack gap="200">
                            <InlineStack gap="200" align="start">
                              <Text variant="bodyMd" fontWeight="bold" as="h3">
                                {productName}
                              </Text>
                              <Badge status={status === "active" ? "success" : "warning"}>
                                {status}
                              </Badge>
                            </InlineStack>
                            <InlineStack gap="400">
                              <Text variant="bodyMd" tone="subdued">
                                Original: {originalPrice}
                              </Text>
                              <Text variant="bodyMd" tone="subdued">
                                Test: {testPrice}
                              </Text>
                              <Text variant="bodyMd" tone="subdued">
                                Started: {startDate}
                              </Text>
                            </InlineStack>
                          </BlockStack>
                          <BlockStack gap="200" align="end">
                            <Text variant="bodyMd" fontWeight="bold">
                              {participants} participants
                            </Text>
                            <Text variant="bodyMd" tone="subdued">
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
