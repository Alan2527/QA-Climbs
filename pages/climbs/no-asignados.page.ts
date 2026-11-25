import { Page, Locator, expect } from '@playwright/test';

type Bandeja = 'items' | 'invoices' | 'pay-orders';

const RUTA: Record<Bandeja, string> = {
  items: '/finance/unassigned-items',
  invoices: '/finance/unassigned-invoices',
  'pay-orders': '/finance/unassigned-pay-orders',
};
/** Desde noviembre las tres bandejas son solapas de una sola pantalla, "Sin asignar". */
const SOLAPA: Record<Bandeja, string> = { items: 'Servicios', invoices: 'Facturas', 'pay-orders': 'Órdenes de pago' };
const TITULO: Record<Bandeja, string> = {
  items: 'Servicios sin asignar',
  invoices: 'Facturas de proveedores sin asignar',
  'pay-orders': 'Órdenes de pago sin asignar',
};

/**
 * Las tres bandejas de "lo que falta asignar" del Backoffice nuevo (Finanzas). Comparten
 * filtros: sucursal, proveedores, moneda, Desde/Hasta (por defecto, los ultimos 30 dias
 * hasta hoy) y un buscador que filtra lo ya traido. La de servicios filtra por la fecha
 * del servicio; las de facturas y ordenes, por la de creacion.
 */
export class NoAsignadosNuevaPage {
  constructor(private readonly page: Page) {}

  async abrir(bandeja: Bandeja) {
    await this.page.goto(RUTA[bandeja]);
    const titulo = this.page.getByRole('heading', { name: TITULO[bandeja], level: 1 })
      .or(this.page.getByRole('heading', { name: 'Sin asignar', level: 1 })).first();
    await expect(titulo).toBeVisible({ timeout: 60_000 });
    const solapa = this.page.getByRole('tab', { name: SOLAPA[bandeja], exact: true });
    if (await solapa.count()) {
      if ((await solapa.getAttribute('aria-selected')) !== 'true') await solapa.click();
      await expect(solapa).toHaveAttribute('aria-selected', 'true');
    }
    await this.esperarResultados();
  }

  private async esperarResultados() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByRole('status').filter({ hasText: /·/ }).or(this.page.getByText(/\d[\d.]* resultados?$/)).first()).toBeVisible({ timeout: 60_000 });
  }

  /** Corre el "Hasta" como lo haria una persona: escribe la fecha y sale del campo. */
  async filtrarHasta(fecha: string) {
    const hasta = this.page.getByRole('textbox', { name: 'Hasta', exact: true });
    await hasta.fill(fecha);
    await hasta.press('Tab');
    await expect(hasta, 'El filtro Hasta tiene que tomar la fecha').toHaveValue(fecha);
    await this.esperarResultados();
  }

  async buscar(texto: string) {
    await this.page.locator('input[id^="search-unassigned-"]').or(this.page.getByRole('searchbox', { name: 'Servicio, file, factura o proveedor' })).first().fill(texto);
    await this.esperarResultados();
  }

  fila(texto: string): Locator {
    return this.page.locator('tbody tr').filter({ hasText: texto });
  }

  async figura(texto: string): Promise<boolean> {
    await this.buscar(texto);
    // El buscador filtra unos instantes despues de escribir: el contador viejo ya esta a la
    // vista, asi que se espera la fila un rato antes de decir que no figura.
    return this.fila(texto).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
  }

  async textoDeLaFila(texto: string): Promise<string> {
    const f = this.fila(texto).first();
    return (await f.count()) ? (await f.innerText()).replace(/\s+/g, ' ').trim() : '';
  }
}
