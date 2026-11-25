import { Page, Locator, expect } from '@playwright/test';

/**
 * Listado de hoteles del Backoffice nuevo (/hotels/hotels) y su "Extender tarifas" en lote.
 * Desde noviembre el boton de la cabecera abre directamente la hoja: a la izquierda los
 * parametros, a la derecha su propia grilla (arranca con el filtro del listado) con una casilla
 * "Elegir {hotel}" por fila; el pie cuenta los elegidos. "Extender" del pie calcula y abre la
 * confirmacion ("Se van a crear N tarifas nuevas en M habitaciones de H hoteles"), y
 * "Confirmar y extender" graba ("Listo: N tarifas nuevas en M habitaciones").
 */
export class HotelesNuevoPage {
  constructor(private readonly page: Page) {}

  get grilla(): Locator { return this.page.getByRole('main').getByRole('table').first(); }
  // Desde noviembre la hoja tiene su propia grilla para elegir los hoteles y la confirmacion es
  // otro dialogo con el mismo titulo: la hoja se reconoce por su campo "Extender hasta".
  get hoja(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.getByRole('textbox', { name: 'Extender hasta' }) }).last(); }
  get confirmacion(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.getByRole('button', { name: 'Confirmar y extender' }) }).last(); }

  /** Filtra por nombre y devuelve los numeros de hotel que quedan en la grilla. */
  async buscar(termino: string): Promise<string[]> {
    await this.page.goto('/hotels/hotels');
    await expect(this.grilla.locator('tbody tr').first()).toContainText(/#\d+/, { timeout: 60_000 });
    const total = this.page.getByText(/^[\d.]+ resultados?$/).first();
    const antes = (await total.innerText().catch(() => '')).trim();
    // El rotulo del buscador cambio (US 201, filtro Freesale): se lo toma por su id.
    await this.page.locator('#search-hotel').fill(termino);
    // El buscador espera a que se deje de escribir: se lee cuando cambia el total y la grilla se aquieta.
    await expect(total).not.toHaveText(antes, { timeout: 60_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const filas = await this.grilla.locator('tbody tr').allInnerTexts();
    return filas.map((f) => f.match(/#(\d+)/)?.[1] ?? '').filter(Boolean);
  }

  /** "Extender tarifas" de la cabecera abre la hoja (con el filtro del listado) y ahi se elige el hotel. */
  async elegirParaExtender(nombre: string) {
    await this.page.getByRole('main').getByRole('button', { name: 'Extender tarifas', exact: true }).first().click();
    await expect(this.hoja).toBeVisible();
    await this.hoja.getByRole('checkbox', { name: `Elegir ${nombre}`, exact: true }).check();
  }

  /** El contador de elegidos del pie de la hoja ("1 hotel elegido"). */
  async abrirHoja(): Promise<string> {
    const barra = this.hoja.getByText(/^\d+ hotel(es)? elegidos?$/).first();
    await expect(barra).toBeVisible();
    return (await barra.innerText()).trim();
  }

  async completarHoja(o: { hasta: string; porcentaje: number; modo: string }) {
    await this.hoja.getByRole('textbox', { name: 'Extender hasta' }).fill(o.hasta);
    await this.hoja.getByRole('textbox', { name: 'Incremento %' }).fill(String(o.porcentaje).replace('.', ','));
    await this.hoja.getByRole('radio', { name: new RegExp(o.modo) }).check();
  }

  async textoDeLaHoja(): Promise<string> {
    return (await this.hoja.innerText()).replace(/\s+/g, ' ').trim();
  }

  /**
   * "Extender" del pie: calcula y abre la confirmacion ("Se van a crear N tarifas nuevas en M
   * habitaciones de H hoteles"), que es lo que antes era el aviso de "Calcular".
   */
  async calcular(): Promise<string> {
    await this.hoja.getByRole('button', { name: 'Extender', exact: true }).last().click();
    const lead = this.confirmacion.locator('.ext-confirm-lead');
    await expect(lead).toBeVisible({ timeout: 120_000 });
    return (await lead.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** "Confirmar y extender": devuelve el texto de la confirmacion y el aviso del resultado. */
  async extender(): Promise<{ confirmacion: string; resultado: string }> {
    const confirmacion = (await this.confirmacion.innerText()).replace(/\s+/g, ' ').trim();
    await this.confirmacion.getByRole('button', { name: 'Confirmar y extender' }).click();
    const aviso = this.page.locator('.toast .toast-text').filter({ hasText: /tarifas nuevas|\S/ }).last();
    await expect(aviso).toBeVisible({ timeout: 120_000 });
    return { confirmacion, resultado: (await aviso.innerText()).trim() };
  }
}
