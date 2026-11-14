import { defineConfig } from '@playwright/test';

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  use: { trace: 'retain-on-failure' },
  projects: ['chromium', 'firefox', 'webkit'].flatMap((browserName) =>
    Object.entries(viewports).map(([size, viewport]) => ({
      name: `${browserName}-${size}`,
      use: { browserName, viewport },
    })),
  ),
});
