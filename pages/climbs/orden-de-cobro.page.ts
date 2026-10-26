import { Page, Locator, expect } from '@playwright/test';

/**
 * Ordenes de cobro del Backoffice nuevo (`/finance/charge-orders`).
 *
 * Igual que la orden de pago pero contra un cliente y sin sucursal. Los pendientes traen
 * los importes en dos juegos de columnas ("Total USD", "Saldo USD" y los mismos en la
 * moneda local), sin el codigo de moneda en la celda: se leen por el nombre de la columna.
 * Los campos se ubican por su id (`co-*`, `ca-*` en el dialogo de asignacion).
 */
export class OrdenDeCobroNuevaPage {
  constructor(private readonly page: Page) {}

  readonly campo = (id: string) => this.page.locator(`#co-${id}`);

  async abrirNueva() {
    await this.page.goto('/finance/charge-orders');
    await this.page.getByRole('button', { name: 'Nueva orden' }).click();
    await expect(this.page).toHaveURL(/\/finance\/charge-orders\/new/);
    await expect(this.page.getByRole('heading', { name: 'Nueva orden de cobro' })).toBeVisible();
  }

  async opcionElegida(id: string): Promise<string> {
    return this.campo(id).evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? '');
  }

  async opciones(id: string): Promise<string[]> {
    return this.campo(id).locator('option').allInnerTexts();
  }

  /** Elige el cliente en el buscador y devuelve la fila que mostraba, para comparar el documento. */
  async elegirCliente(termino: string, nombre: string): Promise<string> {
    await this.page.getByRole('button', { name: 'Buscar cliente' }).click();
    const dialogo = this.page.getByRole('dialog', { name: 'Clientes' });
    await dialogo.getByPlaceholder('Código, nombre, alias o documento').fill(termino);
    const fila = dialogo.locator('tbody tr').filter({ hasText: nombre }).first();
    await expect(fila, `El buscador de clientes tiene que traer a ${nombre}`).toBeVisible({ timeout: 30_000 });
    const texto = (await fila.innerText()).replace(/\s+/g, ' ');
    await fila.click();
    await expect(dialogo).toBeHidden();
    return texto;
  }

  async guardar(): Promise<string> {
    await this.page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(this.page, 'Guardar la orden tiene que llevar a su ficha').toHaveURL(/\/finance\/charge-orders\/\d+/, { timeout: 60_000 });
    await expect(this.campo('code'), 'La orden guardada tiene que mostrar su codigo').not.toHaveValue('', { timeout: 30_000 });
    return this.page.url().match(/charge-orders\/(\d+)/)?.[1] ?? '';
  }

  pendienteDeAsignacion(): Locator {
    return this.page.getByText(/^Pendiente de asignación:/);
  }

  tarjeta(titulo: string): Locator {
    return this.page.locator('section, .card, article').filter({ has: this.page.getByText(titulo, { exact: true }) }).last();
  }

  filaPendiente(fileCode: string): Locator {
    return this.tarjeta('Facturas pendientes de asignación').locator('tbody tr').filter({ hasText: fileCode });
  }

  filaAsignada(fileCode: string): Locator {
    return this.tarjeta('Facturas asignadas').locator('tbody tr').filter({ hasText: fileCode });
  }

  /** Valor de una fila por el nombre de su columna. */
  async valorDeColumna(fila: Locator, columna: string): Promise<string> {
    const tabla = fila.locator('xpath=ancestor::table[1]');
    const encabezados = (await tabla.locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const i = encabezados.indexOf(columna);
    expect(i, `La tabla tiene que tener la columna "${columna}". Tiene: ${encabezados.join(' | ')}`).toBeGreaterThanOrEqual(0);
    return (await fila.locator('td').nth(i).innerText()).trim();
  }

  /** "Asignar" vive en el menu "Acciones" de la fila. */
  async abrirAsignacion(fila: Locator): Promise<Locator> {
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menu', { name: 'Acciones' }).getByRole('menuitem', { name: /^Asignar(?! total)/ }).click();
    const dialogo = this.page.getByRole('dialog', { name: 'Asignación OC' });
    await expect(dialogo).toBeVisible();
    return dialogo;
  }

  async importesDelDialogo(dialogo: Locator) {
    const v = (id: string) => dialogo.locator(`#ca-${id}`).inputValue();
    return {
      moneda: await v('cur'), ordenTotal: await v('total'), ordenPendiente: await v('pending'),
      comprobanteTotal: await v('itotal'), comprobantePendiente: await v('ipending'),
    };
  }

  async asignar(dialogo: Locator, monto: string, comentario: string) {
    await dialogo.locator('#ca-amount').fill(monto);
    await dialogo.locator('#ca-comment').fill(comentario);
    await dialogo.getByRole('button', { name: /^(Guardar|Aceptar)$/ }).click();
    await expect(dialogo).toBeHidden({ timeout: 30_000 });
  }

  /** Carga la fecha y la referencia del recibo y aprueba, confirmando la pregunta (alertdialog). */
  async aprobar(fechaDelRecibo: string, referencia: string) {
    const fecha = this.campo('receipt-date');
    await fecha.fill(fechaDelRecibo);
    await fecha.press('Tab');
    await this.campo('receipt').fill(referencia);
    await this.page.getByRole('button', { name: 'Aprobar & aplicar recibo' }).click();
    const pregunta = this.page.getByRole('alertdialog').filter({ hasText: '¿Aprobar la orden de cobro?' });
    await pregunta.getByRole('button', { name: 'Aprobar & aplicar recibo' }).click();
    await expect(pregunta).toBeHidden({ timeout: 30_000 });
  }
}
