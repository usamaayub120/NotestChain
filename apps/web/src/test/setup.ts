import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// RTL's own auto-cleanup only self-registers when test.globals is on; we
// keep globals off (explicit imports everywhere else), so wire it by hand.
afterEach(cleanup);
