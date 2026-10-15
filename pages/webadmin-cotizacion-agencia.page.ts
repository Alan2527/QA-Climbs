import { Page, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';
import { WebAdminMarkupsPage } from './webadmin-markups.page';

/**
 * WebAdmin (BaseCamp): los dos datos comerciales que la cotizacion de grupo toma de
 * la agencia (`administration/budgets/budgetdetail.aspx`, tarjeta "Datos comerciales").
 *
 * - Markup (`txtMarkup`): `FillAgencyMarkupAndExchangeRate` lo carga con el markup de
 *   HOTELES de la agencia (`AgencyManager.GetFullMarkup(..., Hotel)`): el propio si lo
 *   tiene y si no el de su mercado.
 * - Tipo de cambio USD (`txtExchangeRate`): `CurrencyExchangeManager.LoadByAgencyHierarchy`:
 *   el manual de la agencia si lo tiene y si no el de su pais.
 *
 * Solo se cargan al ELEGIR la agencia en el combo (PostBack completo, sin UpdatePanel).
 * Al abrir el alta no se carga nada: los dos campos quedan en 0,00.
 *
 * Los importes salen con el formato de la cultura de dinero de la pantalla (coma
 * decimal, punto de miles), igual que en la ficha de la agencia.
 */
export class WebAdminCotizacionAgenciaPage {
  constructor(private readonly page: Page) {}

  private det(id: string) { return `[id*="pnlDetails"][id$="${id}"]`; }

  readonly comboAgencia = this.det('ddAgency');
  readonly campoMarkup = this.det('txtMarkup_txtValue');
  readonly campoTipoDeCambio = this.det('txtExchangeRate_txtValue');

  /**
   * Elige la agencia en el combo y espera a que el PostBack termine de rearmar la
   * pagina. Se marca el documento antes del cambio: si la marca desaparece, el
   * servidor ya devolvio la pagina nueva y los campos se pueden leer.
   */
  async elegirAgencia(agencia: string) {
    const combo = this.page.locator(this.comboAgencia);
    await this.page.evaluate(() => { (window as any).__antesDelPostBack = true; });
    // TomSelect: el select real esta oculto, se elige ahi y se dispara el change.
    await Promise.all([
      this.page.waitForLoadState('load'),
      combo.selectOption(agencia, { force: true }),
    ]);
    await this.page.waitForFunction(() => !(window as any).__antesDelPostBack, undefined, { timeout: 60_000 });
    await esperarFinDeCarga(this.page);
    await expect(combo, `El combo Agencia tiene que quedar en ${agencia}`).toHaveValue(agencia);
  }

  /** Markup y tipo de cambio que muestra la ficha en este momento. */
  async valores(): Promise<{ markup: number | null; tipoDeCambio: number | null }> {
    return {
      markup: WebAdminMarkupsPage.leer(await this.page.locator(this.campoMarkup).inputValue()),
      tipoDeCambio: WebAdminMarkupsPage.leer(await this.page.locator(this.campoTipoDeCambio).inputValue()),
    };
  }
}
