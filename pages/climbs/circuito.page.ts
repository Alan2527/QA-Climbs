import { Page, Locator, expect } from '@playwright/test';
import { formatearFecha } from '../../utils/pasos';
import { PortalNuevoPage, PasajeroNuevo } from './portal.page';

/**
 * Ofertas y multidestinos en el portal nuevo (el riel de CustomTours del portal actual).
 *
 *   portada, solapa OFERTAS o MULTIDESTINO (Pais, Ciudad, Check-in, Tour / Paquetes)
 *     -> /site/custom-tours/{id}            "Destinos y pasajeros": pax, habitaciones, noches
 *     -> /site/custom-tours/{id}/detail     "Hoteles y servicios" y "Opciones de cotizacion"
 *     -> /site/custom-tours/{id}/cart       items, pasajeros, referencia y "Reservar"
 */
export class CircuitoNuevoPage {
  constructor(private readonly page: Page) {}

  /** Los combos de la portada son buscadores: se escribe y se elige la opcion. */
  private async elegir(panel: Locator, rotulo: string, valor: string) {
    const combo = panel.getByRole('combobox', { name: rotulo, exact: true });
    if ((await combo.inputValue()).trim() === valor) return;
    await combo.click();
    await combo.fill(valor);
    await this.page.getByRole('option', { name: valor, exact: true }).click();
    await expect(combo, `${rotulo} tiene que quedar en ${valor}`).toHaveValue(valor);
  }

  async buscarViaje(solapa: 'OFERTAS' | 'MULTIDESTINO', viaje: { pais: string; ciudad: string; nombre: string; fecha: Date }) {
    await new PortalNuevoPage(this.page).abrirInicio();
    await this.page.getByRole('tab', { name: solapa, exact: true }).click();
    const panel = this.page.getByRole('tabpanel', { name: solapa });
    await this.elegir(panel, 'País', viaje.pais);
    await this.elegir(panel, 'Ciudad', viaje.ciudad);
    const checkin = panel.getByRole('textbox', { name: 'Check-in' });
    await checkin.fill(formatearFecha(viaje.fecha));
    await checkin.press('Tab');
    await expect(checkin, 'El check-in tiene que quedar con la fecha elegida').toHaveValue(formatearFecha(viaje.fecha));
    await this.elegir(panel, solapa === 'OFERTAS' ? 'Tour' : 'Paquetes', viaje.nombre);
    await panel.getByRole('button', { name: 'Buscar' }).click();
    await expect(this.page, 'Elegido el viaje, la busqueda entra directo al armado').toHaveURL(/\/site\/custom-tours\/\d+$/, { timeout: 60_000 });
  }

  get fechaDeSalida(): Locator { return this.page.getByRole('textbox', { name: /^Fecha de salida/ }); }

  async configurarViaje(pax: number, dobles: number) {
    await this.page.getByRole('combobox', { name: 'Pasajeros', exact: true }).selectOption(String(pax));
    await this.page.getByRole('combobox', { name: 'DBL', exact: true }).selectOption(String(dobles));
    await expect(this.page.getByRole('button', { name: 'Siguiente' }), 'Con pasajeros y habitaciones el armado tiene que dejar seguir').toBeEnabled();
  }

  async nochesDelDestino(indice: number): Promise<number> {
    return Number(await this.page.getByRole('spinbutton', { name: 'Noches' }).nth(indice).inputValue());
  }

  async irAlItinerario() {
    await this.page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(this.page).toHaveURL(/\/site\/custom-tours\/\d+\/detail/, { timeout: 120_000 });
    await expect(this.page.getByRole('button', { name: 'Reservar', exact: true }).last(), 'El itinerario tiene que ofrecer reservar').toBeVisible({ timeout: 120_000 });
  }

  /**
   * El panel "Opciones de cotizacion" del itinerario: los hoteles con su precio, la
   * habitacion, los servicios y el total. Se lee el texto de la pantalla a partir del
   * titulo del panel, que es lo que ve la persona.
   */
  async opcionesDeCotizacion(): Promise<{ lineas: string[]; habitacion: string; servicios: string; total: string }> {
    const texto = (await this.page.locator('main').innerText()).replace(/\r/g, '');
    const desde = texto.lastIndexOf('Opciones de cotización');
    const lineas = texto.slice(desde).split('\n').map((l) => l.trim()).filter(Boolean);
    const despuesDe = (rotulo: RegExp) => { const i = lineas.findIndex((l) => rotulo.test(l)); return i >= 0 ? lineas[i + 1] ?? '' : ''; };
    return {
      lineas: lineas.slice(0, lineas.findIndex((l) => /^Reservar$/.test(l)) + 1 || 30),
      habitacion: despuesDe(/^(SGL|DBL|TPL)$/i),
      servicios: despuesDe(/^SERVICIOS$/i),
      total: despuesDe(/^TOTAL$/i),
    };
  }

  async continuarAlCarrito() {
    await this.page.getByRole('button', { name: 'Reservar', exact: true }).last().click();
    await expect(this.page).toHaveURL(/\/site\/custom-tours\/\d+\/cart/, { timeout: 120_000 });
    await expect(this.page.getByRole('heading', { name: /^Pasajeros/ })).toBeVisible({ timeout: 60_000 });
  }

  // --- Carrito del circuito -------------------------------------------------------------

  itemDelCarrito(fragmento: string): Locator {
    return this.page.locator('main article').filter({ hasText: new RegExp(fragmento, 'i') }).first();
  }

  async importePorItem(fragmentos: string[]): Promise<Record<string, string>> {
    const salida: Record<string, string> = {};
    for (const f of fragmentos) {
      const texto = (await this.itemDelCarrito(f).innerText().catch(() => '')).replace(/\s+/g, ' ');
      salida[f] = texto.match(/[A-Z]{3}\s*[\d.,]+/g)?.at(-1) ?? '';
    }
    return salida;
  }

  /** Total del carrito ("Hoteles", "Servicios", "Total"): el importe que sigue al rotulo "Total". */
  async total(): Promise<string> {
    const texto = (await this.page.locator('main').innerText()).replace(/\r/g, '');
    const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
    const i = lineas.lastIndexOf('Total');
    return i >= 0 ? lineas[i + 1] ?? '' : '';
  }

  /** El comentario del primer item del viaje (el hotel), como en el carrito actual. */
  async completarComentarioDelItem(texto: string) {
    const campo = this.page.locator('main article').first().getByRole('textbox', { name: 'Comentarios', exact: true });
    await campo.fill(texto);
    await expect(campo).toHaveValue(texto);
  }

  async completarPasajeros(pasajeros: PasajeroNuevo[]) {
    const grupos = this.page.getByRole('group', { name: /^Pasajero \d+$/ });
    for (let n = await grupos.count(); n < pasajeros.length; n++) {
      // La tarjeta del pasajero tapa casi todo el boton "Agregar pasajero": solo asoma su
      // borde derecho ("...ajero"). Se hace clic ahi, que es lo que puede hacer la persona.
      const agregar = this.page.getByRole('button', { name: 'Agregar pasajero' });
      await agregar.scrollIntoViewIfNeeded();
      const caja = await agregar.boundingBox();
      await agregar.click({ position: { x: (caja?.width ?? 40) - 20, y: (caja?.height ?? 20) / 2 } });
      await expect(grupos).toHaveCount(n + 1);
    }
    for (const [i, pax] of pasajeros.entries()) {
      const g = grupos.nth(i);
      await g.getByRole('textbox', { name: 'Nombre', exact: true }).fill(pax.nombre);
      await g.getByRole('textbox', { name: 'Apellido', exact: true }).fill(pax.apellido);
      await g.getByRole('textbox', { name: 'Pasaporte', exact: true }).fill(pax.pasaporte);
      const nacimiento = g.getByRole('textbox', { name: 'Fecha de nacimiento', exact: true });
      await nacimiento.fill(pax.nacimiento);
      await nacimiento.press('Tab');
      await g.getByRole('combobox', { name: 'Nacionalidad', exact: true }).selectOption({ label: pax.nacionalidad });
      await expect(nacimiento, `Pasajero ${i + 1}: la fecha de nacimiento tiene que quedar cargada`).toHaveValue(pax.nacimiento);
    }
    await expect(this.page.getByRole('heading', { name: `Pasajeros ${pasajeros.length}/${pasajeros.length}` }),
      'Tienen que quedar cargados todos los pasajeros').toBeVisible();
  }

  async completarDatosDeLaReserva(referencia: string, observaciones: string) {
    await this.page.getByRole('textbox', { name: 'Referencia', exact: true }).fill(referencia);
    await this.page.getByRole('textbox', { name: 'Comentarios de la reserva', exact: true }).fill(observaciones);
    await this.page.getByRole('checkbox', { name: 'Acepto los términos y condiciones' }).check();
  }

  /** Reserva y devuelve el codigo BOxxxxxxxx que muestra la confirmacion. */
  async confirmarReserva(): Promise<string> {
    await this.page.getByRole('button', { name: 'Reservar', exact: true }).last().click();
    const main = this.page.locator('main');
    await expect(main, 'Reservar tiene que confirmar la reserva con su codigo').toContainText(/BO\d{8}/, { timeout: 180_000 });
    const texto = (await main.innerText()).replace(/\s+/g, ' ');
    return texto.match(/BO\d{8}/)?.[0] ?? '';
  }
}
