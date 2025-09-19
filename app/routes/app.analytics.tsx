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
  DataTable,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Mock analytics data
  const analyticsData = [
    {
      testId: "1",
      productName: "Premium Wireless Headphones",
      originalPrice: "$199.99",
      testPrice: "$179.99",
      status: "completed",
      duration: "14 days",
      participants: 1250,
      originalConversions: 156,
      testConversions: 189,
      originalConversionRate: "12.5%",
      testConversionRate: "15.1%",
      improvement: "+20.8%",
      revenueImpact: "+$2,340",
    },
    {
      testId: "2",
      productName: "Smart Fitness Watch", 
      originalPrice: "$299.99",
      testPrice: "$249.99",
      status: "completed",
      duration: "21 days",
      participants: 890,
      originalConversions: 73,
      testConversions: 98,
      originalConversionRate: "8.2%",
      testConversionRate: "11.0%",
      improvement: "+34.2%",
      revenueImpact: "+$4,250",
    },
  ];

  const summaryStats = {
    totalTests: 2,
    totalRevenueIncrease: "$6,590",
    averageImprovement: "+27.5%",
    totalParticipants: 2140,
  };

  return json({ analyticsData, summaryStats });
};

export default function Analytics() {
  const { analyticsData, summaryStats } = useLoaderData<typeof loader>();

  const rows = analyticsData.map((test) => [
    test.productName,
    test.originalPrice,
    test.testPrice,
    test.duration,
    test.participants.toString(),
    test.originalConversionRate,
    test.testConversionRate,
    <Badge status="success">{test.improvement}</Badge>,
    <Badge status="success">{test.revenueImpact}</Badge>,
  ]);

  return (
    <Page>
      <TitleBar title="Analytics" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="300">
              <Text as="h1" variant="headingLg">
                Analytics
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                View test results and performance metrics to optimize your pricing strategy
              </Text>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* Summary Stats */}
        <Layout>
          <Layout.Section variant="oneQuarter">
            <Card>
              <BlockStack gap="200" align="center">
                <Text as="h3" variant="headingLg">
                  {summaryStats.totalTests}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Total Tests
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneQuarter">
            <Card>
              <BlockStack gap="200" align="center">
                <Text as="h3" variant="headingLg" tone="success">
                  {summaryStats.totalRevenueIncrease}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Revenue Increase
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneQuarter">
            <Card>
              <BlockStack gap="200" align="center">
                <Text as="h3" variant="headingLg" tone="success">
                  {summaryStats.averageImprovement}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Avg. Improvement
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneQuarter">
            <Card>
              <BlockStack gap="200" align="center">
                <Text as="h3" variant="headingLg">
                  {summaryStats.totalParticipants.toLocaleString()}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Total Participants
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Test Results Table */}
        <Layout>
          <Layout.Section>
            {analyticsData.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No test results yet"
                  action={{
                    content: "Create your first test",
                    onAction: () => {},
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Run some price tests to see detailed analytics and insights.</p>
                </EmptyState>
              </Card>
            ) : (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Test Results
                  </Text>
                  <DataTable
                    columnContentTypes={[
                      'text',
                      'text', 
                      'text',
                      'text',
                      'numeric',
                      'text',
                      'text',
                      'text',
                      'text',
                    ]}
                    headings={[
                      'Product',
                      'Original Price',
                      'Test Price',
                      'Duration',
                      'Participants',
                      'Original Conv. Rate',
                      'Test Conv. Rate',
                      'Improvement',
                      'Revenue Impact',
                    ]}
                    rows={rows}
                  />
                </BlockStack>
              </Card>
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
