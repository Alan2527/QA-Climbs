import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Factura de proveedor: el primer eslabon de la cadena de cobranzas.
 *
 *   menu Administracion -> administration/supplierinvoices   (bandeja)
 *     -> Nuevo -> administration/supplierinvoice/0           (alta)
 *     -> Guardar -> administration/supplierinvoice/{id}      (imputacion y aprobacion)
 *
 * El alta y la imputacion **no se pueden hacer de una**: en una factura nueva el
 * control de asignacion y el boton Aprobar estan ocultos, y aparecen recien
 * cuando el comprobante ya existe (`Detail.aspx.cs:697-698`).
 *
 * Referencias:
 *   SupplierInvoices/Default.aspx -> alta en administration/supplierinvoice/0
 *   SupplierInvoices/Detail.aspx  -> ddBranch, txtSupplier, ddTypeInvoice,
 *                                    txtInvoiceBranch, txtInvoiceNumber,
 *                                    ddCurrencyID, txtTotalRate, btnSave, btnApprove
 *   Module/SupplierInvoiceAllocControl.ascx -> tblAllocationFileItems, tblAllocated,
 *                                    modalSupplierInvoiceAllocation
 *   Api/PaymentWebService.cs:265  -> loadsupplierinvoice-for-alloc
 *
 * El BO no tiene selector de idioma ni tema oscuro: no aplican las
 * consideraciones transversales de multiidioma ni modo oscuro.
 */
export class FacturaProveedorPage {
  constructor(private readonly page: Page) {}

  private get base() { return process.env.AMV_BO_URL || 'https://qa.bo.amv.travel'; }

  // --- Cabecera del comprobante ---
  readonly comboSucursal = '#ddBranch';
  readonly btnProveedor = '#btnSupplier';
  readonly campoProveedor = '#txtSupplier';
  readonly hiddenProveedor = '#hiddenSupplier';
  readonly campoDocumento = '#txtDocNumber';
  readonly comboMedioDePago = '#ddPaymentMethod';
  readonly comboTipo = '#ddTypeInvoice';
  readonly campoPuntoDeVenta = '#txtInvoiceBranch';
  readonly campoNumero = '#txtInvoiceNumber';
  readonly campoFecha = '#txtInvoiceDate';
  readonly campoVencimiento = '#txtDueDate';
  readonly comboMoneda = '#ddCurrencyID';
  readonly campoCotizacion = '#txtExchangeRate';
  // El total NO se escribe: esta deshabilitado y lo calcula el JS sumando los
  // importes gravados en el focusout de cualquiera de ellos
  // (supplier.js, setSupplierInvoiceTotal). El importe de un servicio va a
  // Exento, que es el unico campo editable de una Factura A sin IVA.
  readonly campoExento = '#txtNonTaxable';
  readonly campoTotal = '#txtTotalRate';
  readonly campoIIBB = '#txtIIBBDeduction';
  readonly campoPercepcion = '#txtTaxPerception';
  readonly campoComentario = '#txtComment';
  readonly btnGuardar = '#btnSave';
  readonly btnAprobar = '#btnApprove';

  // --- Imputacion ---
  readonly pendienteDeAsignacion = '#h5PendingAmount';
  readonly grillaPendientes = '#tblAllocationFileItems';
  readonly grillaAsignados = '#tblAllocated';
  // Acotado a type=search: el JS inyecta dentro del mismo contenedor del filtro
  // el checkbox "Incluir saldos menores a 1 {moneda}"
  // (`supplier.js`, injectIncludeSmallBalanceCheckbox), asi que `input` a secas
  // resuelve a dos elementos.
  readonly buscadorDePendientes = '#tblAllocationFileItems_filter input[type="search"]';
  readonly modalDeAsignacion = '#modalSupplierInvoiceAllocation';

  /**
   * Entra a la bandeja por el menu lateral.
   *
   * Mismo patron que la bandeja de Reservas: el item existe en el DOM pero esta
   * colapsado, asi que primero hay que abrir el padre.
   */
  async irABandejaDeFacturas() {
    const enlace = "a[href*='administration/supplierinvoices']";
    await this.page.locator(`li:has(${enlace}) > a`).first().click();
    const item = this.page.locator(enlace).first();
    await expect(item).toBeVisible();
    await item.click();
    await this.page.waitForURL(/supplierinvoices/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Alta desde el boton Nuevo de la bandeja. */
  async nuevaFactura() {
    await this.page.locator("a[href*='administration/supplierinvoice/0']").first().click();
    await this.page.waitForURL(/supplierinvoice\/0/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Texto de la opcion elegida en un combo, para comparar lo que ve la persona. */
  async opcionElegida(selector: string): Promise<string> {
    return this.page.locator(selector).evaluate((el) => {
      const combo = el as HTMLSelectElement;
      return (combo.options[combo.selectedIndex]?.text ?? '').trim();
    });
  }

  /**
   * Elige el proveedor en el buscador modal.
   *
   * No es un campo de texto libre: el lapiz abre `#modalCnt` con una grilla de
   * proveedores y la fila elegida completa sola el nombre, el documento, el
   * medio de pago y la cotizacion del proveedor
   * (`supplier.js`, applySupplierInvoiceSupplier).
   */
  async elegirProveedor(busqueda: string, razonSocialEsperada: string) {
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

  /** Datos que el sistema completo solo a partir del proveedor elegido. */
  async datosDelProveedor(): Promise<{ razonSocial: string; documento: string; medioDePago: string }> {
    return {
      razonSocial: (await this.page.locator(this.campoProveedor).inputValue()).trim(),
      documento: (await this.page.locator(this.campoDocumento).inputValue()).trim(),
      medioDePago: await this.opcionElegida(this.comboMedioDePago),
    };
  }

  /**
   * Elige la sucursal del comprobante.
   *
   * El combo trae "Seleccione..." cuando el usuario tiene mas de una sucursal
   * (`Detail.aspx.cs:463`), y el guardado corta con "Debe seleccionar una
   * Sucursal" si queda sin elegir (`supplier.js:366`). Al cambiarla se dispara
   * un postback para resolver el modelo fiscal
   * (`requestSupplierInvoiceFiscalCountryRefresh`).
   */
  async elegirSucursal(nombre: string): Promise<string> {
    const combo = this.page.locator(this.comboSucursal);
    const opciones = await combo.locator('option').evaluateAll((os) =>
      os.map((o) => ({ valor: (o as HTMLOptionElement).value, texto: (o.textContent || '').trim() })));

    const elegida = opciones.find((o) => o.texto.toUpperCase().includes(nombre.toUpperCase()));
    expect(
      elegida,
      `El comprobante tiene que ofrecer la sucursal ${nombre}. Ofrece: ` +
      opciones.map((o) => o.texto).filter(Boolean).join(' | '),
    ).toBeTruthy();

    await combo.selectOption(elegida!.valor);
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
    return elegida!.texto;
  }

  /**
   * Carga el importe del comprobante como Exento y deja que el BO calcule el total.
   *
   * El recalculo se dispara en el `focusout` del campo, no al escribir
   * (`supplier.js:353`), asi que hay que sacarle el foco: escribir y no salir
   * deja el total en cero y el guardado corta con "El monto total no puede ser
   * igual a 0".
   */
  async cargarImporte(monto: string) {
    await this.page.locator(this.campoExento).fill(monto);
    await this.page.locator(this.campoExento).blur();
    await esperarFinDeCarga(this.page);
  }

  /**
   * Guarda el comprobante y devuelve su ID.
   *
   * El guardado redirige a `administration/supplierinvoice/{id}`
   * (`Detail.aspx.cs:1124`), asi que el ID sale de la URL igual que el del file.
   * Si el guardado falla, el BO no navega: muestra un noty y se queda en la
   * misma pantalla, y la espera de la URL es lo que lo detecta.
   */
  async guardar(): Promise<string> {
    await this.page.locator(this.btnGuardar).click();
    await this.page.waitForURL(/supplierinvoice\/\d+$/i, { timeout: 120_000 });
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
   * Busca en la grilla de items pendientes con el buscador de la propia grilla.
   *
   * La grilla es server-side: el buscador manda el texto al endpoint, que filtra
   * por codigo del item, file, pasajero, detalle y cliente
   * (`PaymentWebService.cs:450`). Hay que esperar el AJAX o la grilla se lee con
   * el contenido anterior.
   */
  async buscarPendiente(texto: string) {
    await this.page.locator(this.buscadorDePendientes).fill(texto);
    await esperarFinDeCarga(this.page);
  }

  /** Fila de la grilla de pendientes que contiene el texto buscado. */
  filaPendiente(texto: string): Locator {
    return this.page.locator(`${this.grillaPendientes} tbody tr`).filter({ hasText: texto }).first();
  }

  /** Fila de la grilla de items ya asignados a esta factura. */
  filaAsignada(texto: string): Locator {
    return this.page.locator(`${this.grillaAsignados} tbody tr`).filter({ hasText: texto }).first();
  }

  /** Celdas de una fila, normalizadas. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  /**
   * Abre el modal de asignacion de una fila (la accion "A").
   *
   * La otra accion de la fila, "AT", imputa el total sin abrir nada. Se usa el
   * modal porque muestra los cuatro importes que hay que verificar: total y
   * pendiente de la factura, total y pendiente del servicio.
   */
  async abrirAsignacion(fila: Locator) {
    await fila.locator('a.invoice-allocation').first().click();
    await expect(this.page.locator(this.modalDeAsignacion)).toBeVisible({ timeout: 30_000 });

    // El modal se muestra vacio y lo llena un postback asincronico de ASP.NET
    // que dispara el propio `shown.bs.modal` (`supplier.js:1911`). Ese postback
    // **no pasa por jQuery.active**, asi que esperar el fin de carga vuelve
    // enseguida y el modal se lee en blanco. Se espera al dato, que es lo unico
    // que garantiza que el UpdatePanel ya se pinto.
    await expect
      .poll(async () => (await this.page.locator('#txtInvoiceAllocationTotal').inputValue()).trim(), {
        timeout: 60_000,
        message: 'El modal de asignacion tiene que cargar el total del comprobante',
      })
      .not.toBe('');
    await esperarFinDeCarga(this.page);
  }

  /** Los cuatro importes que muestra el modal, mas la moneda del comprobante. */
  async importesDelModal(): Promise<{
    moneda: string; facturaTotal: string; facturaPendiente: string;
    servicioTotal: string; servicioPendiente: string; montoPropuesto: string;
  }> {
    const valor = async (id: string) => (await this.page.locator(id).inputValue()).trim();
    return {
      moneda: await this.opcionElegida('#ddInvoiceAllocationCurrency'),
      facturaTotal: await valor('#txtInvoiceAllocationTotal'),
      facturaPendiente: await valor('#txtInvoiceAllocationPending'),
      servicioTotal: await valor('#txtInvoiceAllocationServiceTotal'),
      servicioPendiente: await valor('#txtInvoiceAllocationServicePending'),
      montoPropuesto: await valor('#txtInvoiceAllocationAmount'),
    };
  }

  /** Carga el monto y el comentario y confirma la imputacion. */
  async imputar(monto: string, comentario: string) {
    await this.page.locator('#txtInvoiceAllocationAmount').fill(monto);
    await this.page.locator('#txtInvoiceAllocationComment').fill(comentario);
    // Por sufijo y no por id: es el unico control del modal sin
    // ClientIDMode="Static" (`SupplierInvoiceAllocControl.ascx:166`), asi que
    // ASP.NET le antepone los prefijos del contenedor.
    await this.page.locator("[id$='lnkConfirmAllocate']").first().click();
    await expect(this.page.locator(this.modalDeAsignacion)).toBeHidden({ timeout: 60_000 });
    await esperarFinDeCarga(this.page);
  }

  /**
   * Aprueba el comprobante.
   *
   * El boton dice "Ajustar & Aprobar" y corta si el total es menor a lo ya
   * imputado (`Detail.aspx.cs:1409`). Recarga la misma pantalla, no navega a
   * otra, asi que lo que confirma el aprobado es que el boton quede deshabilitado.
   */
  async aprobar() {
    await this.page.locator(this.btnAprobar).click();
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Si el comprobante quedo aprobado: el BO deshabilita el boton y los importes. */
  async estaAprobada(): Promise<boolean> {
    return !(await this.page.locator(this.btnAprobar).isEnabled());
  }
}
