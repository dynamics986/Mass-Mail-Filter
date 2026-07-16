import { test, expect } from "@playwright/test";
test("onboarding and opportunity feed work", async ({ page }) => { await page.goto("/"); await expect(page.getByText("CU Link").first()).toBeVisible(); await page.getByRole("button", { name: "开始筛选" }).click(); await expect(page.getByText("Paid AI Web Student Helper").or(page.getByText(/Web development and AI Research/))).toBeVisible(); });
