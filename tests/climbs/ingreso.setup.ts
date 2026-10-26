import { test as setup, expect } from '@playwright/test';
import { PortalNuevoPage } from '../../pages/climbs/portal.page';

const SESION = 'playwright/.auth/app-nueva.json';

/**
 * App nueva (ClimbsApp): una sola sesion para el Backoffice y el portal de agencias.
 *
 * Desde el 25/10/2026 el personal entra al portal con su usuario del backoffice
 * ("Su usuario del sitio no tiene una clave propia", docs/help/sales/sales-site.md), asi
 * que la misma cuenta abre las dos apps. Se entra por pantalla, como lo haria la persona.
 */
setup('Ingreso a la app nueva: Backoffice y portal', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.BO_USER!);
  await page.getByRole('textbox', { name: 'Clave' }).fill(process.env.BO_PASS!);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page, 'El Backoffice nuevo tiene que dejar entrar con la cuenta del backoffice').not.toHaveURL(/\/login/, { timeout: 60_000 });

  const portal = new PortalNuevoPage(page);
  await portal.ingresar(process.env.BO_USER!, process.env.BO_PASS!);

  await page.context().storageState({ path: SESION });
});
