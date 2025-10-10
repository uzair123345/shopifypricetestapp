import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  Box,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  console.log('=== TEST DETAIL LOADER CALLED ===');
  console.log('Request URL:', request.url);
  console.log('Params:', params);
  
  await authenticate.admin(request);

  const testId = parseInt(params.id!);
  console.log('Parsed test ID:', testId);
  
  const abTest = await db.aBTest.findUnique({
    where: { id: testId },
    include: {
      products: true,
      variants: true,
    },
  });

  console.log('Found test:', abTest);

  if (!abTest) {
    console.log('Test not found for ID:', testId);
    throw new Response("Test not found", { status: 404 });
  }

  console.log('Returning test data');
  return json({ abTest });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  
  const testId = parseInt(params.id!);
  const formData = await request.formData();
  const action = formData.get("action") as string;

  try {
    if (action === "start") {
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "active",
          startedAt: new Date(),
        },
      });
    } else if (action === "pause") {
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "paused",
        },
      });
    } else if (action === "resume") {
      await db.aBTest.update({
        where: { id: testId },
        data: {
          status: "active",
        },
      });
    }

    return redirect(`/app/tests/detail/${testId}`);
  } catch (error) {
    console.error("Error updating test:", error);
    return json({ error: "Failed to update test" }, { status: 500 });
  }
};

export default function TestDetail() {
  console.log('=== TEST DETAIL COMPONENT STARTING ===');
  console.log('Current URL:', window.location.href);
  
  const { abTest } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const isSubmitting = navigation.state === "submitting";

  // Debug logging
  console.log('=== TEST DETAIL COMPONENT RENDERED ===');
  console.log('abTest data:', abTest);
  console.log('actionData:', actionData);
  console.log('navigation state:', navigation.state);

  if (!abTest) {
    console.error('abTest is null or undefined!');
    return (
      <Page>
        <TitleBar title="Error" />
        <Card>
          <Text>Test data not found!</Text>
        </Card>
      </Page>
    );
  }

  // Simple test component first
  console.log('About to render the main component');
  return (
    <Page>
      <TitleBar title="Test Detail - Working!" />
      <Card>
        <Text as="h1">SUCCESS! Test Detail Page is Working!</Text>
        <Text as="p">Test ID: {abTest.id}</Text>
        <Text as="p">Test Title: {abTest.title}</Text>
        <Text as="p">Status: {abTest.status}</Text>
        {abTest.status === "draft" && (
          <Form method="post">
            <input type="hidden" name="action" value="start" />
            <Button 
              variant="primary" 
              submit
              loading={isSubmitting}
            >
              Start Test
            </Button>
          </Form>
        )}
        {abTest.status === "active" && (
          <Form method="post">
            <input type="hidden" name="action" value="pause" />
            <Button 
              variant="secondary" 
              submit
              loading={isSubmitting}
            >
              Pause Test
            </Button>
          </Form>
        )}
        {abTest.status === "paused" && (
          <Form method="post">
            <input type="hidden" name="action" value="resume" />
            <Button 
              variant="primary" 
              submit
              loading={isSubmitting}
            >
              Resume Test
            </Button>
          </Form>
        )}
        <Button onClick={() => navigate("/app/tests")} variant="secondary">
          Back to Tests
        </Button>
      </Card>
    </Page>
  );
}
