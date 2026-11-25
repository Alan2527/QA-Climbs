import { Page, Locator, expect } from '@playwright/test';
import { formatearFecha } from '../../utils/pasos';
import { PortalNuevoPage, PasajeroNuevo } from './portal.page';
import { elegirEnCombo } from './combo';

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
    // Desde la US 5040 las solapas se llaman "Multidestino" y "Ofertas" (las mayusculas son de estilo).
    const nombre = solapa === 'OFERTAS' ? 'Ofertas' : 'Multidestino';
    await this.page.getByRole('tab', { name: nombre, exact: true }).click();
    const panel = this.page.getByRole('tabpanel', { name: nombre });
    await this.elegir(panel, 'País', viaje.pais);
    await this.elegir(panel, 'Ciudad', viaje.ciudad);
    const checkin = panel.getByRole('textbox', { name: 'Check-in' });
    await checkin.fill(formatearFecha(viaje.fecha));
    await checkin.press('Tab');
    await expect(checkin, 'El check-in tiene que quedar con la fecha elegida').toHaveValue(formatearFecha(viaje.fecha));
    // Desde la US 5040 las dos solapas eligen el viaje en el combo "Paquetes" (antes Ofertas decia "Tour").
    const rotuloDelViaje = (await panel.getByRole('combobox', { name: 'Tour', exact: true }).count()) ? 'Tour' : 'Paquetes';
    await this.elegir(panel, rotuloDelViaje, viaje.nombre);
    // Mientras la solapa termina de cargar, Buscar no hace nada: se reintenta.
    await expect(async () => {
      if (/\/site\/?$/.test(new URL(this.page.url()).pathname)) await panel.getByRole('button', { name: 'Buscar' }).click();
      await expect(this.page).toHaveURL(/\/site\/custom-tours\/(new|\d+)/, { timeout: 10_000 });
    }, 'Elegido el viaje, la busqueda entra al armado').toPass({ timeout: 60_000 });
    await expect(this.page, 'Elegido el viaje, la busqueda entra directo al armado').toHaveURL(/\/site\/custom-tours\/\d+$/, { timeout: 60_000 });
  }

  get fechaDeSalida(): Locator { return this.page.getByRole('textbox', { name: /^Fecha de salida/ }); }

  async configurarViaje(pax: number, dobles: number) {
    // Desde la US 5040 el campo se llama "Cantidad de pax" y los dos son combos con buscador.
    // Cada combo va dentro de su rotulo: abierto, la lista de opciones pasa a formar parte del
    // nombre ("Cantidad de pax 1 2 3..."). Se los ubica por su id, que no cambia.
    await elegirEnCombo(this.page.locator('#ctb-pax').or(this.page.getByRole('combobox', { name: /^(Cantidad de pax|Pasajeros)$/ })).first(), String(pax));
    await elegirEnCombo(this.page.locator('#ctb-dbl').or(this.page.getByRole('combobox', { name: 'DBL', exact: true })).first(), String(dobles));
    await expect(this.page.getByRole('button', { name: 'Siguiente' }), 'Con pasajeros y habitaciones el armado tiene que dejar seguir').toBeEnabled();
  }

  async nochesDelDestino(indice: number): Promise<number> {
    return Number(await this.page.getByRole('spinbutton', { name: 'Noches' }).nth(indice).inputValue());
  }

  async irAlItinerario() {
    await this.page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(this.page).toHaveURL(/\/site\/custom-tours\/\d+\/detail/, { timeout: 120_000 });
    // Desde noviembre el boton del itinerario dice "Continuar" (antes "Reservar").
    await expect(this.page.getByRole('button', { name: /^(Reservar|Continuar)$/ }).last(), 'El itinerario tiene que ofrecer reservar').toBeVisible({ timeout: 120_000 });
  }

  /**
   * El panel "Opciones de cotizacion" del itinerario: los hoteles con su precio, la
   * habitacion, los servicios y el total. Se lee el texto de la pantalla a partir del
   * titulo del panel, que es lo que ve la persona.
   */
  async opcionesDeCotizacion(): Promise<{ lineas: string[]; habitacion: string; servicios: string; total: string }> {
    const texto = (await this.page.locator('main').innerText()).replace(/\r/g, '');
    // El titulo del panel puede venir en mayusculas por estilo: se busca sin distinguirlas.
    const desde = texto.toLowerCase().lastIndexOf('opciones de cotización');
    const lineas = texto.slice(desde).split('\n').map((l) => l.trim()).filter(Boolean);
    const despuesDe = (rotulo: RegExp) => { const i = lineas.findIndex((l) => rotulo.test(l)); return i >= 0 ? lineas[i + 1] ?? '' : ''; };
    return {
      lineas: lineas.slice(0, lineas.findIndex((l) => /^(Reservar|Continuar)$/i.test(l)) + 1 || 30),
      habitacion: despuesDe(/^(SGL|DBL|TPL)$/i),
      servicios: despuesDe(/^SERVICIOS$/i),
      total: despuesDe(/^TOTAL$/i),
    };
  }

  /**
   * Las filas de servicio del itinerario (article[data-service]): nombre, fecha (el chip muestra dia,
   * mes corto y, a veces, el anio; si no lo trae se deduce del inicio del viaje), pax (la pastilla con el rotulo), modalidad (la ultima
   * pastilla, o el texto fijo cuando no se puede elegir) e importe vigente.
   */
  async serviciosDelItinerario(inicio: Date): Promise<{ nombre: string; fecha: string; pax: string; modalidad: string; importe: string }[]> {
    const crudas = await this.page.locator('main article[data-service]').evaluateAll((rows) => rows.map((r) => {
      const pills = Array.from(r.querySelectorAll('.ctd-row__fields .ctd-pill'));
      const conRotulo = pills.find((p) => p.querySelector('.ctd-pill__label'));
      const ultima = pills.at(-1);
      const texto = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
      return {
        nombre: texto(r.querySelector('.ctd-row__title')),
        dia: texto(r.querySelector('.date-chip__day')),
        mes: texto(r.querySelector('.date-chip__month')),
        pax: texto(conRotulo?.querySelector('.ctd-pill__value')),
        modalidad: ultima && ultima !== conRotulo ? texto(ultima.querySelector('.ctd-pill__value')) : '',
        importe: texto(r.querySelector('.ctd-rate__line:not(.is-old) .ctd-rate__amount')),
      };
    }));
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return crudas.map((c) => {
      const [mes, anio] = c.mes.toLowerCase().replace('.', '').split(/\s+/);
      const m = MESES.findIndex((x) => mes.startsWith(x)) + 1;
      // Sin anio en el chip: el primero en que la fecha no queda antes del inicio del viaje.
      let a = Number(anio) || inicio.getFullYear();
      if (!anio && new Date(a, m - 1, Number(c.dia)) < new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) a += 1;
      const fecha = `${c.dia.padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
      return { nombre: c.nombre, fecha, pax: c.pax, modalidad: c.modalidad, importe: c.importe };
    });
  }

  async continuarAlCarrito() {
    await this.page.getByRole('button', { name: /^(Reservar|Continuar)$/ }).last().click();
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
    // El rotulo puede venir en mayusculas por estilo y con el importe en la misma linea.
    const i = lineas.map((l) => /^total\b/i.test(l)).lastIndexOf(true);
    if (i < 0) return '';
    const mismaLinea = lineas[i].replace(/^total\s*/i, '').trim();
    return mismaLinea || (lineas[i + 1] ?? '');
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
      // Desde noviembre el boton dice "Añadir pasajero".
      const agregar = this.page.getByRole('button', { name: /^(Agregar|Añadir) pasajero$/ });
      await agregar.scrollIntoViewIfNeeded();
      const caja = await agregar.boundingBox();
      await agregar.click({ position: { x: (caja?.width ?? 40) - 20, y: (caja?.height ?? 20) / 2 } });
      await expect(grupos).toHaveCount(n + 1);
    }
    for (const [i, pax] of pasajeros.entries()) {
      const g = grupos.nth(i);
      await g.getByRole('textbox', { name: 'Nombre', exact: true }).fill(pax.nombre);
      await g.getByRole('textbox', { name: 'Apellido', exact: true }).fill(pax.apellido);
      // Desde noviembre los opcionales suman "opcional" al rotulo ("Pasaporteopcional").
      await g.getByRole('textbox', { name: /^Pasaporte/ }).fill(pax.pasaporte);
      const nacimiento = g.getByRole('textbox', { name: 'Fecha de nacimiento', exact: true });
      await nacimiento.fill(pax.nacimiento);
      await nacimiento.press('Tab');
      await elegirEnCombo(g.getByRole('combobox', { name: /^Nacionalidad/ }), pax.nacionalidad);
      await expect(nacimiento, `Pasajero ${i + 1}: la fecha de nacimiento tiene que quedar cargada`).toHaveValue(pax.nacimiento);
    }
    await expect(this.page.getByRole('heading', { name: `Pasajeros ${pasajeros.length}/${pasajeros.length}` }),
      'Tienen que quedar cargados todos los pasajeros').toBeVisible();
  }

  async completarDatosDeLaReserva(referencia: string, observaciones: string) {
    await this.page.getByRole('textbox', { name: 'Referencia', exact: true }).fill(referencia);
    // Desde noviembre el campo se llama "Comentarios", igual que el de cada item: el de la
    // reserva es el ultimo, debajo de Referencia. La casilla es "Términos y condiciones".
    await this.page.getByRole('textbox', { name: 'Comentarios de la reserva', exact: true })
      .or(this.page.getByRole('textbox', { name: 'Comentarios', exact: true }).last()).first().fill(observaciones);
    await this.page.getByRole('checkbox', { name: /^(Acepto los términos y condiciones|Términos y condiciones)$/ }).check();
  }

  /** Reserva y devuelve el codigo BOxxxxxxxx que muestra la confirmacion. */
  async confirmarReserva(): Promise<string> {
    await this.page.getByRole('button', { name: 'Reservar', exact: true }).last().click();
    // Desde noviembre la confirmacion es una capa superpuesta (el "pasaporte" con el codigo)
    // que se dibuja fuera de <main>: se busca el codigo en toda la pagina.
    const pagina = this.page.locator('body');
    await expect(pagina, 'Reservar tiene que confirmar la reserva con su codigo').toContainText(/BO\d{8}/, { timeout: 180_000 });
    const texto = (await pagina.innerText()).replace(/\s+/g, ' ');
    return texto.match(/BO\d{8}/)?.[0] ?? '';
  }
}
