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
   * Elige el viaje en el buscador de INICIO y entra al armado.
   *
   * Sirve para las dos solapas que llevan a este riel: OFERTAS elige en
   * `ddSelectedOpportunity` y MULTIDESTINO en `ddSelectedTour`. En las dos, el
   * combo decide a donde va: con "Todos" se abre el listado y eligiendo uno se
   * entra derecho a la pantalla de armado
   * (OpportunitySearchControl.ascx.cs:198 y TourSearchControl.ascx.cs:208).
   */
  async buscarViaje(panel: Locator, opciones: {
    pais: string; ciudad: string; id: string; combo: string;
  }) {
    const campo = (sufijo: string) => panel.locator(`[id$='${sufijo}']`).first();

    await campo('ddCountry').selectOption({ label: opciones.pais });
    await esperarFinDeCarga(this.page);
    await campo('ddCity').selectOption({ label: opciones.ciudad });
    await esperarFinDeCarga(this.page);
    await campo(opciones.combo).selectOption(opciones.id);

    await panel.locator("[id$='btnSearch']").first().click();
    await this.page.waitForURL(/customtours/i, { timeout: 120_000 });
    await esperarFinDeCarga(this.page);
  }

  /** La oferta se elige en la solapa OFERTAS. */
  async buscarOferta(panel: Locator, opciones: { pais: string; ciudad: string; ofertaId: string }) {
    await this.buscarViaje(panel, {
      pais: opciones.pais, ciudad: opciones.ciudad,
      id: opciones.ofertaId, combo: 'ddSelectedOpportunity',
    });
  }

  /** El paquete de multidestino se elige en la solapa MULTIDESTINO. */
  async buscarPaquete(panel: Locator, opciones: { pais: string; ciudad: string; paqueteId: string }) {
    await this.buscarViaje(panel, {
      pais: opciones.pais, ciudad: opciones.ciudad,
      id: opciones.paqueteId, combo: 'ddSelectedTour',
    });
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

  /**
   * El panel de resumen del itinerario, que es el que trae el boton Continuar.
   *
   * **Hasta el rediseno del 2026-09-05 era una tabla** y esto la buscaba con
   * `table` + el boton adentro. Ahora es el panel `.ct-sum`, con una tarjeta por
   * hotel y las lineas de habitacion, servicios y total.
   */
  tablaDeTotales(): Locator {
    return this.page.locator('.ct-sum').first();
  }

  /**
   * Las lineas del resumen: los hoteles con su precio, la habitacion, los
   * servicios y el total.
   *
   * Antes eran las celdas de una fila —hotel, SGL, DBL, TPL, servicios, total— y
   * ahora son las lineas del panel. **El orden de los importes se mantiene**: los
   * tres ultimos siguen siendo habitacion, servicios y total, asi que la
   * conciliacion de la pantalla sigue valiendo sin reimplementar ningun calculo.
   * Medido en QA: 2.024 de la doble + 182 de servicios = 2.206 de total.
   */
  async filaDeTotales(): Promise<string[]> {
    const texto = await this.tablaDeTotales().innerText();
    return texto.split(String.fromCharCode(10))
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  async continuarAlCarrito() {
    // Acotado al panel de resumen: la pantalla trae varios `lnkReservar` —uno por
    // opcion armada— y `.first()` a secas podia quedarse con el de otra.
    await this.tablaDeTotales().locator(this.btnContinuar).first().click();
    await this.page.waitForURL(/shoppingcartcustomtour/i, { timeout: 120_000 });
    await esperarFinDeCarga(this.page);
  }
}
