import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// globals:false means RTL's auto-cleanup isn't auto-registered; do it here
// so every component test unmounts between cases.
afterEach(() => {
  cleanup();
});
