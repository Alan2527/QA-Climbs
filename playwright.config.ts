import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const ARCHIVO_SESION = 'playwright/.auth/front.json';

/**
 * Suite E2E de AMV Travel — ambiente QA.
 *
 * Las credenciales se leen del entorno (.env local, secrets en CI).
 * Nunca se hardcodean en el codigo.
 */
export default defineConfig({
  testDir: './tests',
  // Los flujos E2E tocan datos reales: sin paralelismo dentro de un mismo archivo.
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  forbidOnly: !!process.env.CI,
  // Un reintento absorbe la flakiness residual del ambiente sin tapar fallos reales.
  retries: process.env.CI ? 1 : 0,
  // El BO y el tarifario tienen PostBacks lentos: timeouts holgados.
  timeout: 180_000,
  expect: { timeout: 30_000 },

  reporter: [
    ['list'],
    // Reporte local sin dependencias: Allure necesita Java, este no.
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', {
      resultsDir: 'allure-results',
      environmentInfo: {
        Entorno: 'QA',
        URL_Front: process.env.AMV_BASE_URL ?? 'https://qa.amv.travel',
        URL_BackOffice: process.env.AMV_BO_URL ?? 'https://qa.bo.amv.travel',
        Framework: 'Playwright + Allure',
      },
    }],
  ],

  use: {
    baseURL: process.env.AMV_BASE_URL ?? 'https://qa.amv.travel',
    // Captura de cada paso: el helper `paso()` adjunta screenshot por bloque.
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION },
      dependencies: ['setup'],
    },
  ],
});
