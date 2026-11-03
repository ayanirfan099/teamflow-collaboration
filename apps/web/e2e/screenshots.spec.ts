import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Deterministic README screenshots from the fictional demo seed.
 *
 * The test is opt-in. CI runs it against a freshly migrated and seeded database,
 * verifies that committed images are current, and uploads them as an artifact.
 * It never commits or pushes repository changes.
 */

const ENABLED = process.env.E2E_SCREENSHOTS === '1';
const TARGET = resolve(__dirname, '..', '..', '..', 'docs', 'screenshots');
const DEMO_NOW = new Date('2026-01-15T12:00:00.000Z');
const MAX_CHANNEL_DELTA = 1;

test.skip(!ENABLED, 'the screenshots are only taken when E2E_SCREENSHOTS=1');

async function expectWorkspace(page: Page): Promise<void> {
  await page.waitForURL('**/my-work', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await expect(page.locator('[title="Live updates are connected"]')).toBeVisible();
}

async function shoot(page: Page, name: string): Promise<void> {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  const toasts = await dismiss.count();
  for (let index = 0; index < toasts; index += 1) {
    await dismiss.first().click();
  }

  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog instanceof HTMLElement) {
      dialog.scrollTop = 0;
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });

  const committedPath = join(TARGET, name);
  const candidatePath = join(TARGET, `.candidate-${name}`);

  await mkdir(dirname(committedPath), { recursive: true });
  await page.screenshot({
    path: candidatePath,
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  });

  let committed: Buffer | null = null;
  try {
    committed = await readFile(committedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      await rm(candidatePath, { force: true });
      throw error;
    }
  }

  if (committed) {
    const candidate = await readFile(candidatePath);
    const comparison = await page.evaluate(
      async ({ expectedBase64, candidateBase64, maxChannelDelta }) => {
        const load = (base64: string): Promise<HTMLImageElement> =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('A screenshot could not be decoded.'));
            image.src = `data:image/png;base64,${base64}`;
          });

        const [expected, actual] = await Promise.all([load(expectedBase64), load(candidateBase64)]);

        if (expected.width !== actual.width || expected.height !== actual.height) {
          return { sameDimensions: false, significantPixels: 1 };
        }

        const expectedCanvas = document.createElement('canvas');
        const actualCanvas = document.createElement('canvas');
        expectedCanvas.width = actualCanvas.width = expected.width;
        expectedCanvas.height = actualCanvas.height = expected.height;

        const expectedContext = expectedCanvas.getContext('2d');
        const actualContext = actualCanvas.getContext('2d');
        if (!expectedContext || !actualContext) {
          throw new Error('A screenshot comparison canvas could not be created.');
        }

        expectedContext.drawImage(expected, 0, 0);
        actualContext.drawImage(actual, 0, 0);

        const expectedPixels = expectedContext.getImageData(
          0,
          0,
          expected.width,
          expected.height,
        ).data;
        const actualPixels = actualContext.getImageData(0, 0, actual.width, actual.height).data;

        let significantPixels = 0;

        for (let offset = 0; offset < expectedPixels.length; offset += 4) {
          const delta = Math.max(
            Math.abs(expectedPixels[offset]! - actualPixels[offset]!),
            Math.abs(expectedPixels[offset + 1]! - actualPixels[offset + 1]!),
            Math.abs(expectedPixels[offset + 2]! - actualPixels[offset + 2]!),
            Math.abs(expectedPixels[offset + 3]! - actualPixels[offset + 3]!),
          );

          if (delta > maxChannelDelta) {
            significantPixels += 1;
          }
        }

        return { sameDimensions: true, significantPixels };
      },
      {
        expectedBase64: committed.toString('base64'),
        candidateBase64: candidate.toString('base64'),
        maxChannelDelta: MAX_CHANNEL_DELTA,
      },
    );

    if (comparison.sameDimensions && comparison.significantPixels === 0) {
      await rm(candidatePath, { force: true });
      return;
    }
  }

  await rename(candidatePath, committedPath);
}

test('the screenshots of the README', async ({ page }) => {
  await page.clock.install({ time: DEMO_NOW });

  await page.goto('/login');
  await page.getByLabel('Email').fill('ada@teamflow.dev');
  await page.getByLabel('Password').fill('TeamFlow!2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectWorkspace(page);

  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByRole('link', { name: 'Website redesign' }).click();
  await expect(page.getByText('Audit the landing page content')).toBeVisible();
  await expect(page.locator('article')).toHaveCount(4);

  const filters = page.locator('section[aria-label="Filter tasks"]');
  await expect(filters.getByLabel('Filter by assignee').locator('option')).toHaveCount(4);
  await expect(filters.getByRole('button', { name: 'Design', exact: true })).toBeVisible();
  await expect(page.locator('[title="Live updates are connected"]')).toBeVisible();

  await shoot(page, 'board.png');

  await page.getByText('Accessibility pass on the pricing page').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
    'Accessibility pass on the pricing page',
  );
  await expect(dialog.getByRole('button', { name: 'Ada Lovelace' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(dialog.getByText('No attachments', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/No comments yet/)).toBeVisible();
  await shoot(page, 'task-dialog.png');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('link', { name: 'My Work' }).first().click();
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await shoot(page, 'my-work.png');
});
