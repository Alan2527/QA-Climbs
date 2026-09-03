import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';
import { Pasajero } from './carrito.page';

/**
 * Carrito y checkout del riel CustomTours (ofertas y multidestinos).
 *
 * A diferencia del riel de servicios y hoteles, aca no hay dos pantallas: el
 * detalle de lo reservado, los pasajeros y la emision viven todos en
 * `shoppingcartcustomtour.aspx`.
 *
 * Y tampoco hay campo de cantidad de pasajeros: la cantidad se fijo en el
 * armado del viaje (`ddPax` de Main.aspx), asi que lo unico que se carga aca
 * son los pasajeros en si.
 *
 * Referencias:
 *   Online/CustomTours/ShoppingCartCustomTour.aspx -> ctrlTourPassanger,
 *     txtReference, txtComment, cbxTermsAndConditions, btnSaveBook
 */
export class CarritoCustomToursPage {
  constructor(private readonly page: Page) {}

  readonly btnAgregarPasajero = "[id$='ctrlTourPassanger_lnkAdd']";
  readonly campoReferencia = "[id$='cphMain_txtReference']";
  readonly campoObservaciones = "[id$='cphMain_txtComment']";
  readonly checkTerminos = "[id$='cbxTermsAndConditions']";
  readonly btnConfirmar = "[id$='cphMain_btnSaveBook']";

  /** Total que muestra el carrito, para conciliar contra el del itinerario. */
  async importes(): Promise<string[]> {
    const texto = await this.page.locator('body').innerText();
    return [...new Set(texto.match(/USD\s*[\d.,]+/g) ?? [])];
  }

  async pasajerosCargables(): Promise<number> {
    return this.page.locator("[id*='lvPassengersData'][id$='_txtName']").count();
  }

  /**
   * Deja tantos bloques de pasajero como pax se reservaron.
   * Igual que en el otro riel, arranca con uno solo.
   */
  async asegurarPasajeros(cantidad: number) {
    for (let intento = 0; await this.pasajerosCargables() < cantidad; intento++) {
      expect(intento, `"Anadir Pasajero" tiene que llegar a ${cantidad} bloques de pasajero`)
        .toBeLessThan(cantidad + 2);
      await this.page.locator(this.btnAgregarPasajero).first().click();
      await esperarFinDeCarga(this.page);
    }
  }

  /**
   * Prefijo de id del bloque de pasajero. Se deriva del DOM: el ListView de
   * ASP.NET no numera sus items de corrido.
   */
  private async prefijoDelPasajero(indice: number): Promise<string> {
    const id = await this.page.locator("[id*='lvPassengersData'][id$='_txtName']")
      .nth(indice).getAttribute('id');
    expect(id, `Tiene que existir el bloque del pasajero ${indice + 1}`).toBeTruthy();
    return id!.replace(/_txtName$/, '');
  }

  /**
   * Carga un pasajero.
   *
   * Ojo con el apellido: en esta pantalla el campo es `txtSurname` y en el
   * checkout del otro riel es `txtSurName`, con la N mayuscula.
   */
  async completarPasajero(indice: number, pax: Pasajero) {
    const prefijo = await this.prefijoDelPasajero(indice);
    const campo = (sufijo: string) => this.page.locator(`#${prefijo}_${sufijo}`).first();
    await campo('txtName').fill(pax.nombre);
    await campo('txtSurname').fill(pax.apellido);
    await campo('txtPassport').fill(pax.pasaporte);
    await campo('txtBirthday').fill(pax.nacimiento);
    await campo('txtNationality').fill(pax.nacionalidad);
  }

  async completarDatosDeLaReserva(referencia: string, observaciones: string) {
    await this.page.locator(this.campoReferencia).first().fill(referencia);
    await this.page.locator(this.campoObservaciones).first().fill(observaciones);
  }

  /**
   * Carga el comentario del primer item del viaje.
   *
   * Aca los comentarios son por item y con nombres propios —el del hotel es
   * `txtData`, los de servicio `txtCommentData`—, a diferencia del otro riel,
   * donde hay un unico `txtDetail` por producto.
   */
  async completarComentarioDelItem(texto: string) {
    const campo = this.page.locator("[id*='lvHotels'][id$='_txtData']").first();
    await expect(campo, 'El carrito tiene que ofrecer el comentario del hotel del viaje')
      .toBeVisible({ timeout: 30_000 });
    await campo.fill(texto);
  }

  async aceptarTerminos() {
    await this.page.locator(this.checkTerminos).first().check();
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.btnConfirmar).first()).toBeEnabled();
  }

  /**
   * Emite la reserva y devuelve el codigo BOxxxxxxxx.
   *
   * Termina en el mismo historial que el otro riel, pero la reserva de un
   * circuito vive en la solapa "Reservas circuitos" y no en la primera.
   */
  async confirmarReserva(): Promise<string> {
    await this.page.locator(this.btnConfirmar).first().click();
    await this.page.waitForURL(/bookinghistory/i, { timeout: 180_000 });
    await esperarFinDeCarga(this.page);

    const solapa = this.page.locator("a[href='#tabCustomTour']").first();
    if (await solapa.count()) await solapa.click();

    const codigo = this.page
      .locator("#tabCustomTour a[href*='BookingHistoryDetail.aspx?book=']").first();
    await expect(codigo).toBeVisible({ timeout: 60_000 });
    return (await codigo.innerText()).trim();
  }
}
