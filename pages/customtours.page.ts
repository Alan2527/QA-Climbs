import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Modulo CustomTours: el riel por el que se reservan las ofertas y los
 * multidestinos.
 *
 *   INICIO / solapa OFERTAS o MULTIDESTINO
 *     -> customtours/main.aspx?tour={id}     armado: fecha, pax y habitaciones
 *     -> customtours/detail.aspx             itinerario y totales
 *     -> customtours/shoppingcartcustomtour.aspx   carrito y checkout en una
 *
 * Es un riel distinto del de servicios y hoteles: no pasa por
 * ShoppingCartPage.aspx ni por CheckOut.aspx.
 *
 * Referencias:
 *   Online/Module/OpportunitySearchControl.ascx -> ddCountry, ddCity,
 *                                                  ddSelectedOpportunity, btnSearch
 *   Online/CustomTours/Main.aspx                -> txtAllCheckin, ddPax, ddDBL, lnkNext
 *   Online/CustomTours/Detail.aspx              -> lvTotales y lnkReservar ("Continuar")
 */
export class CustomToursPage {
  constructor(private readonly page: Page) {}

  readonly campoFecha = "[id$='txtAllCheckin']";
  readonly comboPax = "[id$='cphMain_ddPax']";
  readonly comboDBL = "[id$='cphMain_ddDBL']";
  readonly comboSGL = "[id$='cphMain_ddSGL']";
  readonly btnSiguiente = "[id$='cphMain_lnkNext']";
  readonly btnContinuar = "[id*='lnkReservar']";

  /**
   * Elige la oferta en el buscador de INICIO y entra al armado.
   *
   * El combo decide a donde va: con "Todos" se abre el listado
   * (opportunityall.aspx) y eligiendo una se entra derecho a la pantalla de
   * armado (OpportunitySearchControl.ascx.cs:198).
   */
  async buscarOferta(panel: Locator, opciones: { pais: string; ciudad: string; ofertaId: string }) {
    const combo = (sufijo: string) => panel.locator(`[id$='${sufijo}']`).first();

    await combo('ddCountry').selectOption({ label: opciones.pais });
    await esperarFinDeCarga(this.page);
    await combo('ddCity').selectOption({ label: opciones.ciudad });
    await esperarFinDeCarga(this.page);
    await combo('ddSelectedOpportunity').selectOption(opciones.ofertaId);

    await panel.locator("[id$='btnSearch']").first().click();
    await this.page.waitForURL(/customtours/i, { timeout: 120_000 });
    await esperarFinDeCarga(this.page);
  }

  /**
   * Carga la fecha de inicio, la cantidad de pax y las habitaciones.
   *
   * El calendario de esta pantalla **no es el mismo** que el de los otros dos
   * flujos: aca es un bootstrap-datepicker (`.datepicker-days td.day`), no el
   * daterangepicker del buscador de servicios y hoteles. Se elige el dia
   * clickeando, por el mismo motivo: escribir la fecha no es lo que hace una
   * persona y el widget puede reescribir el campo.
   */
  async configurarViaje(fecha: Date, pax: number, dobles: number) {
    await this.page.locator(this.campoFecha).click();
    await this.page.locator('.datepicker-days td.day:not(.old):not(.new)')
      .filter({ hasText: new RegExp(`^${fecha.getDate()}$`) }).first().click();

    await this.page.locator(this.comboPax).selectOption(String(pax));
    await esperarFinDeCarga(this.page);
    await this.page.locator(this.comboDBL).selectOption(String(dobles));
    await esperarFinDeCarga(this.page);
  }

  /** Valor que quedo en el campo de fecha, para verificar que el clic la tomo. */
  async fechaCargada(): Promise<string> {
    return this.page.locator(this.campoFecha).inputValue();
  }

  /**
   * Noches que el armado asigna a un destino.
   *
   * Sirve para saber que fecha de salida esperar sin fijarla en el test: la
   * oferta define cuantas noches dura cada destino y la pantalla las muestra.
   */
  async nochesDelDestino(indice: number): Promise<number> {
    const campo = this.page.locator("[id*='lvDestinations'][id$='_txtNights']").nth(indice);
    await expect(campo, `El armado tiene que mostrar las noches del destino ${indice + 1}`)
      .toBeVisible();
    return Number(await campo.inputValue());
  }

  async irAlItinerario() {
    await this.page.locator(this.btnSiguiente).click();
    await this.page.waitForURL(/detail/i, { timeout: 120_000 });
    await esperarFinDeCarga(this.page);
  }

  /** La tabla de totales del itinerario, que es la que trae el boton Continuar. */
  tablaDeTotales(): Locator {
    return this.page.locator('table').filter({ has: this.page.locator(this.btnContinuar) }).last();
  }

  /**
   * Celdas de la fila de totales: hotel, SGL, DBL, TPL, servicios y total.
   *
   * El total de la pantalla es la suma de la habitacion mas los servicios, y
   * asi se puede verificar sin reimplementar ningun calculo: la propia fila lo
   * demuestra (2.024 + 558 = 2.582).
   */
  async filaDeTotales(): Promise<string[]> {
    const fila = this.tablaDeTotales().locator('tr').filter({ has: this.page.locator(this.btnContinuar) }).last();
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  async continuarAlCarrito() {
    await this.page.locator(this.btnContinuar).first().click();
    await this.page.waitForURL(/shoppingcartcustomtour/i, { timeout: 120_000 });
    await esperarFinDeCarga(this.page);
  }
}
