import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Caja diaria: el quinto y ultimo eslabon de la cadena de cobranzas.
 *
 *   menu Administracion -> administration/movements/daily-expenses  (bandeja)
 *     -> Apertura -> administration/movements/daily-cash/0
 *     -> lapiz de la fila -> administration/movements/daily-cash/{id}
 *
 * Es el unico punto donde las dos ramas de la cadena se juntan: lo que se pago
 * al proveedor y lo que se cobro al cliente.
 *
 * **Los movimientos no se cargan.** Las ordenes aprobadas aparecen solas en la
 * caja de su fecha y sucursal: `PayOrderSvc.LoadForDailyCash(fecha, sucursal)`
 * las trae si tienen Status 30, la fecha del recibo igual a la de la caja y
 * todavia no estan asignadas a ninguna caja (`!DailyExpenseID.HasValue`). Lo
 * mismo con las de cobro.
 *
 * Hay **una caja por sucursal y fecha**: si ya existe la del dia, hay que abrir
 * esa y no crear otra.
 *
 * El cierre definitivo (`lnkClose`) **no se automatiza**: deja la caja en estado
 * 20 y a partir de ahi ninguna orden de pago ni de cobro de esa sucursal y esa
 * fecha se puede aprobar (`DailyExpenseSvc.FindByDate`), lo que romperia los
 * eslabones 2 y 4 por el resto del dia. Y no es reversible desde la pantalla:
 * `btnSave` no se muestra para ninguna caja existente (`DailyCash.aspx.cs:166`).
 * Se cubre el **pre-cierre**, que es solo de lectura.
 *
 * El BO no tiene selector de idioma ni tema oscuro: no aplican las
 * consideraciones transversales de multiidioma ni modo oscuro.
 */
export class CajaDiariaPage {
  constructor(private readonly page: Page) {}

  // --- Bandeja ---
  readonly grillaDeCajas = '#tblDailyExpenses';
  readonly comboSucursalDeLaBandeja = "[id$='ddBranch']";

  // --- Apertura / detalle ---
  readonly comboSucursal = "[id$='ddBranch']";
  readonly campoFecha = "[id$='txtDate']";
  readonly campoCodigo = "[id$='txtCode']";
  readonly campoDetalle = "[id$='txtDetail']";
  readonly btnGuardar = "[id$='btnSave']";
  readonly comboCajaDeTotales = "[id$='ddCashFlowTotals']";
  // Los ids reales son los de las tablas del LayoutTemplate: los ListView no
  // dejan ninguno en el HTML.
  readonly grillaDeMovimientos = '#tblDailyExpenseItems tbody tr';
  readonly grillaDeTotales = '#tblDailyCashTotals tbody tr';
  readonly btnPreCierre = '#btnReview';
  readonly btnCierreDefinitivo = '#lnkClose';

  /** Entra a la bandeja por el menu, abriendo el padre solo si el clic se traba. */
  async irABandejaDeCajas() {
    const enlace = "a[href$='administration/movements/daily-expenses']";
    const item = this.page.locator(enlace).first();
    const padre = item.locator('xpath=ancestor::li[contains(@class,"menu-accordion")][1]/a').first();

    try {
      await item.click({ timeout: 5_000 });
    } catch {
      await padre.click();
      await item.click({ timeout: 30_000 });
    }
    await this.page.waitForURL(/daily-expenses/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Fila de la bandeja correspondiente a una fecha. */
  filaDeLaFecha(fecha: string): Locator {
    return this.page.locator(`${this.grillaDeCajas} tbody tr`).filter({ hasText: fecha }).first();
  }

  /**
   * Abre la caja del dia, creandola solo si no existe.
   *
   * Devuelve el ID de la caja y si hubo que abrirla. No se crea a ciegas: hay
   * una caja por sucursal y fecha, y una segunda corrida del mismo dia dejaria
   * dos.
   */
  async abrirCajaDelDia(fecha: string, sucursal: string, detalle: string): Promise<{
    id: string; creada: boolean;
  }> {
    const existente = this.filaDeLaFecha(fecha);
    if (await existente.count() && await existente.isVisible()) {
      await existente.locator('a').last().click();
      await this.page.waitForURL(/daily-cash\/\d+/i, { timeout: 60_000 });
      await this.page.waitForLoadState('domcontentloaded');
      await esperarFinDeCarga(this.page);
      return { id: this.page.url().split('/').pop() ?? '', creada: false };
    }

    await this.page.locator("a[href*='daily-cash/0']").first().click();
    await this.page.waitForURL(/daily-cash\/0/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);

    await this.page.locator(this.comboSucursal).first().selectOption({ label: sucursal });
    await esperarFinDeCarga(this.page);
    await this.page.locator(this.campoDetalle).first().fill(detalle);
    await this.page.locator(this.btnGuardar).first().click();
    await this.page.waitForURL(/daily-cash\/\d+/i, { timeout: 120_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
    return { id: this.page.url().split('/').pop() ?? '', creada: true };
  }

  /** Opciones del combo de cajas, para poder explicar por que falta la esperada. */
  async cajasOfrecidas(): Promise<string[]> {
    return this.page.locator(`${this.comboCajaDeTotales} option`).evaluateAll((os) =>
      os.map((o) => (o.textContent || '').trim()).filter(Boolean));
  }

  /**
   * Filtra los movimientos y los totales por una caja.
   *
   * El combo hace postback y los totales se recalculan sobre los movimientos ya
   * filtrados (`DailyCash.aspx.cs:187-190`), asi que filtrando por una caja los
   * totales pasan a ser los de esa caja.
   */
  async filtrarPorCaja(nombre: string) {
    const combo = this.page.locator(this.comboCajaDeTotales).first();
    const opciones = await this.cajasOfrecidas();
    const elegida = opciones.find((o) => o.toUpperCase().includes(nombre.toUpperCase()));
    expect(
      elegida,
      `El filtro de cajas tiene que ofrecer "${nombre}". Ofrece: ${opciones.join(' | ')}`,
    ).toBeTruthy();

    await combo.selectOption({ label: elegida! });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Fila de un movimiento, ubicada por el codigo de la orden (OP… u OC…). */
  filaDelMovimiento(codigo: string): Locator {
    return this.page.locator(this.grillaDeMovimientos).filter({ hasText: codigo }).first();
  }

  /** Celdas de una fila, normalizadas. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  /** Todos los movimientos listados, como lineas, para dejar evidencia. */
  async movimientos(): Promise<string[]> {
    return this.page.locator(this.grillaDeMovimientos).evaluateAll((filas) =>
      filas.map((tr) => Array.from(tr.querySelectorAll('td'))
        .map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean).join(' | ')));
  }

  /**
   * Fila de totales de una moneda: saldo inicial, ingreso, salida, balance y
   * saldo final.
   */
  async totales(moneda: string): Promise<{
    moneda: string; inicial: string; ingreso: string; salida: string;
    balance: string; final: string;
  } | null> {
    const filas = await this.page.locator(this.grillaDeTotales).evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td'))
        .map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())));

    const fila = filas.find((c) => (c[0] ?? '').toUpperCase().includes(moneda.toUpperCase()));
    if (!fila) return null;
    return {
      moneda: fila[0] ?? '', inicial: fila[1] ?? '', ingreso: fila[2] ?? '',
      salida: fila[3] ?? '', balance: fila[4] ?? '', final: fila[5] ?? '',
    };
  }

  /**
   * Abre el pre-cierre, que es solo de lectura.
   *
   * `btnReview` no hace postback: su OnClientClick abre el modal de revision
   * (`DailyCash.aspx:114`). No cambia el estado de la caja.
   */
  async abrirPreCierre(): Promise<Locator> {
    await this.page.locator(this.btnPreCierre).click();
    const modal = this.page.locator('#modalDailyCashReviewControl');
    await expect(modal, 'El pre-cierre tiene que abrir su modal de revision')
      .toBeVisible({ timeout: 30_000 });

    // La grilla del pre-cierre se llena despues de mostrarse el modal: se espera
    // al dato y no al fin de carga.
    await expect
      .poll(() => this.page.locator('#tblDailyCashReview tbody tr').count(), {
        timeout: 60_000,
        message: 'El pre-cierre tiene que listar las cajas con su cuadre',
      })
      .toBeGreaterThan(0);
    await esperarFinDeCarga(this.page);
    return modal;
  }

  /** Fila del pre-cierre de una caja: ©, Nombre, M, Inicial, Ingreso, Salida, Balance dia, Final. */
  async filaDelPreCierre(nombreDeLaCaja: string): Promise<string[]> {
    const filas = await this.page.locator('#tblDailyCashReview tbody tr').evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td'))
        .map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())));
    return filas.find((c) => c.join(' | ').toUpperCase().includes(nombreDeLaCaja.toUpperCase())) ?? [];
  }
}
