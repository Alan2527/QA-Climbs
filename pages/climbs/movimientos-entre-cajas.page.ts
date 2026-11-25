import { Page, Locator, expect } from '@playwright/test';
import { elegirEnMenuAcciones } from './menu-acciones';

export type Acciones = { copiar: boolean; editar: boolean; borrar: boolean };

/** "-1.500,000" -> 1500 (la grilla escribe el signo; el cuadre lo mide aparte). */
export const absoluto = (t: string) => Math.abs(Number((t || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')));

/**
 * Movimientos entre cajas en la caja diaria del Backoffice nuevo.
 *
 * "Agregar" (tarjeta "Movimientos") abre el formulario "Movimientos": Tipo de movimiento
 * (Pago / Cobro / Movimiento), Cotizacion, Origen (moneda, monto, medio) y, solo para un
 * Movimiento, Destino (moneda, monto, sucursal, medio), Referencia y Comentario. Un
 * movimiento son dos filas con el mismo codigo: la salida en la caja de origen y la entrada
 * en la de destino. Los campos se ubican por su id (`dcm-*`).
 */
export class MovimientosNuevaPage {
  constructor(private readonly page: Page) {}

  // Desde noviembre el dialogo se llama "Agregar movimiento" (o "Editar movimiento").
  get formulario(): Locator { return this.page.getByRole('dialog', { name: /^((Agregar|Editar) movimiento|Movimientos)$/ }).first(); }
  campo(id: string): Locator { return this.formulario.locator(`#dcm-${id}`); }

  async elegido(id: string): Promise<string> {
    // El medio ahora es un combo con buscador: lo elegido es el texto del campo.
    return this.campo(id).evaluate((s: HTMLSelectElement | HTMLInputElement) =>
      (s instanceof HTMLSelectElement ? s.options[s.selectedIndex]?.text ?? '' : s.value).trim());
  }

  async abrirNuevo() {
    const tarjeta = this.page.locator('section, .card').filter({ has: this.page.getByRole('heading', { name: 'Movimientos', exact: true }) }).last();
    await tarjeta.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(this.formulario, 'Agregar tiene que abrir el formulario del movimiento').toBeVisible();
    await this.campo('type').selectOption({ label: 'Movimiento' });
    await expect(this.campo('dcashflow'), 'Un movimiento tiene destino').toBeVisible();
  }

  /**
   * Desde noviembre la moneda es un boton "Moneda: ARS" pegado al monto, que despliega la lista
   * de monedas, y el medio (la caja) es un combo con buscador.
   */
  private async elegirMoneda(monto: string, moneda: string) {
    const boton = this.campo(monto).locator('xpath=ancestor::*[.//button[starts-with(@aria-label, "Moneda:")]][1]')
      .getByRole('button', { name: /^Moneda:/ }).first();
    if (((await boton.getAttribute('aria-label')) ?? '').trim() === `Moneda: ${moneda}`) return;
    await boton.click();
    await this.page.getByRole('listbox', { name: 'Moneda' }).getByRole('option', { name: moneda, exact: true }).click();
    await expect(boton, `La moneda tiene que quedar en ${moneda}`).toHaveAttribute('aria-label', `Moneda: ${moneda}`);
  }

  private async elegirCaja(id: string, caja: string) {
    const campo = this.campo(id);
    await campo.click();
    await campo.fill(caja);
    const lista = this.page.locator(`#${await campo.getAttribute('aria-controls')}`);
    await lista.getByRole('option').filter({ hasText: caja }).first().click();
    await expect.poll(() => campo.inputValue(), { message: `El medio tiene que quedar en ${caja}` }).toContain(caja);
  }

  async origen(o: { moneda: string; caja: string; monto?: string }) {
    await this.elegirMoneda('amount', o.moneda);
    await this.elegirCaja('cashflow', o.caja);
    if (o.monto !== undefined) await this.campo('amount').fill(o.monto);
  }

  async destino(d: { sucursal?: string; moneda: string; caja: string; monto?: string }) {
    if (d.sucursal) await this.campo('dbranch').selectOption({ label: d.sucursal });
    await this.elegirMoneda('damount', d.moneda);
    await this.elegirCaja('dcashflow', d.caja);
    if (d.monto !== undefined) await this.campo('damount').fill(d.monto);
  }

  async comentario(texto: string) {
    await this.campo('comment').fill(texto);
  }

  /** Si la cotizacion no vino propuesta, se carga una para poder guardar (no es lo que se prueba). */
  async asegurarCotizacion(): Promise<string> {
    const valor = (await this.campo('exchange').inputValue()).trim();
    if (!valor || Number(valor.replace(/\./g, '').replace(',', '.')) <= 0) {
      await this.campo('exchange').fill('1500,00');
      return 'vacía: se cargó 1500,00';
    }
    return valor;
  }

  async guardarSinEsperar() {
    await this.formulario.getByRole('button', { name: 'Guardar', exact: true }).click();
  }

  async guardar() {
    await this.guardarSinEsperar();
    await expect(this.formulario, 'Guardado, el formulario se tiene que cerrar').toBeHidden({ timeout: 60_000 });
    await expect(this.page.getByText('Movimiento guardado').first()).toBeVisible({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle');
  }

  async cerrarFormulario() {
    await this.formulario.getByRole('button', { name: /^(Cerrar|Close)$/ }).first().click();
    await expect(this.formulario).toBeHidden();
  }

  tarjetaDeMovimientos(): Locator {
    return this.page.locator('section, .card').filter({ has: this.page.getByRole('heading', { name: 'Movimientos', exact: true }) }).last();
  }

  /** Las filas del movimiento: se ubican por el comentario (la grilla lo corta a 25 caracteres). */
  filas(comentario: string): Locator {
    return this.tarjetaDeMovimientos().locator('tbody tr').filter({ has: this.page.locator('td[data-label="Comentario"]', { hasText: comentario.slice(0, 25) }) });
  }

  filaEnLaCaja(comentario: string, caja: string): Locator {
    return this.filas(comentario).filter({ has: this.page.locator('td[data-label="Medio"]', { hasText: caja }) }).first();
  }

  async celda(fila: Locator, columna: string): Promise<string> {
    return (await fila.locator(`td[data-label="${columna}"]`).first().innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Lo que ofrece la fila: con varias acciones van en el menu "Acciones"; con una, el boton directo. */
  async acciones(fila: Locator): Promise<Acciones> {
    const menu = fila.getByRole('button', { name: /^Acciones/ });
    const nombres: string[] = [];
    if (await menu.count()) {
      // El menu se cierra con cualquier scroll de la pagina: leido de una sola vez (maquina lenta) sale
      // vacio o cerrado. Con boton "Acciones" siempre hay dos opciones o mas, asi que se reabre hasta leerlas.
      const m = this.page.getByRole('menu', { name: 'Acciones' });
      await expect(async () => {
        if (!(await m.isVisible())) await menu.click();
        await m.getByRole('menuitem').first().waitFor({ timeout: 2_000 });
        const leidas = (await m.getByRole('menuitem').allInnerTexts()).map((t) => t.trim());
        expect(leidas.length).toBeGreaterThan(1);
        nombres.splice(0, nombres.length, ...leidas);
      }, 'El menu "Acciones" de la fila tiene que abrirse y mostrar sus opciones').toPass({ timeout: 60_000 });
      await this.page.keyboard.press('Escape');
      await expect(m).toBeHidden();
    } else {
      for (const b of await fila.locator('td.finance-actions-cell, td.table-actions-cell').getByRole('button').all()) {
        nombres.push(((await b.getAttribute('aria-label')) ?? (await b.innerText())).trim());
      }
    }
    return {
      copiar: nombres.some((n) => /^Copiar/.test(n)),
      editar: nombres.some((n) => /^Editar$/.test(n)),
      borrar: nombres.some((n) => /^Borrar$/.test(n)),
    };
  }

  async editar(fila: Locator) {
    await elegirEnMenuAcciones(this.page, fila, /^Editar$/);
    await expect(this.formulario, 'Editar tiene que abrir el formulario con el movimiento').toBeVisible();
    await expect(this.campo('amount')).not.toHaveValue('', { timeout: 30_000 });
  }

  async borrar(fila: Locator) {
    await elegirEnMenuAcciones(this.page, fila, /^Borrar$/);
    const pregunta = this.page.getByRole('alertdialog').filter({ hasText: '¿Está seguro?' });
    await pregunta.getByRole('button', { name: 'Sí, eliminar', exact: true }).click();
    await expect(pregunta).toBeHidden({ timeout: 30_000 });
    await expect(this.page.getByText('Movimiento borrado').first()).toBeVisible({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle');
  }

  // --- Copiar movimientos -------------------------------------------------------------

  get copiar(): Locator { return this.page.getByRole('dialog', { name: 'Copiar movimientos' }); }

  async abrirCopiar() {
    await this.tarjetaDeMovimientos().getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect(this.copiar).toBeVisible();
    await this.page.waitForLoadState('networkidle');
  }

  filaDeCopiar(comentario: string): Locator {
    return this.copiar.locator('tbody tr').filter({ hasText: comentario.slice(0, 25) }).first();
  }

  async cerrarCopiar() {
    await this.copiar.getByRole('button', { name: /^(Cerrar|Close)$/ }).first().click();
    await expect(this.copiar).toBeHidden();
  }
}
