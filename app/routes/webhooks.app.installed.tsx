import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.webhook(request);

  try {
    // Auto-install script tag when app is installed
    const appSettings = await admin.rest.Metafield.all({
      session,
      namespace: "ab_price_test",
      owner_resource: "shop",
    });

    const autoInstallSetting = appSettings.find(
      (metafield) => metafield.key === "auto_install"
    );

    // Default to auto-install if no setting exists
    const shouldAutoInstall = autoInstallSetting 
      ? autoInstallSetting.value === "true" 
      : true;

    if (shouldAutoInstall) {
      // Check if script tag already exists
      const scriptTags = await admin.rest.ScriptTag.all({
        session,
      });

      const existingScripts = scriptTags.filter(tag => 
        tag.src && tag.src.includes('ab-price-test-simple.js')
      );

      if (existingScripts.length === 0) {
        // Install the script tag
        await admin.rest.ScriptTag.create({
          session,
          script_tag: {
            event: "onload",
            src: `${process.env.SHOPIFY_APP_URL || "https://encountered-elected-rhode-cable.trycloudflare.com"}/ab-price-test-simple.js`,
            display_scope: "online_store",
          },
        });

        console.log("Auto-installed A/B price testing script tag");
      }
    }

    // Set default app settings
    const defaultSettings = [
      { key: "auto_install", value: "true", type: "boolean" },
      { key: "enable_cart_adjustment", value: "true", type: "boolean" },
    ];

    for (const setting of defaultSettings) {
      const existingSetting = appSettings.find(
        (metafield) => metafield.key === setting.key
      );

      if (!existingSetting) {
        await admin.rest.Metafield.save({
          session,
          metafield: {
            namespace: "ab_price_test",
            key: setting.key,
            value: setting.value,
            type: setting.type,
            owner_resource: "shop",
          },
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error in app installed webhook:", error);
    return new Response("Error", { status: 500 });
  }
};
