import { expect, test, type Page } from '@playwright/test';

/** Waits for the workspace and reports the page content when the navigation fails. */
async function expectWorkspace(page: Page): Promise<void> {
  try {
    await page.waitForURL('**/my-work', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  } catch (error) {
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    throw new Error(`${String(error)}\nurl: ${page.url()}\npage: ${text.slice(0, 500)}`);
  }
}

/**
 * The end-to-end suite runs against a real stack (Next + API + Postgres).
 * Every test creates its own account, so no fixture data is required.
 */

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.test`;
}

test('a visitor can register, sign in and sign out', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/register');
  await page.getByLabel('Your name').fill('E2E Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Workspace name').fill('E2E Workspace');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expectWorkspace(page);

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  // Signing out clears the session and sends the visitor back to the sign-in form.
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('invalid credentials are rejected with a readable message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('nobody@example.test');
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
});
