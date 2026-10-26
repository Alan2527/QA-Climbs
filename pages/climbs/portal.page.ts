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
    const novedades = this.page.getByRole('dialog', { name: 'Novedades' });
    const aparecio = await novedades.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    if (!aparecio) return;
    await novedades.getByRole('button', { name: 'Cerrar' }).click();
    await expect(novedades).toBeHidden();
  }

  async abrirInicio() {
    await this.page.goto('/site');
    await this.cerrarNovedades();
  }

  async vaciarCarrito() {
    await this.page.goto('/site/cart');
    await expect(this.page.getByRole('heading', { name: 'Carrito', level: 1 })).toBeVisible();
    const vaciar = this.page.getByRole('button', { name: 'Vaciar el carrito' });
    if (await vaciar.isVisible()) {
      await vaciar.click();
      // Si pide confirmacion, se confirma.
      const dialogo = this.page.getByRole('dialog');
      if (await dialogo.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        await dialogo.getByRole('button', { name: /vaciar|aceptar|confirmar|s[ií]/i }).first().click();
      }
    }
    await expect(this.page.getByText('El carrito está vacío'), 'El carrito tiene que quedar vacio antes de empezar').toBeVisible();
  }

  /**
   * Solapa SERVICIOS de la portada: Argentina / Buenos Aires / Excursion vienen por defecto.
   * Otro tipo ("Cena Show") se elige en su buscador, como la persona.
   */
  async buscarServicios(fecha: Date, tipo = 'Excursión') {
    await this.abrirInicio();
    await this.page.getByRole('tab', { name: 'SERVICIOS' }).click();
    const panel = this.page.getByRole('tabpanel', { name: 'SERVICIOS' });
    await expect(panel.getByRole('combobox', { name: 'País' })).toHaveValue('Argentina');
    await expect(panel.getByRole('combobox', { name: 'Ciudad' })).toHaveValue('Buenos Aires');
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
    await panel.getByRole('button', { name: 'Buscar' }).click();
    await expect(this.page).toHaveURL(/\/site\/services\?/);
  }

  /** Buscador "Buscar por nombre" de los resultados: elige la sugerencia y abre la ficha. */
  async elegirServicio(termino: string, nombre: string) {
    const buscador = this.page.getByPlaceholder('Buscar por nombre');
    await buscador.click();
    await buscador.pressSequentially(termino, { delay: 50 });
    await this.page.getByRole('option', { name: nombre }).click();
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

  /** Precio de la modalidad tal como lo muestra la ficha ("PRECIO USD 95"). */
  async precioDeLaModalidad(modalidad: string): Promise<string> {
    const texto = (await this.bloqueDeModalidad(modalidad).innerText()).replace(/\s+/g, ' ');
    return texto.match(/PRECIO\s+([A-Z]{3}\s*[\d.,]+)/i)?.[1] ?? '';
  }

  async elegirPasajeros(modalidad: string, pasajeros: number) {
    await this.bloqueDeModalidad(modalidad).getByRole('combobox', { name: `Pasajeros · ${modalidad}` }).selectOption(String(pasajeros));
  }

  /** Total que arma la ficha con los pasajeros elegidos ("Total USD 190", junto a "Agregar al carrito"). */
  async totalDeLaFicha(): Promise<string> {
    const total = this.page.locator('main').getByText(/^Total\s+[A-Z]{3}\s*[\d.,]+$/).last();
    await expect(total, 'La ficha tiene que mostrar el total con los pasajeros elegidos').toBeVisible({ timeout: 30_000 });
    return (await total.innerText()).replace(/^Total\s+/, '').trim();
  }

  async agregarAlCarrito(modalidad: string, pasajeros: number) {
    await this.elegirPasajeros(modalidad, pasajeros);
    await this.page.getByRole('button', { name: 'Agregar al carrito' }).click();
    await expect(this.page.getByRole('status').filter({ hasText: /Se agregó \d+ ítem al carrito/ }),
      'Agregar al carrito tiene que confirmar').toBeVisible();
  }

  /** Contador del carrito en el encabezado: cuenta items, no pasajeros. */
  async itemsEnElCarrito(): Promise<number> {
    return Number((await this.page.getByRole('link', { name: /Carrito/ }).innerText()).match(/\d+/)?.[0] ?? 0);
  }

  /** El item del carrito: "02/11/2026 2 x Regular Excursion Español" y su importe. */
  itemDelCarrito(nombre: string): Locator {
    return this.page.locator('main article').filter({ has: this.page.getByRole('heading', { name: nombre, exact: true }) }).first();
  }

  async irAlCarrito() {
    await this.page.goto('/site/cart');
    await expect(this.page.getByRole('heading', { name: 'Carrito', level: 1 })).toBeVisible();
  }

  async reservarDesdeElCarrito(referencia: string, comentarios: string) {
    await this.page.goto('/site/cart');
    await this.page.getByRole('textbox', { name: 'Referencia' }).fill(referencia);
    await this.page.getByRole('textbox', { name: 'Comentarios' }).fill(comentarios);
    await this.page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(this.page, 'Reservar tiene que llevar a los datos de la reserva').toHaveURL(/\/site\/checkout/);
  }

  /** Datos de la reserva: observaciones del item, un formulario por pasajero y terminos. */
  async completarDatosDeLaReserva(pasajeros: PasajeroNuevo[], observacionesDelItem: string) {
    await this.page.getByRole('textbox', { name: /^Observaciones · / }).first().fill(observacionesDelItem);
    // Arranca con un grupo "Datos del pasajero"; al agregar, los grupos pasan a llamarse
    // "Pasajero 1", "Pasajero 2"... Se los ubica por lo que tienen adentro y no por el nombre.
    const grupos = this.page.getByRole('group').filter({ has: this.page.getByRole('textbox', { name: 'Pasaporte', exact: true }) });
    for (let n = await grupos.count(); n < pasajeros.length; n++) {
      await this.page.getByRole('button', { name: 'Agregar pasajero' }).click();
      await expect(grupos).toHaveCount(n + 1);
    }
    for (const [i, pax] of pasajeros.entries()) {
      const g = grupos.nth(i);
      // Nombres exactos: "Pasaporte" tambien coincide con "Vencimiento del pasaporte".
      const nombre = g.getByRole('textbox', { name: 'Nombre', exact: true });
      const apellido = g.getByRole('textbox', { name: 'Apellido', exact: true });
      const nacimiento = g.getByRole('textbox', { name: 'Fecha de nacimiento', exact: true });
      const nacionalidad = g.getByRole('combobox', { name: 'Nacionalidad', exact: true });
      const pasaporte = g.getByRole('textbox', { name: 'Pasaporte', exact: true });
      await nombre.fill(pax.nombre);
      await apellido.fill(pax.apellido);
      await nacimiento.fill(pax.nacimiento);
      await nacimiento.press('Tab');
      await nacionalidad.selectOption({ label: pax.nacionalidad });
      await pasaporte.fill(pax.pasaporte);
      const quien = `Pasajero ${i + 1}`;
      await expect(nombre, `${quien}: el nombre tiene que quedar cargado`).toHaveValue(pax.nombre);
      await expect(apellido, `${quien}: el apellido tiene que quedar cargado`).toHaveValue(pax.apellido);
      await expect(nacimiento, `${quien}: la fecha de nacimiento tiene que quedar cargada`).toHaveValue(pax.nacimiento);
      await expect(pasaporte, `${quien}: el pasaporte tiene que quedar cargado`).toHaveValue(pax.pasaporte);
    }
    // La cantidad de pasajeros la carga la persona, igual que en el portal actual: en un
    // servicio viene con la del carrito, pero en un hotel viene con las habitaciones (1).
    const cantidad = this.page.getByRole('spinbutton', { name: 'Cantidad de pasajeros' });
    await cantidad.fill(String(pasajeros.length));
    await expect(cantidad, 'La cantidad de pasajeros tiene que quedar cargada').toHaveValue(String(pasajeros.length));
    await this.page.getByRole('checkbox', { name: 'Acepto los términos y condiciones' }).check();
  }

  /**
   * Confirma la reserva y devuelve su codigo. El resultado se muestra en la misma
   * direccion (/site/checkout): "Reserva enviada · La reserva BO00025832 quedo registrada".
   */
  async confirmarReserva(): Promise<string> {
    await this.page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(this.page.getByRole('heading', { name: 'Reserva enviada' }), 'Confirmar tiene que registrar la reserva')
      .toBeVisible({ timeout: 90_000 });
    const texto = (await this.page.locator('main').innerText()).replace(/\s+/g, ' ');
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
  async datoDelDetalle(rotulo: string): Promise<string> {
    const texto = (await this.page.locator('main').innerText()).replace(/\r/g, '');
    const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
    const i = lineas.findIndex((l) => l.toLowerCase() === rotulo.toLowerCase());
    return i >= 0 ? lineas[i + 1] ?? '' : '';
  }
}
