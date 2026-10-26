import { Page, expect } from '@playwright/test';

/**
 * Cancela una reserva desde su detalle en el portal nuevo (`/site/bookings/{id}`), como la
 * agencia: "Cancelar reserva", el tilde "¿Desea cancelarla de todas formas?" y el boton del pie.
 * Es para dejar QA limpio: el Backoffice nuevo no tiene como borrar una reserva de la bandeja.
 * Devuelve lo que paso, para adjuntarlo.
 */
export async function cancelarReservaEnElPortal(page: Page, reserva: number): Promise<string> {
  await page.goto(`/site/bookings/${reserva}`);
  const cancelar = page.locator('main').getByRole('button', { name: 'Cancelar reserva', exact: true });
  if (!(await cancelar.waitFor({ timeout: 30_000 }).then(() => true).catch(() => false))) {
    return `La reserva ${reserva} no ofrece "Cancelar reserva": ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300)}`;
  }
  await cancelar.click();
  const modal = page.getByRole('dialog', { name: 'Cancelación de la reserva' });
  const tilde = modal.getByRole('checkbox', { name: '¿Desea cancelarla de todas formas?' });
  await expect(tilde).toBeVisible({ timeout: 30_000 });
  await tilde.check();
  await modal.getByRole('contentinfo').getByRole('button', { name: 'Cancelar reserva' }).click();
  await expect(modal).toBeHidden({ timeout: 60_000 });
  return `Reserva ${reserva} cancelada desde el portal`;
}
