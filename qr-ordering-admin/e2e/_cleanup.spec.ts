import { test } from "@playwright/test";
import { sessionIdForTableCode, cancelSession } from "./helpers";

// One-off maintenance spec (underscore-prefixed): cancels the tabs the E2E run
// opened on specific tables so the floor returns to a clean, re-runnable state.
// Not a critical-path assertion — pass the table codes to free via TABLE_CODES.
test("free test-created tabs", async ({ request }) => {
  const codes = (process.env.TABLE_CODES ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  for (const code of codes) {
    const sid = await sessionIdForTableCode(request, code);
    if (sid) {
      await cancelSession(request, sid);
      // eslint-disable-next-line no-console
      console.log(`freed table ${code} (session ${sid})`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`table ${code} already free`);
    }
  }
});
