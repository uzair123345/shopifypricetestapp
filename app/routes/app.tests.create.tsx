import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { useLocation } from "@remix-run/react";
import { Page, Card, BlockStack, InlineStack, Text, Button, Icon } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function CreateTestLanding() {
  const location = useLocation();
  const search = location.search || "";

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
                  <Text variant="bodyMd" tone="subdued">
                    Test different prices for a single product.
                  </Text>
                  <Button url={`/app/tests/new?type=single${search}`} variant="primary">
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
                  <Text variant="bodyMd" tone="subdued">
                    Test prices across multiple products at once.
                  </Text>
                  <Button url={`/app/tests/new?type=multiple${search}`}>
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