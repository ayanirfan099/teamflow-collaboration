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

function uniqueEmail(): string {
  return `e2e-board-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.test`;
}

test('a member can create a project, add a task and move it with the keyboard', async ({
  page,
}) => {
  const email = uniqueEmail();

  await page.goto('/register');
  await page.getByLabel('Your name').fill('Board Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Workspace name').fill('Board Workspace');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expectWorkspace(page);

  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name').fill('Launch');
  await page.getByRole('button', { name: 'Create project' }).click();

  await expect(page.getByRole('link', { name: 'Launch' })).toBeVisible();
  await page.getByRole('link', { name: 'Launch' }).click();

  await page.getByRole('button', { name: '+ Add task' }).first().click();
  await page.getByLabel('Title').fill('Write the launch checklist');
  await page.getByRole('button', { name: 'Create task' }).click();

  await expect(page.getByText('Write the launch checklist')).toBeVisible();

  // The "Move to…" menu is the keyboard alternative to dragging a card.
  await page
    .getByRole('button', { name: 'Move Write the launch checklist to another column' })
    .click();
  await page.getByRole('menuitem', { name: /Done/ }).click();

  await expect(page.getByText('Write the launch checklist')).toBeVisible();
});
