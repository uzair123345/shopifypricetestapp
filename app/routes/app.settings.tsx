import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import scheduler from "../services/autoRotationScheduler.server";
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
  Modal,
  Select,
} from "@shopify/polaris";
import { useState, useEffect, useRef } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("🚀 LOADER FUNCTION CALLED!");
  console.log("🚀 LOADER FUNCTION CALLED!");
  console.log("🚀 LOADER FUNCTION CALLED!");
  
  const { admin, session } = await authenticate.admin(request);
  
  // Get the current app URL dynamically
  const currentUrl = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  let appUrl = process.env.SHOPIFY_APP_URL || `${protocol}://${currentUrl}`;
  
  // For development, try to get the tunnel URL from the request
  if (currentUrl && currentUrl.includes('trycloudflare.com')) {
    appUrl = `${protocol}://${currentUrl}`;
  }
  
  console.log("🔗 Detected app URL:", appUrl);
  
  try {
    // Check if script tag already exists using GraphQL
    const scriptTagsResponse = await admin.graphql(`
      query getScriptTags($first: Int!) {
        scriptTags(first: $first) {
          edges {
            node {
              id
              src
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
    
    // Check if existing script has wrong URL and needs updating
    const needsUpdate = existingScript && existingScript.src && !existingScript.src.includes(appUrl);
    if (needsUpdate) {
      console.log("🔄 Script URL mismatch detected, will update script tag");
      console.log("  - Current script URL:", existingScript.src);
      console.log("  - Correct app URL:", appUrl);
    }

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
    
    let dbSettings = await db.settings.findUnique({
      where: { shop: session.shop }
    });

    console.log("  - Raw query result:", dbSettings);

    // If no settings exist, create default ones
    if (!dbSettings) {
      console.log("  - No settings found, creating default...");
      dbSettings = await db.settings.create({
        data: {
          shop: session.shop,
          auto_install: "false",
          enable_cart_adjustment: "false",
          auto_rotation_enabled: false,
          rotation_interval_minutes: 1 // Default to 1 minute
        }
      });
      console.log("  - Created default settings:", dbSettings);
    } else {
      console.log("  - Found existing settings:", dbSettings);
    }

    // Merge database settings with metafield settings
    const mergedSettings = {
      ...settings,
      auto_rotation_enabled: dbSettings?.auto_rotation_enabled || false,
      rotation_interval_minutes: dbSettings?.rotation_interval_minutes || 1
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

    // Start auto-rotation scheduler if it's enabled
    if (mergedSettings.auto_rotation_enabled) {
      console.log("🚀 Auto-rotation is enabled, starting scheduler...");
      try {
        await scheduler.start();
        console.log("✅ Auto-rotation scheduler started successfully");
      } catch (error) {
        console.error("❌ Failed to start auto-rotation scheduler:", error);
      }
    }

    // If script needs updating, automatically update it
    if (needsUpdate) {
      console.log("🔄 Auto-updating script tag with correct URL...");
      try {
        // Remove old script
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
          variables: { id: existingScript.id }
        });
        
        // Create new script with correct URL
        const createResponse = await admin.graphql(`
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
        
        console.log("✅ Script tag updated successfully");
      } catch (error) {
        console.error("❌ Failed to auto-update script tag:", error);
      }
    }

    // Check if external cron is configured (CRON_SECRET is set)
    const hasExternalCron = !!process.env.CRON_SECRET;

    return json({
      scriptInstalled: !!existingScript,
      settings: mergedSettings,
      appUrl,
      needsUpdate: needsUpdate,
      hasExternalCron, // Indicate if external cron service is configured
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
  const rotationIntervalRaw = formData.get("rotationIntervalMinutes") as string | null;
  const rotationIntervalMinutes = rotationIntervalRaw ? parseInt(rotationIntervalRaw) : 1;
  
  console.log("🔍 FORM DATA:");
  console.log("  - autoRotationEnabled:", autoRotationEnabled);
  console.log("  - rotationIntervalMinutes (raw):", rotationIntervalRaw);
  console.log("  - rotationIntervalMinutes (parsed):", rotationIntervalMinutes);

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
        // First, check if script already exists and remove ALL old versions
        const checkScriptTagsResponse = await admin.graphql(`
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

        const checkScriptTagsData = await checkScriptTagsResponse.json();
        const allScripts = checkScriptTagsData.data?.scriptTags?.edges?.map((edge: any) => edge.node) || [];
        
        // Find ALL old A/B test scripts (any variation of the script name)
        const oldScripts = allScripts.filter((tag: any) => 
          tag.src && (
            tag.src.includes('ab-price-test') ||
            tag.src.includes('ab_price_test') ||
            tag.src.includes('ab-price-test-simple.js') ||
            tag.src.includes('ab-price-test.js')
          )
        );

        // Remove ALL old scripts to ensure clean installation
        let removedCount = 0;
        for (const oldScript of oldScripts) {
          try {
            console.log("Removing old script tag:", oldScript.id, oldScript.src);
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
              variables: { id: oldScript.id }
            });
            
            const deleteData = await deleteResponse.json();
            if (deleteData.data?.scriptTagDelete?.deletedScriptTagId) {
              removedCount++;
              console.log("✅ Removed old script:", oldScript.src);
            } else if (deleteData.data?.scriptTagDelete?.userErrors?.length > 0) {
              console.error("Error removing script:", deleteData.data.scriptTagDelete.userErrors);
            }
          } catch (deleteError) {
            console.error("Error removing old script tag:", oldScript.id, deleteError);
          }
        }
        
        if (removedCount > 0) {
          console.log(`✅ Removed ${removedCount} old script tag(s)`);
        }

        // Use the admin client to make the API call
        // Add cache-busting query parameter to ensure latest version is always loaded
        const scriptUrlWithVersion = `${appUrl}/ab-price-test-simple.js?v=${Date.now()}`;
        console.log("Creating script tag with URL (with cache-busting):", scriptUrlWithVersion);
        
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
              src: scriptUrlWithVersion,
              displayScope: "ONLINE_STORE"
            }
          }
        });

        const scriptTagData = await scriptTagResponse.json();
        console.log("Script tag creation response:", JSON.stringify(scriptTagData, null, 2));

        if (scriptTagData.data?.scriptTagCreate?.userErrors?.length > 0) {
          const errors = scriptTagData.data.scriptTagCreate.userErrors;
          console.error("Script tag creation errors:", errors);
          const errorMessage = errors.map((e: any) => e.message).join(', ');
          return json({ 
            success: false, 
            error: "Failed to create script tag",
            details: errorMessage,
            scriptUrl: `${appUrl}/ab-price-test-simple.js`,
            manualInstall: true
          }, { status: 400 });
        }

        if (scriptTagData.data?.scriptTagCreate?.scriptTag) {
          // Verify the script was actually created
          const createdScript = scriptTagData.data.scriptTagCreate.scriptTag;
          console.log("✅ Script tag created successfully:", createdScript);
          
          return json({ 
            success: true, 
            message: `Script tag installed successfully! ${removedCount > 0 ? `Removed ${removedCount} old version(s) and ` : ''}Installed latest version. A/B price testing is now active.`,
            scriptTag: createdScript,
            removedOldScripts: removedCount
          });
        } else {
          console.error("Unexpected response structure:", scriptTagData);
          return json({ 
            success: false, 
            error: "Failed to create script tag",
            details: "Unexpected response structure. Check console logs for details.",
            scriptUrl: `${appUrl}/ab-price-test-simple.js`,
            manualInstall: true
          }, { status: 400 });
        }
      } catch (error) {
        console.error("Error creating script tag:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        // Fallback: Provide manual installation instructions
        return json({ 
          success: false, 
          message: "Automatic installation failed, but you can install manually. Check the instructions below.",
          scriptUrl: `${appUrl}/ab-price-test-simple.js`,
          manualInstall: true,
          error: errorMessage,
          details: `Error: ${errorMessage}. Please install the script manually using the instructions below.`
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
          rotation_interval_minutes: rotationIntervalMinutes,
          auto_install: autoInstall.toString(),
          enable_cart_adjustment: enableCartAdjustment.toString()
        },
        create: {
          shop: session.shop,
          auto_rotation_enabled: autoRotationEnabled,
          rotation_interval_minutes: rotationIntervalMinutes,
          auto_install: autoInstall.toString(),
          enable_cart_adjustment: enableCartAdjustment.toString()
        }
      });

      console.log("✅ DATABASE SAVE RESULT:", savedSettings);
      console.log("✅ SAVED ROTATION INTERVAL:", rotationIntervalMinutes, "minutes");
      
      // Verify the saved value
      const verifySettings = await db.settings.findUnique({
        where: { shop: session.shop },
        select: { rotation_interval_minutes: true }
      });
      console.log("✅ VERIFIED SAVED INTERVAL:", verifySettings?.rotation_interval_minutes);

      // Start or stop auto-rotation scheduler based on setting
      if (autoRotationEnabled) {
        console.log("🚀 Starting auto-rotation scheduler...");
        try {
          await scheduler.start();
          console.log("✅ Auto-rotation scheduler started successfully");
        } catch (error) {
          console.error("❌ Failed to start auto-rotation scheduler:", error);
          // Continue anyway, scheduler might already be running
        }
      } else {
        console.log("⏹️ Stopping auto-rotation scheduler...");
        try {
          await scheduler.stop();
          console.log("✅ Auto-rotation scheduler stopped successfully");
        } catch (error) {
          console.error("❌ Failed to stop auto-rotation scheduler:", error);
        }
      }

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
        message: "Settings saved successfully!",
        savedRotationInterval: rotationIntervalMinutes
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
  const { scriptInstalled, settings, appUrl, hasExternalCron } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  const [isManualRotating, setIsManualRotating] = useState(false);
  const [isResettingPrices, setIsResettingPrices] = useState(false);
  const [isClearingAnalytics, setIsClearingAnalytics] = useState(false);
  const [showClearAnalyticsModal, setShowClearAnalyticsModal] = useState(false);
  // Initialize from server data
  const [autoRotate, setAutoRotate] = useState(() => settings?.auto_rotation_enabled || false);
  const [rotationInterval, setRotationInterval] = useState(() => settings?.rotation_interval_minutes || 1);

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

  const handleClearAnalytics = async () => {
    setIsClearingAnalytics(true);
    try {
      const response = await fetch(`${appUrl}/api/clear-analytics`, {
        method: "POST",
      });
      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ ${result.message}`);
        console.log("Cleared analytics:", result);
      } else {
        alert(`❌ Error: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Clear analytics error:", error);
      alert(`❌ Error: ${error instanceof Error ? error.message : "Network error"}`);
    } finally {
      setIsClearingAnalytics(false);
      setShowClearAnalyticsModal(false);
    }
  };

  // Form submission is now handled by Remix automatically
  // No need for preventDefault() - let the form submit to the server

  // Track if we've initialized from server to avoid resetting while user is interacting
  const [isInitialized, setIsInitialized] = useState(false);
  const lastSavedInterval = useRef<number | null>(null);
  const userSelectedValue = useRef<number | null>(null);
  
  // Initialize state from server data only once on mount
  useEffect(() => {
    if (settings && !isInitialized) {
      const newAutoRotate = settings.auto_rotation_enabled || false;
      const newRotationInterval = settings.rotation_interval_minutes || 1;
      
      setAutoRotate(newAutoRotate);
      setRotationInterval(newRotationInterval);
      setIsInitialized(true);
      console.log("🔄 Initialized state from server:", { newAutoRotate, newRotationInterval });
    }
  }, [settings, isInitialized]);
  
  // Sync after form submission - prioritize the saved value
  useEffect(() => {
    if (actionData && 'success' in actionData && actionData.success) {
      if ('savedRotationInterval' in actionData) {
        const savedInterval = actionData.savedRotationInterval as number;
        if (savedInterval) {
          lastSavedInterval.current = savedInterval;
          userSelectedValue.current = null; // Clear user selection after save
          setRotationInterval(savedInterval);
          setIsInitialized(true); // Mark as initialized to prevent reset
          console.log("✅ Updated rotationInterval from actionData after save:", savedInterval);
        }
      }
    }
  }, [actionData]);

  // Handle auto-rotation disable with price reset
  const handleAutoRotateChange = (newValue: boolean) => {
    // Just update the state - form submission will handle server-side
    setAutoRotate(newValue);
  };

  // Client-side auto-rotation polling (works on free Vercel plan)
  // This runs in the browser when the admin panel is open
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [lastRotationTime, setLastRotationTime] = useState<Date | null>(null);
  const [rotationStatus, setRotationStatus] = useState<string>("");

  useEffect(() => {
    // Clear any existing interval
    if (rotationIntervalRef.current) {
      clearInterval(rotationIntervalRef.current);
      rotationIntervalRef.current = null;
    }

    // Only run if auto-rotation is enabled and we're on Vercel
    if (autoRotate && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      console.log("🔄 Starting client-side auto-rotation polling (interval: " + rotationInterval + " minutes)");
      setRotationStatus("🔄 Auto-rotation active (runs when admin panel is open)");

      // Convert minutes to milliseconds
      const intervalMs = rotationInterval * 60 * 1000;

      // Initial delay to avoid immediate execution
      const initialDelay = setTimeout(() => {
        // Then set up the interval
        rotationIntervalRef.current = setInterval(async () => {
          try {
            console.log("🔄 Client-side auto-rotation triggered");
            setRotationStatus("🔄 Rotating prices...");
            
            const response = await fetch(`${appUrl}/api/cron/rotate-prices`, {
              method: 'GET',
              headers: {
                'x-cron-token': 'client-side-polling' // Simple token for client-side calls
              }
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
              setLastRotationTime(new Date());
              setRotationStatus(`✅ Last rotated: ${new Date().toLocaleTimeString()}`);
              console.log("✅ Client-side auto-rotation successful:", result);
            } else {
              setRotationStatus(`⚠️ Rotation skipped: ${result.message || 'Unknown reason'}`);
              console.log("⚠️ Client-side auto-rotation skipped:", result);
            }
          } catch (error) {
            console.error("❌ Client-side auto-rotation error:", error);
            setRotationStatus("❌ Rotation error - check console");
          }
        }, intervalMs);

        // Also trigger immediately on first run
        fetch(`${appUrl}/api/cron/rotate-prices`, {
          method: 'GET',
          headers: {
            'x-cron-token': 'client-side-polling'
          }
        }).then(res => res.json()).then(result => {
          if (result.success) {
            setLastRotationTime(new Date());
            setRotationStatus(`✅ Last rotated: ${new Date().toLocaleTimeString()}`);
          }
        }).catch(err => console.error("Initial rotation error:", err));
      }, 2000); // Wait 2 seconds before starting

      return () => {
        clearTimeout(initialDelay);
        if (rotationIntervalRef.current) {
          clearInterval(rotationIntervalRef.current);
          rotationIntervalRef.current = null;
        }
      };
    } else if (!autoRotate) {
      setRotationStatus("");
      console.log("⏹️ Auto-rotation is disabled");
    }

    // Cleanup on unmount or when autoRotate/rotationInterval changes
    return () => {
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current);
        rotationIntervalRef.current = null;
      }
    };
  }, [autoRotate, rotationInterval, appUrl]);

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
          <Form method="post">
            <input type="hidden" name="action" value="save_settings" />
            <input 
              type="hidden" 
              name="autoRotationEnabled" 
              value={autoRotate ? "on" : "off"} 
              key={autoRotate ? "on" : "off"} 
            />
            <input type="hidden" name="autoInstall" value="off" />
            <input type="hidden" name="enableCartAdjustment" value="off" />
                  <FormLayout>
                    <Text variant="headingMd">Price Rotation Settings</Text>
                    
                    <Checkbox
                      label="Enable Automatic Price Rotation"
                      helpText="Automatically rotate prices based on A/B test performance. Note: On Vercel free plan, use manual rotation instead."
                      checked={autoRotate}
                      onChange={handleAutoRotateChange}
                    />

                    {autoRotate && (
                      <>
                        <Select
                          label="Rotation Interval"
                          helpText="How often prices should automatically rotate"
                          name="rotationIntervalMinutes"
                          options={[
                            { label: '1 minute', value: '1' },
                            { label: '2 minutes', value: '2' },
                            { label: '3 minutes', value: '3' },
                            { label: '5 minutes', value: '5' },
                            { label: '10 minutes', value: '10' },
                            { label: '15 minutes', value: '15' },
                            { label: '30 minutes', value: '30' },
                            { label: '60 minutes (1 hour)', value: '60' }
                          ]}
                          value={rotationInterval.toString()}
                          onChange={(value) => {
                            const newInterval = parseInt(value);
                            userSelectedValue.current = newInterval;
                            setRotationInterval(newInterval);
                            setIsInitialized(true); // Prevent reset while user is selecting
                            console.log("🔄 Rotation interval changed to:", newInterval);
                          }}
                        />
                        <Box padding="200" background="bg-surface-info-subdued" borderRadius="100">
                          <BlockStack gap="200">
                            <Text variant="bodySm" color="info">
                              ℹ️ <strong>Auto-rotation status:</strong>
                            </Text>
                            {typeof window !== 'undefined' && (
                              <>
                                {window.location.hostname.includes('vercel.app') ? (
                                  <BlockStack gap="200">
                                    {autoRotate ? (
                                      <>
                                        {hasExternalCron ? (
                                          <>
                                            <Text variant="bodySm" color="subdued">
                                              ✅ <strong>24/7 Auto-rotation is ACTIVE!</strong> External cron service is configured and running.
                                            </Text>
                                            <Text variant="bodySm" color="subdued">
                                              🔄 Prices will rotate every {rotationInterval} minute{rotationInterval !== 1 ? 's' : ''} automatically, even when your computer is off.
                                            </Text>
                                            {rotationStatus && (
                                              <Text variant="bodySm" color="subdued">
                                                {rotationStatus}
                                              </Text>
                                            )}
                                            <Text variant="bodySm" color="subdued">
                                              💡 <strong>Note:</strong> Client-side rotation also runs when the admin panel is open (for immediate feedback). External cron handles 24/7 rotation in the background.
                                            </Text>
                                            <Text variant="bodySm" color="subdued">
                                              📊 <strong>Monitor:</strong> Check Vercel logs to see rotation activity: <code>https://vercel.com/shopifypricetestapp-ab/logs</code>
                                            </Text>
                                          </>
                                        ) : (
                                          <>
                                            <Text variant="bodySm" color="subdued">
                                              ✅ <strong>Client-side auto-rotation is active!</strong> Prices will rotate every {rotationInterval} minute{rotationInterval !== 1 ? 's' : ''} while the admin panel is open.
                                            </Text>
                                            {rotationStatus && (
                                              <Text variant="bodySm" color="subdued">
                                                {rotationStatus}
                                              </Text>
                                            )}
                                            <Text variant="bodySm" color="subdued">
                                              ⚠️ <strong>Important:</strong> Client-side rotation only works while the admin panel is open. For <strong>24/7 automatic rotation</strong> (even when your computer is off), you need to set up a free external cron service.
                                            </Text>
                                            <Text variant="bodySm" color="subdued">
                                              📖 <strong>Quick Setup (5 minutes):</strong> See <code>SIMPLE_24_7_SETUP.md</code> for step-by-step instructions. It's free and takes only 5 minutes!
                                            </Text>
                                            <Text variant="bodySm" color="subdued">
                                              ✅ Once set up, rotation will work 24/7 automatically - no manual tasks needed!
                                            </Text>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <Text variant="bodySm" color="subdued">
                                          💡 <strong>Enable auto-rotation</strong> to rotate prices automatically.
                                        </Text>
                                        {hasExternalCron ? (
                                          <Text variant="bodySm" color="subdued">
                                            ✅ External cron service is configured! Once enabled, rotation will work 24/7 automatically.
                                          </Text>
                                        ) : (
                                          <Text variant="bodySm" color="subdued">
                                            🔄 <strong>For 24/7 rotation:</strong> Set up a free external cron service (see <code>SIMPLE_24_7_SETUP.md</code>).
                                          </Text>
                                        )}
                                      </>
                                    )}
                                  </BlockStack>
                                ) : (
                                  <Text variant="bodySm" color="subdued">
                                    ✅ Auto-rotation is enabled! The system will automatically rotate prices every {rotationInterval} minute{rotationInterval !== 1 ? 's' : ''} in the background.
                                  </Text>
                                )}
                              </>
                            )}
                          </BlockStack>
                        </Box>
                      </>
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
              
              <Button 
                onClick={() => setShowClearAnalyticsModal(true)}
                loading={isClearingAnalytics}
                variant="secondary"
                tone="critical"
              >
                {isClearingAnalytics ? "Clearing..." : "Clear Analytics Data"}
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

        {/* Clear Analytics Modal */}
        <Modal
          open={showClearAnalyticsModal}
          onClose={() => setShowClearAnalyticsModal(false)}
          title="Clear All Analytics Data"
          primaryAction={{
            content: "Clear All Data",
            onAction: handleClearAnalytics,
            loading: isClearingAnalytics,
            destructive: true,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowClearAnalyticsModal(false),
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
      </BlockStack>
    </Page>
  );
}
