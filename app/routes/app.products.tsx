import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
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
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch products from Shopify
  const response = await admin.graphql(`
    query getProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            status
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  inventoryQuantity
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
  const shopifyProducts = responseJson.data?.products?.edges?.map((edge: any) => edge.node) || [];

  // Get test status for each product from our database
  const productIds = shopifyProducts.map((product: any) => product.id.replace('gid://shopify/Product/', ''));
  
  const productTests = await db.aBTestProduct.findMany({
    where: {
      productId: { in: productIds },
      abTest: { shop: session.shop }
    },
    include: {
      abTest: true
    }
  });

  // Create a map of product test statuses and test IDs
  const testStatusMap = new Map();
  const testIdMap = new Map();
  productTests.forEach((productTest) => {
    const productId = productTest.productId;
    const testStatus = productTest.abTest.status;
    const testId = productTest.abTest.id;
    
    // Store test ID for this product
    testIdMap.set(productId, testId);
    
    // Determine overall test status for this product
    if (testStatus === 'active' || testStatus === 'paused') {
      testStatusMap.set(productId, 'testing');
    } else if (testStatus === 'completed') {
      testStatusMap.set(productId, 'completed');
    } else {
      testStatusMap.set(productId, 'available');
    }
  });

  // Transform Shopify products to our format
  const products = shopifyProducts.map((product: any) => {
    const productId = product.id.replace('gid://shopify/Product/', '');
    const firstImage = product.images.edges[0]?.node;
    const firstVariant = product.variants.edges[0]?.node;
    
    return {
      id: productId,
      title: product.title,
      handle: product.handle,
      price: firstVariant ? `$${parseFloat(firstVariant.price).toFixed(2)}` : "$0.00",
      status: product.status.toLowerCase(),
      testStatus: testStatusMap.get(productId) || 'available',
      testId: testIdMap.get(productId) || null,
      image: firstImage?.url || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png",
      variants: product.variants.edges.length,
      inventory: firstVariant?.inventoryQuantity || 0,
    };
  });

  return json({ products });
};

export default function Products() {
  const { products } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const getTestStatusBadge = (status: string) => {
    switch (status) {
      case "testing":
        return <Badge tone="info">Testing</Badge>;
      case "completed":
        return <Badge tone="success">Completed</Badge>;
      case "available":
        return <Badge tone="new">Available</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <Page>
      <TitleBar title="Products" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
              <BlockStack gap="200">
                <Text as="h1" variant="headingLg">
                  Products
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Manage products available for price testing
                </Text>
              </BlockStack>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            {products.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No products found"
                  action={{
                    content: "Import products from Shopify",
                    onAction: () => {},
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Import your Shopify products to start creating price tests.</p>
                </EmptyState>
              </Card>
            ) : (
              <Card>
                <ResourceList
                  resourceName={{ singular: "product", plural: "products" }}
                  items={products}
                  renderItem={(item) => {
                    const { id, title, handle, price, status, testStatus, image, variants, inventory } = item;
                    return (
                      <ResourceItem
                        id={id}
                        accessibilityLabel={`View details for ${title}`}
                        media={
                          <Thumbnail
                            source={image}
                            alt={title}
                            size="medium"
                          />
                        }
                      >
                        <InlineStack align="space-between">
                          <BlockStack gap="200">
                            <InlineStack gap="200" align="start">
                              <Text variant="bodyMd" fontWeight="bold" as="h3">
                                {title}
                              </Text>
                              <Badge tone={status === "active" ? "success" : "warning"}>
                                {status}
                              </Badge>
                              {getTestStatusBadge(testStatus)}
                            </InlineStack>
                            <InlineStack gap="400">
                              <Text as="p" variant="bodyMd" tone="subdued">
                                Price: {price}
                              </Text>
                              <Text as="p" variant="bodyMd" tone="subdued">
                                Variants: {variants}
                              </Text>
                              <Text as="p" variant="bodyMd" tone="subdued">
                                Inventory: {inventory}
                              </Text>
                            </InlineStack>
                          </BlockStack>
                          <BlockStack gap="200" align="end">
                            {testStatus === "available" && (
                              <Button 
                                size="slim" 
                                variant="primary"
                                onClick={() => {
                                  console.log("🔍 CREATE TEST BUTTON CLICKED");
                                  console.log("  - Product ID:", item.id);
                                  console.log("  - Product Title:", item.title);
                                  console.log("  - Navigation URL:", `/app/tests?create=true&productId=${item.id}&productTitle=${encodeURIComponent(item.title)}`);
                                  console.log("  - About to navigate...");
                                  navigate(`/app/tests?create=true&productId=${item.id}&productTitle=${encodeURIComponent(item.title)}`);
                                  console.log("  - Navigation called!");
                                }}
                              >
                                Create Test
                              </Button>
                            )}
                            {testStatus === "testing" && (
                              <Button 
                                size="slim" 
                                variant="secondary"
                                onClick={() => {
                                  console.log("🔍 VIEW TEST BUTTON CLICKED");
                                  console.log("  - Test ID:", item.testId);
                                  console.log("  - Product ID:", item.id);
                                  console.log("  - Navigation URL:", `/app/test-view/${item.testId}`);
                                  console.log("  - About to navigate...");
                                  navigate(`/app/test-view/${item.testId}`);
                                  console.log("  - Navigation called!");
                                }}
                              >
                                View Test
                              </Button>
                            )}
                            {testStatus === "paused" && (
                              <Button size="slim" variant="primary">
                                Start Test
                              </Button>
                            )}
                            {testStatus === "completed" && (
                              <Button size="slim" variant="secondary">
                                View Results
                              </Button>
                            )}
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
