import { Page, Locator, expect } from '@playwright/test';

/**
 * Facturas de proveedores del Backoffice nuevo (`/finance/supplier-invoices`).
 *
 * La ficha nace bloqueada: hasta elegir sucursal y proveedor solo muestra el aviso
 * "Seleccione una sucursal y un proveedor...". Guardada, abajo aparecen los servicios
 * asignados y los pendientes del proveedor en esa sucursal, con "Asignar" (abre el
 * dialogo "Asignacion" con los cuatro importes) y "Asignar total".
 *
 * Los campos se ubican por su id (`si-*`): son los que la pantalla asocia a cada etiqueta.
 */
export class FacturaProveedorNuevaPage {
  constructor(private readonly page: Page) {}

  readonly aviso = () => this.page.getByText('Seleccione una sucursal y un proveedor para continuar con la carga del comprobante.');
  readonly campo = (id: string) => this.page.locator(`#si-${id}`);

  async abrirNueva() {
    await this.page.goto('/finance/supplier-invoices');
    await this.page.getByRole('button', { name: 'Nueva factura' }).click();
    await expect(this.page).toHaveURL(/\/finance\/supplier-invoices\/new/);
    await expect(this.page.getByRole('heading', { name: 'Carga del comprobante de proveedores' })).toBeVisible();
  }

  async elegirSucursal(nombre: string) {
    await this.campo('branch').selectOption({ label: nombre });
  }

  async elegirProveedor(termino: string, razonSocial: string) {
    await this.page.getByRole('button', { name: 'Buscar el proveedor' }).click();
    const dialogo = this.page.getByRole('dialog', { name: 'Proveedores' });
    await dialogo.getByPlaceholder('Código, nombre, razón social o documento').fill(termino);
    const fila = dialogo.locator('tbody tr').filter({ hasText: razonSocial }).first();
    await expect(fila, `El buscador de proveedores tiene que traer a ${razonSocial}`).toBeVisible({ timeout: 30_000 });
    await fila.click();
    await expect(dialogo).toBeHidden();
    await expect(this.campo('supplier')).toHaveValue(razonSocial);
  }

  async opcionElegida(id: string): Promise<string> {
    return this.campo(id).evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? '');
  }

  /** Guarda la factura nueva; la pantalla pasa a `/finance/supplier-invoices/{id}`. */
  async guardar(): Promise<string> {
    await this.page.getByRole('button', { name: 'Guardar', exact: true }).click();
    // Si el modelo fiscal pide revisar algo, avisa antes de guardar: se deja que falle con su texto.
    await expect(this.page, 'Guardar la factura tiene que llevar a su ficha').toHaveURL(/\/finance\/supplier-invoices\/\d+/, { timeout: 60_000 });
    return this.page.url().match(/supplier-invoices\/(\d+)/)?.[1] ?? '';
  }

  pendienteDeAsignacion(): Locator {
    return this.page.getByRole('status').filter({ hasText: 'Pendiente de asignación:' });
  }

  tarjeta(titulo: string): Locator {
    return this.page.locator('section, .card, article').filter({ has: this.page.getByText(titulo, { exact: true }) }).last();
  }

  async buscarPendiente(termino: string) {
    await this.page.locator('#si-items-search').fill(termino);
  }

  filaPendiente(fileCode: string): Locator {
    return this.tarjeta('Servicios pendientes de asignación').locator('tbody tr').filter({ hasText: fileCode });
  }

  filaAsignada(fileCode: string): Locator {
    return this.tarjeta('Servicios asignados a la factura').locator('tbody tr').filter({ hasText: fileCode });
  }

  /**
   * Abre "Asignar" de la fila y devuelve el dialogo con sus cuatro importes. Las acciones
   * de la fila viven en el menu "Acciones" (los tres puntos), que se abre aparte.
   */
  async abrirAsignacion(fila: Locator): Promise<Locator> {
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menu', { name: 'Acciones' }).getByRole('menuitem', { name: /^Asignar(?! total)/ }).click();
    const dialogo = this.page.getByRole('dialog', { name: 'Asignación' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator('#si-alloc-invoice-total')).not.toHaveValue('', { timeout: 30_000 });
    return dialogo;
  }

  async importesDelDialogo(dialogo: Locator) {
    const v = (id: string) => dialogo.locator(`#si-alloc-${id}`).inputValue();
    return {
      facturaTotal: await v('invoice-total'), facturaPendiente: await v('invoice-pending'),
      servicioTotal: await v('service-total'), servicioPendiente: await v('service-pending'),
    };
  }

  async asignar(dialogo: Locator, monto: string, comentario: string) {
    await dialogo.locator('#si-alloc-amount').fill(monto);
    await dialogo.locator('#si-alloc-comment').fill(comentario);
    await dialogo.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialogo).toBeHidden({ timeout: 30_000 });
  }
}
