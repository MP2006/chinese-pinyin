import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Ensure DOM cleanup between tests (vitest doesn't auto-integrate with testing-library)
afterEach(() => {
  cleanup();
});

// Provide crypto.randomUUID for node environment (available in Node 19+, polyfill for safety)
if (typeof globalThis.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require("crypto");
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}
