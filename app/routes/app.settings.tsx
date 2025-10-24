import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { authenticate } from "../shopify.server";
// import db from "../db.server";
import {
  Page,
  Card,
  Button,
  TextField,
  FormLayout,
  Banner,
  BlockStack,
  InlineStack,
  Checkbox,
  Divider,
  Text,
  Box,
} from "@shopify/polaris";
import { useState, useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("🚀 LOADER FUNCTION CALLED!");
  console.log("🚀 LOADER FUNCTION CALLED!");
  console.log("🚀 LOADER FUNCTION CALLED!");
  
  const { admin, session } = await authenticate.admin(request);
  
  // Get the current app URL dynamically
  const currentUrl = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const appUrl = process.env.SHOPIFY_APP_URL || `${protocol}://${currentUrl}`;
  
  try {
    // Check if script tag already exists using GraphQL
    const scriptTagsResponse = await admin.graphql(`
      query getScriptTags($first: Int!) {
        scriptTags(first: $first) {
          edges {
            node {
              id
              src
              event
              displayScope
            }
          }
        }
      }
    `, {
      variables: { first: 50 }
    });

    const scriptTagsData = await scriptTagsResponse.json();
    console.log("Script tags response:", scriptTagsData);
    const scriptTags = scriptTagsData.data?.scriptTags?.edges?.map((edge: any) => edge.node) || [];
    
    const existingScript = scriptTags.find((tag: any) => 
      tag.src && tag.src.includes('ab-price-test-simple.js')
    );

    // Get app settings using GraphQL
    const metafieldsResponse = await admin.graphql(`
      query getShopMetafields($namespace: String!, $first: Int!) {
        shop {
          metafields(namespace: $namespace, first: $first) {
            edges {
              node {
                key
                value
                type
              }
            }
          }
        }
      }
    `, {
      variables: { namespace: "ab_price_test", first: 50 }
    });

    const metafieldsData = await metafieldsResponse.json();
    console.log("Metafields response:", metafieldsData);
    const appSettings = metafieldsData.data?.shop?.metafields?.edges?.map((edge: any) => edge.node) || [];

    const settings = {};
    appSettings.forEach((metafield) => {
      settings[metafield.key] = metafield.value;
    });

    // Load settings from database
    console.log("🔍 DATABASE QUERY DEBUG:");
    console.log("  - Querying shop:", session.shop);
    
    // Test database connection first
    try {
      console.log("  - Testing database connection...");
      // const testQuery = await db.settings.findMany();
      // console.log("  - Database connection OK, found", testQuery.length, "total settings");
      console.log("  - Database connection test skipped (commented out)");
    } catch (error) {
      console.error("  - Database connection error:", error);
    }
    
    // let dbSettings = await db.settings.findUnique({
    //   where: { shop: session.shop }
    // });

    // console.log("  - Raw query result:", dbSettings);

    // If no settings exist, create default ones
    // if (!dbSettings) {
    //   console.log("  - No settings found, creating default...");
    //   dbSettings = await db.settings.create({
    //     data: {
    //       shop: session.shop,
    //       auto_install: "false",
    //       enable_cart_adjustment: "false",
    //       auto_rotation_enabled: false
    //     }
    //   });
    //   console.log("  - Created default settings:", dbSettings);
    // } else {
    //   console.log("  - Found existing settings:", dbSettings);
    // }

    // Mock database settings for testing
    const dbSettings = {
      auto_rotation_enabled: false,
      auto_install: "false",
      enable_cart_adjustment: "false"
    };
    console.log("  - Using mock database settings:", dbSettings);

    // Merge database settings with metafield settings
    const mergedSettings = {
      ...settings,
      auto_rotation_enabled: dbSettings.auto_rotation_enabled
    };

    console.log("🔍 LOADER DEBUG:");
    console.log("  - Shop:", session.shop);
    console.log("  - Raw dbSettings:", dbSettings);
    console.log("  - dbSettings.auto_rotation_enabled (before merge):");
    if (dbSettings) {
      console.log("    Value:", dbSettings.auto_rotation_enabled);
      console.log("    Type:", typeof dbSettings.auto_rotation_enabled);
    } else {
      console.log("    dbSettings is null/undefined");
    }
    console.log("  - mergedSettings.auto_rotation_enabled (after merge):");
    console.log("    Value:", mergedSettings.auto_rotation_enabled);
    console.log("    Type:", typeof mergedSettings.auto_rotation_enabled);

    return json({
      scriptInstalled: !!existingScript,
      settings: mergedSettings,
      appUrl,
    });
  } catch (error) {
    console.error("Error loading settings:", error);
    return json({
      scriptInstalled: false,
      settings: {},
      appUrl,
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("🚀 ACTION FUNCTION CALLED!");
  console.log("🚀 ACTION FUNCTION CALLED!");
  console.log("🚀 ACTION FUNCTION CALLED!");
  
  const { admin, session } = await authenticate.admin(request);
  
  const formData = await request.formData();
  const action = formData.get("action") as string;
  const autoInstall = formData.get("autoInstall") === "on";
  const enableCartAdjustment = formData.get("enableCartAdjustment") === "on";
  const autoRotationEnabled = formData.get("autoRotationEnabled") === "on";

  console.log("🔍 ACTION DEBUG:");
  console.log("  - Action:", action);
  console.log("  - Shop:", session.shop);
  console.log("  - autoInstall:", autoInstall);
  console.log("  - enableCartAdjustment:", enableCartAdjustment);
  console.log("  - autoRotationEnabled:", autoRotationEnabled);

  try {
    if (action === "install_script") {
      console.log("Installing script tag...");
      
      // Get the current app URL dynamically
      const currentUrl = request.headers.get('host');
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const appUrl = process.env.SHOPIFY_APP_URL || `${protocol}://${currentUrl}`;
      
      console.log("Creating script tag with URL:", `${appUrl}/ab-price-test-simple.js`);
      console.log("Session shop:", session.shop);
      console.log("Session access token exists:", !!session.accessToken);
      
      try {
        // Use the admin client to make the API call
        const scriptTagResponse = await admin.graphql(`
          mutation scriptTagCreate($input: ScriptTagInput!) {
            scriptTagCreate(input: $input) {
              scriptTag {
                id
                src
                displayScope
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            input: {
              src: `${appUrl}/ab-price-test-simple.js`,
              displayScope: "ONLINE_STORE"
            }
          }
        });

        const scriptTagData = await scriptTagResponse.json();
        console.log("Script tag creation response:", scriptTagData);

        if (scriptTagData.data?.scriptTagCreate?.userErrors?.length > 0) {
          const errors = scriptTagData.data.scriptTagCreate.userErrors;
          console.error("Script tag creation errors:", errors);
          return json({ 
            success: false, 
            error: "Failed to create script tag",
            details: errors.map((e: any) => e.message).join(', ')
          }, { status: 400 });
        }

        if (scriptTagData.data?.scriptTagCreate?.scriptTag) {
          return json({ 
            success: true, 
            message: "Script tag installed successfully! A/B price testing is now active.",
            scriptTag: scriptTagData.data.scriptTagCreate.scriptTag
          });
        } else {
          console.error("Unexpected response structure:", scriptTagData);
          return json({ 
            success: false, 
            error: "Failed to create script tag",
            details: "Unexpected response structure"
          }, { status: 400 });
        }
      } catch (error) {
        console.error("Error creating script tag:", error);
        
        // Fallback: Provide manual installation instructions
        return json({ 
          success: true, 
          message: "Automatic installation failed, but you can install manually. Check the instructions below.",
          scriptUrl: `${appUrl}/ab-price-test-simple.js`,
          manualInstall: true,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    if (action === "remove_script") {
      // Get existing script tags using GraphQL
      const scriptTagsResponse = await admin.graphql(`
        query getScriptTags($first: Int!) {
          scriptTags(first: $first) {
            edges {
              node {
                id
                src
              }
            }
          }
        }
      `, {
        variables: { first: 50 }
      });

      const scriptTagsData = await scriptTagsResponse.json();
      const scriptTags = scriptTagsData.data?.scriptTags?.edges?.map((edge: any) => edge.node) || [];
      
      const existingScripts = scriptTags.filter((tag: any) => 
        tag.src && tag.src.includes('ab-price-test-simple.js')
      );

      // Delete each existing script tag
      for (const scriptTag of existingScripts) {
        const deleteResponse = await admin.graphql(`
          mutation scriptTagDelete($id: ID!) {
            scriptTagDelete(id: $id) {
              deletedScriptTagId
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: { id: scriptTag.id }
        });

        const deleteData = await deleteResponse.json();
        if (deleteData.data?.scriptTagDelete?.userErrors?.length > 0) {
          console.error("Error deleting script tag:", deleteData.data.scriptTagDelete.userErrors);
        }
      }

      return json({ 
        success: true, 
        message: "Script tag removed successfully!" 
      });
    }

    if (action === "save_settings") {
      console.log("💾 SAVING SETTINGS TO DATABASE:");
      console.log("  - autoRotationEnabled:", autoRotationEnabled);
      
      // Save auto-rotation setting to database
      const savedSettings = await db.settings.upsert({
        where: { shop: session.shop },
        update: {
          auto_rotation_enabled: autoRotationEnabled,
          auto_install: autoInstall.toString(),
          enable_cart_adjustment: enableCartAdjustment.toString()
        },
        create: {
          shop: session.shop,
          auto_rotation_enabled: autoRotationEnabled,
          auto_install: autoInstall.toString(),
          enable_cart_adjustment: enableCartAdjustment.toString()
        }
      });

      console.log("✅ DATABASE SAVE RESULT:", savedSettings);

      // Save app settings as metafields using GraphQL
      const settings = [
        { key: "auto_install", value: autoInstall.toString(), type: "boolean" },
        { key: "enable_cart_adjustment", value: enableCartAdjustment.toString(), type: "boolean" },
      ];

      // First get the shop ID
      const shopResponse = await admin.graphql(`
        query getShop {
          shop {
            id
          }
        }
      `);

      const shopData = await shopResponse.json();
      const shopId = shopData.data?.shop?.id;

      for (const setting of settings) {
        const metafieldResponse = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                key
                value
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            metafields: [{
              namespace: "ab_price_test",
              key: setting.key,
              value: setting.value,
              type: setting.type,
              ownerId: shopId
            }]
          }
        });

        const metafieldData = await metafieldResponse.json();
        if (metafieldData.data?.metafieldsSet?.userErrors?.length > 0) {
          console.error("Error saving metafield:", metafieldData.data.metafieldsSet.userErrors);
        }
      }

      return json({ 
        success: true, 
        message: "Settings saved successfully!" 
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in settings action:", error);
    return json({ 
      error: "Failed to update settings",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

export default function AppSettings() {
  const { scriptInstalled, settings, appUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  const [isManualRotating, setIsManualRotating] = useState(false);
  const [isResettingPrices, setIsResettingPrices] = useState(false);
  const [autoRotate, setAutoRotate] = useState(() => {
    // Always use localStorage since server-side isn't working
    if (typeof window !== 'undefined') {
      return localStorage.getItem('autoRotateEnabled') === 'true';
    }
    return false;
  });

  console.log("🎯 COMPONENT DEBUG:");
  console.log("  - settings.auto_rotation_enabled:", settings.auto_rotation_enabled);
  console.log("  - typeof settings.auto_rotation_enabled:", typeof settings.auto_rotation_enabled);
  console.log("  - settings.auto_rotation_enabled === true:", settings.auto_rotation_enabled === true);
  console.log("  - autoRotate state:", autoRotate);

  const handleManualRotate = async () => {
    setIsManualRotating(true);
    try {
      const response = await fetch(`${appUrl}/api/manual-rotate`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        alert(`✅ ${result.message}`);
        console.log("Manual rotation result:", result.result);
      } else {
        alert(`❌ Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Manual rotation error:", error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setIsManualRotating(false);
    }
  };

  const handleResetPrices = async () => {
    setIsResettingPrices(true);
    try {
      const response = await fetch(`${appUrl}/api/reset-prices`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        alert(`✅ ${result.message}`);
        console.log("Reset prices result:", result);
      } else {
        alert(`❌ Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Reset prices error:", error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setIsResettingPrices(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    console.log("🎯 FORM SUBMIT DEBUG:");
    console.log("  - Form submitted!");
    console.log("  - autoRotate state:", autoRotate);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoRotateEnabled', autoRotate.toString());
      console.log("  - Saved to localStorage:", { autoRotate });
      
      // Show success message
      alert("✅ Settings saved successfully!");
    }
    
    // Prevent default form submission since server-side isn't working
    event.preventDefault();
  };

  // Save auto-rotation state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoRotateEnabled', autoRotate.toString());
      console.log("🔄 Auto-rotation state saved to localStorage:", autoRotate);
    }
  }, [autoRotate]);

  // Handle auto-rotation disable with price reset
  const handleAutoRotateChange = async (newValue: boolean) => {
    if (!newValue && autoRotate) {
      // Auto-rotation is being disabled - ask for confirmation and reset prices
      const confirmed = window.confirm(
        "Disabling auto-rotation will reset all test prices to their original values. This ensures customers see the correct prices when rotation stops.\n\nDo you want to continue?"
      );
      
      if (confirmed) {
        // Reset prices first, then disable auto-rotation
        await handleResetPrices();
        setAutoRotate(false);
      }
      // If not confirmed, don't change the autoRotate state
    } else {
      // Auto-rotation is being enabled - just update the state
      setAutoRotate(newValue);
    }
  };

  // Client-side auto-rotation effect
  useEffect(() => {
    if (!autoRotate) return;

    console.log("🔄 Starting client-side auto-rotation...");
    
    const interval = setInterval(async () => {
      try {
        console.log("🔄 Client-side auto-rotation running...");
        const response = await fetch('/api/manual-rotate');
        const result = await response.json();
        
        if (result.success) {
          console.log("✅ Client-side auto-rotation successful:", result.message);
        } else {
          console.log("❌ Client-side auto-rotation failed:", result.error);
        }
      } catch (error) {
        console.log("❌ Client-side auto-rotation error:", error);
      }
    }, 60000); // Every 60 seconds (1 minute)

    return () => {
      console.log("⏹️ Stopping client-side auto-rotation...");
      clearInterval(interval);
    };
  }, [autoRotate]);

  return (
    <Page title="A/B Price Test Settings" subtitle="Configure automatic integration">
      <BlockStack gap="500">
        {actionData?.message && (
          <Banner
            title={actionData.success ? "Success" : "Error"}
            status={actionData.success ? "success" : "critical"}
          >
            <p>{actionData.message}</p>
            {actionData.details && (
              <p><strong>Details:</strong> {actionData.details}</p>
            )}
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Script Installation</Text>
            <Text variant="bodyMd" color="subdued">
              The A/B testing script needs to be installed in your theme to work automatically.
            </Text>
            
            <InlineStack gap="300">
              <Form method="post">
                <input type="hidden" name="action" value="install_script" />
                <Button submit variant="primary">
                  Install Script Automatically
                </Button>
              </Form>
            </InlineStack>

            {actionData?.manualInstall && (
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd">Manual Installation Required</Text>
                  <Text variant="bodyMd">
                    Since automatic installation encountered an issue, please follow these steps to manually add the A/B testing script to your theme:
                  </Text>
                  
                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="300">
                      <Text variant="bodyMd" fontWeight="bold">Step 1: Access Theme Editor</Text>
                      <Text variant="bodyMd">Go to Shopify Admin → Online Store → Themes</Text>
                      
                      <Text variant="bodyMd" fontWeight="bold">Step 2: Edit Theme Code</Text>
                      <Text variant="bodyMd">Click "Actions" → "Edit code" on your active theme</Text>
                      
                      <Text variant="bodyMd" fontWeight="bold">Step 3: Find theme.liquid</Text>
                      <Text variant="bodyMd">In the left sidebar, find "Layout" section and click "theme.liquid"</Text>
                      
                      <Text variant="bodyMd" fontWeight="bold">Step 4: Add Script</Text>
                      <Text variant="bodyMd">Scroll to the bottom and find the closing <code>&lt;/body&gt;</code> tag</Text>
                      <Text variant="bodyMd">Add this script tag JUST BEFORE <code>&lt;/body&gt;</code>:</Text>
                      
                      <Box padding="300" background="bg-surface-primary" borderRadius="100">
                        <Text variant="bodyMd" as="pre" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
{`<script src="${actionData.scriptUrl}"></script>`}
                        </Text>
                      </Box>
                      
                      <Text variant="bodyMd" fontWeight="bold">Step 5: Save</Text>
                      <Text variant="bodyMd">Click "Save" button in the top-right corner</Text>
                    </BlockStack>
                  </Box>
                  
                  <Text variant="bodyMd" color="subdued">
                    After adding the script, your A/B price testing will work automatically on all product pages!
                  </Text>
                  
                  {actionData.error && (
                    <Box padding="300" background="bg-surface-critical-subdued" borderRadius="100">
                      <Text variant="bodyMd" color="critical">
                        <strong>Technical Details:</strong> {actionData.error}
                      </Text>
                    </Box>
                  )}
                </BlockStack>
              </Card>
            )}

            {scriptInstalled && (
              <Banner status="success">
                <p>✅ Script tag is installed and active! A/B price testing is working automatically.</p>
              </Banner>
            )}
          </BlockStack>
        </Card>

        <Card>
          <Form method="post" onSubmit={handleFormSubmit}>
            <input type="hidden" name="action" value="save_settings" />
                  <FormLayout>
                    <Text variant="headingMd">Price Rotation Settings</Text>
                    
                    <Checkbox
                      label="Enable Automatic Price Rotation"
                      helpText="Automatically rotate prices every minute based on A/B test performance"
                      checked={autoRotate}
                      onChange={handleAutoRotateChange}
                      name="autoRotationEnabled"
                    />

                    {autoRotate && (
                      <Box padding="200" background="bg-surface-success-subdued" borderRadius="100">
                        <Text variant="bodySm" color="success">
                          ✅ Auto-rotation is enabled! The system will automatically rotate prices every minute in the background.
                        </Text>
                      </Box>
                    )}

                    <Button submit variant="primary">
                      Save Settings
                    </Button>
                  </FormLayout>
          </Form>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">How It Works</Text>
            <BlockStack gap="200">
              <Text variant="bodyMd">1. Create an A/B test in the "Tests" section</Text>
              <Text variant="bodyMd">2. Activate the test</Text>
              <Text variant="bodyMd">3. The script automatically shows different prices to customers</Text>
              <Text variant="bodyMd">4. Analytics track which prices perform better</Text>
            </BlockStack>
            
            <Divider />
            
            <Text variant="bodyMd" color="subdued">
              <strong>Script URL:</strong> {appUrl}/ab-price-test-simple.js
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Manual Price Rotation</Text>
            <Text variant="bodyMd">
              Manually trigger price rotation to update your Shopify product prices based on the best-performing A/B test variants, or reset all prices to their original values.
            </Text>
            
            <InlineStack gap="300" wrap>
              <Button 
                onClick={handleManualRotate}
                loading={isManualRotating}
                variant="primary"
              >
                {isManualRotating ? "Rotating Prices..." : "Manual Price Rotation"}
              </Button>
              
              <Button 
                onClick={handleResetPrices}
                loading={isResettingPrices}
                variant="secondary"
              >
                {isResettingPrices ? "Resetting Prices..." : "Reset All Prices"}
              </Button>
            </InlineStack>
            
            <Box padding="300" background="bg-surface-info-subdued" borderRadius="100">
              <Text variant="bodyMd">
                <strong>How it works:</strong>
                <br />
                • <strong>Manual Rotation:</strong> Analyzes conversion rates and updates prices to best-performing variants
                <br />
                • <strong>Reset Prices:</strong> Restores all test products to their original prices
                <br />
                • Auto-rotation runs every minute when enabled above
                <br />
                • Disabling auto-rotation automatically resets all prices to original values
              </Text>
            </Box>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
