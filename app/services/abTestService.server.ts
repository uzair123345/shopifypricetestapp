import db from "../db.server";

interface CustomerSession {
  customerId?: string;
  sessionId: string;
  shop: string;
}

interface TestVariant {
  id: number;
  variantName: string;
  price: number;
  discount: number;
  trafficPercent: number;
  isBaseVariant: boolean;
  variantProductId?: string;
}

interface ProductTest {
  id: number;
  title: string;
  status: string;
  testType: string;
  baseTrafficPercent: number;
  products: Array<{
    id: number;
    productId: string;
    productTitle: string;
    basePrice: number;
  }>;
  variants: TestVariant[];
}

/**
 * Get active A/B tests for a specific product
 */
export async function getActiveTestsForProduct(productId: string, shop: string): Promise<ProductTest[]> {
  const tests = await db.aBTest.findMany({
    where: {
      shop,
      status: "active",
      products: {
        some: {
          productId: productId
        }
      }
    },
    include: {
      products: true,
      variants: true
    }
  });

  return tests.map(test => ({
    id: test.id,
    title: test.title,
    status: test.status,
    testType: test.testType,
    baseTrafficPercent: test.baseTrafficPercent,
    products: test.products,
    variants: test.variants
  }));
}

/**
 * Generate a consistent hash for a customer/session
 */
function generateCustomerHash(session: CustomerSession): number {
  const input = `${session.shop}-${session.sessionId}-${session.customerId || 'anonymous'}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Assign a customer to a test variant based on traffic distribution
 */
export function assignCustomerToVariant(
  session: CustomerSession, 
  variants: TestVariant[], 
  testId: number,
  originalPrice: number,
  baseTrafficPercent: number = 34
): TestVariant {
  // Generate a consistent hash for this customer/test combination
  const customerHash = generateCustomerHash(session);
  const testSeed = customerHash + testId; // Add test ID for different test distribution
  
  // Get a number between 0-99 based on the hash
  const randomValue = testSeed % 100;
  
  // Create base variant (original price) if not in variants
  const hasBaseVariant = variants.some(v => v.isBaseVariant);
  let allVariants = [...variants];
  
  if (!hasBaseVariant) {
    // Add base variant (original price)
    allVariants.unshift({
      id: 0, // Special ID for base variant
      variantName: "Original Price",
      price: originalPrice,
      discount: 0,
      trafficPercent: baseTrafficPercent,
      isBaseVariant: true
    });
  }
  
  // Sort variants by traffic percentage for consistent assignment
  const sortedVariants = [...allVariants].sort((a, b) => {
    if (a.isBaseVariant && !b.isBaseVariant) return -1;
    if (!a.isBaseVariant && b.isBaseVariant) return 1;
    return a.trafficPercent - b.trafficPercent;
  });

  let cumulativePercentage = 0;
  
  for (const variant of sortedVariants) {
    cumulativePercentage += variant.trafficPercent;
    if (randomValue < cumulativePercentage) {
      return variant;
    }
  }

  // Fallback to base variant if something goes wrong
  return sortedVariants.find(v => v.isBaseVariant) || sortedVariants[0];
}

/**
 * Get the price to display for a product based on active A/B tests
 */
export async function getDisplayPrice(
  productId: string, 
  originalPrice: number, 
  session: CustomerSession
): Promise<{
  price: number;
  variant?: TestVariant;
  testId?: number;
  isTestPrice: boolean;
}> {
  try {
    console.log(`[getDisplayPrice] Looking for tests for product ${productId} in shop ${session.shop}`);
    
    // Get active tests for this SPECIFIC product
    const activeTests = await getActiveTestsForProduct(productId, session.shop);
    
    console.log(`[getDisplayPrice] Found ${activeTests.length} active tests for product ${productId}`);
    
    if (activeTests.length === 0) {
      // No active tests for this specific product, return original price
      console.log(`[getDisplayPrice] No active tests for product ${productId}, returning original price ${originalPrice}`);
      return {
        price: originalPrice,
        isTestPrice: false
      };
    }

    // Use the most recent active test for this product
    const test = activeTests[0]; // They're already sorted by creation date in the query
    
    console.log(`[getDisplayPrice] Using test ${test.id} (${test.testType}) for product ${productId}`);
    console.log(`[getDisplayPrice] Test products:`, test.products.map(p => ({ id: p.productId, title: p.productTitle })));
    console.log(`[getDisplayPrice] All test variants:`, test.variants.map(v => ({ id: v.id, name: v.variantName, productId: v.variantProductId, price: v.price })));
    
    // Filter variants for this specific product
    let productVariants = test.variants;
    if (test.testType === "multiple") {
      // For multiple product tests, filter variants by product
      productVariants = test.variants.filter(v => 
        !v.variantProductId || v.variantProductId === productId
      );
      console.log(`[getDisplayPrice] Filtered to ${productVariants.length} variants for product ${productId}:`, productVariants.map(v => ({ id: v.id, name: v.variantName, productId: v.variantProductId, price: v.price })));
    }
    
    console.log(`[getDisplayPrice] Test has ${productVariants.length} variants for product ${productId}:`, productVariants.map(v => ({ id: v.id, name: v.variantName, price: v.price, traffic: v.trafficPercent })));
    
    // Get the base traffic percentage for this test
    const baseTrafficPercent = test.baseTrafficPercent || 34; // Default to 34% if not set
    
    // Assign customer to a variant
    const assignedVariant = assignCustomerToVariant(session, productVariants, test.id, originalPrice, baseTrafficPercent);
    
    console.log(`[getDisplayPrice] Assigned variant: ${assignedVariant.variantName} (ID: ${assignedVariant.id}) with price ${assignedVariant.price} (traffic: ${assignedVariant.trafficPercent}%) for product ${productId}`);
    
    return {
      price: assignedVariant.price,
      variant: assignedVariant,
      variantName: assignedVariant.variantName,
      testId: test.id,
      isTestPrice: true // All variants in an A/B test are "test prices" (including the base variant)
    };
  } catch (error) {
    console.error("Error getting display price:", error);
    // Fallback to original price on error
    return {
      price: originalPrice,
      isTestPrice: false
    };
  }
}

/**
 * Track a conversion event (purchase) for A/B test analytics
 */
export async function trackConversion(
  testId: number,
  variantId: number,
  productId: string,
  customerId?: string,
  orderValue?: number
): Promise<void> {
  try {
    // In a real implementation, you'd want to store this in a separate analytics table
    // For now, we'll just log it
    console.log("Conversion tracked:", {
      testId,
      variantId,
      productId,
      customerId,
      orderValue,
      timestamp: new Date()
    });
    
    // TODO: Implement actual conversion tracking in database
    // await db.conversionEvent.create({
    //   data: {
    //     testId,
    //     variantId,
    //     productId,
    //     customerId,
    //     orderValue,
    //     timestamp: new Date()
    //   }
    // });
  } catch (error) {
    console.error("Error tracking conversion:", error);
  }
}

/**
 * Get test analytics for a specific test
 */
export async function getTestAnalytics(testId: number): Promise<{
  testId: number;
  variants: Array<{
    variantId: number;
    variantName: string;
    views: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  }>;
}> {
  // TODO: Implement actual analytics from conversion tracking
  // For now, return mock data
  const test = await db.aBTest.findUnique({
    where: { id: testId },
    include: { variants: true }
  });

  if (!test) {
    throw new Error("Test not found");
  }

  return {
    testId,
    variants: test.variants.map(variant => ({
      variantId: variant.id,
      variantName: variant.variantName,
      views: Math.floor(Math.random() * 1000) + 100, // Mock data
      conversions: Math.floor(Math.random() * 50) + 5, // Mock data
      conversionRate: parseFloat((Math.random() * 10 + 2).toFixed(2)), // Mock data
      revenue: Math.floor(Math.random() * 5000) + 500 // Mock data
    }))
  };
}
