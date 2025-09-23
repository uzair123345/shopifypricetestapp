import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Select,
  TextField,
  Icon,
  Banner,
  Divider,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const selectedType = url.searchParams.get("type") === "multiple" ? "multiple" : "single";

  // Fetch products from Shopify
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
  const products = responseJson.data?.products?.edges?.map((edge: any) => ({
    id: edge.node.id.replace('gid://shopify/Product/', ''),
    title: edge.node.title,
    handle: edge.node.handle,
    price: edge.node.variants.edges[0]?.node?.price || '0',
  })) || [];

  return json({ products, selectedType });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const testType = formData.get("testType") as string;
  const title = formData.get("title") as string;
  const baseTrafficPercent = parseFloat(formData.get("baseTrafficPercent") as string);
  
  // Get variant data
  const variantNames = formData.getAll("variantName") as string[];
  const variantPrices = formData.getAll("variantPrice") as string[];
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

  try {
    // Calculate average base price for multiple products
    const basePrice = productPrices.length > 0 
      ? productPrices.reduce((sum, price) => sum + parseFloat(price), 0) / productPrices.length
      : 0;

    // Create the test
    const abTest = await db.aBTest.create({
      data: {
        title,
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
      if (variantNames[i] && variantPrices[i]) {
        await db.aBTestVariant.create({
          data: {
            abTestId: abTest.id,
            variantName: variantNames[i],
            price: parseFloat(variantPrices[i]),
            discount: variantDiscounts[i] ? parseFloat(variantDiscounts[i]) : null,
            trafficPercent: parseFloat(variantTrafficPercents[i]),
            isBaseVariant: false,
          },
        });
      }
    }

    return redirect(`/app/tests/${abTest.id}`);
  } catch (error) {
    return json({ error: "Failed to create test" }, { status: 500 });
  }
};

export default function NewTest() {
  const { products, selectedType } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [testType, setTestType] = useState(selectedType);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [baseTrafficPercent, setBaseTrafficPercent] = useState("50");
  const [variants, setVariants] = useState([
    { name: "", price: "", discount: "", trafficPercent: "25" },
    { name: "", price: "", discount: "", trafficPercent: "25" },
  ]);

  const selectedProductData = products.find((p: any) => p.id === selectedProduct);
  const selectedProductsData = products.filter((p: any) => selectedProducts.includes(p.id));

  const productOptions = products.map((product: any) => ({
    label: `${product.title} - $${product.price}`,
    value: product.id,
  }));

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
    // Reset selections when changing test type
    setSelectedProduct("");
    setSelectedProducts([]);
  };

  const updateVariant = (index: number, field: string, value: string) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const addVariant = () => {
    setVariants([...variants, { name: "", price: "", discount: "", trafficPercent: "0" }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const calculateTotalTraffic = () => {
    const variantTotal = variants.reduce((sum, variant) => sum + parseFloat(variant.trafficPercent || "0"), 0);
    return parseFloat(baseTrafficPercent || "0") + variantTotal;
  };

  return (
    <Page>
      <TitleBar title="Create New Test" />
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        <Form method="post">
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Test Configuration
                  </Text>

                  <TextField
                    label="Test Title"
                    name="title"
                    placeholder="e.g., Holiday Sale Price Test"
                    autoComplete="off"
                  />

                  <Select
                    label="Test Type"
                    name="testType"
                    options={[
                      { label: "Single Product Test", value: "single" },
                      { label: "Multiple Product Test", value: "multiple" },
                    ]}
                    value={testType}
                    onChange={handleTestTypeChange}
                    helpText="Choose whether to test one product or multiple products"
                  />

                  {testType === "single" ? (
                    <>
                      <Select
                        label="Select Product"
                        name="productId"
                        options={[
                          { label: "Choose a product...", value: "" },
                          ...productOptions,
                        ]}
                        value={selectedProduct}
                        onChange={setSelectedProduct}
                        helpText="Select the product you want to test different prices for"
                      />

                      {selectedProductData && (
                        <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="200">
                            <Text as="p" variant="bodyMd" fontWeight="bold">
                              Selected Product: {selectedProductData.title}
                            </Text>
                            <Text as="p" variant="bodyMd" tone="subdued">
                              Current Price: ${selectedProductData.price}
                            </Text>
                          </BlockStack>
                        </Box>
                      )}
                    </>
                  ) : (
                    <>
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        Select Products (Multiple Selection)
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Choose multiple products to test different prices across your catalog
                      </Text>
                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          {products.map((product: any) => (
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

                      {selectedProductsData.length > 0 && (
                        <Box padding="300" background="bg-surface-info" borderRadius="200">
                          <BlockStack gap="200">
                            <Text as="p" variant="bodyMd" fontWeight="bold">
                              Selected Products ({selectedProductsData.length}):
                            </Text>
                            {selectedProductsData.map((product: any) => (
                              <Text as="p" key={product.id} variant="bodyMd" tone="subdued">
                                • {product.title} - ${product.price}
                              </Text>
                            ))}
                          </BlockStack>
                        </Box>
                      )}
                    </>
                  )}

                  {/* Hidden inputs for form submission */}
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
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Price & Traffic Distribution
                  </Text>

                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="300">
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        Base Price (Original) - Control Group
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        This is the current price that will be shown to a portion of your customers as the control group.
                      </Text>
                      <InlineStack gap="400" align="start">
                        <Box minWidth="250px">
                          <Text as="p" variant="bodyMd" fontWeight="bold">
                            Current Price(s):
                          </Text>
                          {testType === "single" ? (
                            <Text as="p" variant="bodyMd">
                              ${selectedProductData?.price || "0.00"}
                            </Text>
                          ) : (
                            <BlockStack gap="100">
                              {selectedProductsData.length > 0 ? (
                                selectedProductsData.map((product: any) => (
                                  <Text as="p" key={product.id} variant="bodyMd">
                                    {product.title}: ${product.price}
                                  </Text>
                                ))
                              ) : (
                                <Text as="p" variant="bodyMd" tone="subdued">
                                  Select products to see prices
                                </Text>
                              )}
                            </BlockStack>
                          )}
                        </Box>
                        <Box minWidth="150px">
                          <TextField
                            label="Traffic %"
                            name="baseTrafficPercent"
                            type="number"
                            value={baseTrafficPercent}
                            onChange={setBaseTrafficPercent}
                            suffix="%"
                            min="0"
                            max="100"
                            step={0.1}
                            autoComplete="off"
                            helpText="Percentage of traffic to see original price"
                          />
                        </Box>
                      </InlineStack>
                    </BlockStack>
                  </Box>

                  <Divider />

                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingMd">
                          Price Variants
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Create 2-3 different price variants to test (recommended)
                        </Text>
                      </BlockStack>
                      <Button 
                        onClick={addVariant} 
                        size="slim"
                        disabled={variants.length >= 3}
                      >
                        Add Variant {variants.length >= 3 ? "(Max 3)" : ""}
                      </Button>
                    </InlineStack>

                    {variants.map((variant, index) => (
                      <Box key={index} padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <InlineStack gap="300" align="start">
                            <Box minWidth="200px">
                              <TextField
                                label="Variant Name"
                                name="variantName"
                                value={variant.name}
                                onChange={(value) => updateVariant(index, "name", value)}
                                placeholder="e.g., 10% Off, Premium Price"
                                autoComplete="off"
                                helpText="Give this variant a descriptive name"
                              />
                            </Box>
                            <Box minWidth="120px">
                              <TextField
                                label="New Price"
                                name="variantPrice"
                                type="number"
                                value={variant.price}
                                onChange={(value) => updateVariant(index, "price", value)}
                                prefix="$"
                                step={0.01}
                                autoComplete="off"
                                helpText="Set the test price"
                              />
                            </Box>
                            <Box minWidth="120px">
                              <TextField
                                label="Discount Amount"
                                name="variantDiscount"
                                type="number"
                                value={variant.discount}
                                onChange={(value) => updateVariant(index, "discount", value)}
                                prefix="$"
                                step={0.01}
                                autoComplete="off"
                                helpText="Optional discount"
                              />
                            </Box>
                            <Box minWidth="120px">
                              <TextField
                                label="Traffic %"
                                name="variantTrafficPercent"
                                type="number"
                                value={variant.trafficPercent}
                                onChange={(value) => updateVariant(index, "trafficPercent", value)}
                                suffix="%"
                                min="0"
                                max="100"
                                step={0.1}
                                autoComplete="off"
                                helpText="Traffic allocation"
                              />
                            </Box>
                            <Button
                              onClick={() => removeVariant(index)}
                              variant="tertiary"
                              tone="critical"
                              size="slim"
                            >
                              Remove
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>

                  <Box padding="400" background={calculateTotalTraffic() === 100 ? "bg-surface-success" : "bg-surface-critical"} borderRadius="200">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="p" variant="bodyMd" fontWeight="bold">
                          Total Traffic Distribution:
                        </Text>
                        <Text as="p" variant="bodyMd" fontWeight="bold" tone={calculateTotalTraffic() === 100 ? "success" : "critical"}>
                          {calculateTotalTraffic().toFixed(1)}%
                        </Text>
                      </InlineStack>
                      {calculateTotalTraffic() === 100 ? (
                        <Text as="p" variant="bodyMd" tone="success">
                          ✅ Perfect! All traffic is allocated correctly.
                        </Text>
                      ) : (
                        <Text as="p" variant="bodyMd" tone="critical">
                          ⚠️ Traffic distribution must equal exactly 100%. Currently at {calculateTotalTraffic().toFixed(1)}%
                        </Text>
                      )}
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <InlineStack align="end" gap="300">
                <Button url="/app/tests" variant="secondary">
                  Cancel
                </Button>
                <Button
                  submit
                  variant="primary"
                  loading={isSubmitting}
                  disabled={
                    calculateTotalTraffic() !== 100 || 
                    (testType === "single" ? !selectedProduct : selectedProducts.length === 0)
                  }
                >
                  Create Test
                </Button>
              </InlineStack>
            </Layout.Section>
          </Layout>
        </Form>
      </BlockStack>
    </Page>
  );
}
