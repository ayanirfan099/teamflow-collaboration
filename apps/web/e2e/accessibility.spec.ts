import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The accessibility check.
 *
 * Every primary flow is checked with axe-core. Only the violations of the WCAG 2.2 A and AA
 * rules fail the test — the rules that need a manual review (colour contrast of a gradient,
 * for example) are reported but not enforced.
 */

function uniqueEmail(): string {
  return `e2e-a11y-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.test`;
}

async function expectWorkspace(page: Page): Promise<void> {
  await page.waitForURL('**/my-work', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
}

/** Runs axe-core and fails with a readable report when a rule is violated. */
async function expectNoViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
  }));

  expect(violations, `Accessibility violations on ${label}`).toEqual([]);
}

test('the primary flows have no accessibility violations', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/register');
  await expectNoViolations(page, 'the sign-up form');

  await page.getByLabel('Your name').fill('Accessibility Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Workspace name').fill('A11y Workspace');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectWorkspace(page);

  await expectNoViolations(page, 'the My Work dashboard');

  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name').fill('Accessible Project');
  await expectNoViolations(page, 'the new project dialog');

  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: 'Accessible Project' }).click();

  await page.getByRole('button', { name: '+ Add task' }).first().click();
  await page.getByLabel('Title').fill('An accessible task');
  await page.getByRole('button', { name: 'Create task' }).click();

  await expect(page.getByText('An accessible task')).toBeVisible();
  await expectNoViolations(page, 'the board');

  await page.getByText('An accessible task').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations(page, 'the task dialog');

  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('link', { name: 'Directory' }).first().click();
  await expectNoViolations(page, 'the directory');
});
