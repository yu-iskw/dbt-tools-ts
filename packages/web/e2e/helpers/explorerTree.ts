import { expect, type Page } from '@playwright/test';

const BRANCH_SELECTOR = '.explorer-tree__row--branch';
const BRANCH_LABEL_SELECTOR = '.explorer-tree__label';

/** Expand a folder row if it is collapsed (avoids toggling branches already opened for the current selection). */
export async function expandExplorerBranchIfCollapsed(page: Page, label: string) {
  const branch = page.locator(BRANCH_SELECTOR, {
    has: page.locator(BRANCH_LABEL_SELECTOR, { hasText: label }),
  });
  const row = branch.first();
  await expect(row).toBeVisible();
  const chevron = row.locator('.explorer-tree__chevron');
  const expanded = await chevron.evaluate((el) =>
    el.classList.contains('explorer-tree__chevron--expanded'),
  );
  if (!expanded) await row.click();
}
