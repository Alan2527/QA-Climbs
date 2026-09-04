import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Orden de cobro: el cuarto eslabon de la cadena de cobranzas.
 *
 *   menu Administracion -> Ordenes Cobro -> administration/chargeorders
 *     -> Nuevo -> administration/chargeorder/0
 *     -> Guardar -> administration/chargeorder/{id}   (imputacion y aprobacion)
 *
 * Es el espejo de la orden de pago, con tres diferencias que importan:
 *
 *  - va contra un **cliente**, no un proveedor;
 *  - **no tiene combo de sucursal**: las cajas se listan solo por moneda
 *    (`CashFlowSvc.LoadPublished`), sin filtrar por sucursal;
 *  - admite **dos** formas de pago, no cuatro.
 *
 * La sucursal igual existe, pero se deduce: al aprobar, el BO la resuelve desde
 * la categoria de la caja elegida (`DailyExpenseSvc.GetChargeOrderBranchID`). Si
 * la categoria no tuviera sucursal, la aprobacion corta con "No se encontro
 * sucursal asociada para la OC".
 *
 * Aprobar tambien recalcula lo cobrado del file y lo guarda en
 * `BO_File.CashedAmount`, que **no se muestra en pantalla**
 * (`ChargeOrderCashHelper.RecalculateAndAccredit`).
 *
 * El BO no tiene selector de idioma ni tema oscuro: no aplican las
 * consideraciones transversales de multiidioma ni modo oscuro.
 */
export class OrdenDeCobroPage {
  constructor(private readonly page: Page) {}

  // --- Cabecera ---
  readonly btnCliente = '#btnCustomer';
  readonly campoCliente = '#txtCustomer';
  readonly hiddenCliente = '#hiddenCustomer';
  readonly campoDocumento = '#txtDocNumber';
  readonly comboMoneda = '#ddCurrency';
  readonly campoFecha = '#txtDate';
  readonly campoCotizacion = '#txtExchangeRate';
  readonly comboMesDeAplicacion = '#ddApplyMonth';
  // El Monto Total tampoco se escribe: lo suma el JS a partir de las formas de
  // pago, igual que en la orden de pago.
  readonly campoTotal = '#txtTotalAmount';
  readonly campoDetalle = '#txtDetail';
  readonly campoCodigo = '#txtCode';
  readonly btnGuardar = '#btnSave';
  readonly btnAprobar = '#btnApprove';

  // --- Forma de pago: hasta dos cajas ---
  readonly comboCaja = '#ddCashFlow1';
  readonly campoImporteDeLaCaja = '#txtAmount1';
  readonly campoVencimientoDeLaCaja = '#txtAmountDueDate1';

  // --- Recibo ---
  readonly campoFechaDelRecibo = '#txtReceiptDate';
  readonly campoNumeroDelRecibo = '#txtReceiptNumber';

  // --- Imputacion ---
  // El pendiente no tiene id propio: `litPending` es un asp:Literal dentro de un
  // h5 (`ChargeOrderAllocationControl.ascx:7-9`).
  readonly pendienteDeAsignacion = 'h5.pull-right.text-primary';
  readonly grillaPendientes = '#tblChargeOrderAllocation';
  readonly modalDeAsignacion = '#modalChargeOrderAllocation';

  /**
   * Entra a la bandeja por el menu lateral.
   *
   * El acordeon deja el item con tamano aunque este colapsado, asi que preguntar
   * por `isVisible()` no sirve: se intenta el clic y, si lo tapa el encabezado,
   * se abre el padre y se reintenta.
   */
  async irABandejaDeOrdenes() {
    const enlace = "a[href$='administration/chargeorders']";
    const item = this.page.locator(enlace).first();
    const padre = item.locator('xpath=ancestor::li[contains(@class,"menu-accordion")][1]/a').first();

    try {
      await item.click({ timeout: 5_000 });
    } catch {
      await padre.click();
      await item.click({ timeout: 30_000 });
    }
    await this.page.waitForURL(/chargeorders/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Alta desde el boton Nuevo de la bandeja. */
  async nuevaOrden() {
    await this.page.locator("a[href*='administration/chargeorder/0']").first().click();
    await this.page.waitForURL(/chargeorder\/0/i, { timeout: 60_000 });
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

  /** Opciones que ofrece un combo, para poder explicar por que no esta la esperada. */
  async opcionesDe(selector: string): Promise<string[]> {
    return this.page.locator(`${selector} option`).evaluateAll((os) =>
      os.map((o) => (o.textContent || '').trim()).filter(Boolean));
  }

  /**
   * Elige una opcion de un combo por su etiqueta y espera el postback parcial.
   *
   * `ddCurrency` y `ddCashFlow1..2` son AutoPostBack, y esos postbacks no pasan
   * por `jQuery.active`: hay que esperar al PageRequestManager o se opera sobre
   * un DOM que se esta reemplazando.
   */
  async elegirEnCombo(selector: string, etiqueta: string): Promise<string> {
    const opciones = await this.opcionesDe(selector);
    const elegida = opciones.find((o) => o.toUpperCase().includes(etiqueta.toUpperCase()));
    expect(
      elegida,
      `El combo tiene que ofrecer "${etiqueta}". Ofrece: ${opciones.join(' | ')}`,
    ).toBeTruthy();

    await Promise.all([
      this.page.waitForResponse(
        (r) => r.request().method() === 'POST' && /chargeorder/i.test(r.url()),
        { timeout: 60_000 },
      ).catch(() => null),
      this.page.locator(selector).selectOption({ label: elegida! }),
    ]);
    await this.esperarPostback();
    return elegida!;
  }

  /** Espera a que ASP.NET termine el postback parcial del UpdatePanel. */
  private async esperarPostback() {
    await this.page.waitForFunction(() => {
      const w = window as any;
      const prm = w.Sys?.WebForms?.PageRequestManager?.getInstance?.();
      return !prm || !prm.get_isInAsyncPostBack();
    }, undefined, { timeout: 60_000 }).catch(() => {});
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Elige el cliente en el buscador modal. */
  async elegirCliente(busqueda: string, nombreEsperado: string) {
    await expect(this.page.locator(this.campoCliente)).toBeEditable({ timeout: 30_000 });
    await this.page.locator(this.btnCliente).click();
    const modal = this.page.locator('#modalCnt');
    await expect(modal).toBeVisible({ timeout: 30_000 });

    await modal.locator('#dataCustomers_filter input').fill(busqueda);
    const fila = modal.locator('#dataCustomers tbody tr').filter({ hasText: nombreEsperado }).first();
    await expect(
      fila,
      `El buscador de clientes tiene que ofrecer ${nombreEsperado} al buscar "${busqueda}"`,
    ).toBeVisible({ timeout: 30_000 });

    await fila.click();
    await expect(modal).toBeHidden({ timeout: 30_000 });
    await esperarFinDeCarga(this.page);
  }

  /**
   * Carga el importe de la primera forma de pago y deja que el BO calcule el total.
   *
   * El recalculo se dispara al salir del campo, no al escribir.
   */
  async cargarImporte(monto: string) {
    await this.page.locator(this.campoImporteDeLaCaja).fill(monto);
    await this.page.locator(this.campoImporteDeLaCaja).blur();
    await esperarFinDeCarga(this.page);
  }

  /** Guarda la orden y devuelve su ID. El guardado redirige a chargeorder/{id}. */
  async guardar(): Promise<string> {
    await this.page.locator(this.btnGuardar).click();
    await this.page.waitForURL(/chargeorder\/\d+$/i, { timeout: 120_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
    return this.page.url().split('/').pop() ?? '';
  }

  /** Mensaje de error que muestra el BO cuando el guardado no pasa la validacion. */
  async mensajeDeError(): Promise<string> {
    const noty = this.page.locator('.noty_text, .noty_body').first();
    return (await noty.count()) ? (await noty.innerText()).replace(/\s+/g, ' ').trim() : '';
  }

  /** Importe pendiente de asignacion, tal como lo muestra el encabezado. */
  async pendiente(): Promise<string> {
    const h5 = this.page.locator(this.pendienteDeAsignacion)
      .filter({ hasText: 'Pendiente de asignaci' }).first();
    const texto = await h5.innerText();
    return texto.replace(/^[^:]*:/, '').replace(/\s+/g, ' ').trim();
  }

  /** Fila de la grilla de comprobantes pendientes de cobrar. */
  filaPendiente(texto: string): Locator {
    return this.page.locator(`${this.grillaPendientes} tbody tr`).filter({ hasText: texto }).first();
  }

  /** Celdas de una fila, normalizadas. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  /**
   * Valor de una columna de la grilla de pendientes, por el texto de su encabezado.
   *
   * Hace falta porque la grilla trae **seis columnas de importe**: Total, Asig. y
   * Saldo en USD y las mismas tres en la moneda de la sucursal. Tomar "el ultimo
   * importe de la fila" agarra el saldo en la otra moneda. Encima las columnas de
   * la moneda de la sucursal se escriben con **punto decimal** ("10.000" son 10),
   * al reves que el resto del BO, asi que leerlas con el parser de siempre da un
   * numero mil veces mas grande.
   */
  async valorDeColumna(fila: Locator, encabezado: string): Promise<string> {
    const encabezados = await this.page.locator(`${this.grillaPendientes} thead th`).allInnerTexts();
    const indice = encabezados.findIndex((h) =>
      h.replace(/\s+/g, ' ').trim().toUpperCase() === encabezado.toUpperCase());
    expect(
      indice,
      `La grilla tiene que tener la columna "${encabezado}". Tiene: ` +
      encabezados.map((h) => h.replace(/\s+/g, ' ').trim()).join(' | '),
    ).toBeGreaterThanOrEqual(0);

    const celdas = await this.celdas(fila);
    return celdas[indice] ?? '';
  }

  /**
   * Abre el modal de asignacion de una fila (la accion "A").
   *
   * El modal se muestra vacio y lo llena un postback asincronico disparado por
   * `shown.bs.modal` (`payment.js:1032`), que no pasa por jQuery.active: se
   * espera al dato.
   */
  async abrirAsignacion(fila: Locator) {
    await fila.locator('a.invoice-allocation').first().click();
    await expect(this.page.locator(this.modalDeAsignacion)).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => (await this.page.locator('#txtChargeOrderAllocationTotal').inputValue()).trim(), {
        timeout: 60_000,
        message: 'El modal de asignacion tiene que cargar el total de la orden',
      })
      .not.toBe('');
    await esperarFinDeCarga(this.page);
  }

  /** Los cuatro importes del modal: total y pendiente de la orden y del comprobante. */
  async importesDelModal(): Promise<{
    moneda: string; ordenTotal: string; ordenPendiente: string;
    comprobanteTotal: string; comprobantePendiente: string; montoPropuesto: string;
  }> {
    const valor = async (id: string) => (await this.page.locator(id).inputValue()).trim();
    return {
      moneda: await this.opcionElegida('#ddChargeOrderAllocationCurrency'),
      ordenTotal: await valor('#txtChargeOrderAllocationTotal'),
      ordenPendiente: await valor('#txtChargeOrderAllocationPending'),
      comprobanteTotal: await valor('#txtInvoiceAllocationTotal'),
      comprobantePendiente: await valor('#txtInvoiceAllocationPending'),
      montoPropuesto: await valor('#txtInvoiceAllocationAmount'),
    };
  }

  /** Carga el monto y el comentario y confirma la imputacion. */
  async imputar(monto: string, comentario: string) {
    await this.page.locator('#txtInvoiceAllocationAmount').fill(monto);
    await this.page.locator('#txtInvoiceAllocationComment').fill(comentario);
    // Por sufijo: `lnkConfirmAllocate` no es estatico.
    await this.page.locator("[id$='lnkConfirmAllocate']").first().click();
    await expect(this.page.locator(this.modalDeAsignacion)).toBeHidden({ timeout: 60_000 });
    await esperarFinDeCarga(this.page);
  }

  /**
   * Aprueba la orden aplicando el recibo.
   *
   * La fecha del recibo se **tipea**: el campo tiene mascara y con `fill` el
   * valor no viaja en el postback. Ademas no puede ser anterior a la fecha de la
   * orden, ni posterior a hoy, ni caer en un dia cerrado en Gastos & Mov.
   * Diarios.
   */
  async aprobar(fecha: string, numeroDeRecibo: string) {
    await this.page.locator(this.campoFechaDelRecibo).click();
    await this.page.locator(this.campoFechaDelRecibo)
      .pressSequentially(fecha.replace(/\D/g, ''), { delay: 60 });
    await this.page.locator(this.campoNumeroDelRecibo).fill(numeroDeRecibo);
    await this.page.locator(this.campoNumeroDelRecibo).blur();

    await this.page.locator(this.btnAprobar).click();
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);

    // Aprobar redirige a la misma pantalla: leer el estado enseguida lo devuelve
    // vacio porque la navegacion sigue en curso.
    await expect
      .poll(() => this.estado(), {
        timeout: 60_000,
        message: 'La pantalla de la orden tiene que volver a mostrar su estado',
      })
      .not.toBe('');
  }

  /** Estado que muestra la pantalla. Aprobada queda en Pago (Status 30). */
  async estado(): Promise<string> {
    const h5 = this.page.locator('h5.text-uppercase.text-success').first();
    return (await h5.count()) ? (await h5.innerText()).replace(/\s+/g, ' ').trim() : '';
  }
}
