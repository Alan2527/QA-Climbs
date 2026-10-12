import { Page, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * WebAdmin (BaseCamp): markup de un mercado y markup propio de una agencia.
 *
 * - Mercado: `administration/markets/detail.aspx?market=<id>` (Markets/Detail.aspx),
 *   campos Markup hoteles / Markup servicios.
 * - Agencia: `administration/agencies/detail.aspx?agency=<id>` (Agencies/Detail.aspx
 *   con AgencyMarketMarkupControl). Vacio = sigue al mercado.
 *
 * Los importes se escriben con coma decimal, como los muestra la pantalla ("0,80").
 */
export class WebAdminMarkupsPage {
  constructor(private readonly page: Page) {}

  // Mercado
  private readonly mercadoHotel = '[id$="pnlDetails_txtHotelMarkup_txtValue"]';
  private readonly mercadoServicio = '[id$="pnlDetails_txtServiceMarkup_txtValue"]';
  private readonly mercadoGuardar = '[id$="tabContainer_pnlDetails_btnSave"]';
  // Si alguna agencia del mercado tiene markup propio, guardar abre este modal en vez
  // de guardar. Los tests usan un mercado con una sola agencia y sin override, asi
  // que si aparece es que los datos ya no son los esperados.
  private readonly modalAgenciasConMarkup = '#pnlCustomMarkupModal';

  // Agencia
  private readonly agenciaHotel = '[id$="ctrlMarketMarkup_txtHotelMarkup_txtValue"]';
  private readonly agenciaServicio = '[id$="ctrlMarketMarkup_txtServiceMarkup_txtValue"]';
  private readonly agenciaGuardar = '[id$="AgencyTabContainer_pnlDetails_btnSave"]';
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

  async abrirAgencia(id: number) {
    await this.page.goto(`/administration/agencies/detail.aspx?agency=${id}`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.agenciaHotel)).toBeVisible();
  }

  async markupsDeLaAgencia(): Promise<{ hotel: number | null; servicio: number | null }> {
    return {
      hotel: WebAdminMarkupsPage.leer(await this.page.locator(this.agenciaHotel).inputValue()),
      servicio: WebAdminMarkupsPage.leer(await this.page.locator(this.agenciaServicio).inputValue()),
    };
  }

  /** `null` deja el campo vacio: la agencia sigue al mercado en ese tipo. */
  async guardarAgencia(id: number, hotel: number | null, servicio: number | null) {
    await this.abrirAgencia(id);
    await this.page.locator(this.agenciaHotel).fill(WebAdminMarkupsPage.formatear(hotel));
    await this.page.locator(this.agenciaServicio).fill(WebAdminMarkupsPage.formatear(servicio));
    await this.page.locator(this.agenciaServicio).blur();
    await Promise.all([
      this.page.waitForLoadState('load'),
      this.page.locator(this.agenciaGuardar).click(),
    ]);
    await esperarFinDeCarga(this.page);
    const continuar = this.page.locator(this.continuarAgenciaSimilar);
    if (await continuar.isVisible().catch(() => false)) {
      await Promise.all([this.page.waitForLoadState('load'), continuar.click()]);
      await esperarFinDeCarga(this.page);
    }
    await this.abrirAgencia(id);
    expect(await this.markupsDeLaAgencia(), 'La agencia tiene que quedar con los markups cargados')
      .toEqual({ hotel, servicio });
  }
}
