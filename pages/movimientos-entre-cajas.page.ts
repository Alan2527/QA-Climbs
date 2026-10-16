import { Page, Locator, Request, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';
import { CajaDiariaPage } from './caja-diaria.page';

/**
 * Movimientos entre cajas del BackOffice: el modal "Movimientos" de la caja diaria.
 *
 *   administration/movements/daily-expenses   (bandeja, filtra por sucursal)
 *     -> lapiz de la fila -> administration/movements/daily-cash/{id}
 *     -> Agregar / lapiz de un movimiento / ojo -> modal DailyCashControl.ascx
 *
 * Un movimiento (tipo 30) son DOS filas con el mismo codigo: la salida de la caja de
 * origen (importe negativo, `IsDestination = false`) y la entrada en la de destino
 * (`IsDestination = true`). Si el destino es de otra sucursal, la entrada vive en
 * la caja diaria de esa sucursal y la fecha (`DailyExpenseSvc.LoadBranchIDByDateAndBranch`).
 * Desde el commit `a34bbc76` (4877) el alta y la edicion van en una transaccion y el
 * destino se ubica por codigo, ya no por el campo oculto `hiddenDailyExpenseDestinationItem`.
 *
 * Esta clase **no pisa nada de `CajaDiariaPage`**: la usa para la bandeja, el filtro por
 * caja y los totales, y agrega lo que le falta (el modal, la baja de un movimiento, la
 * eleccion de sucursal en la bandeja).
 *
 * El BO tiene modo oscuro pero no selector de idioma. Este flujo no verifica el modo
 * oscuro: no es parte de lo que cambio el commit.
 */
export class MovimientosEntreCajasPage {
  private readonly caja: CajaDiariaPage;

  constructor(private readonly page: Page, caja?: CajaDiariaPage) {
    this.caja = caja ?? new CajaDiariaPage(page);
  }

  // --- Bandeja ---
  readonly comboSucursalDeLaBandeja = '#ddBranch';
  readonly grillaDeLaBandeja = '#tblDailyExpenses';

  // --- Caja diaria ---
  readonly btnAgregar = "[id$='lnkAdd']";
  readonly btnCopiar = "[id$='lnkCopyDailyCash']";
  readonly filasDeMovimientos = '#tblDailyExpenseItems tbody tr';

  // --- Modal Movimientos ---
  readonly modal = '#modalDailyCashControl';
  readonly cuerpoDelModal = '#updDailyCashControl .modal-body';
  // Hay dos #txtCode en la pagina (el de la caja y el del modal): se toma el del modal.
  readonly campoCodigo = "#updDailyCashControl [name$='ctrlDailyCashControl$txtCode']";
  readonly comboTipo = '#ddItemType';
  readonly campoCotizacion = '#txtItemExchangeRate';
  readonly comboMonedaOrigen = '#ddItemCurrency';
  readonly campoMontoOrigen = '#txtItemAmount';
  readonly comboSucursalOrigen = '#ddItemBranch';
  // Este combo no tiene ClientIDMode estatico: su id real es
  // ctl00_cphMain_ctrlDailyCashControl_ddCashFlow.
  readonly comboCajaOrigen = "#updDailyCashControl select[id$='ddCashFlow']";
  readonly comboMonedaDestino = '#ddDestinationCurrency';
  readonly campoMontoDestino = '#txtItemDestinationAmount';
  readonly comboSucursalDestino = '#ddItemDestinationBranch';
  readonly comboCajaDestino = '#ddDestinationCashFlow';
  readonly campoComentario = '#txtItemComment';
  readonly btnGuardar = '#btnAddDailyCash';
  readonly btnCerrarModal = '#modalDailyCashControl .modal-footer button[data-dismiss="modal"]';

  // --- Modal Copiar movimientos ---
  readonly modalCopiar = '#modalDailyCashCopy';
  readonly filasDelModalCopiar = '#tblDailyCashCopy tbody tr';

  /** Avisos (noty) y carteles (SweetAlert) que muestra el BO. */
  readonly avisos = '.noty_text, .noty_body, .noty_message';
  readonly cartel = '.sweet-alert.visible';

  private get velo(): Locator { return this.page.locator('#pageloadcnt'); }

  /** Espera a que el velo de carga del BO se apague. */
  private async esperarVelo() {
    await expect(this.velo).toBeHidden({ timeout: 60_000 });
  }

  // ------------------------------------------------------------------
  // Bandeja y apertura de la caja de una sucursal
  // ------------------------------------------------------------------

  /** Espera a que la bandeja (DataTables por AJAX) termine de dibujar sus filas. */
  async esperarBandeja() {
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator('#tblDailyExpenses_processing')).toBeHidden({ timeout: 60_000 });
    await expect(this.page.locator(`${this.grillaDeLaBandeja} tbody tr`).first()).toBeVisible({ timeout: 60_000 });
  }

  /**
   * Elige la sucursal en el combo de la bandeja. El combo no hace postback: recarga la
   * grilla por AJAX (`load-daily-expenses`). Arranca en la sucursal de trabajo.
   */
  async elegirSucursalDeLaBandeja(sucursal: string) {
    const combo = this.page.locator(this.comboSucursalDeLaBandeja);
    const opciones = await combo.locator('option').evaluateAll((os) =>
      os.map((o) => ({ valor: (o as HTMLOptionElement).value, texto: (o.textContent || '').trim() })));
    const elegida = opciones.find((o) => o.texto.toUpperCase().includes(sucursal.toUpperCase()));
    expect(
      elegida,
      `La bandeja tiene que ofrecer la sucursal ${sucursal}. Ofrece: ${opciones.map((o) => o.texto).join(' | ')}`,
    ).toBeTruthy();

    if ((await combo.inputValue()) !== elegida!.valor) {
      const recarga = this.page.waitForResponse((r) => r.url().includes('load-daily-expenses'), { timeout: 60_000 });
      await combo.selectOption(elegida!.valor);
      await recarga;
    }
    await this.esperarBandeja();
  }

  /** Fila de la bandeja cuya columna Fecha (la segunda) es la fecha pedida. */
  filaDeLaBandejaDeLaFecha(fecha: string): Locator {
    return this.page.locator(`${this.grillaDeLaBandeja} tbody tr`)
      .filter({ has: this.page.locator('td:nth-child(2)', { hasText: fecha }) })
      .first();
  }

  /**
   * Abre la caja diaria de una sucursal y una fecha, creandola solo si no existe.
   *
   * Hay una caja por sucursal y fecha (`btnSave_Click`: "Existe otra Apertura de caja en
   * la misma fecha y sucursal"), asi que primero se mira la bandeja de esa sucursal. Se
   * usa en lugar de `CajaDiariaPage.abrirCajaDelDia` porque ese metodo busca la fecha en
   * cualquier columna y no deja elegir la sucursal de la bandeja.
   *
   * Un movimiento entre sucursales exige que las dos tengan caja abierta ese dia.
   */
  async abrirCajaDe(sucursal: string, fecha: string, detalle: string): Promise<{
    id: string; creada: boolean;
  }> {
    await this.caja.irABandejaDeCajas();
    await this.elegirSucursalDeLaBandeja(sucursal);

    const existente = this.filaDeLaBandejaDeLaFecha(fecha);
    const existia = (await existente.count()) > 0;
    if (existia) {
      const texto = (await existente.innerText()).replace(/\s+/g, ' ').toUpperCase();
      expect(texto, `La caja del ${fecha} de ${sucursal} esta cerrada: no admite movimientos`).not.toContain('CERRAD');
      await existente.locator('a:has(i.ph-pencil-simple)').first().click();
    } else {
      await this.page.locator("a[href*='daily-cash/0']").first().click();
      await this.page.waitForURL(/daily-cash\/0$/i, { timeout: 60_000 });
      await esperarFinDeCarga(this.page);
      await this.page.locator(this.caja.comboSucursal).first().selectOption({ label: sucursal });
      await this.page.locator(this.caja.campoDetalle).first().fill(detalle);
      await this.page.locator(this.caja.btnGuardar).first().click();
    }

    // Se exige un id distinto de 0: la apertura vive en daily-cash/0.
    await this.page.waitForURL(/daily-cash\/[1-9]\d*$/i, { timeout: 120_000 });
    await esperarFinDeCarga(this.page);
    await this.esperarVelo();
    await expect(
      this.page.locator(this.btnAgregar),
      `La caja del dia de ${sucursal} tiene que estar abierta y ofrecer "Agregar"`,
    ).toBeVisible({ timeout: 30_000 });

    return { id: this.page.url().split('/').pop() ?? '', creada: !existia };
  }

  // ------------------------------------------------------------------
  // Grilla de movimientos
  // ------------------------------------------------------------------

  /** Todas las filas de la grilla con ese codigo (la salida y, si esta en la misma caja, la entrada). */
  filasDelMovimiento(codigo: string): Locator {
    return this.page.locator(this.filasDeMovimientos).filter({ hasText: codigo });
  }

  /** Fila del movimiento en una caja concreta, ubicada por el nombre del Medio. */
  filaEnLaCaja(codigo: string, nombreDeLaCaja: string): Locator {
    return this.filasDelMovimiento(codigo).filter({ hasText: nombreDeLaCaja }).first();
  }

  /**
   * Celdas de la fila por posicion. La grilla tiene 13 columnas:
   * 0 copiar, 1 ID (codigo), 2 fecha, 3 tipo, 4 moneda, 5 monto, 6 cotizacion,
   * 7 medio, 8 referencia, 9 cliente/prov., 10 comentario, 11 borrar, 12 editar.
   */
  async celdas(fila: Locator): Promise<string[]> {
    return this.caja.celdas(fila);
  }

  /** Botones de accion de una fila, para saber que puede hacer el usuario con ella. */
  async acciones(fila: Locator): Promise<{ copiar: boolean; borrar: boolean; editar: boolean; ver: boolean }> {
    return {
      copiar: (await fila.locator('a[onclick*="openDailyCashModal(this, true)"]').count()) > 0,
      borrar: (await fila.locator('i.ph-trash').count()) > 0,
      editar: (await fila.locator('a[data-itemid]:has(i.ph-pencil-simple)').count()) > 0,
      ver: (await fila.locator('a[title="Ver movimiento de origen"]').count()) > 0,
    };
  }

  /** Refresca la caja con un GET: lo que se ve despues es lo que quedo guardado. */
  async recargarCaja() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await esperarFinDeCarga(this.page);
    await this.esperarVelo();
  }

  // ------------------------------------------------------------------
  // Modal Movimientos
  // ------------------------------------------------------------------

  /**
   * El modal se abre vacio y se llena por postback: hasta que vuelve, el cuerpo queda con
   * `visibility: hidden` y el boton Guardar deshabilitado (movements.js, openDailyCashModal).
   */
  private async esperarModalCargado(codigoEsperado?: string) {
    await expect(this.page.locator(this.modal)).toBeVisible({ timeout: 30_000 });
    await expect(this.page.locator(this.cuerpoDelModal)).toBeVisible({ timeout: 60_000 });
    await esperarFinDeCarga(this.page);
    await this.esperarVelo();
    if (codigoEsperado) {
      await expect(this.page.locator(this.campoCodigo)).toHaveValue(codigoEsperado, { timeout: 30_000 });
    } else {
      await expect(this.page.locator(this.campoCodigo)).not.toHaveValue('', { timeout: 30_000 });
    }
  }

  /** Abre el modal para un movimiento nuevo y devuelve el codigo que le genera. */
  async abrirModalNuevo(): Promise<string> {
    await this.page.locator(this.btnAgregar).click();
    await this.esperarModalCargado();
    return this.page.locator(this.campoCodigo).inputValue();
  }

  /** Abre el modal de edicion con el lapiz de la fila de origen. */
  async abrirModalEdicion(fila: Locator, codigo: string) {
    await fila.locator('a[data-itemid]:has(i.ph-pencil-simple)').click();
    await this.esperarModalCargado(codigo);
  }

  /** Abre el modal de solo lectura con el ojo de la entrada de otra sucursal. */
  async abrirModalVista(fila: Locator, codigo: string) {
    await fila.locator('a[title="Ver movimiento de origen"]').click();
    await this.esperarModalCargado(codigo);
  }

  /** Texto de la opcion elegida en un combo. */
  async elegido(combo: string): Promise<string> {
    return this.page.locator(combo).first().evaluate((s) => {
      const sel = s as HTMLSelectElement;
      return (sel.options[sel.selectedIndex]?.text ?? '').trim();
    });
  }

  /**
   * Elige una opcion de un combo del modal. Los que tienen AutoPostBack se esperan por la
   * respuesta del UpdatePanel (cabecera `X-MicrosoftAjax`): mirar solo `esperarFinDeCarga`
   * no alcanza, porque el postback arranca en un `setTimeout` y el chequeo puede pasar
   * antes de que salga. Si ya esta elegida no hay cambio, no hay postback y no se espera.
   */
  async elegir(combo: string, etiqueta: string, conPostback: boolean) {
    const select = this.page.locator(combo).first();

    // Se busca la opcion tal cual y, si no esta, la que la contenga: la etiqueta de una
    // sucursal o de una caja puede venir con un prefijo que el test no conoce.
    const opciones = (await select.locator('option').evaluateAll((os) =>
      os.map((o) => (o.textContent || '').trim()))).filter(Boolean);
    const buscada = etiqueta.toUpperCase();
    const real = opciones.find((o) => o.toUpperCase() === buscada)
      ?? opciones.find((o) => o.toUpperCase().includes(buscada));
    expect(real, `El combo ${combo} tiene que ofrecer "${etiqueta}". Ofrece: ${opciones.join(' | ')}`).toBeTruthy();

    if ((await this.elegido(combo)).toUpperCase() === real!.toUpperCase()) return;

    const respuesta = conPostback
      ? this.page.waitForResponse(
        (r) => r.request().method() === 'POST' && /daily-cash/i.test(r.url()),
        { timeout: 60_000 })
      : null;
    // Primero el clic, como una persona: los combos del modal tienen ClientIDMode="Static" y
    // el PageRequestManager no los encuentra por su UniqueID; para decidir si el postback es
    // asincronico usa el ultimo elemento clickeado del formulario. Con `selectOption` solo,
    // el postback salia completo y cerraba el modal (medido el 15/10; a mano queda abierto).
    await select.click();
    await select.selectOption({ label: real! });
    if (respuesta) {
      await respuesta;
      await esperarFinDeCarga(this.page);
      await this.esperarVelo();
    }
  }

  /**
   * Filtra la caja diaria por una caja (o "TODOS") y espera a que vuelvan los movimientos y los
   * totales. `CajaDiariaPage.filtrarPorCaja` no espera el postback del combo: leer los totales
   * justo despues puede dar los del filtro anterior. Aca se espera la respuesta del UpdatePanel.
   */
  async filtrarPorCaja(nombre: string) {
    const combo = this.page.locator(this.caja.comboCajaDeTotales).first();
    const opciones = await this.caja.cajasOfrecidas();
    const elegida = opciones.find((o) => o.toUpperCase().includes(nombre.toUpperCase()));
    expect(elegida, `El filtro de cajas tiene que ofrecer "${nombre}". Ofrece: ${opciones.join(' | ')}`).toBeTruthy();

    if ((await this.elegido(this.caja.comboCajaDeTotales)).toUpperCase() === elegida!.toUpperCase()) return;

    // El combo hace un postback completo (sin el encabezado x-microsoftajax, medido el 15/10):
    // se espera cualquier POST de la caja diaria, sea completo o asincronico.
    const respuesta = this.page.waitForResponse(
      (r) => r.request().method() === 'POST' && /daily-cash/i.test(r.url()),
      { timeout: 60_000 });
    await combo.selectOption({ label: elegida! });
    await respuesta;
    await esperarFinDeCarga(this.page);
    await this.esperarVelo();
  }

  /** Elige el tipo "Movimiento": muestra el bloque Destino. */
  async elegirTipoMovimiento() {
    await this.elegir(this.comboTipo, 'Movimiento', true);
    await expect(this.page.locator(this.comboMonedaDestino), 'El tipo Movimiento tiene que mostrar el bloque Destino')
      .toBeVisible({ timeout: 30_000 });
  }

  /**
   * Completa el origen. El orden importa: la moneda recarga las cajas ofrecidas y la caja
   * recalcula la cotizacion.
   */
  async completarOrigen(o: { moneda: string; caja: string; monto?: string }) {
    await this.elegir(this.comboMonedaOrigen, o.moneda, true);
    await this.elegir(this.comboCajaOrigen, o.caja, true);
    if (o.monto !== undefined) await this.page.locator(this.campoMontoOrigen).fill(o.monto);
  }

  /**
   * Completa el destino. La sucursal (si cambia) recarga las cajas, y la moneda tambien:
   * por eso va primero la sucursal, despues la moneda y al final la caja, que no hace postback.
   */
  async completarDestino(d: { sucursal?: string; moneda: string; caja: string; monto?: string }) {
    if (d.sucursal) await this.elegir(this.comboSucursalDestino, d.sucursal, true);
    await this.elegir(this.comboMonedaDestino, d.moneda, true);
    await this.elegir(this.comboCajaDestino, d.caja, false);
    if (d.monto !== undefined) await this.page.locator(this.campoMontoDestino).fill(d.monto);
  }

  async completarComentario(texto: string) {
    await this.page.locator(this.campoComentario).fill(texto);
  }

  /** Avisos visibles ahora en pantalla (noty y carteles), para explicar un fallo. */
  async avisosVisibles(): Promise<string[]> {
    const noty = await this.page.locator(this.avisos).allInnerTexts();
    const carteles = await this.page.locator(this.cartel).allInnerTexts();
    return [...noty, ...carteles].map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  /** Aviso que contiene el texto pedido. */
  aviso(texto: string | RegExp): Locator {
    return this.page.locator(this.avisos).filter({ hasText: texto }).first();
  }

  /** Guarda sin esperar a que cierre: sirve para las validaciones, donde el modal sigue abierto. */
  async guardarSinEsperar() {
    await this.esperarVelo();
    await this.page.locator(this.btnGuardar).click();
  }

  /**
   * Guarda y espera a que el modal cierre (`closeDailyCashModal`). Si no cierra, el error
   * dice que avisos habia en pantalla.
   */
  async guardar() {
    await this.guardarSinEsperar();
    try {
      await expect(this.page.locator(this.modal)).toBeHidden({ timeout: 90_000 });
    } catch (error) {
      const avisos = await this.avisosVisibles();
      throw new Error(
        `El modal no se cerro despues de guardar. Avisos en pantalla: ${avisos.join(' | ') || '(ninguno)'}. ` +
        `${(error as Error).message}`,
      );
    }
    await esperarFinDeCarga(this.page);
    await this.esperarVelo();
  }

  /** Cierra el modal con el boton "Cerrar" del pie. */
  async cerrarModal() {
    await this.page.locator(this.btnCerrarModal).click();
    await expect(this.page.locator(this.modal)).toBeHidden({ timeout: 30_000 });
    await this.esperarVelo();
  }

  // ------------------------------------------------------------------
  // Baja de un movimiento
  // ------------------------------------------------------------------

  /**
   * Borra el movimiento con la papelera de la fila de origen y la confirmacion
   * "Sí, eliminar". El borrado es logico y alcanza a las dos filas (`lnkDelete_Command`).
   *
   * El clic en "Si, eliminar" mientras el cartel todavia entra lo cierra sin llamar al
   * callback (medido el 15/10 en las anulaciones): se espera a que termine de abrirse, se
   * exige que salga el POST `lnkDelete` y, si no sale, se reintenta una vez.
   */
  async eliminar(fila: Locator) {
    const borrado = (r: Request) =>
      r.method() === 'POST' && /__EVENTTARGET=[^&]*lnkDelete/.test(r.postData() ?? '');

    for (let intento = 0; intento < 2; intento++) {
      await fila.locator('a:has(i.ph-trash)').click();
      const cartel = this.page.locator(this.cartel).last();
      await expect(cartel, 'El BO tiene que pedir confirmacion antes de eliminar el movimiento')
        .toBeVisible({ timeout: 30_000 });
      await this.page.waitForTimeout(500);
      const post = this.page.waitForRequest(borrado, { timeout: 15_000 }).then(() => true).catch(() => false);
      await cartel.getByRole('button', { name: /S[ií],\s*eliminar/i }).click();
      if (await post) {
        await esperarFinDeCarga(this.page);
        await this.esperarVelo();
        return;
      }
    }
    throw new Error('Confirmado el cartel, el BO no envio el borrado del movimiento (no salio el POST lnkDelete)');
  }

  // ------------------------------------------------------------------
  // Modal Copiar movimientos
  // ------------------------------------------------------------------

  /**
   * Abre "Copiar" sobre la caja del dia. Sin fecha el servicio toma hoy
   * (`FindDailyExpenses`: `DateTime date = DateTime.Today`) y busca la caja de la MISMA
   * sucursal, asi que lista los movimientos de origen de la caja abierta.
   */
  async abrirCopiar() {
    await this.page.locator(this.btnCopiar).click();
    await expect(this.page.locator(this.modalCopiar)).toBeVisible({ timeout: 30_000 });
    await this.page.waitForFunction(() => !!(window as any).tblDailyCashCopy, undefined, { timeout: 30_000 });
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator('#tblDailyCashCopy_processing')).toBeHidden({ timeout: 60_000 });
  }

  /** Fila del modal Copiar ubicada por el comentario (la tabla no muestra el codigo). */
  filaDelModalCopiar(comentario: string): Locator {
    return this.page.locator(this.filasDelModalCopiar).filter({ hasText: comentario }).first();
  }

  async cerrarCopiar() {
    await this.page.locator(`${this.modalCopiar} .modal-footer button[data-dismiss="modal"]`).click();
    await expect(this.page.locator(this.modalCopiar)).toBeHidden({ timeout: 30_000 });
  }

  // ------------------------------------------------------------------
  // Baja de una caja diaria desde la bandeja
  // ------------------------------------------------------------------

  /**
   * Intenta eliminar la caja del dia desde la bandeja. Devuelve el texto del cartel que
   * muestra el BO. Si la caja tuviera movimientos con otra sucursal, la baja se bloquea
   * (`DailyExpenses.aspx.cs`, Delete).
   *
   * **Solo llamarlo con una caja sin otros datos**: si el bloqueo fallara, la baja se llevaria
   * puestos todos sus movimientos (`DeleteByDailyExpense`).
   */
  async intentarEliminarCajaDeLaBandeja(fecha: string): Promise<string> {
    const fila = this.filaDeLaBandejaDeLaFecha(fecha);
    await fila.locator('a.del-data').click();
    const confirmacion = this.page.locator(this.cartel).last();
    await expect(confirmacion).toBeVisible({ timeout: 30_000 });
    await this.page.waitForTimeout(500);
    await confirmacion.getByRole('button', { name: /S[ií],\s*eliminar/i }).click();

    // Llega un segundo cartel (showErrorPopUp) con el motivo del bloqueo.
    const bloqueo = this.page.locator(this.cartel).filter({ hasText: 'No es posible eliminar la caja' }).last();
    await expect(bloqueo, 'La baja de una caja con movimientos de otra sucursal tiene que bloquearse con un cartel')
      .toBeVisible({ timeout: 30_000 });
    const texto = (await bloqueo.innerText()).replace(/\s+/g, ' ').trim();
    await bloqueo.getByRole('button', { name: /Aceptar/i }).click();
    return texto;
  }
}
