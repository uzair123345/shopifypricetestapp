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
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Mock product data - in a real app, this would come from Shopify's GraphQL API
  const products = [
    {
      id: "1",
      title: "Premium Wireless Headphones",
      handle: "premium-wireless-headphones",
      price: "$199.99",
      status: "active",
      testStatus: "testing",
      image: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png",
      variants: 3,
      inventory: 45,
    },
    {
      id: "2",
      title: "Smart Fitness Watch",
      handle: "smart-fitness-watch", 
      price: "$299.99",
      status: "active",
      testStatus: "completed",
      image: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png",
      variants: 2,
      inventory: 23,
    },
    {
      id: "3",
      title: "Bluetooth Speaker",
      handle: "bluetooth-speaker",
      price: "$89.99",
      status: "active", 
      testStatus: "available",
      image: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png",
      variants: 4,
      inventory: 67,
    },
  ];

  return json({ products });
};

export default function Products() {
  const { products } = useLoaderData<typeof loader>();

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
            <InlineStack align="space-between">
              <BlockStack gap="200">
                <Text as="h1" variant="headingLg">
                  Products
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Manage products available for price testing
                </Text>
              </BlockStack>
              <Button variant="primary">
                Import Products
              </Button>
            </InlineStack>
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
                        url={`/app/products/${id}`}
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
                              <Button size="slim" variant="primary">
                                Start Test
                              </Button>
                            )}
                            {testStatus === "testing" && (
                              <Button size="slim" variant="secondary">
                                View Test
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
