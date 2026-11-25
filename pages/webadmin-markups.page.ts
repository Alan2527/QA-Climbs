import { Page, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * WebAdmin (BaseCamp): markup de un mercado y markup propio de una agencia.
 *
 * - Mercado: `administration/markets/detail.aspx?market=<id>` (Markets/Detail.aspx). Desde la
 *   5107 (17/11/2026) el markup va por sucursal, en la tabla "Markups por sucursal": el de los
 *   productos de Buenos Aires es la fila Argentina (casa matriz), que en el mercado 37 esta en
 *   Manual. Se leen y escriben sus campos Hoteles / Servicios.
 * - Agencia: `administration/agencies/detail.aspx?agency=<id>` (Agencies/Detail.aspx). Desde la
 *   5107 el markup propio va en la solapa "Markup" (AgencyBranchMarkupControl), una fila por
 *   sucursal: "Segun mercado" toma el del mercado; "Manual" fija los dos numeros (hoteles y
 *   servicios) solo para esa agencia. Se usa la fila Argentina.
 *
 * Los importes se escriben con coma decimal, como los muestra la pantalla ("0,80").
 */
export class WebAdminMarkupsPage {
  constructor(private readonly page: Page) {}

  // Mercado
  private readonly filaArgentina = 'table.bm-grid tbody tr:has(strong:text-is("Argentina"))';
  private readonly mercadoHotel = `${this.filaArgentina} [id$="txtRowHotel"]`;
  private readonly mercadoServicio = `${this.filaArgentina} [id$="txtRowService"]`;
  private readonly mercadoGuardar = '[id$="tabContainer_pnlDetails_btnSave"]';
  // Si alguna agencia del mercado tiene markup propio, guardar abre este modal en vez
  // de guardar. Los tests usan un mercado con una sola agencia y sin override, asi
  // que si aparece es que los datos ya no son los esperados.
  private readonly modalAgenciasConMarkup = '#pnlCustomMarkupModal';

  // Agencia
  private readonly agenciaGuardar = '[id$="AgencyTabContainer_pnlDetails_btnSave"]';
  private readonly solapaMarkup = '[id$="AgencyTabContainer_pnlMarkup_tab"]';
  private readonly filaArgentinaAgencia = '[id$="ctrlBranchMarkup_updBranchMarkup"] table.bm-grid tbody tr:has(strong:text-is("Argentina"))';
  private readonly agenciaHotel = `${this.filaArgentinaAgencia} [id$="txtRowHotel"]`;
  private readonly agenciaServicio = `${this.filaArgentinaAgencia} [id$="txtRowService"]`;
  private readonly agenciaManual = `${this.filaArgentinaAgencia} input[type="radio"][value="manual"]`;
  private readonly agenciaSegunMercado = `${this.filaArgentinaAgencia} input[type="radio"][value="auto"]`;
  private readonly agenciaGuardarMarkup = '[id$="AgencyTabContainer_pnlMarkup_btnSaveMarkup"]';
  // Al guardar, el WebAdmin avisa si hay agencias con nombre parecido y pide confirmar.
  private readonly continuarAgenciaSimilar = '[id$="btnContinueSimilarAgencySave"]';

  static formatear(valor: number | null): string {
    return valor === null ? '' : valor.toFixed(2).replace('.', ',');
  }

  static leer(texto: string): number | null {
    const t = texto.trim();
    return t === '' ? null : Number(t.replace(/\./g, '').replace(',', '.'));
  }

  async abrirMercado(id: number) {
    await this.page.goto(`/administration/markets/detail.aspx?market=${id}`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.mercadoHotel)).toBeVisible();
  }

  async markupsDelMercado(): Promise<{ hotel: number | null; servicio: number | null }> {
    return {
      hotel: WebAdminMarkupsPage.leer(await this.page.locator(this.mercadoHotel).inputValue()),
      servicio: WebAdminMarkupsPage.leer(await this.page.locator(this.mercadoServicio).inputValue()),
    };
  }

  async guardarMercado(id: number, hotel: number, servicio: number) {
    await this.abrirMercado(id);
    await this.page.locator(this.mercadoHotel).fill(WebAdminMarkupsPage.formatear(hotel));
    await this.page.locator(this.mercadoServicio).fill(WebAdminMarkupsPage.formatear(servicio));
    await this.page.locator(this.mercadoServicio).blur();
    await Promise.all([
      this.page.waitForLoadState('load'),
      this.page.locator(this.mercadoGuardar).click(),
    ]);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.modalAgenciasConMarkup),
      'Guardar el mercado no tiene que pedir revisar agencias con markup propio').toBeHidden();
    // Se relee de una carga nueva: lo que importa es lo que quedo guardado.
    await this.abrirMercado(id);
    expect(await this.markupsDelMercado(), 'El mercado tiene que quedar con los markups cargados')
      .toEqual({ hotel, servicio });
  }

  /** Fila de una sucursal en "Markups por sucursal" del mercado. */
  private filaDelMercado(sucursal: string) {
    return this.page.locator(`table.bm-grid tbody tr:has(strong:text-is("${sucursal}"))`).first();
  }

  /**
   * Modo y markups de una sucursal del mercado (US 5107). En "Por defecto" los campos no se ven y
   * la fila muestra en gris los que hereda ("0,88 de Peru 0,92 de Peru"): se leen de ese texto.
   */
  async markupDeLaSucursalDelMercado(sucursal: string): Promise<{ manual: boolean; hotel: number | null; servicio: number | null }> {
    const fila = this.filaDelMercado(sucursal);
    await expect(fila, `El mercado tiene que tener la fila de la sucursal ${sucursal}`).toBeVisible();
    const manual = await fila.locator('input[type="radio"][id$="rblMode_1"]').isChecked();
    if (manual) {
      return {
        manual,
        hotel: WebAdminMarkupsPage.leer(await fila.locator('[id$="txtRowHotel"]').inputValue()),
        servicio: WebAdminMarkupsPage.leer(await fila.locator('[id$="txtRowService"]').inputValue()),
      };
    }
    const heredados = ((await fila.innerText()).replace(/\s+/g, ' ').match(/\d+,\d{2}(?= de )/g) ?? []).map((x) => WebAdminMarkupsPage.leer(x));
    return { manual, hotel: heredados[0] ?? null, servicio: heredados[1] ?? null };
  }

  /** Pasa la sucursal del mercado a "Por defecto" o a Manual con los dos markups, guarda y relee. */
  async guardarSucursalDelMercado(id: number, sucursal: string, valor: 'Por defecto' | { hotel: number; servicio: number }) {
    await this.abrirMercado(id);
    const fila = this.filaDelMercado(sucursal);
    const manual = valor !== 'Por defecto';
    const radio = fila.locator(`input[type="radio"][id$="rblMode_${manual ? 1 : 0}"]`);
    if (!(await radio.isChecked())) {
      // El cambio de modo hace postback parcial; la etiqueta tapa al radio.
      await fila.locator(`label[for="${await radio.getAttribute('id')}"]`).click();
      await esperarFinDeCarga(this.page);
      await expect(this.filaDelMercado(sucursal).locator(`input[type="radio"][id$="rblMode_${manual ? 1 : 0}"]`)).toBeChecked();
    }
    if (manual) {
      const f = this.filaDelMercado(sucursal);
      await f.locator('[id$="txtRowHotel"]').fill(WebAdminMarkupsPage.formatear(valor.hotel));
      await f.locator('[id$="txtRowService"]').fill(WebAdminMarkupsPage.formatear(valor.servicio));
      await f.locator('[id$="txtRowService"]').blur();
    }
    await Promise.all([this.page.waitForLoadState('load'), this.page.locator(this.mercadoGuardar).click()]);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.modalAgenciasConMarkup),
      'Guardar el mercado no tiene que pedir revisar agencias con markup propio').toBeHidden();
    await this.abrirMercado(id);
    const guardado = await this.markupDeLaSucursalDelMercado(sucursal);
    expect(guardado.manual, `${sucursal} tiene que quedar en ${manual ? 'Manual' : '"Por defecto"'}`).toBe(manual);
    if (manual) expect(guardado, `${sucursal} tiene que quedar con los markups cargados`).toEqual({ manual, ...valor });
  }

  /** La ficha de la agencia en la solapa Detalle (tipo de cambio, datos generales). */
  async abrirAgencia(id: number) {
    await this.page.goto(`/administration/agencies/detail.aspx?agency=${id}`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.agenciaGuardar)).toBeAttached();
  }

  /** La ficha de la agencia en la solapa Markup, con la fila Argentina a la vista. */
  async abrirMarkupDeLaAgencia(id: number) {
    await this.abrirAgencia(id);
    await this.page.locator(this.solapaMarkup).click();
    await expect(this.page.locator(this.filaArgentinaAgencia)).toBeVisible();
  }

  /** Argentina en "Segun mercado" = sin markup propio ({null, null}); en Manual, sus dos numeros. */
  async markupsDeLaAgencia(): Promise<{ hotel: number | null; servicio: number | null }> {
    if (!(await this.page.locator(this.filaArgentinaAgencia).isVisible())) await this.page.locator(this.solapaMarkup).click();
    await expect(this.page.locator(this.filaArgentinaAgencia)).toBeVisible();
    if (!(await this.page.locator(this.agenciaManual).isChecked())) return { hotel: null, servicio: null };
    return {
      hotel: WebAdminMarkupsPage.leer(await this.page.locator(this.agenciaHotel).inputValue()),
      servicio: WebAdminMarkupsPage.leer(await this.page.locator(this.agenciaServicio).inputValue()),
    };
  }

  // Tipo de cambio manual de la agencia (USD): sin tildar usa el del pais.
  private readonly cambioManual = '[id$="AgencyTabContainer_pnlDetails_cbManualExchangeRate"]';
  private readonly cambioGeneral = '[id$="AgencyTabContainer_pnlDetails_ctrlExchangeGeneral_txtValue"]';
  private readonly cambioOportunidad = '[id$="AgencyTabContainer_pnlDetails_ctrlExchangeOpportunity_txtValue"]';

  async tipoDeCambioDeLaAgencia(): Promise<{ manual: boolean; general: number | null; oportunidad: number | null }> {
    return {
      manual: await this.page.locator(this.cambioManual).isChecked(),
      general: WebAdminMarkupsPage.leer(await this.page.locator(this.cambioGeneral).inputValue()),
      oportunidad: WebAdminMarkupsPage.leer(await this.page.locator(this.cambioOportunidad).inputValue()),
    };
  }

  /**
   * Tilda o destilda el tipo de cambio manual y, si queda tildado, carga los dos
   * valores (general y oportunidades). Destildarlo no borra la fila: la marca como
   * borrada (`Deleted`), y la agencia vuelve a usar la cotizacion de su pais.
   */
  async guardarTipoDeCambio(id: number, manual: boolean, valor?: number) {
    await this.abrirAgencia(id);
    const check = this.page.locator(this.cambioManual);
    if ((await check.isChecked()) !== manual) await check.click();
    await expect(check).toBeChecked({ checked: manual });
    if (manual && valor !== undefined) {
      const texto = valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      await this.page.locator(this.cambioGeneral).fill(texto);
      await this.page.locator(this.cambioOportunidad).fill(texto);
      await this.page.locator(this.cambioOportunidad).blur();
    }
    await Promise.all([this.page.waitForLoadState('load'), this.page.locator(this.agenciaGuardar).click()]);
    await esperarFinDeCarga(this.page);
    const continuar = this.page.locator(this.continuarAgenciaSimilar);
    if (await continuar.isVisible().catch(() => false)) {
      await Promise.all([this.page.waitForLoadState('load'), continuar.click()]);
      await esperarFinDeCarga(this.page);
    }
    await this.abrirAgencia(id);
    const guardado = await this.tipoDeCambioDeLaAgencia();
    expect(guardado.manual, `El tipo de cambio manual tiene que quedar ${manual ? 'tildado' : 'destildado'}`).toBe(manual);
    if (manual && valor !== undefined) {
      expect(guardado.general, 'El tipo de cambio general tiene que quedar guardado').toBe(valor);
    }
  }

  /**
   * `null, null` deja Argentina en "Segun mercado" (sin markup propio). Con valores la pasa a
   * Manual, que fija los dos numeros: para cambiar solo uno hay que repetir el del mercado en el otro.
   */
  async guardarAgencia(id: number, hotel: number | null, servicio: number | null) {
    const manual = hotel !== null || servicio !== null;
    expect(!manual || (hotel !== null && servicio !== null), 'Manual fija los dos markups de la sucursal: hay que pasar hoteles y servicios').toBe(true);
    await this.abrirMarkupDeLaAgencia(id);
    const radio = this.page.locator(manual ? this.agenciaManual : this.agenciaSegunMercado);
    if (!(await radio.isChecked())) {
      // El cambio de modo hace postback parcial (UpdatePanel): se espera a que vuelva la fila.
      // Se hace clic en la etiqueta ("Manual" / "Segun mercado"): tapa al radio.
      await this.page.locator(`${this.filaArgentinaAgencia} label[for="${await radio.getAttribute('id')}"]`).click();
      await esperarFinDeCarga(this.page);
      await expect(this.page.locator(manual ? this.agenciaManual : this.agenciaSegunMercado)).toBeChecked();
    }
    if (manual) {
      await this.page.locator(this.agenciaHotel).fill(WebAdminMarkupsPage.formatear(hotel));
      await this.page.locator(this.agenciaServicio).fill(WebAdminMarkupsPage.formatear(servicio));
      await this.page.locator(this.agenciaServicio).blur();
    }
    await Promise.all([this.page.waitForLoadState('load'), this.page.locator(this.agenciaGuardarMarkup).click()]);
    await esperarFinDeCarga(this.page);
    const continuar = this.page.locator(this.continuarAgenciaSimilar);
    if (await continuar.isVisible().catch(() => false)) {
      await Promise.all([this.page.waitForLoadState('load'), continuar.click()]);
      await esperarFinDeCarga(this.page);
    }
    await this.abrirMarkupDeLaAgencia(id);
    expect(await this.markupsDeLaAgencia(), 'La agencia tiene que quedar con los markups cargados')
      .toEqual({ hotel, servicio });
  }
}
