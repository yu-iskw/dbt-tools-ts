# E2E spec skeleton (ESM)

Copy into a new `*.spec.ts` under `packages/web/e2e/` and adjust names, paths, and assertions.

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('feature name', () => {
  test('user-visible outcome', async ({ page }) => {
    await page.goto('/');

    // Example: stable id from FileUpload (verify in source before relying on it)
    // await page.locator("#manifest-input").setInputFiles(fixturePath);

    await expect(page.getByRole('heading', { name: /example/i })).toBeVisible();
  });
});
```

Run from repository root: `pnpm test:e2e`.
