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
  TextField,
  DatePicker,
  Popover,
  ActionList,
  Tag,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useEffect, useRef } from "react";
import { useFetcher } from "@remix-run/react";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "week"
  | "lastWeek"
  | "last30days"
  | "last90days"
  | "last365days"
  | "lastMonth"
  | "last12months"
  | "custom";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function getPresetDates(preset: DateRangePreset): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (preset === "today") {
    start = startOfDay(now);
    end = endOfDay(now);
  } else if (preset === "yesterday") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 1);
    start = startOfDay(d);
    end = endOfDay(d);
  } else if (preset === "week") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 6);
    start = startOfDay(d);
    end = endOfDay(now);
  } else if (preset === "lastWeek") {
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() + mondayOffset - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
    start = startOfDay(lastMonday);
    end = endOfDay(lastSunday);
  } else if (preset === "last30days") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 29);
    start = startOfDay(d);
    end = endOfDay(now);
  } else if (preset === "last90days") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 89);
    start = startOfDay(d);
    end = endOfDay(now);
  } else if (preset === "last365days") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 364);
    start = startOfDay(d);
    end = endOfDay(now);
  } else if (preset === "lastMonth") {
    const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastOfLastMonth = new Date(firstOfThisMonth);
    lastOfLastMonth.setUTCDate(0);
    const firstOfLastMonth = new Date(lastOfLastMonth.getUTCFullYear(), lastOfLastMonth.getUTCMonth(), 1);
    start = startOfDay(firstOfLastMonth);
    end = endOfDay(lastOfLastMonth);
  } else if (preset === "last12months") {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - 11);
    d.setUTCDate(1);
    start = startOfDay(d);
    end = endOfDay(now);
  } else {
    start = startOfDay(now);
    end = endOfDay(now);
  }
  return { start, end };
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days",
  lastWeek: "Last week",
  last30days: "Last 30 days",
  last90days: "Last 90 days",
  last365days: "Last 365 days",
  lastMonth: "Last month",
  last12months: "Last 12 months",
  custom: "Custom",
};

const PRESET_VALUES: DateRangePreset[] = [
  "today", "yesterday", "week", "lastWeek", "last30days", "last90days",
  "last365days", "lastMonth", "last12months", "custom"
];

function parseDateRange(request: Request): { start: Date; end: Date; preset: DateRangePreset } {
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") as DateRangePreset | null;
  const startParam = url.searchParams.get("startDate");
  const endParam = url.searchParams.get("endDate");

  // Preset (non-custom)
  if (rangeParam && rangeParam !== "custom" && PRESET_VALUES.includes(rangeParam)) {
    return { ...getPresetDates(rangeParam), preset: rangeParam };
  }

  // Custom: startDate and endDate
  if (rangeParam === "custom" && startParam && endParam) {
    const start = new Date(startParam);
    const end = new Date(endParam);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      return { start, end, preset: "custom" };
    }
  }

  // Legacy: no range param but startDate/endDate present
  if (startParam && endParam) {
    const start = new Date(startParam);
    const end = new Date(endParam);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      return { start, end, preset: "custom" };
    }
  }

  // Default: last 7 days (week)
  return { ...getPresetDates("week"), preset: "week" };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const dateRange = parseDateRange(request);
  const timestampFilter = { timestamp: { gte: startOfDay(dateRange.start), lte: endOfDay(dateRange.end) } };
  const viewWhere = { shop: session.shop, ...timestampFilter };

  // Get all view events FIRST to see what's actually in the database
  const allViewEvents = await db.viewEvent.findMany({
    where: viewWhere,
    orderBy: { timestamp: 'desc' }
  });
  
  console.log(`[Analytics] DEBUG: Total views in database for shop ${session.shop}: ${allViewEvents.length}`);
  allViewEvents.forEach(view => {
    console.log(`[Analytics] View Event: id=${view.id}, productId=${view.productId}, variantId=${view.variantId}, abTestId=${view.abTestId}, price=${view.price}, timestamp=${view.timestamp}`);
  });

  // Product filter from URL (comma-separated product IDs)
  const url = new URL(request.url);
  const productIdsParam = url.searchParams.get("productIds");
  const productIdSet = productIdsParam
    ? new Set(productIdsParam.split(",").map((id) => id.trim()).filter(Boolean))
    : null;

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

  // All unique products across tests (for filter dropdown)
  const allProductsList: { productId: string; productTitle: string }[] = [];
  const seenIds = new Set<string>();
  for (const test of tests) {
    for (const p of test.products) {
      if (!seenIds.has(p.productId)) {
        seenIds.add(p.productId);
        allProductsList.push({ productId: p.productId, productTitle: p.productTitle });
      }
    }
  }

  // Get all view events with variantId = null (base price views) for this shop
  const basePriceViews = await db.viewEvent.findMany({
    where: { 
      ...viewWhere,
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
      ...viewWhere,
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
  const conversionWhere = { shop: session.shop, abTestId: { not: null }, ...timestampFilter };
  const allConversionEvents = await db.conversionEvent.findMany({
    where: conversionWhere
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
      
      if (productIdSet && !productIdSet.has(productId)) return null;
      
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
    }).filter((row): row is NonNullable<typeof row> => row != null);
  });

  // Add base price analytics data for each test
  const basePriceAnalytics = tests.flatMap((test) => {
    const startDate = test.startedAt || test.createdAt;
    const endDate = test.status === 'completed' ? test.endedAt || new Date() : new Date();
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    
    return test.products
      .filter((product) => !productIdSet || productIdSet.has(product.productId))
      .map((product) => {
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

  // Group variants by test and product for better display (respect product filter)
  const testsWithVariants = tests
    .filter((test) => !productIdSet || test.products.some((p) => productIdSet.has(p.productId)))
    .map(test => {
    if (test.testType === "multiple") {
      // For multiple product tests, group by product (only products in filter)
      const productsWithVariants = test.products
        .filter((product) => !productIdSet || productIdSet.has(product.productId))
        .map(product => {
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

  return json({
    analyticsData: allAnalyticsData,
    summaryStats,
    testsWithVariants,
    allProducts: allProductsList,
    productIdsFilter: productIdsParam ? productIdsParam.split(",").map((id) => id.trim()).filter(Boolean) : [],
    dateRange: {
      startDate: dateRange.start.toISOString().slice(0, 10),
      endDate: dateRange.end.toISOString().slice(0, 10),
      preset: dateRange.preset,
    },
  });
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
  // Track which URL the fetcher data was loaded for – so we show loader data immediately after filter change
  const fetcherSearchRef = useRef(location.search);
  
  // Mark component as mounted after initial render
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only use fetcher data if it was loaded for the current URL (filters). Otherwise use loader data so filter changes apply immediately.
  const fetcherMatchesCurrentUrl = location.search === fetcherSearchRef.current;
  // When URL (filters) changed, prefer loader data so filter changes apply immediately; once fetcher completes for this URL we use fetcher data.
  const analyticsData = (fetcherMatchesCurrentUrl && fetcher.data?.analyticsData) ? fetcher.data.analyticsData : initialData.analyticsData;
  const summaryStats = (fetcherMatchesCurrentUrl && fetcher.data?.summaryStats) ? fetcher.data.summaryStats : initialData.summaryStats;
  const testsWithVariants = (fetcherMatchesCurrentUrl && fetcher.data?.testsWithVariants) ? fetcher.data.testsWithVariants : initialData.testsWithVariants;
  const allProducts = (fetcherMatchesCurrentUrl && fetcher.data?.allProducts) ? fetcher.data.allProducts : (initialData.allProducts ?? []);
  const productIdsFilter = (fetcherMatchesCurrentUrl && fetcher.data?.productIdsFilter) ? fetcher.data.productIdsFilter : (initialData.productIdsFilter ?? []);
  const dateRangeFromServer = (fetcherMatchesCurrentUrl && fetcher.data?.dateRange) ? fetcher.data.dateRange : initialData.dateRange;
  const isRefreshing = fetcher.state === "loading";

  // Date range filter: modal + presets
  const searchParams = new URLSearchParams(location.search);
  const rangeParam = searchParams.get("range") as DateRangePreset | null;
  const activePreset = dateRangeFromServer?.preset ?? (rangeParam || "week");
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [productPopoverActive, setProductPopoverActive] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<DateRangePreset>(activePreset);
  const [startDateInput, setStartDateInput] = useState(() => searchParams.get("startDate") ?? dateRangeFromServer?.startDate ?? "");
  const [endDateInput, setEndDateInput] = useState(() => searchParams.get("endDate") ?? dateRangeFromServer?.endDate ?? "");
  const now = new Date();
  const [datePickerMonth, setDatePickerMonth] = useState(now.getMonth());
  const [datePickerYear, setDatePickerYear] = useState(now.getFullYear());

  // Client-side preset to date range (YYYY-MM-DD) for syncing calendar when preset is selected
  const getPresetDateStrings = (preset: DateRangePreset): { startDate: string; endDate: string } => {
    const toYMD = (d: Date) => d.toISOString().slice(0, 10);
    const startOfDay = (d: Date) => new Date(new Date(d).setUTCHours(0, 0, 0, 0));
    const endOfDay = (d: Date) => new Date(new Date(d).setUTCHours(23, 59, 59, 999));
    if (preset === "today") {
      const d = new Date();
      return { startDate: toYMD(startOfDay(d)), endDate: toYMD(endOfDay(d)) };
    }
    if (preset === "yesterday") {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      return { startDate: toYMD(startOfDay(d)), endDate: toYMD(endOfDay(d)) };
    }
    if (preset === "week") {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 6);
      return { startDate: toYMD(startOfDay(d)), endDate: toYMD(endOfDay(now)) };
    }
    if (preset === "lastWeek") {
      const dayOfWeek = now.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const lastMonday = new Date(now);
      lastMonday.setUTCDate(now.getUTCDate() + mondayOffset - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
      return { startDate: toYMD(startOfDay(lastMonday)), endDate: toYMD(endOfDay(lastSunday)) };
    }
    if (preset === "last30days") {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 29);
      return { startDate: toYMD(startOfDay(d)), endDate: toYMD(endOfDay(now)) };
    }
    if (preset === "last90days") {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 89);
      return { startDate: toYMD(startOfDay(d)), endDate: toYMD(endOfDay(now)) };
    }
    if (preset === "last365days") {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 364);
      return { startDate: toYMD(startOfDay(d)), endDate: toYMD(endOfDay(now)) };
    }
    if (preset === "lastMonth") {
      const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastOfLastMonth = new Date(firstOfThisMonth);
      lastOfLastMonth.setUTCDate(0);
      const firstOfLastMonth = new Date(lastOfLastMonth.getUTCFullYear(), lastOfLastMonth.getUTCMonth(), 1);
      return { startDate: toYMD(firstOfLastMonth), endDate: toYMD(endOfDay(lastOfLastMonth)) };
    }
    if (preset === "last12months") {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - 11);
      d.setUTCDate(1);
      return { startDate: toYMD(startOfDay(d)), endDate: toYMD(endOfDay(now)) };
    }
    return { startDate: startDateInput || toYMD(now), endDate: endDateInput || toYMD(now) };
  };

  useEffect(() => {
    const start = searchParams.get("startDate");
    const end = searchParams.get("endDate");
    if (start) setStartDateInput(start);
    if (end) setEndDateInput(end);
  }, [location.search]);

  useEffect(() => {
    setPendingPreset(activePreset);
  }, [activePreset, showDateRangeModal]);

  // When opening modal or selecting a preset, sync date inputs so calendar shows the range
  useEffect(() => {
    if (showDateRangeModal && pendingPreset !== "custom") {
      const { startDate, endDate } = getPresetDateStrings(pendingPreset);
      setStartDateInput(startDate);
      setEndDateInput(endDate);
    }
  }, [showDateRangeModal, pendingPreset]);

  const customRangeForPicker = {
    start: startDateInput ? new Date(startDateInput) : new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
    end: endDateInput ? new Date(endDateInput) : now,
  };

  const applyDateRangeFromModal = () => {
    if (pendingPreset === "custom") {
      const params = new URLSearchParams();
      params.set("range", "custom");
      if (startDateInput) params.set("startDate", startDateInput);
      if (endDateInput) params.set("endDate", endDateInput);
      navigate(`/app/analytics?${params.toString()}`);
    } else {
      navigate(`/app/analytics?range=${pendingPreset}`);
    }
    setShowDateRangeModal(false);
  };
  
  // Always-on polling - starts automatically when component is mounted
  useEffect(() => {
    if (!isMounted) return; // Wait until component is mounted

    // Don't fetch immediately - we already have initial data from loader
    // Start polling after page is fully loaded
      const initialDelay = setTimeout(() => {
      // Then refresh every 5 seconds (preserve date filter via URL)
      refreshIntervalRef.current = setInterval(() => {
        try {
          if (fetcher.state === "idle") {
            const params = new URLSearchParams(location.search);
            params.set("refresh", "true");
            fetcherSearchRef.current = location.search;
            fetcher.load(`/app/analytics?${params.toString()}`);
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
  }, [isMounted, location.search]); // Re-run when date filter (URL) changes
  
  // When filters (URL) change by user action, refetch immediately so data and "Last updated" reflect the new filters right away.
  const prevSearchRef = useRef(location.search);
  useEffect(() => {
    if (!isMounted || fetcher.state === "loading") return;
    if (prevSearchRef.current === location.search) return;
    prevSearchRef.current = location.search;
    fetcherSearchRef.current = ""; // Prefer loader data until this load completes
    fetcher.load(`/app/analytics${location.search ? `?${location.search.replace(/^\?/, "")}` : ""}`);
  }, [location.search, isMounted, fetcher.state]);

  // When fetcher completes, mark that we have data for the current URL so we can show it (and update lastUpdate).
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      fetcherSearchRef.current = location.search;
    }
  }, [fetcher.state, fetcher.data, location.search]);

  // Update last update time when data changes
  useEffect(() => {
    if (fetcher.data) {
      setLastUpdate(new Date());
    }
  }, [fetcher.data]);
  
  const analyticsUrl = () => {
    const params = new URLSearchParams(location.search);
    params.set("refresh", "true");
    return `/app/analytics?${params.toString()}`;
  };

  const refreshAnalytics = () => {
    if (fetcher.state === "idle") {
      try {
        fetcherSearchRef.current = location.search;
        fetcher.load(analyticsUrl());
      } catch (error) {
        console.error("Error refreshing analytics:", error);
      }
    }
  };

  const clearDateFilter = () => {
    setStartDateInput("");
    setEndDateInput("");
    navigate("/app/analytics?range=week");
  };

  const currentRangeLabel = activePreset === "custom" && dateRangeFromServer
    ? `${dateRangeFromServer.startDate} – ${dateRangeFromServer.endDate}`
    : PRESET_LABELS[activePreset];

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
                <Text variant="bodyLg" fontWeight="regular">
                  Live Analytics
                </Text>
                <Badge tone={isRefreshing ? "attention" : "success"}>
                  {isRefreshing ? 'Updating...' : 'Live'}
                </Badge>
                <Text variant="bodyMd" tone="subdued" fontWeight="regular">
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

        {/* Filter bar – Card with explicit white background and larger font to match other cards */}
        <Card>
          <Box
            padding="300"
            background="bg-surface"
            borderRadius="200"
            minHeight="52px"
            style={{
              fontSize: '21px',
              fontWeight: 400,
              backgroundColor: 'var(--p-color-bg-surface, #ffffff)',
              boxShadow: 'var(--p-shadow-card, 0 0 0 1px rgba(63, 63, 68, 0.05), 0 1px 3px rgba(63, 63, 68, 0.15)',
            }}
          >
            <InlineStack align="center" blockAlign="center" gap="400" wrap>
              {/* Left: filter controls */}
              <InlineStack align="center" gap="300" wrap={false}>
                <Text as="span" variant="bodyLg" fontWeight="regular" tone="subdued">
                  Filters
                </Text>
              <Button
                onClick={() => setShowDateRangeModal(true)}
                size="medium"
                variant="tertiary"
                disclosure="down"
              >
                {currentRangeLabel}
              </Button>
              {allProducts.length > 0 && (
                <Popover
                  active={productPopoverActive}
                  activator={
                    <Button
                      size="medium"
                      variant="tertiary"
                      onClick={() => setProductPopoverActive(true)}
                      disclosure={!productPopoverActive ? "down" : "up"}
                    >
                      {productIdsFilter.length === 1
                        ? allProducts.find((p) => p.productId === productIdsFilter[0])?.productTitle ?? "All products"
                        : "Product"}
                    </Button>
                  }
                  onClose={() => setProductPopoverActive(false)}
                  autofocusTarget="first-node"
                >
                  <ActionList
                    items={[
                      {
                        content: "All products",
                        onAction: () => {
                          const params = new URLSearchParams(location.search);
                          params.delete("productIds");
                          navigate(`/app/analytics?${params.toString()}`);
                          setProductPopoverActive(false);
                        },
                      },
                      ...allProducts.map((p) => ({
                        content: p.productTitle,
                        onAction: () => {
                          const params = new URLSearchParams(location.search);
                          params.set("productIds", p.productId);
                          navigate(`/app/analytics?${params.toString()}`);
                          setProductPopoverActive(false);
                        },
                      })),
                    ]}
                  />
                </Popover>
              )}
            </InlineStack>
            {/* Right: active filter chips + clear all */}
            <InlineStack align="center" gap="300" wrap>
              {activePreset !== "week" && (
                <Tag onRemove={() => {
                  const params = new URLSearchParams(location.search);
                  params.set("range", "week");
                  navigate(`/app/analytics?${params.toString()}`);
                }}>
                  {currentRangeLabel}
                </Tag>
              )}
              {productIdsFilter.length === 1 && (
                <Tag onRemove={() => {
                  const params = new URLSearchParams(location.search);
                  params.delete("productIds");
                  navigate(`/app/analytics?${params.toString()}`);
                }}>
                  {allProducts.find((p) => p.productId === productIdsFilter[0])?.productTitle ?? "Product"}
                </Tag>
              )}
              {(activePreset !== "week" || productIdsFilter.length > 0) && (
                <Button
                  variant="plain"
                  size="medium"
                  onClick={() => navigate("/app/analytics?range=week")}
                >
                  Clear all
                </Button>
              )}
            </InlineStack>
          </InlineStack>
          </Box>
        </Card>

        {/* Date range modal - two panels: presets (left) + custom calendar (right) */}
        <Modal
          open={showDateRangeModal}
          onClose={() => setShowDateRangeModal(false)}
          title="Date range"
          size="large"
          primaryAction={{
            content: "Apply",
            onAction: applyDateRangeFromModal,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setShowDateRangeModal(false) },
          ]}
        >
          <Modal.Section>
            <Box paddingBlockEnd="400">
              <InlineStack gap="0" blockAlign="stretch" wrap={false}>
                {/* Left panel: preset list */}
                <Box
                  minWidth="220px"
                  maxWidth="260px"
                  maxHeight="360px"
                  overflowY="auto"
                  paddingInlineEnd="400"
                  borderWidth="025"
                  borderColor="border"
                  borderBlockEndWidth="0"
                  borderInlineEndWidth="1"
                  background="bg-surface-secondary"
                  paddingBlockStart="300"
                  paddingBlockEnd="300"
                  paddingInlineStart="300"
                >
                  <BlockStack gap="0">
                    {PRESET_VALUES.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPendingPreset(preset)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          width: "100%",
                          padding: "10px 12px",
                          textAlign: "left",
                          background: pendingPreset === preset ? "var(--p-color-bg-surface-selected)" : "transparent",
                          border: "none",
                          borderRadius: "var(--p-border-radius-200)",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontFamily: "inherit",
                          minHeight: "40px",
                        }}
                      >
                        <span style={{ minWidth: "20px", display: "inline-flex" }}>
                          {pendingPreset === preset ? (
                            <Icon source="checkmark" tone="base" />
                          ) : null}
                        </span>
                        <Text as="span" variant="bodyMd">
                          {PRESET_LABELS[preset]}
                        </Text>
                      </button>
                    ))}
                  </BlockStack>
                </Box>
                {/* Right panel: Fixed – always show date range + calendar */}
                <Box padding="400" minWidth="320px" minHeight="400px">
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingSm">
                      Fixed
                    </Text>
                    {pendingPreset !== "custom" && (
                      <Text variant="bodyMd" tone="subdued">
                        {PRESET_LABELS[pendingPreset]} • Click Apply to use, or pick dates below
                      </Text>
                    )}
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Select start and end date
                    </Text>
                    <InlineStack gap="200" blockAlign="center">
                      <TextField
                        label=""
                        type="date"
                        value={startDateInput}
                        onChange={(v) => {
                          setStartDateInput(v);
                          setPendingPreset("custom");
                        }}
                        autoComplete="off"
                      />
                      <Text as="span" variant="bodyMd" tone="subdued">
                        –
                      </Text>
                      <TextField
                        label=""
                        type="date"
                        value={endDateInput}
                        onChange={(v) => {
                          setEndDateInput(v);
                          setPendingPreset("custom");
                        }}
                        autoComplete="off"
                      />
                    </InlineStack>
                    <Box paddingBlockStart="200">
                      <DatePicker
                        month={datePickerMonth}
                        year={datePickerYear}
                        allowRange
                        multiMonth
                        selected={customRangeForPicker}
                        onChange={(range) => {
                          setStartDateInput(range.start.toISOString().slice(0, 10));
                          setEndDateInput(range.end.toISOString().slice(0, 10));
                          setPendingPreset("custom");
                        }}
                        onMonthChange={(month, year) => {
                          setDatePickerMonth(month);
                          setDatePickerYear(year);
                        }}
                      />
                    </Box>
                  </BlockStack>
                </Box>
              </InlineStack>
            </Box>
          </Modal.Section>
        </Modal>

        <Layout>
          <Layout.Section>
            <InlineStack align="space-between" blockAlign="center" gap="300">
              <BlockStack gap="300">
                <Text as="h1" variant="headingXl" fontWeight="semibold">
                  Analytics
                </Text>
                <Text variant="bodyLg" as="p" tone="subdued" fontWeight="regular">
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
