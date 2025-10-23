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
  Icon,
  EmptyState,
  DataTable,
  Badge,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get all tests with their products and variants
  const tests = await db.aBTest.findMany({
    where: { shop: session.shop },
    include: {
      products: true,
      variants: {
        include: {
          viewEvents: true,
          conversionEvents: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Create variant-level analytics data from real tracking data
  const analyticsData = tests.flatMap((test) => {
    const startDate = test.startedAt || test.createdAt;
    const endDate = test.status === 'completed' ? test.endedAt || new Date() : new Date();
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    
    return test.variants.map((variant) => {
      // Get real analytics data from tracking events
      const views = variant.viewEvents.length;
      const purchases = variant.conversionEvents.length;
      const unitsSold = variant.conversionEvents.reduce((sum, event) => sum + (event.orderValue ? 1 : 1), 0);
      const conversionRate = views > 0 ? ((purchases / views) * 100).toFixed(2) : "0.00";
      const revenue = variant.conversionEvents.reduce((sum, event) => sum + (event.orderValue || event.price), 0);
      
      // Find the product this variant belongs to
      const product = test.products.find(p => p.productId === variant.variantProductId) || test.products[0];
      
      return {
        testId: test.id.toString(),
        testTitle: test.title,
        productName: product?.productTitle || "Unknown Product",
        productId: product?.productId || "",
        variantName: variant.variantName,
        price: variant.price,
        isBaseVariant: variant.isBaseVariant,
        trafficPercent: variant.trafficPercent,
        status: test.status,
        duration: `${durationDays} days`,
        views,
        purchases,
        unitsSold,
        conversionRate: `${conversionRate}%`,
        revenue,
      };
    });
  });

  // Calculate summary statistics from real data
  const totalViews = analyticsData.reduce((sum, variant) => sum + variant.views, 0);
  const totalPurchases = analyticsData.reduce((sum, variant) => sum + variant.purchases, 0);
  const totalUnitsSold = analyticsData.reduce((sum, variant) => sum + variant.unitsSold, 0);
  const totalRevenue = analyticsData.reduce((sum, variant) => sum + variant.revenue, 0);
  const averageConversionRate = totalViews > 0 ? ((totalPurchases / totalViews) * 100).toFixed(2) : "0.00";

  const summaryStats = {
    totalViews,
    totalPurchases,
    totalUnitsSold,
    totalRevenue,
    averageConversionRate: `${averageConversionRate}%`,
  };

  // Group variants by test and product for better display
  const testsWithVariants = tests.map(test => {
    if (test.testType === "multiple") {
      // For multiple product tests, group by product
      const productsWithVariants = test.products.map(product => {
        const productVariants = test.variants.filter(variant => variant.variantProductId === product.productId);
        const variantsWithData = productVariants.map(variant => {
          const variantData = analyticsData.find(v => 
            v.testId === test.id.toString() && 
            v.variantName === variant.variantName &&
            v.productId === product.productId
          );
          return { ...variant, ...variantData };
        });
        
        return {
          ...product,
          variants: variantsWithData,
          testTitle: test.title,
          testStatus: test.status,
          testId: test.id
        };
      });
      
      return {
        ...test,
        productsWithVariants
      };
    } else {
      // For single product tests, show all variants together
      const variantsWithData = test.variants.map(variant => {
        const variantData = analyticsData.find(v => 
          v.testId === test.id.toString() && 
          v.variantName === variant.variantName
        );
        return { ...variant, ...variantData };
      });
      
      return {
        ...test,
        variants: variantsWithData
      };
    }
  });

  return json({ analyticsData, summaryStats, testsWithVariants });
};

export default function Analytics() {
  const { analyticsData, summaryStats, testsWithVariants } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Page
      backAction={{
        content: 'Dashboard',
        onAction: () => navigate(`/app${location.search || ""}`)
      }}
    >
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
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200" align="center">
                <Text as="h3" variant="headingLg">
                  {summaryStats.totalViews}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Total Views
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200" align="center">
                <Text as="h3" variant="headingLg" tone="success">
                  {summaryStats.totalPurchases}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Total Purchases
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200" align="center">
                <Text as="h3" variant="headingLg" tone="success">
                  ${summaryStats.totalRevenue.toFixed(2)}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Total Revenue
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Additional Stats Row */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200" align="center">
                <Text as="h3" variant="headingLg" tone="success">
                  {summaryStats.averageConversionRate}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Average Conversion Rate
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Variant Performance Cards */}
        <Layout>
          <Layout.Section>
            {testsWithVariants.length === 0 ? (
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
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Variant Performance
                  </Text>
                  {testsWithVariants.map((test) => {
                    if (test.testType === "multiple") {
                      // Multiple product tests - show each product separately
                      return (
                        <Card key={test.id}>
                          <BlockStack gap="400">
                            <InlineStack align="space-between">
                              <BlockStack gap="200">
                                <Text as="h3" variant="headingMd">
                                  {test.title}
                                </Text>
                                <Text variant="bodyMd" as="p" tone="subdued">
                                  Multiple Product Test
                                </Text>
                              </BlockStack>
                              <Badge tone={test.status === 'active' ? 'success' : test.status === 'completed' ? 'info' : 'warning'}>
                                {test.status}
                              </Badge>
                            </InlineStack>
                            
                            {test.productsWithVariants.map((product, productIndex) => (
                              <Card key={product.id}>
                                <BlockStack gap="300">
                                  <Text as="h4" variant="headingSm">
                                    {product.productTitle} ({productIndex + 1} of {test.productsWithVariants.length})
                                  </Text>
                                  
                                  <Layout>
                                    {/* Base Price Card for Multiple Product Tests */}
                                    <Layout.Section variant="oneThird">
                                      <Card>
                                        <BlockStack gap="300">
                                          <InlineStack align="space-between">
                                            <Text as="h4" variant="headingSm">
                                              Base Price
                                            </Text>
                                            <InlineStack gap="200">
                                              <Badge tone="info">
                                                {(() => {
                                                  // Calculate base traffic percentage for this product
                                                  const variantTrafficSum = product.variants.reduce((sum, variant) => sum + variant.trafficPercent, 0);
                                                  const baseTrafficPercent = Math.max(0, 100 - variantTrafficSum);
                                                  return `${baseTrafficPercent}% Traffic`;
                                                })()}
                                              </Badge>
                                              <Badge tone="info">
                                                Base Price
                                              </Badge>
                                            </InlineStack>
                                          </InlineStack>
                                          
                                          {/* Traffic allocation bar */}
                                          <Box 
                                            padding="200" 
                                            background="bg-surface-secondary" 
                                            borderRadius="100"
                                          >
                                            <BlockStack gap="200">
                                              <Text variant="bodyMd" fontWeight="medium">
                                                Conversion Rate
                                              </Text>
                                              <Box 
                                                padding="100" 
                                                background="bg-surface-brand" 
                                                borderRadius="050"
                                                style={{ 
                                                  width: `${(() => {
                                                    const variantTrafficSum = product.variants.reduce((sum, variant) => sum + variant.trafficPercent, 0);
                                                    const baseTrafficPercent = Math.max(0, 100 - variantTrafficSum);
                                                    return baseTrafficPercent;
                                                  })()}%`,
                                                  minWidth: '20px'
                                                }}
                                              />
                                              <InlineStack align="space-between">
                                                <InlineStack gap="200" align="start">
                                                  <Icon source="warning" tone="critical" />
                                                  <Text 
                                                    variant="bodyMd" 
                                                    tone="critical"
                                                    fontWeight="medium"
                                                  >
                                                    No Data Yet
                                                  </Text>
                                                </InlineStack>
                                                <Text variant="bodyMd" fontWeight="medium">
                                                  {(() => {
                                                    const variantTrafficSum = product.variants.reduce((sum, variant) => sum + variant.trafficPercent, 0);
                                                    const baseTrafficPercent = Math.max(0, 100 - variantTrafficSum);
                                                    return `${baseTrafficPercent}%`;
                                                  })()}
                                                </Text>
                                              </InlineStack>
                                            </BlockStack>
                                          </Box>
                                          
                                          <InlineStack gap="400" wrap>
                                            <Text variant="bodyMd" fontWeight="medium">
                                              Price: ${product.basePrice.toFixed(2)}
                                            </Text>
                                            <Text variant="bodyMd" fontWeight="medium">
                                              Views: 0
                                            </Text>
                                            <Text variant="bodyMd" fontWeight="medium">
                                              Purchases: 0
                                            </Text>
                                            <Text variant="bodyMd" fontWeight="medium">
                                              Revenue: $0.00
                                            </Text>
                                          </InlineStack>
                                        </BlockStack>
                                      </Card>
                                    </Layout.Section>
                                    
                                    {/* Test Variants */}
                                    {product.variants.map((variant, index) => {
                                      const isBestPerformer = variant.conversionRate && 
                                        parseFloat(variant.conversionRate) === Math.max(...product.variants.map(v => parseFloat(v.conversionRate || "0")));
                                      
                                      return (
                                        <Layout.Section key={variant.id} variant="oneThird">
                                          <Card>
                                            <BlockStack gap="300">
                                              <InlineStack align="space-between">
                                                <Text as="h5" variant="headingSm">
                                                  {variant.variantName}
                                                </Text>
                                                <InlineStack gap="200">
                                                  <Badge tone="info">
                                                    {variant.trafficPercent}% Traffic
                                                  </Badge>
                                                  {variant.isBaseVariant && (
                                                    <Badge tone="info">
                                                      Base Price
                                                    </Badge>
                                                  )}
                                                  {isBestPerformer && variant.purchases > 0 && (
                                                    <Badge tone="success">
                                                      Best Performer
                                                    </Badge>
                                                  )}
                                                </InlineStack>
                                              </InlineStack>
                                              
                                              {/* Traffic allocation bar */}
                                              <Box 
                                                padding="200" 
                                                background="bg-surface-secondary" 
                                                borderRadius="100"
                                              >
                                                <BlockStack gap="200">
                                                  <Text variant="bodyMd" fontWeight="medium">
                                                    Conversion Rate
                                                  </Text>
                                                  <Box 
                                                    padding="100" 
                                                    background="bg-surface-brand" 
                                                    borderRadius="050"
                                                    style={{ 
                                                      width: `${variant.trafficPercent}%`,
                                                      minWidth: '20px'
                                                    }}
                                                  />
                                                  <InlineStack align="space-between">
                                                    <InlineStack gap="200" align="start">
                                                      {parseFloat(variant.conversionRate || "0") > 0 ? (
                                                        <Icon source="checkmark" tone="success" />
                                                      ) : (
                                                        <Icon source="warning" tone="critical" />
                                                      )}
                                                      <Text 
                                                        variant="headingMd" 
                                                        fontWeight="bold"
                                                        tone={parseFloat(variant.conversionRate || "0") > 0 ? "success" : "critical"}
                                                      >
                                                        {variant.conversionRate}
                                                      </Text>
                                                    </InlineStack>
                                                    <Text variant="bodyMd" tone="subdued">
                                                      {variant.purchases} purchase{variant.purchases !== 1 ? 's' : ''}
                                                    </Text>
                                                  </InlineStack>
                                                </BlockStack>
                                              </Box>
                                              
                                              {/* Metrics */}
                                              <Layout>
                                                <Layout.Section variant="oneThird">
                                                  <BlockStack gap="100" align="center">
                                                    <Text as="h6" variant="headingMd">
                                                      {variant.views}
                                                    </Text>
                                                    <Text variant="bodySm" tone="subdued">
                                                      Views
                                                    </Text>
                                                  </BlockStack>
                                                </Layout.Section>
                                                <Layout.Section variant="oneThird">
                                                  <BlockStack gap="100" align="center">
                                                    <Text as="h6" variant="headingMd">
                                                      {variant.purchases}
                                                    </Text>
                                                    <Text variant="bodySm" tone="subdued">
                                                      Purchases
                                                    </Text>
                                                  </BlockStack>
                                                </Layout.Section>
                                                <Layout.Section variant="oneThird">
                                                  <BlockStack gap="100" align="center">
                                                    <Text as="h6" variant="headingMd">
                                                      {variant.unitsSold}
                                                    </Text>
                                                    <Text variant="bodySm" tone="subdued">
                                                      Units Sold
                                                    </Text>
                                                  </BlockStack>
                                                </Layout.Section>
                                              </Layout>
                                              
                                              <InlineStack align="space-between">
                                                <Text variant="bodyMd" tone="subdued">
                                                  Price: ${variant.price.toFixed(2)}
                                                </Text>
                                                <Text variant="bodyMd" fontWeight="medium">
                                                  Revenue: ${variant.revenue.toFixed(2)}
                                                </Text>
                                              </InlineStack>
                                            </BlockStack>
                                          </Card>
                                        </Layout.Section>
                                      );
                                    })}
                                  </Layout>
                                </BlockStack>
                              </Card>
                            ))}
                          </BlockStack>
                        </Card>
                      );
                    } else {
                      // Single product tests - show all variants together
                      // Check if this is an old test structure (no proper base variant) or new structure
                      const hasProperBaseVariant = test.variants.some(v => v.variantName === "Base Price" && v.isBaseVariant);
                      const baseVariant = test.variants.find(v => v.variantName === "Base Price" && v.isBaseVariant);
                      const testVariants = test.variants.filter(v => !(v.variantName === "Base Price" && v.isBaseVariant));
                      
                      return (
                        <Card key={test.id}>
                          <BlockStack gap="400">
                            <InlineStack align="space-between">
                              <BlockStack gap="200">
                                <Text as="h3" variant="headingMd">
                                  {test.title}
                                </Text>
                                <Text variant="bodyMd" as="p" tone="subdued">
                                  {test.products[0]?.productTitle || "Unknown Product"}
                                </Text>
                              </BlockStack>
                              <Badge tone={test.status === 'active' ? 'success' : test.status === 'completed' ? 'info' : 'warning'}>
                                {test.status}
                              </Badge>
                            </InlineStack>
                            
                            <Layout>
                              {/* Always show base price card for single product tests */}
                              {baseVariant ? (
                                /* Show proper base variant if it exists */
                                <Layout.Section variant="oneThird">
                                  <Card>
                                    <BlockStack gap="300">
                                      <InlineStack align="space-between">
                                        <Text as="h4" variant="headingSm">
                                          {baseVariant.variantName}
                                        </Text>
                                        <InlineStack gap="200">
                                          <Badge tone="info">
                                            {baseVariant.trafficPercent}% Traffic
                                          </Badge>
                                          <Badge tone="info">
                                            Base Price
                                          </Badge>
                                        </InlineStack>
                                      </InlineStack>
                                      
                                      {/* Traffic allocation bar */}
                                      <Box 
                                        padding="200" 
                                        background="bg-surface-secondary" 
                                        borderRadius="100"
                                      >
                                        <BlockStack gap="200">
                                          <Text variant="bodyMd" fontWeight="medium">
                                            Conversion Rate
                                          </Text>
                                          <Box 
                                            padding="100" 
                                            background="bg-surface-brand" 
                                            borderRadius="050"
                                            style={{ 
                                              width: `${baseVariant.trafficPercent}%`,
                                              minWidth: '20px'
                                            }}
                                          />
                                          <InlineStack align="space-between">
                                            <InlineStack gap="200" align="start">
                                              {parseFloat(baseVariant.conversionRate || "0") > 0 ? (
                                                <Icon source="checkmark" tone="success" />
                                              ) : (
                                                <Icon source="warning" tone="critical" />
                                              )}
                                              <Text 
                                                variant="headingMd" 
                                                fontWeight="bold"
                                                tone={parseFloat(baseVariant.conversionRate || "0") > 0 ? "success" : "critical"}
                                              >
                                                {baseVariant.conversionRate}
                                              </Text>
                                            </InlineStack>
                                            <Text variant="bodyMd" tone="subdued">
                                              {baseVariant.purchases} purchase{baseVariant.purchases !== 1 ? 's' : ''}
                                            </Text>
                                          </InlineStack>
                                        </BlockStack>
                                      </Box>
                                      
                                      {/* Metrics */}
                                      <Layout>
                                        <Layout.Section variant="oneThird">
                                          <BlockStack gap="100" align="center">
                                            <Text as="h5" variant="headingMd">
                                              {baseVariant.views}
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                              Views
                                            </Text>
                                          </BlockStack>
                                        </Layout.Section>
                                        <Layout.Section variant="oneThird">
                                          <BlockStack gap="100" align="center">
                                            <Text as="h5" variant="headingMd">
                                              {baseVariant.purchases}
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                              Purchases
                                            </Text>
                                          </BlockStack>
                                        </Layout.Section>
                                        <Layout.Section variant="oneThird">
                                          <BlockStack gap="100" align="center">
                                            <Text as="h5" variant="headingMd">
                                              {baseVariant.unitsSold}
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                              Units Sold
                                            </Text>
                                          </BlockStack>
                                        </Layout.Section>
                                      </Layout>
                                      
                                      <InlineStack align="space-between">
                                        <Text variant="bodyMd" tone="subdued">
                                          Price: ${baseVariant.price.toFixed(2)}
                                        </Text>
                                        <Text variant="bodyMd" fontWeight="medium">
                                          Revenue: ${baseVariant.revenue.toFixed(2)}
                                        </Text>
                                      </InlineStack>
                                    </BlockStack>
                                  </Card>
                                </Layout.Section>
                              ) : (
                                /* Always show base price card for single product tests without proper base variant */
                                <Layout.Section variant="oneThird">
                                  <Card>
                                    <BlockStack gap="300">
                                      <InlineStack align="space-between">
                                        <Text as="h4" variant="headingSm">
                                          Base Price
                                        </Text>
                                        <InlineStack gap="200">
                                          <Badge tone="info">
                                            {test.baseTrafficPercent}% Traffic
                                          </Badge>
                                          <Badge tone="info">
                                            Base Price
                                          </Badge>
                                        </InlineStack>
                                      </InlineStack>
                                      
                                      {/* Traffic allocation bar */}
                                      <Box 
                                        padding="200" 
                                        background="bg-surface-secondary" 
                                        borderRadius="100"
                                      >
                                        <BlockStack gap="200">
                                          <Text variant="bodyMd" fontWeight="medium">
                                            Conversion Rate
                                          </Text>
                                          <Box 
                                            padding="100" 
                                            background="bg-surface-brand" 
                                            borderRadius="050"
                                            style={{ 
                                              width: `${test.baseTrafficPercent}%`,
                                              minWidth: '20px'
                                            }}
                                          />
                                          <InlineStack align="space-between">
                                            <InlineStack gap="200" align="start">
                                              <Icon source="warning" tone="critical" />
                                              <Text 
                                                variant="headingMd" 
                                                fontWeight="bold"
                                                tone="critical"
                                              >
                                                0.00%
                                              </Text>
                                            </InlineStack>
                                            <Text variant="bodyMd" tone="subdued">
                                              0 purchases
                                            </Text>
                                          </InlineStack>
                                        </BlockStack>
                                      </Box>
                                      
                                      {/* Metrics */}
                                      <Layout>
                                        <Layout.Section variant="oneThird">
                                          <BlockStack gap="100" align="center">
                                            <Text as="h5" variant="headingMd">
                                              0
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                              Views
                                            </Text>
                                          </BlockStack>
                                        </Layout.Section>
                                        <Layout.Section variant="oneThird">
                                          <BlockStack gap="100" align="center">
                                            <Text as="h5" variant="headingMd">
                                              0
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                              Purchases
                                            </Text>
                                          </BlockStack>
                                        </Layout.Section>
                                        <Layout.Section variant="oneThird">
                                          <BlockStack gap="100" align="center">
                                            <Text as="h5" variant="headingMd">
                                              0
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                              Units Sold
                                            </Text>
                                          </BlockStack>
                                        </Layout.Section>
                                      </Layout>
                                      
                                      <InlineStack align="space-between">
                                        <Text variant="bodyMd" tone="subdued">
                                          Price: ${test.products[0]?.basePrice.toFixed(2) || "0.00"}
                                        </Text>
                                        <Text variant="bodyMd" fontWeight="medium">
                                          Revenue: $0.00
                                        </Text>
                                      </InlineStack>
                                    </BlockStack>
                                  </Card>
                                </Layout.Section>
                              )}
                              
                              {/* Show test variants */}
                              {(testVariants.length > 0 ? testVariants : test.variants).map((variant, index) => {
                                const isBestPerformer = variant.conversionRate && 
                                  parseFloat(variant.conversionRate) === Math.max(...test.variants.map(v => parseFloat(v.conversionRate || "0")));
                                
                                return (
                                  <Layout.Section key={variant.id} variant="oneThird">
                                    <Card>
                                      <BlockStack gap="300">
                                        <InlineStack align="space-between">
                                          <Text as="h4" variant="headingSm">
                                            {variant.variantName}
                                          </Text>
                                          <InlineStack gap="200">
                                            <Badge tone="info">
                                              {variant.trafficPercent}% Traffic
                                            </Badge>
                                            {isBestPerformer && variant.purchases > 0 && (
                                              <Badge tone="success">
                                                Best Performer
                                              </Badge>
                                            )}
                                          </InlineStack>
                                        </InlineStack>
                                        
                                        {/* Traffic allocation bar */}
                                        <Box 
                                          padding="200" 
                                          background="bg-surface-secondary" 
                                          borderRadius="100"
                                        >
                                          <BlockStack gap="200">
                                            <Text variant="bodyMd" fontWeight="medium">
                                              Conversion Rate
                                            </Text>
                                            <Box 
                                              padding="100" 
                                              background="bg-surface-brand" 
                                              borderRadius="050"
                                              style={{ 
                                                width: `${variant.trafficPercent}%`,
                                                minWidth: '20px'
                                              }}
                                            />
                                            <InlineStack align="space-between">
                                              <InlineStack gap="200" align="start">
                                                {parseFloat(variant.conversionRate || "0") > 0 ? (
                                                  <Icon source="checkmark" tone="success" />
                                                ) : (
                                                  <Icon source="warning" tone="critical" />
                                                )}
                                                <Text 
                                                  variant="headingMd" 
                                                  fontWeight="bold"
                                                  tone={parseFloat(variant.conversionRate || "0") > 0 ? "success" : "critical"}
                                                >
                                                  {variant.conversionRate}
                                                </Text>
                                              </InlineStack>
                                              <Text variant="bodyMd" tone="subdued">
                                                {variant.purchases} purchase{variant.purchases !== 1 ? 's' : ''}
                                              </Text>
                                            </InlineStack>
                                          </BlockStack>
                                        </Box>
                                        
                                        {/* Metrics */}
                                        <Layout>
                                          <Layout.Section variant="oneThird">
                                            <BlockStack gap="100" align="center">
                                              <Text as="h5" variant="headingMd">
                                                {variant.views}
                                              </Text>
                                              <Text variant="bodySm" tone="subdued">
                                                Views
                                              </Text>
                                            </BlockStack>
                                          </Layout.Section>
                                          <Layout.Section variant="oneThird">
                                            <BlockStack gap="100" align="center">
                                              <Text as="h5" variant="headingMd">
                                                {variant.purchases}
                                              </Text>
                                              <Text variant="bodySm" tone="subdued">
                                                Purchases
                                              </Text>
                                            </BlockStack>
                                          </Layout.Section>
                                          <Layout.Section variant="oneThird">
                                            <BlockStack gap="100" align="center">
                                              <Text as="h5" variant="headingMd">
                                                {variant.unitsSold}
                                              </Text>
                                              <Text variant="bodySm" tone="subdued">
                                                Units Sold
                                              </Text>
                                            </BlockStack>
                                          </Layout.Section>
                                        </Layout>
                                        
                                        <InlineStack align="space-between">
                                          <Text variant="bodyMd" tone="subdued">
                                            Price: ${variant.price.toFixed(2)}
                                          </Text>
                                          <Text variant="bodyMd" fontWeight="medium">
                                            Revenue: ${variant.revenue.toFixed(2)}
                                          </Text>
                                        </InlineStack>
                                      </BlockStack>
                                    </Card>
                                  </Layout.Section>
                                );
                              })}
                            </Layout>
                          </BlockStack>
                        </Card>
                      );
                    }
                  })}
                </BlockStack>
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
