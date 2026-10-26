import { Page, Locator, expect } from '@playwright/test';

/**
 * Listado de hoteles del Backoffice nuevo (/hotels/hotels) y su "Extender tarifas" en lote:
 * el boton de la cabecera pasa la grilla a modo eleccion (una casilla "Elegir {hotel}" por
 * fila), la barra de abajo cuenta los elegidos y su "Extender tarifas" abre la hoja. La hoja
 * primero "Calcular" (aviso "Se crearan N tarifas en M habitaciones") y despues "Extender",
 * que pide confirmacion.
 */
export class HotelesNuevoPage {
  constructor(private readonly page: Page) {}

  get grilla(): Locator { return this.page.getByRole('main').getByRole('table').first(); }
  get hoja(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.getByRole('heading', { name: 'Extender tarifas' }) }).last(); }

  /** Filtra por nombre y devuelve los numeros de hotel que quedan en la grilla. */
  async buscar(termino: string): Promise<string[]> {
    await this.page.goto('/hotels/hotels');
    await expect(this.grilla.locator('tbody tr').first()).toContainText(/#\d+/, { timeout: 60_000 });
    const total = this.page.getByText(/^[\d.]+ resultados?$/).first();
    const antes = (await total.innerText().catch(() => '')).trim();
    await this.page.getByRole('searchbox', { name: 'Buscar por nombre o número' }).fill(termino);
    // El buscador espera a que se deje de escribir: se lee cuando cambia el total y la grilla se aquieta.
    await expect(total).not.toHaveText(antes, { timeout: 60_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const filas = await this.grilla.locator('tbody tr').allInnerTexts();
    return filas.map((f) => f.match(/#(\d+)/)?.[1] ?? '').filter(Boolean);
  }

  async elegirParaExtender(nombre: string) {
    await this.page.getByRole('main').getByRole('button', { name: 'Extender tarifas', exact: true }).first().click();
    await this.page.getByRole('checkbox', { name: `Elegir ${nombre}` }).check();
  }

  /** La barra de los elegidos ("1 hotel elegido") y su boton para abrir la hoja. */
  async abrirHoja(): Promise<string> {
    const barra = this.page.getByText(/^\d+ hotel(es)? elegidos?$/).first();
    await expect(barra).toBeVisible();
    const elegidos = (await barra.innerText()).trim();
    await this.page.getByRole('button', { name: 'Extender tarifas', exact: true }).last().click();
    await expect(this.hoja).toBeVisible();
    return elegidos;
  }

  async completarHoja(o: { hasta: string; porcentaje: number; modo: string }) {
    await this.hoja.getByRole('textbox', { name: 'Extender hasta' }).fill(o.hasta);
    await this.hoja.getByRole('textbox', { name: 'Incremento %' }).fill(String(o.porcentaje).replace('.', ','));
    await this.hoja.getByRole('radio', { name: new RegExp(o.modo) }).check();
  }

  async textoDeLaHoja(): Promise<string> {
    return (await this.hoja.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** "Calcular": devuelve el aviso con lo que se va a crear. */
  async calcular(): Promise<string> {
    await this.hoja.getByRole('button', { name: 'Calcular' }).click();
    const aviso = this.hoja.locator('.notice').last();
    await expect(aviso).toBeVisible({ timeout: 60_000 });
    return (await aviso.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** "Extender" + confirmacion: devuelve el texto de la confirmacion y el aviso del resultado. */
  async extender(): Promise<{ confirmacion: string; resultado: string }> {
    await this.hoja.getByRole('button', { name: 'Extender', exact: true }).click();
    const dialogo = this.page.getByRole('alertdialog');
    await expect(dialogo).toBeVisible();
    const confirmacion = (await dialogo.innerText()).replace(/\s+/g, ' ').trim();
    await dialogo.getByRole('button', { name: 'Extender', exact: true }).click();
    const aviso = this.page.locator('.toast .toast-text').filter({ hasText: /tarifas nuevas|\S/ }).last();
    await expect(aviso).toBeVisible({ timeout: 120_000 });
    return { confirmacion, resultado: (await aviso.innerText()).trim() };
  }
}
