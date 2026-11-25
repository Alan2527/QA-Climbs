import { Locator, expect } from '@playwright/test';

/**
 * Desde noviembre muchas listas son un combo con buscador (input con rol combobox y su lista
 * aparte). Si el control sigue siendo una lista nativa, se usa como tal.
 */
export async function elegirEnCombo(combo: Locator, texto: string) {
  await expect(combo).toBeVisible({ timeout: 60_000 });
  if (await combo.evaluate((e) => e.tagName === 'SELECT')) { await combo.selectOption({ label: texto }); return; }
  if ((await combo.inputValue()).trim() === texto) return;
  await combo.click();
  // Hay combos de solo lectura (sin buscador): se abren y se toca la opcion, sin escribir.
  if (await combo.isEditable()) await combo.fill(texto);
  const lista = combo.page().locator(`#${await combo.getAttribute('aria-controls')}`);
  await lista.getByRole('option', { name: texto, exact: true }).first().click();
  await expect(combo, `El combo tiene que quedar en ${texto}`).toHaveValue(texto);
}
