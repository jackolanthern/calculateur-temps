const { defineConfig, devices } = require('@playwright/test');

// Sert app/ via le serveur http intégré de Python (déjà présent), zéro dépendance serveur.
module.exports = defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:8123' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'python3 -m http.server 8123 --directory app',
    url: 'http://localhost:8123',
    reuseExistingServer: !process.env.CI,
  },
});
