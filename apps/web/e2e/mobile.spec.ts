import { expect, test, type Page } from '@playwright/test';

/**
 * The mobile workflow.
 *
 * The board is horizontally scrollable on a small screen, the navigation collapses into a
 * scrollable bar and the task dialog stays usable.
 */

test.use({ viewport: { width: 390, height: 844 } });

async function expectWorkspace(page: Page): Promise<void> {
  await page.waitForURL('**/my-work', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
}

function uniqueEmail(): string {
  return `e2e-mobile-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.test`;
}

test('a project can be worked on a phone', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/register');
  await page.getByLabel('Your name').fill('Mobile Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Workspace name').fill('Mobile Workspace');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectWorkspace(page);

  // The navigation is available on the small screen as well.
  await page
    .getByRole('navigation', { name: 'Main (mobile)' })
    .getByRole('link', { name: 'Projects' })
    .click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name').fill('Mobile Project');
  await page.getByRole('button', { name: 'Create project' }).click();

  await page.getByRole('link', { name: 'Mobile Project' }).click();
  await page.getByRole('button', { name: '+ Add task' }).first().click();
  await page.getByLabel('Title').fill('Check the layout on a phone');
  await page.getByRole('button', { name: 'Create task' }).click();

  await expect(page.getByText('Check the layout on a phone')).toBeVisible();

  // The page itself does not scroll sideways — the board scrolls inside its own container.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // The task dialog opens, stays inside the viewport and is readable on the small screen.
  await page.getByText('Check the layout on a phone').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Title')).toBeVisible();

  const box = await page.getByRole('dialog').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
});
