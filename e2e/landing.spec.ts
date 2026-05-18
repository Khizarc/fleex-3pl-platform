import { test, expect } from '@playwright/test';

test('landing page renders and links to both app shells', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fleex 3PL Platform' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Warehouse Dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Client Portal' })).toBeVisible();
});
