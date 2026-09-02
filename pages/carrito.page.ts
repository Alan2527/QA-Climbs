import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/** Datos de un pasajero tal como se cargan en el checkout. */
export type Pasajero = {
  nombre: string; apellido: string; pasaporte: string;
  nacimiento: string; nacionalidad: string;
};

/**
 * Carrito y checkout del riel clasico (servicios y hoteles).
 *
 *   ShoppingCartPage.aspx -> CheckOut.aspx -> BookingHistory.aspx
 *
 * Referencias:
 *   Online/Module/UserStatusControl.ascx -> #AncoreShoppingCart, #btnVaciar
 *   Online/ShoppingCartPage.aspx         -> txtReference, txtComment, lnkCreateBook
 *   Online/CheckOut.aspx                 -> lvPassengersData, txtPaxQuantity,
 *                                           cbxTermsAndConditions, btnSaveBook
 *   Online/BookingHistory.aspx           -> el codigo BOxxxxxxxx de la reserva
 */
export class CarritoPage {
  constructor(private readonly page: Page) {}

  readonly iconoCarrito = '#AncoreShoppingCart';
  readonly filas = 'table.table-bordered tbody tr';
  readonly campoReferencia = "[id$='_txtReference']";
  readonly campoObservaciones = "[id$='_txtComment']";
  readonly btnCrearReserva = "[id$='lnkCreateBook']";
  readonly btnLimpiar = "[id$='lnkCancelShoppingCart']";

  // --- Checkout ---
  readonly btnAgregarPasajero = "[id$='cphMain_lnkAdd']";
  readonly campoCantidadPax = "[id$='cphMain_txtPaxQuantity']";
  readonly campoReferenciaCheckout = "[id$='cphMain_txtReference']";
  readonly campoObservacionesCheckout = "[id$='cphMain_txtComment']";
  readonly checkTerminos = "[id$='cbxTermsAndConditions']";
  readonly btnConfirmar = "[id$='btnSaveBook']";

  /** Cantidad de pasajeros que muestra el icono del carrito (cuenta pax, no items). */
  async paxEnElCarrito(): Promise<number> {
    const texto = (await this.page.locator(this.iconoCarrito).first().innerText()).trim();
    return Number(texto.replace(/\D/g, '') || 0);
  }

  async irAlCarrito() {
    await this.page.locator(this.iconoCarrito).first().click();
    await this.page.waitForURL(/shoppingcartpage/i, { timeout: 60_000 });
    await esperarFinDeCarga(this.page);
  }

  /**
   * Deja el carrito vacio antes de empezar.
   *
   * Hace falta porque el carrito es del lado del servidor y esta atado a la
   * cookie de sesion (ShoppingCartManager filtra por CustomerSessionGUID), que
   * viaja en el storageState: lo que quede de una corrida aparece en la
   * siguiente y se emitiria dentro de la reserva.
   */
  async vaciar() {
    // Se mira primero el contador del encabezado, como haria una persona: si
    // esta en cero no hay nada que limpiar y no hay por que entrar al carrito.
    // Ademas, con el carrito vacio el icono no navega a la pantalla.
    if (await this.paxEnElCarrito() === 0) return;

    await this.irAlCarrito();
    if (await this.page.locator(this.filas).count() === 0) return;
    // "Limpiar Carrito" vacia por API y redirige al inicio
    // (ShoppingCartPage.aspx.cs:209 y :220), asi que no se queda en el carrito.
    await this.page.locator(this.btnLimpiar).first().click();
    await esperarFinDeCarga(this.page);
    await expect.poll(() => this.paxEnElCarrito(), { timeout: 30_000 }).toBe(0);
  }

  filaDelCarrito(nombre: string): Locator {
    return this.page.locator(this.filas).filter({ hasText: nombre }).first();
  }

  /** Carga referencia y observaciones en el carrito y pasa al checkout. */
  async crearReserva(referencia: string, observaciones: string) {
    await this.page.locator(this.campoReferencia).first().fill(referencia);
    await this.page.locator(this.campoObservaciones).first().fill(observaciones);
    await this.page.locator(this.btnCrearReserva).first().click();
    await this.page.waitForURL(/checkout/i, { timeout: 90_000 });
    await esperarFinDeCarga(this.page);
  }

  /** Cantidad de bloques de pasajero que muestra el checkout. */
  async pasajerosCargables(): Promise<number> {
    return this.page.locator("[id*='lvPassengersData'][id$='_txtName']").count();
  }

  /**
   * Deja tantos bloques de pasajero como pax se reservaron.
   *
   * El checkout arranca con uno solo aunque la reserva sea de dos o mas: una
   * persona presiona "Anadir Pasajero" hasta completar los que declaro.
   */
  async asegurarPasajeros(cantidad: number) {
    // Tope de intentos: si el boton dejara de agregar, el error tiene que ser
    // "no se pudieron cargar los pasajeros" y no un test colgado.
    for (let intento = 0; await this.pasajerosCargables() < cantidad; intento++) {
      expect(intento, `"Anadir Pasajero" tiene que llegar a ${cantidad} bloques de pasajero`)
        .toBeLessThan(cantidad + 2);
      await this.page.locator(this.btnAgregarPasajero).first().click();
      await esperarFinDeCarga(this.page);
    }
  }

  /**
   * Prefijo de id del bloque de pasajero que ocupa esa posicion en la pantalla.
   *
   * Se deriva del DOM y no se arma a mano: el ListView de ASP.NET no numera sus
   * items de corrido, asi que el segundo pasajero no es necesariamente `ctrl1`.
   */
  private async prefijoDelPasajero(indice: number): Promise<string> {
    const id = await this.page.locator("[id*='lvPassengersData'][id$='_txtName']")
      .nth(indice).getAttribute('id');
    expect(id, `Tiene que existir el bloque del pasajero ${indice + 1}`).toBeTruthy();
    return id!.replace(/_txtName$/, '');
  }

  async completarPasajero(indice: number, pax: Pasajero) {
    const prefijo = await this.prefijoDelPasajero(indice);
    const campo = (sufijo: string) => this.page.locator(`#${prefijo}_${sufijo}`).first();
    await campo('txtName').fill(pax.nombre);
    await campo('txtSurName').fill(pax.apellido);
    await campo('txtPassport').fill(pax.pasaporte);
    await campo('txtBirthday').fill(pax.nacimiento);
    await campo('txtNationality').fill(pax.nacionalidad);
  }

  async completarDatosDeLaReserva(cantidadPax: number, referencia: string, observaciones: string) {
    await this.page.locator(this.campoCantidadPax).first().fill(String(cantidadPax));
    await this.page.locator(this.campoReferenciaCheckout).first().fill(referencia);
    await this.page.locator(this.campoObservacionesCheckout).first().fill(observaciones);
  }

  /** El boton solo se habilita despues de aceptar los terminos (AutoPostBack). */
  async aceptarTerminos() {
    await this.page.locator(this.checkTerminos).first().check();
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.btnConfirmar).first()).toBeEnabled();
  }

  /**
   * Emite la reserva y devuelve el codigo BOxxxxxxxx que muestra el historial.
   * Es el identificador con el que despues se la busca en el BO: la aplicacion
   * lo arma igual de los dos lados (AdvisorHelper.SetBookCode / CodeHelper.OnlineBookingCode).
   */
  async confirmarReserva(): Promise<string> {
    await this.page.locator(this.btnConfirmar).first().click();
    await this.page.waitForURL(/bookinghistory/i, { timeout: 120_000 });
    await esperarFinDeCarga(this.page);

    // El historial tiene dos solapas, "Reservas" y "Reservas circuitos", y cual
    // queda activa lo decide el servidor. La reserva de un servicio vive en la
    // primera, asi que se la abre antes de leer el codigo.
    const solapa = this.page.locator("a[href='#tabBooking']").first();
    if (await solapa.count()) await solapa.click();

    const codigo = this.page
      .locator("#tabBooking a[href*='BookingHistoryDetail.aspx?book=']").first();
    await expect(codigo).toBeVisible({ timeout: 60_000 });
    return (await codigo.innerText()).trim();
  }
}
