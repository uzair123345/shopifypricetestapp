import { LoaderFunctionArgs, json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const currentUrl = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const appUrl = process.env.SHOPIFY_APP_URL || `${protocol}://${currentUrl}`;
  
  return json({
    message: "Script endpoint test",
    scriptUrl: `${appUrl}/ab-price-test-simple.js`,
    currentUrl,
    protocol,
    headers: Object.fromEntries(request.headers.entries()),
  });
};




