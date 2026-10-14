import { Page, Locator, expect } from '@playwright/test';
import { adjuntarTexto, codigoDeReserva, elegirNacionalidad, esperarFinDeCarga } from '../utils/pasos';

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

  /**
   * El icono del encabezado.
   *
   * Cuenta **items del carrito**, no pasajeros: `UserStatusControl.js` hace
   * `var count = items.length`. Hasta el rediseño del 2026-09-05 sumaba el
   * `Quantity` de cada item —pasajeros en un servicio, habitaciones en un hotel—.
   * El PM confirmo que contar items es lo correcto y que lo anterior estaba mal.
   *
   * Desde ese mismo rediseño **ya no navega**: abre un panel lateral.
   */
  readonly iconoCarrito = '#AncoreShoppingCart';
  /** El boton "Ir al carrito", dentro del panel lateral que abre el icono. */
  readonly btnIrAlCarrito = '#btnFinalizar';
  /**
   * Cada item del carrito.
   *
   * **Hasta el rediseño del 2026-09-05 el carrito era una tabla** y esto valia
   * `table.table-bordered tbody tr`. Ahora cada item es un `.ct-row` dentro de
   * `.ct-list--cart`, y en la pantalla no queda un solo `tr`.
   *
   * El sintoma fue silencioso y caro: `vaciar()` cuenta las filas y **se va
   * temprano si no hay ninguna**, asi que daba el carrito por vacio y no limpiaba
   * nada. Las corridas fallidas fueron dejando items adentro y el test siguiente
   * encontraba 5 pasajeros donde esperaba 1. No fallaba donde estaba el problema.
   *
   * Se acota a las filas que tienen boton de borrar para no contar el encabezado
   * de la lista, que tambien es un `.ct-row`.
   */
  readonly filas = ".ct-list--cart .ct-row:has([id*='lnkDeleteItem'])";
  readonly campoReferencia = "[id$='_txtReference']";
  readonly campoObservaciones = "[id$='_txtComment']";
  readonly btnCrearReserva = "[id$='lnkCreateBook']";
  readonly btnLimpiar = "[id$='lnkCancelShoppingCart']";

  // --- Checkout ---
  readonly btnAgregarPasajero = "[id$='cphMain_lnkAdd']";
  // Por id y no por clase: `lnkCopy` y `lnkRemove` comparten `ct-row__remove`
  // (CheckOut.aspx:216 y :219), asi que la clase resuelve al de copiar.
  readonly btnQuitarPasajero = "[id*='lvPassengersData'][id$='_lnkRemove']";
  readonly campoCantidadPax = "[id$='cphMain_txtPaxQuantity']";
  readonly campoReferenciaCheckout = "[id$='cphMain_txtReference']";
  readonly campoObservacionesCheckout = "[id$='cphMain_txtComment']";
  readonly checkTerminos = "[id$='cbxTermsAndConditions']";
  readonly btnConfirmar = "[id$='btnSaveBook']";

  /** Numero que muestra el icono del carrito: la cantidad de items. */
  async paxEnElCarrito(): Promise<number> {
    const texto = (await this.page.locator(this.iconoCarrito).first().innerText()).trim();
    return Number(texto.replace(/\D/g, '') || 0);
  }

  /**
   * Va al carrito.
   *
   * **El icono dejo de navegar con el rediseño del 2026-09-05** (US 4613). Sigue
   * siendo un `<a>` con su `href` a `ShoppingCartPage.aspx`, pero ahora es tambien
   * un `cart-trigger` con un popover de Bootstrap —`data-toggle="popover"`,
   * `data-content="Item añadido"`— y el click se queda en el popover: la pantalla
   * no se mueve. El sintoma era un `waitForURL` esperando sesenta segundos una
   * navegacion que ya nadie dispara.
   *
   * Lo que hace ahora el icono es **abrir un panel lateral** con lo que hay en el
   * carrito, y adentro de ese panel esta el boton **"Ir al carrito"**
   * (`#btnFinalizar`, clase `cart-drawer__go-btn`). Ese es el recorrido de una
   * persona hoy: icono para abrir el panel, boton para entrar.
   *
   * El detalle que lo delata: el boton existe en el DOM desde el principio, pero
   * con el panel cerrado queda **fuera del viewport**, asi que clickearlo directo
   * termina en un timeout de treinta segundos que no explica nada.
   */
  async irAlCarrito() {
    const boton = this.page.locator(this.btnIrAlCarrito).first();
    const icono = this.page.locator(this.iconoCarrito).first();

    if (await boton.count()) {
      await icono.click();
      await expect(
        boton,
        'El icono del carrito tiene que abrir el panel con el boton de ir al carrito',
      ).toBeInViewport({ timeout: 15_000 });
      await boton.click();
    } else {
      // Pantallas que todavia no tienen el panel: se entra por el icono, que en
      // ellas sigue navegando.
      await expect(
        icono,
        'La pantalla tiene que ofrecer alguna forma de ir al carrito',
      ).toBeVisible({ timeout: 30_000 });
      await icono.click();
    }

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
    // **No se decide por el contador del encabezado.** Desde el deploy del
    // 2026-09-26 ese numero lo escribe UserStatusControl.js cuando llegan los items,
    // despues de cargar la pagina: leido antes esta vacio, se tomaba como 0 y se
    // salia sin vaciar. El 2026-10-10 asi quedo un Tigre y Delta de un test anterior,
    // el siguiente agrego otro y el file de la liquidacion salio con el servicio
    // duplicado. Se entra derecho a la pantalla del carrito y se miran sus filas.
    //
    // "Limpiar Carrito" vacia por API y redirige al inicio (ShoppingCartPage.aspx.cs:209
    // y :220). Si se vuelve al carrito antes de que la API termine, todavia muestra el
    // item: medido el 14/10, la verificacion esperaba 30 s sobre esa misma pagina sin
    // recargarla y fallaba con el carrito ya vacio. Por eso se reintenta: limpiar,
    // volver a abrir el carrito y mirar sus filas, hasta tres veces.
    const abrirYContar = async () => {
      await this.page.goto('/online/ShoppingCartPage.aspx');
      await esperarFinDeCarga(this.page);
      // Con el carrito vacio la pantalla redirige al inicio y no hay filas.
      return this.page.locator(this.filas).count();
    };
    let quedan = await abrirYContar();
    for (let intento = 0; intento < 3 && quedan > 0; intento++) {
      await this.page.locator(this.btnLimpiar).first().click();
      await esperarFinDeCarga(this.page);
      await this.page.waitForTimeout(2_000 * (intento + 1));
      quedan = await abrirYContar();
    }
    // Se confirma en la pantalla del carrito y no con el contador, que vacio
    // tambien "da" 0.
    expect(quedan, 'Despues de limpiarlo, el carrito no puede tener items').toBe(0);
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
   * Deja exactamente tantos bloques de pasajero como pax se reservaron: agrega
   * los que falten y quita los que sobren.
   *
   * Quitar no es simetria por prolijidad. El checkout rechaza la reserva si la
   * cantidad de pax declarada es menor que la de bloques dibujados
   * (`CheckOut.aspx.cs:890`), asi que un solo bloque de mas -- aunque este
   * vacio -- alcanza para que no se emita, con el aviso "La cantidad de
   * pasajeros ingresada es menor a los pasajeros cargados". Este metodo daba por
   * hecho que la pantalla arranca con un bloque y solo agregaba; el 2026-09-09
   * la corrida del CI la encontro con tres, y se cayeron las precondiciones de
   * tres tests del Bloque C sin llegar nunca al BackOffice.
   *
   * El primer bloque no trae boton de quitar -- nace con `ShowDelete = false`
   * (`CheckOut.aspx.cs:150`) --, que es justo lo que hace falta: nunca se puede
   * bajar de un pasajero.
   */
  async asegurarPasajeros(cantidad: number) {
    // Desde el deploy del 2026-09-26 el "+" se esconde cuando las fichas llegan a la
    // Cantidad de PAX (`coSyncAddPax`, CheckOut.aspx): con el campo en 1 no hay boton
    // para agregar el segundo pasajero. Se carga primero la cantidad, como haria una
    // persona que va a sumar pasajeros; `completarDatosDeLaReserva` la vuelve a escribir.
    const campoCantidad = this.page.locator(this.campoCantidadPax).first();
    if ((Number(await campoCantidad.inputValue()) || 0) < cantidad) {
      await campoCantidad.fill(String(cantidad));
    }

    // Tope de intentos: si el boton dejara de agregar, el error tiene que ser
    // "no se pudieron cargar los pasajeros" y no un test colgado.
    for (let intento = 0; await this.pasajerosCargables() < cantidad; intento++) {
      expect(intento, `"Anadir Pasajero" tiene que llegar a ${cantidad} bloques de pasajero`)
        .toBeLessThan(cantidad + 2);
      await this.page.locator(this.btnAgregarPasajero).first().click();
      await esperarFinDeCarga(this.page);
    }

    // El tope se calcula sobre lo que sobra al entrar, no sobre la cantidad
    // pedida: los bloques de mas pueden ser muchos mas que los que se reservan.
    const sobrantes = (await this.pasajerosCargables()) - cantidad;
    for (let intento = 0; await this.pasajerosCargables() > cantidad; intento++) {
      expect(intento, `Quitar tiene que dejar ${cantidad} bloques de pasajero`)
        .toBeLessThan(sobrantes + 2);
      await this.page.locator(this.btnQuitarPasajero).last().click();
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
    // El rediseño del 2026-09-05 (US 4613) le cambio la mayuscula al id: era
    // `txtSurName` y quedo `txtSurname`. Confirmado en CheckOut.aspx:208.
    await campo('txtSurname').fill(pax.apellido);
    await campo('txtPassport').fill(pax.pasaporte);
    await campo('txtBirthday').fill(pax.nacimiento);
    await elegirNacionalidad(this.page, prefijo, pax.nacionalidad);
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

    // Desde el deploy del 2026-09-26 el checkout ya no redirige: el servidor llama a
    // `preloaderPassportDone` (OnlineHelper.BookDoneScript, assets/js/preloader.js),
    // que estampa "Reserva generada" con el codigo y ofrece "Ver reserva" e "Ir a mis
    // reservas". Si el i18n no cargo, el mismo script redirige al historial como
    // antes, asi que se espera cualquiera de las dos salidas.
    const sello = this.page.locator('.wpreloader__stamp--done small').first();
    const enHistorial = () => /bookinghistory/i.test(this.page.url());
    await expect.poll(async () => enHistorial() || await sello.isVisible(), {
      message: 'Al confirmar tiene que aparecer "Reserva generada" o abrirse el historial',
      timeout: 120_000,
    }).toBe(true);

    let delSello = '';
    if (!enHistorial()) {
      delSello = codigoDeReserva(await sello.innerText());
      await adjuntarTexto('Codigo del sello "Reserva generada"', delSello);
      // "Ir a mis reservas" es el boton sin `--primary`; "Ver reserva" abre el detalle.
      await this.page.locator('.wpreloader__actions a.wpreloader__btn:not(.wpreloader__btn--primary)')
        .first().click();
      await this.page.waitForURL(/bookinghistory/i, { timeout: 120_000 });
    }
    await esperarFinDeCarga(this.page);

    // El historial tiene dos solapas, "Reservas" y "Reservas circuitos", y cual
    // queda activa lo decide el servidor. La reserva de un servicio vive en la
    // primera, asi que se la abre antes de leer el codigo.
    const solapa = this.page.locator("a[href='#tabBooking']").first();
    if (await solapa.count()) await solapa.click();

    const enlaces = this.page.locator("#tabBooking a[href*='BookingHistoryDetail.aspx?book=']");
    const fila = delSello ? enlaces.filter({ hasText: delSello }).first() : enlaces.first();
    await expect(fila, 'El historial tiene que mostrar la reserva recien generada')
      .toBeVisible({ timeout: 60_000 });
    return codigoDeReserva(await fila.locator('.bh-row__code').innerText());
  }
}
