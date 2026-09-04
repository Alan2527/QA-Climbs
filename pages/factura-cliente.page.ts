import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Factura al cliente: el tercer eslabon de la cadena de cobranzas.
 *
 *   menu Facturacion -> Nuevo Compr.
 *     -> invoice-management/invoicing/newinvoice
 *     -> Guardar -> invoice-management/invoicing/pending   (bandeja de pendientes)
 *
 * Es el eslabon que vuelve a atar la cadena con el file: la factura entra **por
 * el file**, no por el proveedor. El orden no es opcional — primero el
 * destinatario y despues el file, porque el buscador de files filtra por cliente
 * y ni siquiera abre sin uno elegido (`invoicing.js:305`).
 *
 * Elegir el file completa solo el pasajero, el numero de file, las fechas de los
 * servicios y la moneda, trae los conceptos a facturar desde
 * `loaditemsbyfile` y calcula el vencimiento en el servidor
 * (`invoicing.js`, selectFile / loadFileItems / loadDueDate).
 *
 * A diferencia de la orden de pago, **no hay una segunda etapa**: se guarda una
 * vez y la factura cae en la bandeja de pendientes de emision.
 *
 * Referencias:
 *   Invoicing/NewInvoice.aspx      -> btnShow, btnSelectFile, edittbl,
 *                                     txtTotalRate, txtExchange, btnSave
 *   Modal/SearchFileControl.ascx   -> modalSelectFile, tblSelectFile
 *   Invoicing/PendingInvoices.aspx -> tblPending
 *
 * El BO no tiene selector de idioma ni tema oscuro: no aplican las
 * consideraciones transversales de multiidioma ni modo oscuro.
 */
export class FacturaClientePage {
  constructor(private readonly page: Page) {}

  // --- Destinatario ---
  readonly btnDestinatario = '#btnShow';
  readonly nombreDelCliente = '#spanName';
  readonly documentoDelCliente = '#spanDocument';
  readonly condicionFiscal = '#spanConditionFiscal';

  // --- File ---
  readonly btnElegirFile = '#btnSelectFile';
  readonly campoNumeroDeFile = '#txtFileNumber';
  readonly campoPasajero = '#txtPaxName';
  readonly campoFechasDelServicio = '#txtServicesDate';
  readonly campoVencimiento = '#txtDueDate';

  // --- Comprobante ---
  readonly comboTipo = '#ddTypeInvoice';
  readonly comboMoneda = '#ddCurrency';
  readonly comboMonedaRelacionada = '#ddCurrencyRelated';
  readonly campoCotizacion = '#txtExchange';
  readonly campoTotal = '#txtTotalRate';
  readonly campoDetalle = '#txtDetail';
  readonly grillaDeConceptos = '#edittbl';
  readonly avisoDeDescuento = '#litDiscountAlert';
  readonly btnGuardar = '#btnSave';

  // --- Bandeja de pendientes ---
  readonly grillaPendientes = '#tblPending';

  /**
   * Entra por el menu lateral, abriendo el padre solo si esta cerrado.
   *
   * Clickear el padre cuando el acordeon ya esta abierto lo cierra y deja el
   * item tapado, que es lo que paso con la bandeja de ordenes de pago.
   */
  async irANuevoComprobante() {
    // Hay **dos** enlaces a esta ruta: el acceso rapido "Nuevo Inv." del
    // lanzador, que vive oculto, y el item de menu "Nuevo Compr.". Se distingue
    // por su texto o se termina clickeando el que no navega.
    const enlace = "a[href$='invoice-management/invoicing/newinvoice']";
    const item = this.page.locator(enlace).filter({ hasText: 'Nuevo Compr' }).first();

    // El acordeon deja el item con tamano aunque este colapsado: `isVisible()`
    // devuelve true y el clic lo intercepta el encabezado "Facturacion". En vez
    // de adivinar en que estado esta el menu, se intenta el clic y, si lo tapan,
    // se abre el padre y se reintenta. Sirve tanto viniendo de una pantalla que
    // dejo el menu abierto como de una que lo dejo cerrado.
    const padre = item.locator('xpath=ancestor::li[contains(@class,"menu-accordion")][1]/a').first();
    try {
      await item.click({ timeout: 5_000 });
    } catch {
      await padre.click();
      await item.click({ timeout: 30_000 });
    }
    await this.page.waitForURL(/newinvoice/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Texto de la opcion elegida en un combo. */
  async opcionElegida(selector: string): Promise<string> {
    return this.page.locator(selector).evaluate((el) => {
      const combo = el as HTMLSelectElement;
      return (combo.options[combo.selectedIndex]?.text ?? '').trim();
    });
  }

  /**
   * Elige el destinatario del comprobante.
   *
   * Es lo primero: sin cliente elegido el buscador de files no abre y avisa
   * "Debe seleccionar Destinatario / Cliente".
   */
  async elegirDestinatario(nombre: string) {
    await this.page.locator(this.btnDestinatario).click();
    const modal = this.page.locator('#modalCnt');
    await expect(modal).toBeVisible({ timeout: 30_000 });

    await modal.locator('#dataCustomers_filter input').fill(nombre);
    const fila = modal.locator('#dataCustomers tbody tr').filter({ hasText: nombre }).first();
    await expect(
      fila,
      `El buscador de clientes tiene que ofrecer ${nombre}`,
    ).toBeVisible({ timeout: 30_000 });

    await fila.click();
    await expect(modal).toBeHidden({ timeout: 30_000 });
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.nombreDelCliente)).not.toBeEmpty({ timeout: 30_000 });
  }

  /** Datos del destinatario que muestra la pantalla una vez elegido. */
  async datosDelDestinatario(): Promise<{ nombre: string; documento: string; condicion: string }> {
    const texto = async (sel: string) =>
      (await this.page.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
    return {
      nombre: await texto(this.nombreDelCliente),
      documento: await texto(this.documentoDelCliente),
      condicion: await texto(this.condicionFiscal),
    };
  }

  /**
   * Elige el file y espera a que traiga sus conceptos.
   *
   * La grilla de files es un DataTable server-side filtrado por el cliente
   * elegido. Al tomar la fila, el JS dispara dos AJAX — los conceptos y el
   * vencimiento — que **no pasan por jQuery.active**, asi que se espera al dato:
   * que la grilla de conceptos tenga al menos una fila.
   */
  async elegirFile(numeroDeFile: string) {
    await this.page.locator(this.btnElegirFile).click();
    const modal = this.page.locator('#modalSelectFile');
    await expect(modal).toBeVisible({ timeout: 30_000 });

    await modal.locator('#tblSelectFile_filter input').fill(numeroDeFile);
    await esperarFinDeCarga(this.page);

    const fila = modal.locator('#tblSelectFile tbody tr').filter({ hasText: numeroDeFile }).first();
    await expect(
      fila,
      `El buscador de files tiene que ofrecer el file ${numeroDeFile} para el destinatario elegido. ` +
      'Si no aparece, revisar que el cliente del file sea el mismo que se eligio como destinatario.',
    ).toBeVisible({ timeout: 60_000 });

    await fila.click();
    await expect(modal).toBeHidden({ timeout: 30_000 });

    await expect
      .poll(() => this.page.locator(`${this.grillaDeConceptos} tbody tr`).count(), {
        timeout: 60_000,
        message: 'El file tiene que traer sus conceptos a facturar',
      })
      .toBeGreaterThan(0);
    await esperarFinDeCarga(this.page);
  }

  /** Filas de la grilla de conceptos, cada una como lista de celdas. */
  async conceptos(): Promise<string[][]> {
    return this.page.locator(`${this.grillaDeConceptos} tbody tr`).evaluateAll((filas) =>
      filas.map((tr) => Array.from(tr.querySelectorAll('td, th'))
        .map((c) => {
          const control = c.querySelector('input, select, textarea') as HTMLInputElement | null;
          const valor = control ? control.value : (c.textContent || '');
          return valor.replace(/\s+/g, ' ').trim();
        })));
  }

  /** Aviso de descuento por reserva online, si la pantalla lo muestra. */
  async descuento(): Promise<string> {
    const aviso = this.page.locator(this.avisoDeDescuento);
    if (!(await aviso.count())) return '';
    if (!(await aviso.isVisible())) return '';
    return (await aviso.innerText()).replace(/\s+/g, ' ').trim();
  }

  /**
   * Guarda el comprobante.
   *
   * Guardar redirige a la bandeja de pendientes
   * (`NewInvoice.aspx.cs:481`); si alguna validacion de cliente falla, se queda
   * en la pantalla con un noty y la espera de la URL lo detecta.
   */
  async guardar() {
    await this.page.locator(this.btnGuardar).click();
    await this.page.waitForURL(/invoicing\/pending/i, { timeout: 120_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Mensaje de error que muestra el BO cuando el guardado no pasa la validacion. */
  async mensajeDeError(): Promise<string> {
    const noty = this.page.locator('.noty_text, .noty_body').first();
    return (await noty.count()) ? (await noty.innerText()).replace(/\s+/g, ' ').trim() : '';
  }

  /** Fila de la bandeja de pendientes que corresponde a un file. */
  filaPendiente(texto: string): Locator {
    return this.page.locator(`${this.grillaPendientes} tbody tr`).filter({ hasText: texto }).first();
  }

  /** Celdas de una fila, normalizadas. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }
}
