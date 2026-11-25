import { Page, Locator, expect } from '@playwright/test';
import { formatearFecha } from '../../utils/pasos';

export type PasajeroNuevo = {
  nombre: string;
  apellido: string;
  /** dd/mm/aaaa */
  nacimiento: string;
  nacionalidad: string;
  pasaporte: string;
};

/**
 * Portal de agencias de la app nueva (ClimbsApp, `/site`).
 *
 * Se usa como lo usaria la agencia: buscador de la portada, ficha, carrito y datos de
 * la reserva. Nada por API: la precondicion de cada test tiene que pasar por las mismas
 * pantallas que un usuario real.
 */
export class PortalNuevoPage {
  constructor(private readonly page: Page) {}

  async ingresar(usuario: string, clave: string) {
    await this.page.goto('/site/login');
    await this.page.getByRole('textbox', { name: 'Usuario o email' }).fill(usuario);
    await this.page.getByRole('textbox', { name: 'Contraseña' }).fill(clave);
    await this.page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(this.page, 'El portal nuevo tiene que dejar entrar al personal con su cuenta del backoffice')
      .toHaveURL(/\/site\/?$/, { timeout: 60_000 });
    await this.cerrarNovedades();
  }

  /**
   * El dialogo "Novedades" ("Renovamos nuestra web") aparece unos segundos despues de
   * cargar la portada y, mientras esta abierto, deja inaccesible el resto de la pagina.
   * Se espera a que aparezca y se cierra con su boton, como haria la persona.
   */
  async cerrarNovedades() {
    // Desde noviembre la novedad de Cruceros abre su propio pop-up ("Cruceros en AMV Travel",
    // #amvcp-overlay) en lugar del folleto: tambien tapa la pagina y se cierra con su boton.
    const novedades = this.page.getByRole('dialog', { name: /^(Novedades|Cruceros en AMV Travel)$/ }).first();
    for (let i = 0; i < 2; i++) {
      const aparecio = await novedades.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
      if (!aparecio) return;
      await novedades.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
      await expect(this.page.locator('#amvcp-overlay.is-open')).toHaveCount(0, { timeout: 10_000 });
    }
  }

  // --- Idioma del sitio ---------------------------------------------------------------

  /** Como se nombra cada idioma en el menu, segun el idioma en que esta el sitio. */
  // Desde la US 5040 el menu nombra cada idioma en su propia lengua, sea cual sea el activo.
  private static readonly NOMBRES_DE_IDIOMA: Record<string, string> = { ES: 'Español', PT: 'Português', EN: 'English' };

  get botonDeIdioma(): Locator {
    return this.page.getByRole('banner').getByRole('button', { name: /^(ES|EN|PT)$/ });
  }

  /** El codigo del idioma activo, como lo muestra el encabezado ("ES", "EN", "PT"). */
  async idiomaActivo(): Promise<string> {
    return (await this.botonDeIdioma.innerText()).trim().toUpperCase();
  }

  /**
   * Cambia el idioma desde el encabezado. Desde la US 5040 el menu se abre con un clic en el
   * boton (antes, al pasar el mouse), ofrece los otros dos idiomas y al elegir recarga la pagina.
   */
  async cambiarIdioma(codigo: 'ES' | 'EN' | 'PT') {
    const actual = await this.idiomaActivo();
    if (actual === codigo) return;
    const opcion = this.page.getByRole('banner').getByRole('menuitem', { name: PortalNuevoPage.NOMBRES_DE_IDIOMA[codigo], exact: true });
    await expect(async () => {
      if (!(await opcion.isVisible())) await this.botonDeIdioma.click();
      await expect(opcion).toBeVisible({ timeout: 5_000 });
    }, 'El menu de idioma tiene que abrirse').toPass({ timeout: 30_000 });
    await opcion.click();
    await expect(this.botonDeIdioma, `El encabezado tiene que quedar en ${codigo}`).toHaveText(codigo);
    await this.page.waitForLoadState('networkidle');
  }

  async abrirInicio() {
    await this.page.goto('/site');
    await this.cerrarNovedades();
  }

  /**
   * El carrito del encabezado abre un panel lateral ("Tu carrito") con Vaciar e "Ir al
   * carrito" (US 5040, como el portal viejo). Con el carrito vacio, /site/cart vuelve al inicio.
   */
  get panelDelCarrito(): Locator {
    return this.page.getByRole('dialog', { name: 'Tu carrito' });
  }

  async abrirPanelDelCarrito() {
    if (!/\/site/.test(this.page.url())) await this.abrirInicio();
    await this.page.getByRole('banner').getByRole('link', { name: 'Carrito' }).click();
    await expect(this.panelDelCarrito.getByRole('heading', { name: 'Tu carrito' })).toBeVisible();
  }

  async cerrarPanelDelCarrito() {
    const cerrar = this.panelDelCarrito.getByRole('button', { name: 'Cerrar' });
    if (await cerrar.isVisible()) await cerrar.click();
  }

  async vaciarCarrito() {
    await this.abrirInicio();
    await this.abrirPanelDelCarrito();
    const vaciar = this.panelDelCarrito.getByRole('button', { name: 'Vaciar', exact: true });
    if (await vaciar.isVisible()) await vaciar.click();
    await expect(this.panelDelCarrito.getByText('Tu carrito está vacío'), 'El carrito tiene que quedar vacio antes de empezar').toBeVisible();
    await this.cerrarPanelDelCarrito();
  }

  /**
   * Solapa SERVICIOS de la portada: Argentina / Buenos Aires / Excursion vienen por defecto.
   * Otro tipo ("Cena Show") se elige en su buscador, como la persona.
   */
  async buscarServicios(fecha: Date, tipo = 'Excursión', destino?: { pais: string; ciudad: string }) {
    await this.abrirInicio();
    await this.page.getByRole('tab', { name: 'Servicios', exact: true }).click();
    const panel = this.page.getByRole('tabpanel', { name: 'Servicios' });
    if (!destino) {
      await expect(panel.getByRole('combobox', { name: 'País' })).toHaveValue('Argentina');
      await expect(panel.getByRole('combobox', { name: 'Ciudad' })).toHaveValue('Buenos Aires');
    }
    // Otro destino: se elige el pais y despues la ciudad, como una persona (el buscador recuerda el ultimo).
    for (const [rotulo, valor] of destino ? [['País', destino.pais], ['Ciudad', destino.ciudad]] as const : []) {
      const c = panel.getByRole('combobox', { name: rotulo });
      await expect(c).not.toHaveValue('', { timeout: 30_000 });
      if ((await c.inputValue()) === valor) continue;
      await c.click();
      await c.fill(valor);
      await this.page.getByRole('option', { name: valor, exact: true }).first().click();
      await expect(c, `El buscador tiene que quedar en ${valor}`).toHaveValue(valor);
    }
    const combo = panel.getByRole('combobox', { name: 'Tipo' });
    if ((await combo.inputValue()) !== tipo) {
      await combo.click();
      await combo.fill(tipo);
      await this.page.getByRole('option', { name: tipo, exact: true }).click();
    }
    await expect(combo).toHaveValue(tipo);
    const checkin = panel.getByRole('textbox', { name: 'Check-in' });
    await checkin.fill(formatearFecha(fecha));
    await checkin.press('Tab');
    await expect(checkin, 'La fecha del servicio tiene que quedar cargada').toHaveValue(formatearFecha(fecha));
    // Mientras la solapa termina de cargar pais y ciudad, Buscar no hace nada: se reintenta.
    await expect(async () => {
      await panel.getByRole('button', { name: 'Buscar' }).click();
      await expect(this.page).toHaveURL(/\/site\/services\?/, { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
  }

  /** Buscador "Buscá un servicio por nombre" de los resultados: elige la sugerencia y abre la ficha. */
  async elegirServicio(termino: string, nombre: string) {
    const buscador = this.page.getByRole('combobox', { name: 'Buscá un servicio por nombre' });
    await buscador.click();
    await buscador.pressSequentially(termino, { delay: 50 });
    await this.page.getByRole('option').filter({ hasText: nombre }).first().click();
    await expect(this.page.getByRole('heading', { level: 1, name: nombre }), `Tiene que abrir la ficha de ${nombre}`).toBeVisible();
  }

  bloqueDeModalidad(modalidad: string): Locator {
    return this.page.locator('article').filter({ has: this.page.getByRole('heading', { name: modalidad, exact: true }) });
  }

  /** Minimo de pasajeros de la modalidad ("Minimo 2 pasajeros"); 1 si no dice. */
  async minimoDePasajeros(modalidad: string): Promise<number> {
    const texto = (await this.bloqueDeModalidad(modalidad).innerText()).replace(/\s+/g, ' ');
    return Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
  }

  /**
   * Precio por persona de la modalidad tal como lo muestra la ficha ("Precio por persona
   * USD 48"). Desde la US 5040 aparece recien con los pasajeros elegidos; antes muestra "-".
   */
  async precioDeLaModalidad(modalidad: string): Promise<string> {
    const texto = (await this.bloqueDeModalidad(modalidad).innerText()).replace(/\s+/g, ' ');
    return texto.match(/PRECIO(?: POR PERSONA)?\s+([A-Z]{3}\s*[\d.,]+)/i)?.[1] ?? '';
  }

  async elegirPasajeros(modalidad: string, pasajeros: number) {
    await this.bloqueDeModalidad(modalidad).getByRole('combobox', { name: `PAX · ${modalidad}` }).selectOption(String(pasajeros));
  }

  /** Total que arma la ficha con los pasajeros elegidos ("Total USD 190", junto a "Agregar al carrito"). */
  async totalDeLaFicha(): Promise<string> {
    // "Total" y el importe van en elementos separados, junto a "Agregar al carrito".
    const total = this.page.locator('main').getByText('Total', { exact: true }).last().locator('xpath=following-sibling::strong[1]');
    await expect(total, 'La ficha tiene que mostrar el total con los pasajeros elegidos').toHaveText(/[A-Z]{3}\s*[\d.,]+/, { timeout: 30_000 });
    return (await total.innerText()).trim();
  }

  async agregarAlCarrito(modalidad: string, pasajeros: number) {
    await this.elegirPasajeros(modalidad, pasajeros);
    await this.page.getByRole('button', { name: 'Agregar al carrito' }).click();
    await expect(this.page.getByRole('status').filter({ hasText: /Se agregó \d+ ítem al carrito/ }).first(),
      'Agregar al carrito tiene que confirmar').toBeVisible();
  }

  /** Contador del carrito en el encabezado: cuenta items, no pasajeros. */
  async itemsEnElCarrito(): Promise<number> {
    // Por su direccion y no por el nombre: el rotulo se traduce ("Carrito", "Cart").
    return Number((await this.page.getByRole('banner').locator('a[href="/site/cart"] #lblCartCount').first().innerText()).match(/\d+/)?.[0] ?? 0);
  }

  /** El item del resumen de la compra: "Excursión Español · 2 Regular 30/11/2026 USD 96". */
  itemDelCarrito(nombre: string): Locator {
    return this.page.locator('main article').filter({ has: this.page.getByRole('heading', { name: nombre, exact: true }) }).first();
  }

  /** Como la persona: el panel del encabezado y "Ir al carrito" (pantalla "Resumen de la compra"). */
  /** La caja del total del carrito: desde noviembre "Total compra" (.scp-total); antes, el panel lateral. */
  get cajaDelTotal(): Locator {
    return this.page.locator('main .scp-total').or(this.page.locator('main').getByRole('complementary')).first();
  }

  /** El importe del total del carrito, como lo muestra la pantalla ("USD 1.234"). */
  async totalDelCarrito(): Promise<string> {
    const texto = (await this.cajaDelTotal.innerText()).replace(/\s+/g, ' ');
    const desde = texto.toLowerCase().lastIndexOf('total');
    return texto.slice(Math.max(desde, 0)).match(/(?:[A-Z]{3}|\$)\s*-?\d[\d.,]*/)?.[0] ?? '';
  }

  async irAlCarrito() {
    await this.abrirPanelDelCarrito();
    await this.panelDelCarrito.getByRole('link', { name: 'Ir al carrito' }).click();
    await expect(this.page.getByRole('heading', { name: 'Resumen de la compra', level: 1 })).toBeVisible();
  }

  async reservarDesdeElCarrito(referencia: string, comentarios: string) {
    await this.irAlCarrito();
    await this.page.getByRole('textbox', { name: 'Referencia' }).fill(referencia);
    await this.page.getByRole('textbox', { name: 'Comentarios' }).fill(comentarios);
    await this.page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(this.page, 'Reservar tiene que llevar a los datos de la reserva').toHaveURL(/\/site\/checkout/);
  }

  /** Datos de la reserva: observaciones del item, un formulario por pasajero y terminos. */
  async completarDatosDeLaReserva(pasajeros: PasajeroNuevo[], observacionesDelItem: string) {
    await this.page.getByRole('textbox', { name: /^Comentario\(s\) \/ fecha\(s\) \/ vuelo · / }).first().fill(observacionesDelItem);
    // Un grupo por pasajero ("Datos del pasajero" o "Pasajero 1", "Pasajero 2"...): se los
    // ubica por lo que tienen adentro y no por el nombre. Los opcionales suman "opcional" al rotulo.
    // La cantidad de pasajeros la carga la persona, igual que en el portal actual: en un
    // servicio viene con la del carrito, pero en un hotel viene con las habitaciones (1).
    // Desde noviembre "Añadir pasajero" aparece solo mientras haya menos pasajeros que esa cantidad:
    // primero se carga la cantidad.
    const cantidad = this.page.getByRole('spinbutton', { name: 'Cantidad de PAX' });
    await cantidad.fill(String(pasajeros.length));
    await expect(cantidad, 'La cantidad de pasajeros tiene que quedar cargada').toHaveValue(String(pasajeros.length));
    const grupos = this.page.getByRole('group').filter({ has: this.page.getByRole('textbox', { name: /^Pasaporte/ }) });
    for (let n = await grupos.count(); n < pasajeros.length; n++) {
      await this.page.getByRole('button', { name: 'Añadir pasajero' }).click();
      await expect(grupos).toHaveCount(n + 1);
    }
    for (const [i, pax] of pasajeros.entries()) {
      const g = grupos.nth(i);
      // Nombres exactos: "Pasaporte" tambien coincide con "Vencimiento del pasaporte".
      const nombre = g.getByRole('textbox', { name: 'Nombre', exact: true });
      const apellido = g.getByRole('textbox', { name: 'Apellido', exact: true });
      const nacimiento = g.getByRole('textbox', { name: 'Fecha de nacimiento', exact: true });
      const nacionalidad = g.getByRole('combobox', { name: /^Nacionalidad/ });
      const pasaporte = g.getByRole('textbox', { name: /^Pasaporte/ });
      await nombre.fill(pax.nombre);
      await apellido.fill(pax.apellido);
      await nacimiento.fill(pax.nacimiento);
      await nacimiento.press('Tab');
      // Combobox con buscador (no un select nativo): se escribe y se elige la opcion.
      await nacionalidad.click();
      await nacionalidad.fill(pax.nacionalidad);
      await this.page.getByRole('option', { name: pax.nacionalidad, exact: true }).click();
      await pasaporte.fill(pax.pasaporte);
      const quien = `Pasajero ${i + 1}`;
      await expect(nombre, `${quien}: el nombre tiene que quedar cargado`).toHaveValue(pax.nombre);
      await expect(apellido, `${quien}: el apellido tiene que quedar cargado`).toHaveValue(pax.apellido);
      await expect(nacimiento, `${quien}: la fecha de nacimiento tiene que quedar cargada`).toHaveValue(pax.nacimiento);
      await expect(pasaporte, `${quien}: el pasaporte tiene que quedar cargado`).toHaveValue(pax.pasaporte);
    }
    await this.page.getByRole('checkbox', { name: 'Términos y condiciones' }).check();
  }

  /**
   * Confirma la reserva y devuelve su codigo. Desde la US 5040 el resultado es un aviso
   * sobre la misma pantalla (/site/checkout) con el codigo y "Ver la reserva".
   */
  async confirmarReserva(): Promise<string> {
    await this.page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
    const aviso = this.page.getByRole('status').filter({ hasText: '¡Reserva generada!' });
    await expect(aviso.getByRole('link', { name: 'Ver reserva' }), 'Confirmar tiene que registrar la reserva')
      .toBeVisible({ timeout: 90_000 });
    // El codigo va en el sello del aviso ("BO00025832").
    const texto = ((await aviso.textContent()) ?? '').replace(/\s+/g, ' ');
    const codigo = texto.match(/BO\d{8}/)?.[0] ?? '';
    expect(codigo, `La confirmacion tiene que mostrar el codigo de la reserva. Dice: "${texto.slice(0, 200)}"`).toMatch(/^BO\d{8}$/);
    return codigo;
  }

  // --- Historial de reservas (/site/bookings) -----------------------------------------

  /**
   * La fila de la reserva en el historial. Las reservas viven en tres solapas ("Carrito de
   * compras", "Multidestino", "Series") y la pantalla abre en la ultima usada: se elige la
   * solapa como haria la persona.
   */
  async filaDelHistorial(codigo: string, solapa: 'Carrito de compras' | 'Multidestino' | 'Series'): Promise<Locator> {
    await this.page.goto('/site/bookings');
    await this.page.getByRole('tab', { name: solapa, exact: true }).click();
    const fila = this.page.getByRole('tabpanel').getByRole('link').filter({ hasText: codigo }).first();
    await expect(fila, `La reserva ${codigo} tiene que figurar en la solapa "${solapa}" del historial`).toBeVisible({ timeout: 60_000 });
    return fila;
  }

  /** Entra al detalle de la reserva desde su fila del historial (/site/bookings/{id}). */
  async abrirDetalleDeLaReserva(fila: Locator, codigo: string) {
    await fila.click();
    await expect(this.page.getByRole('heading', { level: 1, name: `Reserva ${codigo}` }), `Tiene que abrir el detalle de ${codigo}`)
      .toBeVisible({ timeout: 60_000 });
  }

  /** Un dato de la cabecera del detalle por su rotulo ("Referencia", "Comentario(s)", "Total de la reserva"...). */
  async datoDelDetalle(rotulo: string | string[]): Promise<string> {
    // Acepta varios rotulos: el de la US 5040 ("Comentario") y el anterior ("Comentario(s)").
    const rotulos = (Array.isArray(rotulo) ? rotulo : [rotulo]).map((r) => r.toLowerCase());
    const texto = (await this.page.locator('main').innerText()).replace(/\r/g, '');
    const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
    const i = lineas.findIndex((l) => rotulos.includes(l.toLowerCase()));
    return i >= 0 ? lineas[i + 1] ?? '' : '';
  }
}
