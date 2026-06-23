import { defineConfig, devices } from "@playwright/test";

// E2E harness for the QR-ordering admin POS + customer mobile app.
//
// The three dev servers (backend :4000, admin :3001, mobile :3000) are assumed
// to be ALREADY RUNNING locally — we deliberately do NOT launch webServers here.
// The admin/mobile Next.js dev servers can be slow to compile a heavy route on
// first hit, so navigation/action timeouts are generous.
//
// baseURL points at the admin app (:3001); the mobile spec navigates to the
// customer app (:3000) with absolute URLs.
export default defineConfig({
  testDir: "./e2e",
  // First-compile of a heavy Next.js route can take a while; keep per-test
  // headroom well above the navigation timeout.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  // One spec at a time: both specs mutate shared dev state (open a table tab /
  // place an order), so running them serially keeps free tables predictable.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    // The admin dev server occasionally needs ~30-40s to compile the POS route
    // on a cold first hit — give navigations and actions room.
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
