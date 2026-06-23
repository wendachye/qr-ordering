import { test, expect } from "@playwright/test";
import {
  loginAdmin,
  cancelSession,
  sessionIdFromUrl,
  ADMIN_BASE,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from "./helpers";

// Smoke: the real /admin/login form authenticates and lands on the floor. This
// exercises the actual login UI (the order-entry test seeds auth via the token
// for speed/robustness).
test("owner can sign in via the login form", async ({ page }) => {
  await page.goto(`${ADMIN_BASE}/admin/login`);
  await page.getByLabel(/email/i).fill(OWNER_EMAIL);
  await page.getByLabel(/password/i).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/tables/, { timeout: 60_000 });
  await expect(
    page.getByRole("button", { name: /^Manage / }).first()
  ).toBeVisible({ timeout: 60_000 });
});

// Critical path: an owner logs in, starts an order on a free table, adds a menu
// item via the POS, places the order, and sees it land on the running tab.
test.describe("Admin POS", () => {
  // The session opened by the test, cancelled in teardown so the table is freed
  // again and the suite stays re-runnable.
  let createdSessionId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (createdSessionId) {
      await cancelSession(request, createdSessionId);
      createdSessionId = null;
    }
  });

  test("owner places an order on a free table and it appears on the tab", async ({
    page,
  }) => {
    // 1. Log in and land on the live floor.
    await loginAdmin(page);

    // 2. Open a FREE table — its tile reads "+ Start order" (occupied tiles show
    //    an amount instead). Click the first free one to begin order entry.
    const startOrderTile = page
      .getByRole("button", { name: /start order/i })
      .first();
    await expect(startOrderTile).toBeVisible({ timeout: 60_000 });
    await startOrderTile.click();

    // 3. We're on the POS order-entry screen.
    await expect(page).toHaveURL(/\/admin\/orders\/new/, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: /new order/i })
    ).toBeVisible({ timeout: 60_000 });

    // 4. Wait for the menu to load, then add the first available item card. Item
    //    cards are buttons captioned with the item name + price; the search box
    //    is also a "Search the menu" control we skip past. We grab the first
    //    enabled card in the grid.
    await expect(
      page.getByPlaceholder(/search the menu/i)
    ).toBeVisible({ timeout: 60_000 });

    // Item cards live in the scrollable grid. Each renders the item name as text
    // inside a button. Filter to enabled buttons that aren't the category tabs /
    // search controls by requiring a price ("RM") in the accessible name.
    const itemCard = page
      .getByRole("button", { name: /RM\s?\d/i })
      .first();
    await expect(itemCard).toBeVisible({ timeout: 60_000 });
    await itemCard.click();

    // 5. The option/quantity picker opens as a modal dialog titled with the item
    //    name — capture it for the tab assertion. For a simple item there are no
    //    required options, so "Add to order" is enabled immediately.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const itemName =
      (await dialog.getByRole("heading").first().textContent())?.trim() ?? "";
    await dialog.getByRole("button", { name: /add to order/i }).click();

    // 6. The cart (right panel) now shows the line + the Place order button is
    //    enabled. Place the order.
    const placeOrder = page.getByRole("button", { name: /^place order$/i });
    await expect(placeOrder).toBeEnabled({ timeout: 30_000 });
    await placeOrder.click();

    // 7. Placing the first round opens the running tab at /admin/sessions/<id>.
    await expect(page).toHaveURL(/\/admin\/sessions\//, { timeout: 60_000 });
    createdSessionId = sessionIdFromUrl(page.url());

    // 8. The new round shows under "On the tab" — assert the section header
    //    exists (use exact text to avoid matching the "on the tab" total label)
    //    and the item we added appears in the running tab.
    await expect(
      page.getByText("On the tab", { exact: true })
    ).toBeVisible({ timeout: 60_000 });
    if (itemName) {
      // The item name may be truncated on the card; match its leading words.
      const lead = itemName.split(/\s+/).slice(0, 2).join(" ");
      await expect(
        page.getByText(new RegExp(lead.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first()
      ).toBeVisible({ timeout: 60_000 });
    } else {
      // Fallback: at minimum the tab is no longer empty.
      await expect(page.getByText(/nothing sent yet/i)).toHaveCount(0);
    }
  });
});
