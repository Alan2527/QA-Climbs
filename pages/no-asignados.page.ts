import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga, formatearFecha } from '../utils/pasos';

/**
 * PROVISORIO, hasta que se corrija el hallazgo 9.
 *
 * Las bandejas de facturas y de ordenes de pago comparan la fecha de CREACION contra
 * el "Hasta" a las 00:00, asi que lo creado hoy no figura con los filtros con los que
 * abren. El PM confirmo que es un defecto ("tiene que filtrar el hasta inclusive").
 * Mientras tanto, por pedido de Alan (2026-09-15), las dos bandejas se abren con el
 * "Hasta" en manana. Cuando se corrija, pasar esto a `false`: las bandejas vuelven a
 * mirarse con sus filtros por defecto, que es lo que hace una persona.
 */
const ESQUIVAR_HALLAZGO_9 = true;

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
  readonly tablaDeItems = '#tblFileItems';

  /**
   * Abre la bandeja de items de file sin factura de proveedor
   * (`UnassignedItems/Default.aspx`, vista "No Asignados").
   *
   * Filtra por la fecha del SERVICIO (`FI.InDate`, `FileItemSvc.cs:1372`) y el
   * rango por defecto termina hoy: un servicio reservado a futuro no se lista
   * hasta correr el "Hasta". Por eso se recibe la fecha y se vuelve a filtrar.
   */
  async abrirItems(hasta: string) {
    await this.abrir('administration/unassigned-items', this.tablaDeItems);
    await this.filtrarHasta(hasta, this.tablaDeItems);
  }

  /**
   * Corre el filtro "Hasta" de la bandeja abierta y vuelve a filtrar.
   *
   * Las tres bandejas lo traen en hoy, pero no filtran lo mismo: la de items mira
   * la fecha del SERVICIO, y un servicio reservado a futuro no se lista sin correrlo.
   * La de facturas y la de ordenes de pago miran la de CREACION contra el "Hasta" a
   * las 00:00 y dejan afuera lo creado hoy: es el hallazgo 9, confirmado como defecto
   * por el PM, y mientras no se corrija se esquiva (ver `ESQUIVAR_HALLAZGO_9`).
   *
   * Es un bootstrap-datepicker (`data-provide="datepicker"`): el valor se tipea
   * como lo haria una persona y se confirma con Enter, que cierra el calendario sin
   * volver a la fecha anterior. Se verifica antes de filtrar, porque un "Hasta" que
   * no tomo la fecha lista igual y lo buscado falta por otro motivo.
   */
  async filtrarHasta(hasta: string, tabla: string) {
    const campoHasta = this.page.locator('#txtDateTo');
    await campoHasta.click();
    await campoHasta.press('Control+A');
    await campoHasta.pressSequentially(hasta, { delay: 20 });
    await campoHasta.press('Enter');
    await expect(campoHasta, 'El filtro Hasta tiene que quedar con la fecha pedida').toHaveValue(hasta);
    // El boton es un LinkButton sin ClientIDMode Static: su id termina en btnFilter.
    await this.page.locator("[id$='btnFilter']").first().click();
    await esperarFinDeCarga(this.page);
    await expect(
      this.page.locator(tabla),
      'La bandeja tiene que volver a mostrar su grilla despues de filtrar',
    ).toBeVisible({ timeout: 60_000 });
  }

  /** Abre la bandeja de facturas de proveedor sin imputar. */
  async abrirFacturas() {
    await this.abrir('administration/unassigned-invoices', this.tablaDeFacturas);
    await this.esquivarHallazgo9(this.tablaDeFacturas);
  }

  /** Abre la bandeja de ordenes de pago sin imputar. */
  async abrirOrdenes() {
    await this.abrir('administration/unassigned-payorders', this.tablaDeOrdenes);
    await this.esquivarHallazgo9(this.tablaDeOrdenes);
  }

  /** Corre el "Hasta" a manana mientras siga el hallazgo 9. */
  private async esquivarHallazgo9(tabla: string) {
    if (!ESQUIVAR_HALLAZGO_9) return;
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    await this.filtrarHasta(formatearFecha(manana), tabla);
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
