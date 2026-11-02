import { expect, test, type Page } from '@playwright/test';

/**
 * The end-to-end journey of the acceptance criteria:
 * sign in → create a project → create and move a task → comment with a mention →
 * the activity timeline shows the change.
 */

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

function uniqueEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.test`;
}

test('the whole journey works: project, task, comment, mention and activity', async ({
  page,
  context,
}) => {
  const owner = uniqueEmail('journey');
  const teammate = uniqueEmail('teammate');

  // --- The owner creates an account and a workspace. -------------------------------
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Flow Owner');
  await page.getByLabel('Email').fill(owner);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Workspace name').fill('Journey Workspace');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectWorkspace(page);

  // --- A second person joins the workspace. ----------------------------------------
  const teammateContext = await context.browser()!.newContext();
  const teammatePage = await teammateContext.newPage();

  await teammatePage.goto('/register');
  await teammatePage.getByLabel('Your name').fill('Journey Teammate');
  await teammatePage.getByLabel('Email').fill(teammate);
  await teammatePage.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await teammatePage.getByRole('button', { name: 'Create account' }).click();
  await expectWorkspace(teammatePage);

  // The owner invites the teammate and shares the invitation link.
  await page.getByRole('link', { name: 'Members' }).first().click();
  await page.getByRole('button', { name: 'Invite a member' }).click();
  await page.getByLabel('Email address').fill(teammate);
  await page.getByRole('button', { name: 'Create invitation' }).click();

  const invitationLink = await page
    .getByText(/Share this link with/)
    .innerText()
    .then((text) => text.split(': ').pop() ?? '');

  expect(invitationLink).toContain('/invite/');

  await teammatePage.goto(invitationLink);
  await teammatePage
    .getByRole('button', { name: /Accept|Join/ })
    .first()
    .click();
  await expectWorkspace(teammatePage);

  // --- The owner creates a project and a task. -------------------------------------
  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name').fill('Journey Project');
  await page.getByRole('button', { name: 'Create project' }).click();

  await expect(page.getByRole('link', { name: 'Journey Project' })).toBeVisible();
  await page.getByRole('link', { name: 'Journey Project' }).click();

  await page.getByRole('button', { name: '+ Add task' }).first().click();
  await page.getByLabel('Title').fill('Write the release notes');
  await page.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByText('Write the release notes')).toBeVisible();

  // --- The task is moved with the keyboard alternative to dragging. ---------------
  await page
    .getByRole('button', { name: 'Move Write the release notes to another column' })
    .click();
  await page.getByRole('menuitem', { name: /In progress/ }).click();
  await expect(page.getByText('Write the release notes')).toBeVisible();

  // --- The owner comments and mentions the teammate. ------------------------------
  await page.getByText('Write the release notes').first().click();
  const commentBox = page.getByLabel('Write a comment');
  await commentBox.fill('Can you review this?');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText('Can you review this?')).toBeVisible();
  // The box is empty again when the comment has been sent.
  await expect(commentBox).toHaveValue('');

  // The mention picker inserts the name of the teammate; the client turns it into the
  // mention markup when the comment is sent.
  await commentBox.pressSequentially('Please have a look @');
  // The picker suggests the teammate. It is deliberately not clicked: the list is re-rendered
  // while the mention is typed, and the client encodes a typed name as well.
  await expect(page.getByRole('button', { name: /^@Journey/ }).first()).toBeVisible();
  await commentBox.pressSequentially('Journey Teammate');
  await expect(commentBox).toHaveValue(/@Journey Teammate/);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText('Please have a look @Journey Teammate')).toBeVisible();

  // --- The teammate is notified. ---------------------------------------------------
  await teammatePage.getByRole('link', { name: 'My Work' }).first().click();
  await expect(teammatePage.getByRole('button', { name: /Notifications, 1 unread/ })).toBeVisible({
    timeout: 30_000,
  });

  // --- The activity timeline shows the change. -------------------------------------
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('link', { name: 'Activity' }).first().click();
  await expect(page.getByText(/commented on "Write the release notes"/)).toBeVisible();
  await expect(page.getByText(/moved "Write the release notes"/)).toBeVisible();

  await teammateContext.close();
});

test('a member can complete a task and it leaves the board', async ({ page }) => {
  const email = uniqueEmail('complete');

  await page.goto('/register');
  await page.getByLabel('Your name').fill('Completer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Workspace name').fill('Completion Workspace');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectWorkspace(page);

  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name').fill('Completion Project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: 'Completion Project' }).click();

  await page.getByRole('button', { name: '+ Add task' }).first().click();
  await page.getByLabel('Title').fill('Ship the release');
  await page.getByRole('button', { name: 'Create task' }).click();

  await page.getByText('Ship the release').first().click();
  await page.getByRole('button', { name: 'Mark as completed' }).click();
  await expect(page.getByRole('dialog')).toContainText('Completed');

  // The default board view only shows open tasks.
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Ship the release')).toBeHidden();

  // The completed task is still reachable through the filter.
  await page.getByLabel('Filter by status').selectOption('done');
  await expect(page.getByText('Ship the release')).toBeVisible();
});

test('a member can search and filter the tasks of a project', async ({ page }) => {
  const email = uniqueEmail('filter');

  await page.goto('/register');
  await page.getByLabel('Your name').fill('Filterer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Workspace name').fill('Filter Workspace');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectWorkspace(page);

  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name').fill('Filter Project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: 'Filter Project' }).click();

  for (const title of ['Fix the navigation', 'Audit the copy']) {
    await page.getByRole('button', { name: '+ Add task' }).first().click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create task' }).click();
  }

  await expect(page.getByText('Fix the navigation')).toBeVisible();
  await expect(page.getByText('Audit the copy')).toBeVisible();

  await page.getByLabel('Search tasks').fill('navigation');
  await expect(page.getByText('Fix the navigation')).toBeVisible();
  await expect(page.getByText('Audit the copy')).toBeHidden();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('Audit the copy')).toBeVisible();
});
