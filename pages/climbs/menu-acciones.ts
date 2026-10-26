import { Page, Locator, expect } from '@playwright/test';

/**
 * Las acciones de cada fila de Finanzas viven en el menu "Acciones" (los tres puntos). El
 * menu se cierra solo ante cualquier desplazamiento de la pagina, asi que si se cierra antes
 * de elegir, se vuelve a abrir, como haria una persona.
 */
export async function elegirEnMenuAcciones(page: Page, fila: Locator, opcion: RegExp) {
  await expect(async () => {
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await page.getByRole('menu', { name: 'Acciones' }).getByRole('menuitem', { name: opcion }).click({ timeout: 5_000 });
  }, `El menu "Acciones" de la fila tiene que ofrecer ${opcion}`).toPass({ timeout: 60_000 });
}
