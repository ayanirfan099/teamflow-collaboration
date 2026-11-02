import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * The screenshots of the README.
 *
 * The test only runs when `E2E_SCREENSHOTS=1` is set; the CI job "Screenshots" then commits
 * the PNGs into `docs/screenshots/`. The images are therefore always produced by the real
 * application — no mock-up is ever shipped.
 */

const ENABLED = process.env.E2E_SCREENSHOTS === '1';
// The path is resolved from the file, so the screenshots land in the repository no matter
// from which directory Playwright was started.
const TARGET = resolve(__dirname, '..', '..', '..', 'docs', 'screenshots');

test.skip(!ENABLED, 'the screenshots are only taken when E2E_SCREENSHOTS=1');

function uniqueEmail(): string {
  return `e2e-shot-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.test`;
}

async function expectWorkspace(page: Page): Promise<void> {
  await page.waitForURL('**/my-work', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
}

/**
 * Takes a screenshot of the current view.
 *
 * The toasts are dismissed and the page is scrolled to the top first, so the image shows the
 * application and not the leftovers of the last action.
 */
async function shoot(page: Page, name: string): Promise<void> {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  const toasts = await dismiss.count();
  for (let index = 0; index < toasts; index += 1) {
    await dismiss.first().click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  await mkdir(dirname(join(TARGET, name)), { recursive: true });
  await page.screenshot({ path: join(TARGET, name), fullPage: false });
}

test('the screenshots of the README', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/register');
  await page.getByLabel('Your name').fill('Avery Stone');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Workspace name').fill('Northwind Studio');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectWorkspace(page);

  // --- The board with a few realistic cards. ---------------------------------------
  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name').fill('Website Redesign');
  await page
    .getByLabel('Description')
    .fill('The new marketing site, from the first sketch to the launch.');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: 'Website Redesign' }).click();

  const tasks = [
    { title: 'Audit the landing page content', column: 0 },
    { title: 'Design the pricing table', column: 0 },
    { title: 'Fix the mobile navigation', column: 1 },
    { title: 'Set up the analytics events', column: 2 },
  ];

  for (const task of tasks) {
    await page.getByRole('button', { name: '+ Add task' }).nth(task.column).click();
    await page.getByLabel('Title').fill(task.title);
    await page.getByRole('button', { name: 'Create task' }).click();
  }

  await expect(page.getByText('Audit the landing page content')).toBeVisible();
  await page.waitForTimeout(400);
  await shoot(page, 'board.png');

  // --- The task dialog with a comment. ---------------------------------------------
  await page.getByText('Design the pricing table').first().click();
  await page.getByLabel('Write a comment').fill('Two columns and a highlight row would work best.');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText('Two columns and a highlight row would work best.')).toBeVisible();
  await page.waitForTimeout(300);
  await shoot(page, 'task-dialog.png');
  await page.getByRole('button', { name: 'Close' }).click();

  // --- The My Work dashboard. --------------------------------------------------------
  await page.getByRole('link', { name: 'My Work' }).first().click();
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await page.waitForTimeout(300);
  await shoot(page, 'my-work.png');
});
