import { Page, Locator, expect } from '@playwright/test';
import { elegirEnMenuAcciones } from './menu-acciones';

/**
 * Ordenes de pago del Backoffice nuevo (`/finance/pay-orders`).
 *
 * La ficha nueva trae la sucursal, la fecha de hoy y una forma de pago con vencimiento hoy.
 * Guardada, suma el bloque "Recibo" (fecha, numero interno, recibo del proveedor y
 * "Aprobar & aplicar recibo") y la asignacion a las facturas pendientes del proveedor.
 * Los campos se ubican por su id (`po-*`, `pa-*` en el dialogo de asignacion).
 */
export class OrdenDePagoNuevaPage {
  constructor(private readonly page: Page) {}

  readonly campo = (id: string) => this.page.locator(`#po-${id}`);

  async abrirNueva() {
    await this.page.goto('/finance/pay-orders');
    await this.page.getByRole('button', { name: 'Nueva orden' }).or(this.page.getByRole('link', { name: 'Nueva orden' })).click();
    await expect(this.page).toHaveURL(/\/finance\/pay-orders\/new/);
    await expect(this.page.getByRole('heading', { name: 'Nueva orden de pago' })).toBeVisible();
  }

  /** Desde noviembre las listas largas (mas de 15 opciones, como la caja) son un combo con buscador. */
  private async esSelect(id: string): Promise<boolean> {
    await expect(this.campo(id)).toBeVisible({ timeout: 30_000 });
    return this.campo(id).evaluate((e) => e.tagName === 'SELECT');
  }

  async opcionElegida(id: string): Promise<string> {
    if (!(await this.esSelect(id))) return (await this.campo(id).inputValue()).trim();
    return this.campo(id).evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? '');
  }

  /** Las opciones del campo. En el combo con buscador, las que trae al escribir `filtro` (sin filtro, hasta 60). */
  async opciones(id: string, filtro = ''): Promise<string[]> {
    if (await this.esSelect(id)) return this.campo(id).locator('option').allInnerTexts();
    const lista = await this.abrirCombo(id, filtro);
    const out = (await lista.getByRole('option').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    await this.campo(id).press('Escape');
    return out;
  }

  /** Elige una opcion por su texto, sea lista nativa o combo con buscador. */
  async elegir(id: string, etiqueta: string) {
    if (await this.esSelect(id)) { await this.campo(id).selectOption({ label: etiqueta }); return; }
    const lista = await this.abrirCombo(id, etiqueta);
    await lista.getByRole('option').filter({ hasText: etiqueta }).first().click();
    await expect.poll(() => this.campo(id).inputValue(), { message: `El campo tiene que quedar en ${etiqueta}`, timeout: 30_000 }).toContain(etiqueta);
  }

  private async abrirCombo(id: string, texto: string): Promise<Locator> {
    const campo = this.campo(id);
    await campo.click();
    if (texto) await campo.fill(texto);
    const lista = this.page.locator(`#${await campo.getAttribute('aria-controls')}`);
    await expect(lista, 'El combo tiene que desplegar sus opciones').toBeVisible({ timeout: 30_000 });
    return lista;
  }

  async elegirProveedor(termino: string, razonSocial: string) {
    await this.page.getByRole('button', { name: 'Buscar proveedor' }).click();
    const dialogo = this.page.getByRole('dialog', { name: 'Proveedores' });
    await dialogo.getByPlaceholder('Código, nombre, razón social o documento').fill(termino);
    const fila = dialogo.locator('tbody tr').filter({ hasText: razonSocial }).first();
    await expect(fila, `El buscador de proveedores tiene que traer a ${razonSocial}`).toBeVisible({ timeout: 30_000 });
    await fila.click();
    await expect(dialogo).toBeHidden();
  }

  /** Guarda la orden nueva; la pantalla pasa a `/finance/pay-orders/{id}`. */
  async guardar(): Promise<string> {
    await this.page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(this.page, 'Guardar la orden tiene que llevar a su ficha').toHaveURL(/\/finance\/pay-orders\/\d+/, { timeout: 60_000 });
    await expect(this.campo('code'), 'La orden guardada tiene que mostrar su codigo').not.toHaveValue('', { timeout: 30_000 });
    return this.page.url().match(/pay-orders\/(\d+)/)?.[1] ?? '';
  }

  pendienteDeAsignacion(): Locator {
    return this.page.getByRole('status').filter({ hasText: /^\s*Pendiente de asignación/ }).or(this.page.getByText(/^Pendiente de asignación:/)).first();
  }

  tarjeta(titulo: string): Locator {
    return this.page.locator('section, .card, article').filter({ has: this.page.getByText(titulo, { exact: true }) }).last();
  }

  filaPendiente(numeroDeFactura: string): Locator {
    return this.tarjeta('Facturas pendientes de asignación').locator('tbody tr').filter({ hasText: numeroDeFactura });
  }

  filaAsignada(numeroDeFactura: string): Locator {
    return this.tarjeta('Facturas asignadas').locator('tbody tr').filter({ hasText: numeroDeFactura });
  }

  /** "Asignar" vive en el menu "Acciones" de la fila. */
  async abrirAsignacion(fila: Locator): Promise<Locator> {
    await elegirEnMenuAcciones(this.page, fila, /^Asignar(?! total)/);
    const dialogo = this.page.getByRole('dialog', { name: 'Asignación OP' });
    await expect(dialogo).toBeVisible();
    return dialogo;
  }

  async importesDelDialogo(dialogo: Locator) {
    const v = (id: string) => dialogo.locator(`#pa-${id}`).inputValue();
    return {
      moneda: await v('cur'), ordenTotal: await v('total'), ordenPendiente: await v('pending'),
      facturaPagable: await v('payable'), facturaPendiente: await v('ipending'),
    };
  }

  async asignar(dialogo: Locator, monto: string, comentario: string) {
    await dialogo.locator('#pa-amount').fill(monto);
    await dialogo.locator('#pa-comment').fill(comentario);
    await dialogo.getByRole('button', { name: /^(Guardar|Aceptar)$/ }).click();
    await expect(dialogo).toBeHidden({ timeout: 30_000 });
  }

  /** Carga la fecha y el recibo del proveedor y aprueba, confirmando la pregunta. */
  async aprobar(fechaDelRecibo: string, reciboDelProveedor: string) {
    const fecha = this.campo('receipt-date');
    await fecha.fill(fechaDelRecibo);
    await fecha.press('Tab');
    await this.campo('receipt').fill(reciboDelProveedor);
    await this.page.getByRole('button', { name: 'Aprobar & aplicar recibo' }).click();
    // La confirmacion es un alertdialog, no un dialog.
    const pregunta = this.page.getByRole('alertdialog').filter({ hasText: '¿Aprobar la orden de pago?' });
    await pregunta.getByRole('button', { name: 'Aprobar & aplicar recibo' }).click();
    await expect(pregunta).toBeHidden({ timeout: 30_000 });
  }
}
