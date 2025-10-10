import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useLocation, useSearchParams, Link, useNavigate, useActionData, useNavigation, Form } from "@remix-run/react";
import { useState, useEffect } from "react";
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
  Select,
  TextField,
  Banner,
  Divider,
  Box,
  RadioButton,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const isCreateMode = url.searchParams.get("create") === "true";
  
  // Preserve incoming auth/context query string from Shopify (embedded, host, hmac, id_token, session, shop, timestamp)
  // We'll forward this to internal links to avoid re-auth redirects
  const forwardSearch = url.search || "";
  console.log("=== TESTS LOADER DEBUG ===");
  console.log("Request URL:", request.url);
  console.log("Forward search:", forwardSearch);
  console.log("Session shop:", session.shop);

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

  // If in create mode, also fetch products
  let products = [];
  if (isCreateMode) {
    try {
      const response = await admin.graphql(`
        query getProducts($first: Int!) {
          products(first: $first) {
            edges {
              node {
                id
                title
                handle
                variants(first: 1) {
                  edges {
                    node {
                      id
                      price
                    }
                  }
                }
              }
            }
          }
        }
      `, {
        variables: { first: 50 }
      });

      const responseJson = await response.json();
      products = responseJson.data?.products?.edges?.map((edge: any) => ({
        id: edge.node.id.replace('gid://shopify/Product/', ''),
        title: edge.node.title,
        handle: edge.node.handle,
        price: edge.node.variants.edges[0]?.node?.price || '0',
      })) || [];
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }

  return json({ activeTests, shop: session.shop, products, forwardSearch });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const testType = formData.get("testType") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const baseTrafficPercent = parseFloat(formData.get("baseTrafficPercent") as string);
  
  // Get variant data
  const variantNames = formData.getAll("variantName") as string[];
  const variantDiscounts = formData.getAll("variantDiscount") as string[];
  const variantTrafficPercents = formData.getAll("variantTrafficPercent") as string[];

  // Get product data
  const productIds = formData.getAll("productId") as string[];
  const productTitles = formData.getAll("productTitle") as string[];
  const productHandles = formData.getAll("productHandle") as string[];
  const productPrices = formData.getAll("productPrice") as string[];

  // Validation
  const totalTraffic = baseTrafficPercent + variantTrafficPercents.reduce((sum, percent) => sum + parseFloat(percent), 0);
  if (Math.abs(totalTraffic - 100) > 0.01) {
    return json({ error: "Total traffic percentage must equal 100%" }, { status: 400 });
  }

  if (productIds.length === 0) {
    return json({ error: "Please select at least one product" }, { status: 400 });
  }

  if (!title || title.trim() === "") {
    return json({ error: "Test name is required" }, { status: 400 });
  }

  try {
    // Calculate average base price for multiple products
    const basePrice = productPrices.length > 0 
      ? productPrices.reduce((sum, price) => sum + parseFloat(price), 0) / productPrices.length
      : 0;

    // Create the test
    const abTest = await db.aBTest.create({
      data: {
        title,
        description: description || null,
        shop: session.shop,
        testType,
        basePrice,
        baseTrafficPercent,
        totalTrafficPercent: 100,
        status: "draft",
      },
    });

    // Add products
    for (let i = 0; i < productIds.length; i++) {
      if (productIds[i]) {
        await db.aBTestProduct.create({
          data: {
            abTestId: abTest.id,
            productId: productIds[i],
            productTitle: productTitles[i],
            productHandle: productHandles[i],
            basePrice: parseFloat(productPrices[i]),
          },
        });
      }
    }

    // Add variants
    for (let i = 0; i < variantNames.length; i++) {
      if (variantNames[i] && variantDiscounts[i]) {
        // Calculate the final price based on discount percentage
        const baseProductPrice = parseFloat(productPrices[0] || "0"); // Use first product's price for calculation
        const discountPercent = parseFloat(variantDiscounts[i]);
        const finalPrice = baseProductPrice - (baseProductPrice * discountPercent / 100);

        await db.aBTestVariant.create({
          data: {
            abTestId: abTest.id,
            variantName: variantNames[i],
            price: finalPrice,
            discount: discountPercent,
            trafficPercent: parseFloat(variantTrafficPercents[i]),
            isBaseVariant: i === 0, // First variant is the base/control variant
          },
        });
      }
    }

    // Preserve embedded app context by forwarding existing query params (e.g., host, shop)
    const currentUrl = new URL(request.url);
    const host = currentUrl.searchParams.get("host");
    const shopParam = currentUrl.searchParams.get("shop");
    const query = new URLSearchParams();
    if (shopParam) query.set("shop", shopParam);
    if (host) query.set("host", host);

    return redirect(`/app/tests/detail/${abTest.id}${query.toString() ? `?${query.toString()}` : ""}`);
  } catch (error) {
    console.error("Error creating test:", error);
    return json({ error: "Failed to create test" }, { status: 500 });
  }
};

export default function ActiveTests() {
  const { activeTests, shop, products, forwardSearch } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  
  const navigate = useNavigate();
  
  const isSubmitting = navigation.state === "submitting";

  // Check if we're in create mode
  const isCreateMode = searchParams.get("create") === "true";
  const selectedType = searchParams.get("type");
  
  // Form state
  const [testType, setTestType] = useState(selectedType || "single");
  const [testName, setTestName] = useState("");
  const [testDescription, setTestDescription] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [baseTrafficPercent, setBaseTrafficPercent] = useState("50");
  const [variants, setVariants] = useState([
    { name: "Control (Original Price)", discount: "0", trafficPercent: "25" },
    { name: "Test Variant 1", discount: "10", trafficPercent: "25" },
  ]);
  
  
  // Form logic
  const selectedProductData = products?.find((p: any) => p.id === selectedProduct);
  const selectedProductsData = products?.filter((p: any) => selectedProducts.includes(p.id)) || [];

  const productOptions = products?.map((product: any) => ({
    label: `${product.title} - $${product.price}`,
    value: product.id,
  })) || [];

  const handleProductSelection = (productId: string) => {
    if (testType === "single") {
      setSelectedProduct(productId);
    } else {
      if (selectedProducts.includes(productId)) {
        setSelectedProducts(selectedProducts.filter(id => id !== productId));
      } else {
        setSelectedProducts([...selectedProducts, productId]);
      }
    }
  };

  const handleTestTypeChange = (newTestType: string) => {
    setTestType(newTestType);
    setSelectedProduct("");
    setSelectedProducts([]);
  };

  const updateVariant = (index: number, field: string, value: string) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const addVariant = () => {
    setVariants([...variants, { name: `Test Variant ${variants.length}`, discount: "0", trafficPercent: "0" }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const calculateTotalTraffic = () => {
    const variantTotal = variants.reduce((sum, variant) => sum + parseFloat(variant.trafficPercent || "0"), 0);
    return parseFloat(baseTrafficPercent || "0") + variantTotal;
  };

  const calculateFinalPrice = (basePrice: number, discountPercent: number) => {
    const discount = (basePrice * discountPercent) / 100;
    return basePrice - discount;
  };

  // Build clean URLs for navigation
  // Prefer the server-provided forwardSearch (complete set of params from Shopify)
  const baseQueryString = (forwardSearch || location.search || "").replace(/^\?/, "");
  const createUrl = `/app/tests?create=true${baseQueryString ? `&${baseQueryString}` : ""}`;

  // Navigation handlers
  const handleContinueClick = (type: string) => {
    const newSearchParams = new URLSearchParams(location.search);
    newSearchParams.set("type", type);
    navigate(`/app/tests?${newSearchParams.toString()}`);
  };


  // If in create mode, show the create page
  if (isCreateMode) {
    // If no type selected, show test type selection
    if (!selectedType) {
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
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Test different prices for a single product.
                      </Text>
                      <Button variant="primary" onClick={() => handleContinueClick("single")}>
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
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Test prices across multiple products at once.
                      </Text>
                      <Button onClick={() => handleContinueClick("multiple")}>
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

    // If type is selected, show the form
    return (
      <Page>
        <TitleBar title="Create A/B Test" />
        <BlockStack gap="500">
          {actionData?.error && (
            <Banner tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}
          
          <Form method="post">
            <Card>
              <BlockStack gap="400">
                {/* Test Details Section */}
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Test Details</Text>
                  
                  <TextField
                    label="Test Name"
                    name="title"
                    placeholder="e.g., Product X Price Test"
                    value={testName}
                    onChange={setTestName}
                    autoComplete="off"
                    requiredIndicator
                  />

                  <TextField
                    label="Test Description"
                    name="description"
                    placeholder="Describe what you're testing..."
                    value={testDescription}
                    onChange={setTestDescription}
                    multiline={3}
                    autoComplete="off"
                  />
                </BlockStack>

              <Divider />

              {/* Test Type Section */}
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">Test Type</Text>
                <BlockStack gap="200">
                  <InlineStack gap="200" align="start">
                    <RadioButton
                      label="Single Product Test"
                      checked={testType === "single"}
                      id="single"
                      name="testType"
                      onChange={() => handleTestTypeChange("single")}
                    />
                  </InlineStack>
                  <InlineStack gap="200" align="start">
                    <RadioButton
                      label="Multiple Products Test"
                      checked={testType === "multiple"}
                      id="multiple"
                      name="testType"
                      onChange={() => handleTestTypeChange("multiple")}
                    />
                  </InlineStack>
                </BlockStack>
              </BlockStack>

              <Divider />

              {/* Product Selection Section */}
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">Product Selection</Text>
                
                {testType === "single" ? (
                  <>
                    <Select
                      label="Product"
                      options={[
                        { label: "Select a product...", value: "" },
                        ...productOptions,
                      ]}
                      value={selectedProduct}
                      onChange={setSelectedProduct}
                      requiredIndicator
                    />

                    {selectedProductData && (
                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <Text as="p" variant="bodyMd" fontWeight="bold">
                            Base Price ($): ${selectedProductData.price}
                          </Text>
                          <Text as="p" variant="bodyMd" tone="subdued">
                            The original price used as baseline for calculating variant prices
                          </Text>
                        </BlockStack>
                      </Box>
                    )}

                    <TextField
                      label="Base Price Traffic Percentage"
                      type="number"
                      value={baseTrafficPercent}
                      onChange={setBaseTrafficPercent}
                      suffix="%"
                      min="0"
                      max="100"
                      step={0.1}
                      autoComplete="off"
                      helpText="Percentage of visitors who will see the original price"
                    />
                  </>
                ) : (
                  <>
                    <Text as="p" variant="bodyMd" fontWeight="bold">
                      Select Products (Multiple Selection)
                    </Text>
                    <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="200">
                        {products?.map((product: any) => (
                          <InlineStack key={product.id} gap="300" align="space-between">
                            <InlineStack gap="200">
                              <input
                                type="checkbox"
                                id={`product-${product.id}`}
                                checked={selectedProducts.includes(product.id)}
                                onChange={() => handleProductSelection(product.id)}
                              />
                              <label htmlFor={`product-${product.id}`}>
                                <Text as="span" variant="bodyMd">
                                  {product.title} - ${product.price}
                                </Text>
                              </label>
                            </InlineStack>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Box>

                    <TextField
                      label="Base Price Traffic Percentage"
                      type="number"
                      value={baseTrafficPercent}
                      onChange={setBaseTrafficPercent}
                      suffix="%"
                      min="0"
                      max="100"
                      step={0.1}
                      autoComplete="off"
                      helpText="Percentage of visitors who will see the original price"
                    />
                  </>
                )}
              </BlockStack>

              <Divider />

              {/* Test Variants Section */}
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Test Variants</Text>
                  <Button 
                    onClick={addVariant} 
                    size="slim"
                    disabled={variants.length >= 5}
                  >
                    Add Variant
                  </Button>
                </InlineStack>

                {variants.map((variant, index) => (
                  <Box key={index} padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="h4" variant="headingSm">Variant {index + 1}</Text>
                        {index > 0 && (
                          <Button
                            onClick={() => removeVariant(index)}
                            variant="tertiary"
                            tone="critical"
                            size="slim"
                          >
                            Remove
                          </Button>
                        )}
                      </InlineStack>

                      <InlineStack gap="300" align="start">
                        <Box minWidth="200px">
                          <TextField
                            label="Variant Name"
                            value={variant.name}
                            onChange={(value) => updateVariant(index, "name", value)}
                            autoComplete="off"
                          />
                        </Box>
                        <Box minWidth="120px">
                          <TextField
                            label="Discount %"
                            type="number"
                            value={variant.discount}
                            onChange={(value) => updateVariant(index, "discount", value)}
                            suffix="%"
                            min="0"
                            max="100"
                            step={0.1}
                            autoComplete="off"
                          />
                        </Box>
                        <Box minWidth="120px">
                          <TextField
                            label="Final Price ($)"
                            type="number"
                            value={selectedProductData ? calculateFinalPrice(parseFloat(selectedProductData.price), parseFloat(variant.discount || "0")).toFixed(2) : "0.00"}
                            prefix="$"
                            step={0.01}
                            autoComplete="off"
                            disabled
                            helpText="Calculated automatically"
                          />
                        </Box>
                        <Box minWidth="120px">
                          <TextField
                            label="Traffic Percentage"
                            type="number"
                            value={variant.trafficPercent}
                            onChange={(value) => updateVariant(index, "trafficPercent", value)}
                            suffix="%"
                            min="0"
                            max="100"
                            step={0.1}
                            autoComplete="off"
                            helpText="Percentage of visitors who will see this variant"
                          />
                        </Box>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>

              {/* Traffic Allocation Warning */}
              <Box padding="400" background={calculateTotalTraffic() === 100 ? "bg-surface-secondary" : "bg-surface-critical"} borderRadius="200">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="bold" tone={calculateTotalTraffic() === 100 ? "success" : "critical"}>
                    Total traffic allocation: {calculateTotalTraffic().toFixed(0)}% - {calculateTotalTraffic() === 100 ? "Perfect!" : "Must equal 100%"}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Base price: {baseTrafficPercent}% | Test variants: {variants.reduce((sum, variant) => sum + parseFloat(variant.trafficPercent || "0"), 0).toFixed(0)}%
                  </Text>
                </BlockStack>
              </Box>

              {/* Action Buttons */}
              <InlineStack align="end" gap="300">
                <Button onClick={() => navigate("/app/tests")} variant="secondary">
                  Cancel
                </Button>
                <Button
                  submit
                  variant="primary"
                  loading={isSubmitting}
                  disabled={
                    !testName.trim() ||
                    calculateTotalTraffic() !== 100 || 
                    (testType === "single" ? !selectedProduct : selectedProducts.length === 0)
                  }
                >
                  Create Test
                </Button>
              </InlineStack>

              {/* Hidden form fields */}
              <input type="hidden" name="testType" value={testType} />
              <input type="hidden" name="baseTrafficPercent" value={baseTrafficPercent} />
              
              {testType === "single" ? (
                <>
                  <input type="hidden" name="productId" value={selectedProduct} />
                  <input type="hidden" name="productTitle" value={selectedProductData?.title || ""} />
                  <input type="hidden" name="productHandle" value={selectedProductData?.handle || ""} />
                  <input type="hidden" name="productPrice" value={selectedProductData?.price || "0"} />
                </>
              ) : (
                <>
                  {selectedProductsData.map((product: any) => (
                    <div key={product.id}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="productTitle" value={product.title} />
                      <input type="hidden" name="productHandle" value={product.handle} />
                      <input type="hidden" name="productPrice" value={product.price} />
                    </div>
                  ))}
                </>
              )}

              {variants.map((variant, index) => (
                <div key={index}>
                  <input type="hidden" name="variantName" value={variant.name} />
                  <input type="hidden" name="variantDiscount" value={variant.discount} />
                  <input type="hidden" name="variantTrafficPercent" value={variant.trafficPercent} />
                </div>
              ))}
            </BlockStack>
          </Card>
        </Form>
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
              <Button variant="primary" onClick={() => navigate(createUrl)}>
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
                    onAction: () => navigate(createUrl),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Start optimizing your product prices with data-driven A/B testing.</p>
                </EmptyState>
              </Card>
            ) : (
              <Card>
                <BlockStack gap="300">
                  {activeTests.map((item) => {
                    const { id, title, productName, originalPrice, testPrice, status, startDate, participants, conversionRate } = item;
                    // Build URL using TOP window's search params to preserve embedded auth context.
                    // IMPORTANT: Accessing window.top.location on a cross-origin frame throws a SecurityError.
                    // Always wrap in try/catch and fall back to the current frame's search params.
                    // Combine server-provided forwardSearch with any runtime params
                    const merged = new URLSearchParams((forwardSearch || location.search || "").replace(/^\?/, ""));
                    if (!merged.get("shop") && shop) merged.set("shop", shop);
                    const finalQuery = merged.toString();
                    const testUrl = `/app/test-view/${id}${finalQuery ? `?${finalQuery}` : ""}`;

                  return (
                    <Box
                      key={id}
                      padding="400" 
                      background="bg-surface-secondary" 
                      borderRadius="200" 
                      data-test-id={`test-card-${id}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(testUrl)}
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
                    </Box>
                    );
                  })}
                </BlockStack>
              </Card>
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
