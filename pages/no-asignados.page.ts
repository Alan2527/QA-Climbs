import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Las dos bandejas de no asignados del BackOffice.
 *
 *   administration/unassigned-invoices    facturas de proveedor sin imputar
 *   administration/unassigned-payorders   ordenes de pago sin imputar
 *
 * **Lo que listan es lo que quedo suelto**, no lo que existe: la consulta arranca
 * de la factura y se queda con las que **no** tienen fila en
 * `FileItemToSupplierInvoice` (`FileItemSvc.cs:1637`, `where FITSI.SupplierInvoiceID
 * == null`). O sea que una factura entra a la bandeja al crearse y sale al
 * imputarse a un item de file.
 *
 * Eso es justo lo que las vuelve verificables de punta a punta sin inventar nada:
 * el eslabon 1 crea una factura y despues la imputa, asi que tiene que aparecer
 * antes y no estar despues. Una bandeja de "lo que falta hacer" que no se vacia
 * cuando el trabajo se hizo deja de servir para lo unico que sirve.
 *
 * Referencias:
 *   BO.WebApp/Global.asax.cs:96-97          las rutas
 *   BO.WebApp/UnassignedInvoices/Default.aspx   #tblUnassignedInvoices
 *   BO.WebApp/UnassignedPayorders/Default.aspx  #tblUnassignedPayorders
 */
export class NoAsignadosPage {
  constructor(private readonly page: Page) {}

  readonly tablaDeFacturas = '#tblUnassignedInvoices';
  readonly tablaDeOrdenes = '#tblUnassignedPayorders';

  /** Abre la bandeja de facturas de proveedor sin imputar. */
  async abrirFacturas() {
    await this.abrir('administration/unassigned-invoices', this.tablaDeFacturas);
  }

  /** Abre la bandeja de ordenes de pago sin imputar. */
  async abrirOrdenes() {
    await this.abrir('administration/unassigned-payorders', this.tablaDeOrdenes);
  }

  private async abrir(ruta: string, tabla: string) {
    await this.page.goto(`${process.env.AMV_BO_URL}/${ruta}`);
    await esperarFinDeCarga(this.page);
    await expect(
      this.page.locator(tabla),
      `La bandeja ${ruta} tiene que abrir con su grilla`,
    ).toBeVisible({ timeout: 60_000 });
  }

  /**
   * Busca una fila por un texto suyo, dentro de la bandeja indicada.
   *
   * Las dos grillas son filtrables y paginadas, asi que antes de mirar se escribe
   * el texto en el buscador: sin eso, una factura que existe pero cayo en la
   * pagina tres se leeria como ausente.
   */
  async filtrar(tabla: string, texto: string) {
    const buscador = this.page.locator(`${tabla}_filter input, ${tabla}_wrapper input[type='search']`).first();
    if (await buscador.count()) {
      await buscador.fill(texto);
      await this.page.waitForTimeout(1_000);
    }
  }

  fila(tabla: string, texto: string): Locator {
    return this.page.locator(`${tabla} tbody tr`).filter({ hasText: texto }).first();
  }

  /** Si la bandeja lista algo que contenga ese texto. */
  async figura(tabla: string, texto: string): Promise<boolean> {
    await this.filtrar(tabla, texto);
    return (await this.fila(tabla, texto).count()) > 0;
  }

  /** Texto de la fila, para dejarlo en el reporte. */
  async textoDeLaFila(tabla: string, texto: string): Promise<string> {
    const f = this.fila(tabla, texto);
    if (!(await f.count())) return '';
    return (await f.innerText()).replace(/\s+/g, ' ').trim();
  }
}
