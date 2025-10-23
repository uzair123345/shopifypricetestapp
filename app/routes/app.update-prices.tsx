import { useState, useEffect } from "react";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, useNavigate, useLocation } from "@remix-run/react";
import {
  Card,
  Button,
  Text,
  Banner,
  Layout,
  Page,
  Spinner,
  Checkbox,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Call the API to update Shopify prices
    const response = await fetch(`${request.url.split('/app')[0]}/api/update-shopify-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (result.success) {
      return json({ 
        success: true, 
        message: `Successfully updated prices for ${result.rotatedTests} active tests!`,
        rotatedTests: result.rotatedTests
      });
    } else {
      return json({ 
        success: false, 
        message: result.error ? `Failed to update prices: ${result.error}` : "Failed to update prices. Please try again.",
        rotatedTests: result.rotatedTests ?? 0,
        failures: result.failures ?? [],
        raw: result
      });
    }
  } catch (error) {
    console.error("Error updating prices:", error);
    return json({ 
      success: false, 
      message: error instanceof Error ? `An error occurred while updating prices: ${error.message}` : "An error occurred while updating prices." 
    });
  }
};

export default function UpdatePrices() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const isSubmitting = navigation.state === "submitting";
  const [autoRotate, setAutoRotate] = useState(() => {
    // Check localStorage for saved state
    if (typeof window !== 'undefined') {
      return localStorage.getItem('autoRotateEnabled') === 'true';
    }
    return false;
  });
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Save auto-rotation state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoRotateEnabled', autoRotate.toString());
    }
  }, [autoRotate]);

  // Auto-rotation effect
  useEffect(() => {
    if (!autoRotate) return;

    const interval = setInterval(async () => {
      try {
        console.log("🔄 Auto-rotating prices...");
        const response = await fetch('/api/auto-rotate-prices', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
          setLastUpdate(new Date().toLocaleTimeString());
          console.log(`✅ Auto-rotation successful: ${result.message}`);
        } else {
          console.log(`❌ Auto-rotation failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ Auto-rotation error:`, error);
      }
    }, 60000); // Every 60 seconds (1 minute)

    return () => clearInterval(interval);
  }, [autoRotate]);

  return (
    <Page
      title="Update A/B Test Prices"
      subtitle="Manually rotate prices for all active A/B tests"
      backAction={{
        content: 'Dashboard',
        onAction: () => navigate(`/app${location.search || ""}`)
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text variant="headingMd" as="h2">
                Price Rotation
              </Text>
              <div style={{ marginTop: "16px", marginBottom: "20px" }}>
                <Text variant="bodyMd" as="p">
                  Click the button below to manually rotate prices for all active A/B tests. 
                  This will update the actual product prices in your Shopify store based on 
                  your test variants and traffic distribution.
                </Text>
              </div>
              
              {/* Auto-rotation toggle */}
              <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f6f6f7", borderRadius: "8px" }}>
                <Checkbox
                  label="Enable Automatic Price Rotation (Every 1 Minute)"
                  checked={autoRotate}
                  onChange={setAutoRotate}
                />
                {autoRotate && (
                  <div style={{ marginTop: "8px" }}>
                    <Text variant="bodySm" as="p" color="success">
                      ✅ Auto-rotation is active! Last update: {lastUpdate || "Starting..."}
                    </Text>
                  </div>
                )}
              </div>
              
              {actionData && (
                <div style={{ marginBottom: "20px" }}>
                  <Banner
                    status={actionData.success ? "success" : "critical"}
                    title={actionData.message}
                  >
                    {!actionData.success && actionData.failures && (
                      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12 }}>
                        {JSON.stringify(actionData.failures, null, 2)}
                      </pre>
                    )}
                    {!actionData.success && actionData.raw && (
                      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12 }}>
                        {JSON.stringify(actionData.raw, null, 2)}
                      </pre>
                    )}
                  </Banner>
                </div>
              )}
              
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Button
                  onClick={async () => {
                    try {
                      console.log("🔄 Starting price update...");
                      const response = await fetch('/api/update-shopify-prices', { 
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      const result = await response.json();
                      console.log("📊 Update result:", result);
                      
                      if (result.success) {
                        alert(`✅ Success! Updated prices for ${result.rotatedTests} tests`);
                      } else {
                        alert(`❌ Failed: ${result.error}\nFailures: ${JSON.stringify(result.failures || [], null, 2)}`);
                      }
                    } catch (error) {
                      console.error("💥 Update error:", error);
                      alert('Error: ' + error);
                    }
                  }}
                  primary
                >
                  Update Prices Now
                </Button>
              </div>
              
              {isSubmitting && (
                <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Spinner size="small" />
                  <Text variant="bodySm" as="span">
                    Rotating prices for all active tests...
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text variant="headingMd" as="h2">
                How It Works
              </Text>
              <div style={{ marginTop: "16px" }}>
                <Text variant="bodyMd" as="p">
                  When you click "Update Prices Now", the system will:
                </Text>
                <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                  <li>Find all active A/B tests</li>
                  <li>Rotate through test variants based on time (every 1 minute)</li>
                  <li>Update the actual product prices in Shopify</li>
                  <li>Ensure customers see consistent prices throughout their shopping journey</li>
                </ul>
                <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#e3f2fd", borderRadius: "8px" }}>
                  <Text variant="bodyMd" as="p" color="info">
                    <strong>Auto-Rotation:</strong> Enable the checkbox above to automatically rotate prices every minute without manual clicks.
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}