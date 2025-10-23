import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("🧪 TEST LOADER CALLED!");
  console.log("🧪 TEST LOADER CALLED!");
  console.log("🧪 TEST LOADER CALLED!");
  
  return json({ message: "Test loader working!" });
};

export default function TestRoute() {
  return (
    <div>
      <h1>Test Route</h1>
      <p>This is a test route to check if server-side code works.</p>
    </div>
  );
}

