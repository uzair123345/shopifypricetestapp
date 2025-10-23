import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useLocation } from "@remix-run/react";
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
  const { session } = await authenticate.admin(request);
  const testId = parseInt(params.id || "0");

  if (!testId) {
    throw new Response("Test not found", { status: 404 });
  }

  // Get test details
  const test = await db.aBTest.findUnique({
    where: { 
      id: testId,
      shop: session.shop 
    },
    include: {
      variants: true,
      products: true
    }
  });

  if (!test) {
    throw new Response("Test not found", { status: 404 });
  }

  // Get analytics data for this test
  const viewEvents = await db.viewEvent.findMany({
    where: { abTestId: testId },
    include: { variant: true }
  });

  const conversionEvents = await db.conversionEvent.findMany({
    where: { abTestId: testId },
    include: { variant: true }
  });

  // Calculate analytics by variant
  const variantAnalytics = test.variants.map(variant => {
    const variantViews = viewEvents.filter(event => event.variantId === variant.id);
    const variantConversions = conversionEvents.filter(event => event.variantId === variant.id);
    
    const conversionRate = variantViews.length > 0 
      ? (variantConversions.length / variantViews.length) * 100 
      : 0;

    return {
      variantId: variant.id,
      variantName: variant.variantName,
      price: variant.price,
      views: variantViews.length,
      conversions: variantConversions.length,
      conversionRate: Math.round(conversionRate * 100) / 100,
      revenue: variantConversions.reduce((sum, event) => sum + (event.orderValue || 0), 0)
    };
  });

  return json({ 
    test, 
    variantAnalytics,
    totalViews: viewEvents.length,
    totalConversions: conversionEvents.length
  });
};

export default function TestDetail() {
  const { test, variantAnalytics, totalViews, totalConversions } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge status="success">Active</Badge>;
      case 'paused':
        return <Badge status="warning">Paused</Badge>;
      case 'completed':
        return <Badge status="info">Completed</Badge>;
      default:
        return <Badge status="critical">Draft</Badge>;
    }
  };

  const analyticsRows = variantAnalytics.map(analytics => [
    analytics.variantName,
    `$${analytics.price.toFixed(2)}`,
    analytics.views.toString(),
    analytics.conversions.toString(),
    `${analytics.conversionRate}%`,
    `$${analytics.revenue.toFixed(2)}`
  ]);

  return (
    <Page
      backAction={{
        content: 'Active Tests',
        onAction: () => navigate(`/app/tests${location.search || ""}`)
      }}
    >
      <TitleBar title={`Test: ${test.title}`} />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <BlockStack gap="200">
                    <Text as="h1" variant="headingLg">
                      {test.title}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {test.description || "No description provided"}
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    {getStatusBadge(test.status)}
                    <Button 
                      variant="secondary"
                      onClick={() => navigate(`/app/tests${location.search || ""}`)}
                    >
                      Back to Tests
                    </Button>
                  </InlineStack>
                </InlineStack>
                
                <Divider />
                
                <Layout>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">Test Configuration</Text>
                      <BlockStack gap="100">
                        <Text variant="bodyMd"><strong>Type:</strong> {test.testType}</Text>
                        <Text variant="bodyMd"><strong>Base Price:</strong> ${test.basePrice}</Text>
                        <Text variant="bodyMd"><strong>Traffic Distribution:</strong> {test.totalTrafficPercent}%</Text>
                        <Text variant="bodyMd"><strong>Created:</strong> {new Date(test.createdAt).toLocaleDateString()}</Text>
                        <Text variant="bodyMd"><strong>Last Updated:</strong> {new Date(test.updatedAt).toLocaleDateString()}</Text>
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>
                  
                  <Layout.Section variant="twoThirds">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">Test Variants</Text>
                      <DataTable
                        columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                        headings={['Variant', 'Price', 'Views', 'Conversions', 'Conversion Rate', 'Revenue']}
                        rows={analyticsRows}
                      />
                    </BlockStack>
                  </Layout.Section>
                </Layout>
                
                <Divider />
                
                <Layout>
                  <Layout.Section variant="oneThird">
                    <Card>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">Overall Performance</Text>
                        <BlockStack gap="100">
                          <Text variant="bodyMd"><strong>Total Views:</strong> {totalViews}</Text>
                          <Text variant="bodyMd"><strong>Total Conversions:</strong> {totalConversions}</Text>
                          <Text variant="bodyMd">
                            <strong>Overall Conversion Rate:</strong> {
                              totalViews > 0 
                                ? `${Math.round((totalConversions / totalViews) * 100 * 100) / 100}%`
                                : '0%'
                            }
                          </Text>
                        </BlockStack>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                  
                  <Layout.Section variant="twoThirds">
                    <Card>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">Products Under Test</Text>
                        {test.products.length > 0 ? (
                          <BlockStack gap="100">
                            {test.products.map(product => (
                              <Text key={product.id} variant="bodyMd">
                                • {product.productTitle} (${product.basePrice})
                              </Text>
                            ))}
                          </BlockStack>
                        ) : (
                          <Text variant="bodyMd" tone="subdued">No products assigned to this test</Text>
                        )}
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}



