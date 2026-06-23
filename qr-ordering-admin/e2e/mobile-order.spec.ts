import { test, expect } from "@playwright/test";
import {
  getFreeTableCode,
  sessionIdForTableCode,
  cancelSession,
  MOBILE_BASE,
} from "./helpers";

// Critical path: a customer scans a table QR, browses the menu, adds an item to
// the cart, and submits the order — landing on the success page.
test.describe("Customer mobile order", () => {
  let tableCode: string;

  test.beforeAll(async ({ request }) => {
    // Pick a real, free table code from the backend so the order is clean.
    tableCode = await getFreeTableCode(request);
  });

  // Submitting the order opens a tab on that table. Cancel it afterwards so the
  // table is freed again and the suite stays re-runnable.
  test.afterAll(async ({ request }) => {
    if (!tableCode) return;
    const sessionId = await sessionIdForTableCode(request, tableCode);
    if (sessionId) await cancelSession(request, sessionId);
  });

  test("customer adds an item and submits an order", async ({ page }) => {
    // 1. Open the table's ordering page.
    await page.goto(`${MOBILE_BASE}/order/${tableCode}`);

    // 2. The menu renders: category tabs + a 2-up grid of item cards. Wait for an
    //    item card (a button whose accessible name carries a price).
    const itemCard = page
      .getByRole("button", { name: /RM\s?\d/i })
      .first();
    await expect(itemCard).toBeVisible({ timeout: 60_000 });
    await itemCard.click();

    // 3. The item bottom-sheet opens (role="dialog"). For a simple item the
    //    "Add to cart" button is enabled immediately.
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await sheet
      .getByRole("button", { name: /add to cart/i })
      .click();

    // 4. The sticky cart bar appears with a "View cart" link — go to the cart.
    const viewCart = page.getByRole("link", { name: /view cart/i });
    await expect(viewCart).toBeVisible({ timeout: 30_000 });
    await viewCart.click();

    // 5. On the cart page, submit the order.
    await expect(page).toHaveURL(/\/cart$/, { timeout: 30_000 });
    const submit = page.getByRole("button", { name: /submit order/i });
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();

    // 6. The success page confirms the order reached the kitchen / the tab.
    await expect(page).toHaveURL(/\/success\//, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: /sent to the kitchen/i })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/added to your table/i)).toBeVisible();
  });
});
