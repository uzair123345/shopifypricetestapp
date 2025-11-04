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
  Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useEffect, useRef } from "react";
import { useFetcher } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get all view events FIRST to see what's actually in the database
  const allViewEvents = await db.viewEvent.findMany({
    where: { shop: session.shop },
    orderBy: { timestamp: 'desc' }
  });
  
  console.log(`[Analytics] DEBUG: Total views in database for shop ${session.shop}: ${allViewEvents.length}`);
  allViewEvents.forEach(view => {
    console.log(`[Analytics] View Event: id=${view.id}, productId=${view.productId}, variantId=${view.variantId}, abTestId=${view.abTestId}, price=${view.price}, timestamp=${view.timestamp}`);
  });

  // Get all tests with their products and variants
  // NOTE: We'll manually fetch variant views to ensure accuracy
  const tests = await db.aBTest.findMany({
    where: { shop: session.shop },
    include: {
      products: true,
      variants: true  // Don't include viewEvents via relation - we'll fetch manually
    },
    orderBy: { createdAt: 'desc' }
  });

  // Get all view events with variantId = null (base price views) for this shop
  const basePriceViews = await db.viewEvent.findMany({
    where: { 
      shop: session.shop,
      variantId: null,
      abTestId: { not: null } // Only views that are part of a test
    }
  });
  
  console.log(`[Analytics] Found ${basePriceViews.length} base price views (variantId: null, abTestId: not null)`);
  basePriceViews.forEach(view => {
    console.log(`[Analytics] Base price view: id=${view.id}, productId=${view.productId}, abTestId=${view.abTestId}, price=${view.price}`);
  });
  
  // Get all variant views (variantId is NOT null)
  const variantViewEvents = await db.viewEvent.findMany({
    where: {
      shop: session.shop,
      variantId: { not: null },
      abTestId: { not: null }
    }
  });
  
  console.log(`[Analytics] Found ${variantViewEvents.length} variant views (variantId: not null)`);
  variantViewEvents.forEach(view => {
    console.log(`[Analytics] Variant view: id=${view.id}, productId=${view.productId}, variantId=${view.variantId}, abTestId=${view.abTestId}, price=${view.price}`);
  });

  // Create variant-level analytics data from real tracking data
  // Fetch all conversions once outside the loop for better performance
  const allConversionEvents = await db.conversionEvent.findMany({
    where: { shop: session.shop, abTestId: { not: null } }
  });
  
  const analyticsData = tests.flatMap((test) => {
    const startDate = test.startedAt || test.createdAt;
    const endDate = test.status === 'completed' ? test.endedAt || new Date() : new Date();
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    
    return test.variants.map((variant) => {
      // Find the product this variant belongs to
      // For multi-product tests, match by variantProductId
      // For single product tests, use the first product
      const product = test.testType === "multiple" 
        ? test.products.find(p => p.productId === variant.variantProductId) || test.products[0]
        : test.products[0];
      const productId = product?.productId || test.products[0]?.productId || "";
      
      console.log(`[Analytics] Processing variant: testId=${test.id}, variantId=${variant.id}, variantName=${variant.variantName}, productId=${productId}, productName=${product?.productTitle}`);
      
      // IMPORTANT: Fetch views directly from database instead of using Prisma relation
      // This ensures we get accurate data and can filter properly
      // Base price views (variantId: null) should NOT appear here
      // ALSO: Exclude views where price matches base price (these are incorrectly tracked base price views)
      const productBasePrice = test.products.find(p => p.productId === productId)?.basePrice || 0;
      
      // Match views to variants by EXACT variantId, productId, and testId
      // Show views exactly as they are in the database - don't try to "correct" them
      const viewEvents = test.testType === "multiple"
        ? variantViewEvents.filter(event => {
            // Must match: variantId, productId, and testId exactly
            const matches = event.productId === productId && 
                          event.variantId !== null && 
                          event.variantId === variant.id && 
                          event.abTestId === test.id;
            
            if (matches) {
              console.log(`[Analytics] ✅ Matched view to variant: variantId=${variant.id}, productId=${productId}, price=${event.price}, viewId=${event.id}`);
            }
            return matches;
          })
        : variantViewEvents.filter(event => {
            // For single product tests, only need variantId and testId match
            const matches = event.variantId !== null && 
                          event.variantId === variant.id && 
                          event.abTestId === test.id;
            
            if (matches) {
              console.log(`[Analytics] ✅ Matched view to variant: variantId=${variant.id}, productId=${productId}, price=${event.price}, viewId=${event.id}`);
            }
            return matches;
          });
      
      // Filter conversions from pre-fetched array
      const conversionEvents = allConversionEvents.filter(event => {
        if (event.variantId !== variant.id || event.abTestId !== test.id) return false;
        if (test.testType === "multiple" && event.productId !== productId) return false;
        return true;
      });
      
      // Get real analytics data from filtered tracking events
      const views = viewEvents.length;
      const purchases = conversionEvents.length;
      const unitsSold = conversionEvents.reduce((sum, event) => sum + (event.orderValue ? 1 : 1), 0);
      const conversionRate = views > 0 ? ((purchases / views) * 100).toFixed(2) : "0.00";
      const revenue = conversionEvents.reduce((sum, event) => sum + (event.orderValue || event.price), 0);
      
      return {
        testId: test.id.toString(),
        testTitle: test.title,
        productName: product?.productTitle || "Unknown Product",
        productId: productId,
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

  // Add base price analytics data for each test
  const basePriceAnalytics = tests.flatMap((test) => {
    const startDate = test.startedAt || test.createdAt;
    const endDate = test.status === 'completed' ? test.endedAt || new Date() : new Date();
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    
    return test.products.map((product) => {
      // Get base price views for this specific product and test
      // Match by productId and testId exactly - show views as they are in the database
      // Only include views with variantId = null (base price views)
      const productBaseViews = basePriceViews.filter(view => 
        view.productId === product.productId && 
        view.abTestId === test.id
      );
      
      const views = productBaseViews.length;
      
      // Debug logging for base price views
      if (views > 0) {
        console.log(`[Analytics] ✅ Found ${views} base price views for product ${product.productTitle} (${product.productId}) in test ${test.id}`);
        productBaseViews.forEach(view => {
          console.log(`  - Base price view: id=${view.id}, price=${view.price}, variantId=${view.variantId}`);
        });
      } else {
        console.log(`[Analytics] ℹ️ No base price views for product ${product.productTitle} (${product.productId}) in test ${test.id}`);
      }
      const purchases = 0; // Base price conversions would need separate tracking
      const unitsSold = 0;
      const conversionRate = "0.00";
      const revenue = 0;
      
      return {
        testId: test.id.toString(),
        testTitle: test.title,
        productName: product.productTitle,
        productId: product.productId,
        variantName: "Base Price",
        price: product.basePrice,
        isBaseVariant: true,
        trafficPercent: test.baseTrafficPercent,
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

  // Combine variant analytics with base price analytics
  const allAnalyticsData = [...analyticsData, ...basePriceAnalytics];

  // Calculate summary statistics from all data (variants + base prices)
  const totalViews = allAnalyticsData.reduce((sum, variant) => sum + variant.views, 0);
  const totalPurchases = allAnalyticsData.reduce((sum, variant) => sum + variant.purchases, 0);
  const totalUnitsSold = allAnalyticsData.reduce((sum, variant) => sum + variant.unitsSold, 0);
  const totalRevenue = allAnalyticsData.reduce((sum, variant) => sum + variant.revenue, 0);
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
          const variantData = allAnalyticsData.find(v => 
            v.testId === test.id.toString() && 
            v.variantName === variant.variantName &&
            v.productId === product.productId
          );
          return { ...variant, ...variantData };
        });
        
        // IMPORTANT: Add base price data for this product
        const basePriceData = allAnalyticsData.find(v => 
          v.testId === test.id.toString() && 
          v.variantName === "Base Price" &&
          v.productId === product.productId &&
          v.isBaseVariant === true
        );
        
        // If base price data exists, add it as the first item
        const allVariantsWithData = basePriceData 
          ? [{ 
              id: null, 
              variantName: "Base Price", 
              isBaseVariant: true, 
              price: product.basePrice, 
              trafficPercent: test.baseTrafficPercent,
              ...basePriceData 
            }, ...variantsWithData]
          : variantsWithData;
        
        return {
          ...product,
          variants: allVariantsWithData,
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
        const variantData = allAnalyticsData.find(v => 
          v.testId === test.id.toString() && 
          v.variantName === variant.variantName
        );
        return { ...variant, ...variantData };
      });
      
      // IMPORTANT: Add base price data for single product tests
      const basePriceData = allAnalyticsData.find(v => 
        v.testId === test.id.toString() && 
        v.variantName === "Base Price" &&
        v.isBaseVariant === true &&
        test.products.length > 0 &&
        v.productId === test.products[0].productId
      );
      
      // If base price data exists, add it as the first item
      const allVariantsWithData = basePriceData && test.products.length > 0
        ? [{ 
            id: null, 
            variantName: "Base Price", 
            isBaseVariant: true, 
            price: test.products[0].basePrice, 
            trafficPercent: test.baseTrafficPercent,
            ...basePriceData 
          }, ...variantsWithData]
        : variantsWithData;
      
      return {
        ...test,
        variants: allVariantsWithData
      };
    }
  });

  return json({ analyticsData: allAnalyticsData, summaryStats, testsWithVariants });
};

export default function Analytics() {
  const initialData = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  
  // Real-time analytics using Remix fetcher - always enabled
  const fetcher = useFetcher<typeof loader>();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Mark component as mounted after initial render
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Use fetcher data if available, otherwise use initial data
  const analyticsData = fetcher.data?.analyticsData || initialData.analyticsData;
  const summaryStats = fetcher.data?.summaryStats || initialData.summaryStats;
  const testsWithVariants = fetcher.data?.testsWithVariants || initialData.testsWithVariants;
  const isRefreshing = fetcher.state === "loading";
  
  // Always-on polling - starts automatically when component is mounted
  useEffect(() => {
    if (!isMounted) return; // Wait until component is mounted

    // Don't fetch immediately - we already have initial data from loader
    // Start polling after page is fully loaded
    const initialDelay = setTimeout(() => {
      // Then refresh every 5 seconds
      refreshIntervalRef.current = setInterval(() => {
        try {
          if (fetcher.state === "idle") { // Only fetch if not already loading
            fetcher.load("/app/analytics?refresh=true");
          }
        } catch (error) {
          console.error("Error refreshing analytics:", error);
        }
      }, 5000);
    }, 2000); // Wait 2 seconds after component is mounted
    
    return () => {
      clearTimeout(initialDelay);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]); // Only depend on isMounted
  
  // Update last update time when data changes
  useEffect(() => {
    if (fetcher.data) {
      setLastUpdate(new Date());
    }
  }, [fetcher.data]);
  
  const refreshAnalytics = () => {
    // Only refresh if fetcher is idle (not already loading)
    if (fetcher.state === "idle") {
      try {
        fetcher.load("/app/analytics?refresh=true");
      } catch (error) {
        console.error("Error refreshing analytics:", error);
      }
    }
  };

  const handleClearAnalytics = async () => {
    setIsClearing(true);
    try {
      const response = await fetch("/api/clear-analytics", {
        method: "POST",
      });
      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ ${result.message}`);
        // Reload the page to show updated analytics
        window.location.reload();
      } else {
        alert(`❌ Error: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Clear analytics error:", error);
      alert(`❌ Error: ${error instanceof Error ? error.message : "Network error"}`);
    } finally {
      setIsClearing(false);
      setShowClearModal(false);
    }
  };

  return (
    <Page
      backAction={{
        content: 'Dashboard',
        onAction: () => navigate(`/app${location.search || ""}`)
      }}
    >
      <TitleBar title="Analytics" />
      <BlockStack gap="500">
        {/* Real-time Status Bar - Always Live */}
        {isMounted && (
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="300" blockAlign="center">
                <Text variant="bodyMd" fontWeight="medium">
                  Live Analytics
                </Text>
                <Badge tone={isRefreshing ? "attention" : "success"}>
                  {isRefreshing ? 'Updating...' : 'Live'}
                </Badge>
                <Text variant="bodySm" tone="subdued">
                  Auto-updates every 5 seconds • Last updated: {lastUpdate.toLocaleTimeString()}
                </Text>
              </InlineStack>
              <Button
                variant="plain"
                size="slim"
                onClick={refreshAnalytics}
                disabled={isRefreshing}
                loading={isRefreshing}
              >
                Refresh Now
              </Button>
            </InlineStack>
          </Card>
        )}

        <Layout>
          <Layout.Section>
            <InlineStack align="space-between" blockAlign="center" gap="300">
              <BlockStack gap="300">
                <Text as="h1" variant="headingLg">
                  Analytics
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  View test results and performance metrics to optimize your pricing strategy
                </Text>
              </BlockStack>
              <Button
                variant="plain"
                tone="critical"
                onClick={() => setShowClearModal(true)}
                disabled={isClearing}
              >
                Clear Analytics Data
              </Button>
            </InlineStack>
          </Layout.Section>
        </Layout>

        {/* Clear Analytics Confirmation Modal */}
        <Modal
          open={showClearModal}
          onClose={() => setShowClearModal(false)}
          title="Clear All Analytics Data"
          primaryAction={{
            content: "Clear All Data",
            onAction: handleClearAnalytics,
            loading: isClearing,
            destructive: true,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowClearModal(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text variant="bodyMd" as="p">
                Are you sure you want to clear all analytics data? This will permanently delete:
              </Text>
              <Text variant="bodyMd" as="ul">
                <li>All view events</li>
                <li>All conversion events</li>
                <li>All analytics history</li>
              </Text>
              <Text variant="bodyMd" as="p" tone="critical">
                This action cannot be undone.
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>

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
                                    {/* Base Price and Test Variants */}
                                    {product.variants.map((variant, index) => {
                                      // Skip base variant if it doesn't have data yet - we'll show it with variants that have data
                                      const isBestPerformer = !variant.isBaseVariant && variant.conversionRate && 
                                        parseFloat(variant.conversionRate) === Math.max(...product.variants.filter(v => !v.isBaseVariant).map(v => parseFloat(v.conversionRate || "0")));
                                      
                                      // Get base price data from variants array (we added it earlier)
                                      if (variant.isBaseVariant) {
                                        const baseTrafficPercent = variant.trafficPercent || Math.max(0, 100 - product.variants.filter(v => !v.isBaseVariant).reduce((sum, v) => sum + (v.trafficPercent || 0), 0));
                                        
                                        return (
                                          <Layout.Section key="base-price" variant="oneThird">
                                            <Card>
                                              <BlockStack gap="300">
                                                <InlineStack align="space-between">
                                                  <Text as="h4" variant="headingSm">
                                                    Base Price
                                                  </Text>
                                                  <InlineStack gap="200">
                                                    <Badge tone="info">
                                                      {baseTrafficPercent}% Traffic
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
                                                        width: `${baseTrafficPercent}%`,
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
                                                          {variant.conversionRate || "0.00%"}
                                                        </Text>
                                                      </InlineStack>
                                                      <Text variant="bodyMd" tone="subdued">
                                                        {variant.purchases || 0} purchases
                                                      </Text>
                                                    </InlineStack>
                                                  </BlockStack>
                                                </Box>
                                                
                                                {/* Metrics */}
                                                <Layout>
                                                  <Layout.Section variant="oneThird">
                                                    <BlockStack gap="100" align="center">
                                                      <Text as="h6" variant="headingMd">
                                                        {variant.views || 0}
                                                      </Text>
                                                      <Text variant="bodySm" tone="subdued">
                                                        Views
                                                      </Text>
                                                    </BlockStack>
                                                  </Layout.Section>
                                                  <Layout.Section variant="oneThird">
                                                    <BlockStack gap="100" align="center">
                                                      <Text as="h6" variant="headingMd">
                                                        {variant.purchases || 0}
                                                      </Text>
                                                      <Text variant="bodySm" tone="subdued">
                                                        Purchases
                                                      </Text>
                                                    </BlockStack>
                                                  </Layout.Section>
                                                  <Layout.Section variant="oneThird">
                                                    <BlockStack gap="100" align="center">
                                                      <Text as="h6" variant="headingMd">
                                                        {variant.unitsSold || 0}
                                                      </Text>
                                                      <Text variant="bodySm" tone="subdued">
                                                        Units Sold
                                                      </Text>
                                                    </BlockStack>
                                                  </Layout.Section>
                                                </Layout>
                                                
                                                <InlineStack align="space-between">
                                                  <Text variant="bodyMd" tone="subdued">
                                                    Price: ${(variant.price || product.basePrice).toFixed(2)}
                                                  </Text>
                                                  <Text variant="bodyMd" fontWeight="medium">
                                                    Revenue: ${(variant.revenue || 0).toFixed(2)}
                                                  </Text>
                                                </InlineStack>
                                              </BlockStack>
                                            </Card>
                                          </Layout.Section>
                                        );
                                      }
                                      
                                      // Regular test variants
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
                      // Find base variant from merged analytics data (we added it earlier)
                      const baseVariant = test.variants.find(v => 
                        (v.variantName === "Base Price" || v.isBaseVariant === true) &&
                        (v.views !== undefined || v.purchases !== undefined || v.productId !== undefined)
                      );
                      const testVariants = test.variants.filter(v => !(v.variantName === "Base Price" && v.isBaseVariant === true));
                      
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
