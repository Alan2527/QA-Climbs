import { Page, Locator, expect } from '@playwright/test';

type Bandeja = 'items' | 'invoices' | 'pay-orders';

const RUTA: Record<Bandeja, string> = {
  items: '/finance/unassigned-items',
  invoices: '/finance/unassigned-invoices',
  'pay-orders': '/finance/unassigned-pay-orders',
};
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
    await expect(this.page.getByRole('heading', { name: TITULO[bandeja], level: 1 })).toBeVisible();
    await this.esperarResultados();
  }

  private async esperarResultados() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByRole('status').filter({ hasText: /·/ }).first()).toBeVisible({ timeout: 60_000 });
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
    await this.page.locator('input[id^="search-unassigned-"]').fill(texto);
    await this.esperarResultados();
  }

  fila(texto: string): Locator {
    return this.page.locator('tbody tr').filter({ hasText: texto });
  }

  async figura(texto: string): Promise<boolean> {
    await this.buscar(texto);
    return (await this.fila(texto).count()) > 0;
  }

  async textoDeLaFila(texto: string): Promise<string> {
    const f = this.fila(texto).first();
    return (await f.count()) ? (await f.innerText()).replace(/\s+/g, ' ').trim() : '';
  }
}
