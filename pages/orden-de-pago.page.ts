import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Orden de pago: el segundo eslabon de la cadena de cobranzas.
 *
 *   menu Administracion -> administration/payorders        (bandeja)
 *     -> Nuevo -> administration/payorder/0                (alta)
 *     -> Guardar -> administration/payorder/{id}           (imputacion y aprobacion)
 *
 * Misma estructura de dos etapas que la factura de proveedor: en una orden
 * nueva el control de asignacion y el boton Aprobar estan ocultos y aparecen
 * recien cuando la orden existe (`Detail.aspx.cs:441-447`).
 *
 * Ojo con los ids: en esta pantalla **la mayoria NO son estaticos**. Solo lo son
 * los que estan declarados con `ClientIDMode="Static"`; `ddBranch` y
 * `lnkConfirmAllocate` llevan los prefijos de ASP.NET y hay que ubicarlos por
 * sufijo.
 *
 * Referencias:
 *   PayOrders/Default.aspx -> alta en administration/payorder/0
 *   PayOrders/Detail.aspx  -> ddBranch, txtSupplier, ddCurrency, txtDate,
 *                             ddApplyMonth, txtTotalAmount, ddCashFlow1..4,
 *                             txtAmount1..4, txtReceiptDate, btnSave, btnApprove
 *   Module/PayOrderAllocationControl.ascx -> tblAllocationSupplierInvoices,
 *                             modalPayOrderAllocation, lnkAsignarTotal
 *
 * El BO no tiene selector de idioma ni tema oscuro: no aplican las
 * consideraciones transversales de multiidioma ni modo oscuro.
 */
export class OrdenDePagoPage {
  constructor(private readonly page: Page) {}

  // --- Cabecera ---
  // ddBranch no es estatico en esta pantalla, a diferencia de la factura.
  readonly comboSucursal = "[id$='ddBranch']";
  readonly btnProveedor = '#btnSupplier';
  readonly campoProveedor = '#txtSupplier';
  readonly hiddenProveedor = '#hiddenSupplier';
  readonly campoDocumento = '#txtDocNumber';
  readonly comboMoneda = '#ddCurrency';
  readonly campoFecha = '#txtDate';
  readonly campoCotizacion = '#txtExchangeRate';
  readonly comboMesDeAplicacion = '#ddApplyMonth';
  // El Monto Total esta deshabilitado y lo calcula el JS sumando los importes de
  // las cuatro cajas en su focusout (`payment.js:283`), igual que el total de la
  // factura de proveedor. No se escribe.
  readonly campoTotal = '#txtTotalAmount';
  readonly campoDetalle = '#txtDetail';
  readonly campoCodigo = '#txtCode';
  readonly btnGuardar = '#btnSave';
  readonly btnAprobar = '#btnApprove';

  // --- Forma de pago: hasta cuatro cajas con su importe y vencimiento ---
  readonly comboCaja = '#ddCashFlow1';
  readonly campoImporteDeLaCaja = '#txtAmount1';
  readonly campoVencimientoDeLaCaja = '#txtAmountDueDate1';

  // --- Recibo ---
  readonly campoFechaDelRecibo = '#txtReceiptDate';
  readonly campoNumeroDelRecibo = '#txtReceiptNumber';

  // --- Imputacion ---
  readonly pendienteDeAsignacion = '#h5PendingAmount';
  readonly grillaPendientes = '#tblAllocationSupplierInvoices';
  readonly modalDeAsignacion = '#modalPayOrderAllocation';

  // --- Bandeja ---
  readonly grillaDeLaBandeja = '#tblPayOrders';

  /**
   * Busca en la bandeja con el buscador de la propia grilla.
   *
   * Es un DataTable de cliente sobre filas ya renderizadas, no server-side: el
   * filtro es local y no dispara AJAX.
   */
  async buscarEnLaBandeja(texto: string) {
    await this.page.locator(`${this.grillaDeLaBandeja}_filter input`).fill(texto);
  }

  /** Fila de la bandeja que contiene el texto buscado. */
  filaEnLaBandeja(texto: string): Locator {
    return this.page.locator(`${this.grillaDeLaBandeja} tbody tr`).filter({ hasText: texto }).first();
  }

  /** Celdas de una fila de la bandeja, normalizadas. */
  async celdasDeLaBandeja(texto: string): Promise<string[]> {
    return (await this.filaEnLaBandeja(texto).locator('td').allInnerTexts())
      .map((c) => c.replace(/\s+/g, ' ').trim());
  }

  /**
   * Entra a la bandeja por el menu lateral.
   *
   * El padre se abre **solo si hace falta**. Ordenes Pago vive en el mismo
   * submenu que Fact. de Proveed. (`BOMaster.Master:411-414`), asi que cuando se
   * llega desde la factura el acordeon ya esta abierto y clickear el padre lo
   * cerraria, dejando el item presente en el DOM pero tapado por los items
   * vecinos.
   */
  async irABandejaDeOrdenes() {
    const enlace = "a[href$='administration/payorders']";
    const item = this.page.locator(enlace).first();
    const padre = item.locator('xpath=ancestor::li[contains(@class,"menu-accordion")][1]/a').first();

    try {
      await item.click({ timeout: 5_000 });
    } catch {
      await padre.click();
      await item.click({ timeout: 30_000 });
    }
    await this.page.waitForURL(/payorders/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Alta desde el boton Nuevo de la bandeja. */
  async nuevaOrden() {
    await this.page.locator("a[href*='administration/payorder/0']").first().click();
    await this.page.waitForURL(/payorder\/0/i, { timeout: 60_000 });
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
   * Elige una opcion de un combo por su etiqueta y espera el postback.
   *
   * `ddBranch`, `ddCurrency` y `ddCashFlow1..4` son AutoPostBack: cambiar la
   * moneda o la sucursal recarga la lista de cajas
   * (`Detail.aspx.cs:184`, LoadCashFlows), y cambiar la caja recalcula la
   * cotizacion.
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
        (r) => r.request().method() === 'POST' && /payorder/i.test(r.url()),
        { timeout: 60_000 },
      ).catch(() => null),
      this.page.locator(selector).selectOption({ label: elegida! }),
    ]);
    await this.esperarPostback();
    return elegida!;
  }

  /**
   * Espera a que ASP.NET termine el postback parcial.
   *
   * `esperarFinDeCarga` mira `jQuery.active`, y los postbacks del UpdatePanel no
   * pasan por jQuery: vuelve enseguida y se opera sobre un DOM que se esta
   * reemplazando. Ahi se pierden los handlers que `initPayOrderDetail` vuelve a
   * enganchar, y el buscador de proveedores deja de abrir.
   */
  private async esperarPostback() {
    await this.page.waitForFunction(() => {
      const w = window as any;
      const prm = w.Sys?.WebForms?.PageRequestManager?.getInstance?.();
      return !prm || !prm.get_isInAsyncPostBack();
    }, undefined, { timeout: 60_000 }).catch(() => {});
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Elige el proveedor en el buscador modal, igual que la factura. */
  async elegirProveedor(busqueda: string, razonSocialEsperada: string) {
    // El buscador solo abre si el campo de proveedor esta habilitado
    // (`payment.js:129`): si se llega mientras el UpdatePanel se repinta, el
    // clic no hace nada y el modal nunca se muestra.
    await expect(this.page.locator(this.campoProveedor)).toBeEditable({ timeout: 30_000 });
    await this.page.locator(this.btnProveedor).click();
    const modal = this.page.locator('#modalCnt');
    await expect(modal).toBeVisible({ timeout: 30_000 });

    await modal.locator('#dataSuppliers_filter input').fill(busqueda);
    const fila = modal.locator('#dataSuppliers tbody tr').filter({ hasText: razonSocialEsperada }).first();
    await expect(
      fila,
      `El buscador de proveedores tiene que ofrecer ${razonSocialEsperada} al buscar "${busqueda}"`,
    ).toBeVisible({ timeout: 30_000 });

    await fila.click();
    await expect(modal).toBeHidden({ timeout: 30_000 });
    await esperarFinDeCarga(this.page);
  }

  /**
   * Carga el importe de la primera forma de pago y deja que el BO calcule el total.
   *
   * El recalculo se dispara al salir del campo, no al escribir, asi que hay que
   * sacarle el foco o el Monto Total queda en cero.
   */
  async cargarImporte(monto: string) {
    await this.page.locator(this.campoImporteDeLaCaja).fill(monto);
    await this.page.locator(this.campoImporteDeLaCaja).blur();
    await esperarFinDeCarga(this.page);
  }

  /**
   * Guarda la orden y devuelve su ID.
   *
   * El guardado redirige a `administration/payorder/{id}`
   * (`Detail.aspx.cs:1050`). Si falta la caja, la fecha o el proveedor, corta
   * con un noty y no navega.
   */
  async guardar(): Promise<string> {
    await this.page.locator(this.btnGuardar).click();
    await this.page.waitForURL(/payorder\/\d+$/i, { timeout: 120_000 });
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
    const texto = await this.page.locator(this.pendienteDeAsignacion).innerText();
    return texto.replace(/^[^:]*:/, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Fila de la grilla de facturas pendientes de imputar.
   *
   * La grilla es un ListView renderizado por el servidor, no un DataTable
   * server-side: viene entera y no tiene buscador propio.
   */
  filaPendiente(texto: string): Locator {
    return this.page.locator(`${this.grillaPendientes} tbody tr`).filter({ hasText: texto }).first();
  }

  /** Celdas de una fila, normalizadas. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  /**
   * Abre el modal de asignacion de una fila (la accion "A").
   *
   * Como en la factura, el modal se muestra vacio y lo llena un postback
   * asincronico que dispara `shown.bs.modal` (`payment.js:368`). Ese postback no
   * pasa por jQuery.active, asi que hay que esperar al dato.
   */
  async abrirAsignacion(fila: Locator) {
    await fila.locator('a.invoice-allocation').first().click();
    await expect(this.page.locator(this.modalDeAsignacion)).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => (await this.page.locator('#txtPayOrderAllocationTotal').inputValue()).trim(), {
        timeout: 60_000,
        message: 'El modal de asignacion tiene que cargar el total de la orden',
      })
      .not.toBe('');
    await esperarFinDeCarga(this.page);
  }

  /** Los cuatro importes del modal: total y pendiente de la orden y de la factura. */
  async importesDelModal(): Promise<{
    moneda: string; ordenTotal: string; ordenPendiente: string;
    facturaTotal: string; facturaPendiente: string; montoPropuesto: string;
  }> {
    const valor = async (id: string) => (await this.page.locator(id).inputValue()).trim();
    return {
      moneda: await this.opcionElegida('#ddPayOrderAllocationCurrency'),
      ordenTotal: await valor('#txtPayOrderAllocationTotal'),
      ordenPendiente: await valor('#txtPayOrderAllocationPending'),
      facturaTotal: await valor('#txtInvoiceAllocationTotal'),
      facturaPendiente: await valor('#txtInvoiceAllocationPending'),
      montoPropuesto: await valor('#txtInvoiceAllocationAmount'),
    };
  }

  /** Carga el monto y el comentario y confirma la imputacion. */
  async imputar(monto: string, comentario: string) {
    await this.page.locator('#txtInvoiceAllocationAmount').fill(monto);
    await this.page.locator('#txtInvoiceAllocationComment').fill(comentario);
    // Por sufijo: `lnkConfirmAllocate` no es estatico
    // (`PayOrderAllocationControl.ascx:244`).
    await this.page.locator("[id$='lnkConfirmAllocate']").first().click();
    await expect(this.page.locator(this.modalDeAsignacion)).toBeHidden({ timeout: 60_000 });
    await esperarFinDeCarga(this.page);
  }

  /**
   * Aprueba la orden aplicando el recibo.
   *
   * El boton dice "Aprobar & Aplicar Recibo" y exige la fecha del recibo, que no
   * puede ser anterior a la de la orden ni posterior a hoy, ni caer en un dia ya
   * cerrado en Gastos & Mov. Diarios (`Detail.aspx.cs:1128-1160`). Recarga la
   * misma pantalla.
   */
  /**
   * Elige la fecha del recibo **en el calendario**, no escribiendola.
   *
   * El campo tiene un bootstrap-datepicker, no una mascara, y ninguna de las dos
   * formas de escribirlo funciona:
   *
   *  - con `fill` el valor se ve en pantalla pero **llega vacio** al servidor, que
   *    corta con "Debe completar la fecha del Recibo";
   *  - tipeando los digitos pelados queda "07092026", que el servidor no puede
   *    parsear y `ToDate()` **cae silenciosamente a hoy**, asi que la orden se
   *    aprueba con una fecha que nadie eligio.
   *
   * Elegir el dia en el calendario es ademas lo que hace una persona.
   */
  async elegirFechaDelRecibo(fecha: string) {
    const [dia, mes, anio] = fecha.split('/').map(Number);
    await this.page.locator(this.campoFechaDelRecibo).click();

    const calendario = this.page.locator('.datepicker').filter({ has: this.page.locator('.datepicker-days') }).last();
    await expect(calendario, 'El campo de la fecha del recibo tiene que abrir su calendario')
      .toBeVisible({ timeout: 30_000 });

    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
      'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const buscado = `${meses[mes - 1]} ${anio}`;

    // El encabezado dice "Septiembre 2026": se avanza o retrocede hasta el mes
    // pedido en vez de asumir que ya esta a la vista.
    for (let intento = 0; intento < 24; intento++) {
      const titulo = (await calendario.locator('.datepicker-days .datepicker-switch').first().innerText())
        .replace(/\s+/g, ' ').trim().toUpperCase();
      if (titulo === buscado) break;

      const actual = meses.indexOf(titulo.split(' ')[0]) + 1;
      const anioActual = Number(titulo.split(' ')[1]);
      const adelante = anioActual < anio || (anioActual === anio && actual < mes);
      await calendario.locator(`.datepicker-days th.${adelante ? 'next' : 'prev'}`).first().click();
    }

    await calendario.locator('.datepicker-days td.day:not(.old):not(.new)')
      .filter({ hasText: new RegExp(`^${dia}$`) }).first().click();

    await expect(
      this.page.locator(this.campoFechaDelRecibo),
      'El calendario tiene que dejar la fecha elegida en el campo',
    ).toHaveValue(fecha, { timeout: 30_000 });
    await esperarFinDeCarga(this.page);
  }

  async aprobar(fecha: string, numeroDeRecibo: string) {
    await this.elegirFechaDelRecibo(fecha);
    await this.page.locator(this.campoNumeroDelRecibo).fill(numeroDeRecibo);
    await this.page.locator(this.campoNumeroDelRecibo).blur();
    await this.page.locator(this.btnAprobar).click();
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);

    // Aprobar hace un Response.Redirect a la misma pantalla: leer el estado
    // enseguida lo devuelve vacio porque la navegacion todavia esta en curso. Se
    // espera a que el estado exista, sea el que sea; si la aprobacion fue
    // rechazada seguira en Pendiente y lo dira la comparacion del test, no un
    // timeout.
    await expect
      .poll(() => this.estado(), {
        timeout: 60_000,
        message: 'La pantalla de la orden tiene que volver a mostrar su estado',
      })
      .not.toBe('');
  }

  /**
   * Estado que muestra la pantalla. Aprobada queda en Pagada (Status 30).
   *
   * Se lee del h5 que lo contiene: `litStatus` es un `asp:Literal` dentro de un
   * PlaceHolder (`Detail.aspx:23-25`) y ninguno de los dos deja id en el HTML.
   */
  async estado(): Promise<string> {
    const h5 = this.page.locator('h5.text-uppercase.text-success').first();
    return (await h5.count()) ? (await h5.innerText()).replace(/\s+/g, ' ').trim() : '';
  }
}
