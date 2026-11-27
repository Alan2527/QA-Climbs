import { Page, Locator, expect, Response } from '@playwright/test';
import { importeANumero } from '../../utils/pasos';
import { PortalNuevoPage, PasajeroNuevo } from './portal.page';

/** Una salida tal como la carga la pantalla (`/api/site/series/tours/{id}/booking`). */
export type SalidaDeSerie = { date: string; single: number | null; double: number | null; triple: number | null; child: number | null; quota: number | null };
export type CategoriaDeSerie = { id: number; name: string; freeMaxAge: number | null; childMaxAge: number | null; departures: SalidaDeSerie[] };

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const importe = (t: string) => importeANumero((t.match(/[A-Z]{3}\s*([\d.,]+)/)?.[1]) ?? '') ?? 0;

/**
 * Series en el portal nuevo: listado `/site/series` (menu "Series"), la serie
 * `/site/series/{id}` con sus circuitos ("Ver viaje") y el circuito `/site/series/tours/{id}`,
 * que trae el itinerario y el asistente "Reservar circuito" en tres pasos (Disponibilidad,
 * Pasajeros, Resumen) con el "Resumen de reserva" al costado.
 *
 * El cupo de cada salida no se ve en pantalla salvo cuando quedan 5 o menos ("Quedan N
 * habitaciones..."): se lee de la respuesta con la que la pantalla arma el calendario, la
 * misma informacion que el test del portal actual leia de la pagina.
 */
export class SerieNuevaPage {
  private salidas: CategoriaDeSerie[] = [];
  urlDelAsistente = '';

  constructor(private readonly page: Page) {}

  // --- Listado y serie ----------------------------------------------------------------

  async abrirListado() {
    // Por el menu del encabezado, ubicado por su direccion: el rotulo se traduce. La portada
    // abre con el dialogo "Novedades" demorado: se cierra antes, como en los demas flujos.
    await new PortalNuevoPage(this.page).abrirInicio();
    await this.page.getByRole('banner').locator('nav a[href="/site/series"]').click();
    await expect(this.page).toHaveURL(/\/site\/series$/);
    await expect(this.page.locator('main article').first()).toBeVisible({ timeout: 60_000 });
  }

  async seriesDelListado(): Promise<string[]> {
    return (await this.page.locator('main article').getByRole('heading', { level: 2 }).allInnerTexts()).map((t) => t.trim());
  }

  async abrirSerie(nombre: string) {
    await this.page.locator('main article').filter({ has: this.page.getByRole('heading', { level: 2, name: nombre, exact: true }) }).getByRole('link').click();
    await expect(this.page).toHaveURL(/\/site\/series\/\d+$/);
    await expect(this.page.locator('main article').first()).toBeVisible({ timeout: 60_000 });
  }

  tarjetaDelCircuito(circuito: string): Locator {
    return this.page.locator('main article').filter({ has: this.page.getByRole('heading', { level: 3 }).filter({ hasText: circuito }) }).first();
  }

  async circuitosDeLaSerie(): Promise<string[]> {
    return (await this.page.locator('main article').getByRole('heading', { level: 3 }).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  async precioDesde(circuito: string): Promise<string> {
    return (await this.tarjetaDelCircuito(circuito).locator('strong').first().innerText()).trim();
  }

  /** Entra al circuito y guarda las salidas con las que la pantalla arma el calendario. */
  async abrirCircuito(circuito: string) {
    const [respuesta] = await Promise.all([
      this.page.waitForResponse((r) => /\/api\/site\/series\/tours\/\d+\/booking/.test(r.url()), { timeout: 60_000 }),
      this.tarjetaDelCircuito(circuito).getByRole('link').click(),
    ]);
    await this.leerSalidas(respuesta);
    this.urlDelAsistente = this.page.url();
    await expect(this.page.getByRole('heading', { level: 1 })).toContainText(circuito);
  }

  /** Vuelve a pedir el asistente desde cero (y relee las salidas). */
  async reabrirAsistente() {
    const [respuesta] = await Promise.all([
      this.page.waitForResponse((r) => /\/api\/site\/series\/tours\/\d+\/booking/.test(r.url()), { timeout: 60_000 }),
      this.page.goto(this.urlDelAsistente),
    ]);
    await this.leerSalidas(respuesta);
  }

  private async leerSalidas(respuesta: Response) {
    this.salidas = ((await respuesta.json()) as { categories: CategoriaDeSerie[] }).categories ?? [];
  }

  /** La salida de la categoria en la fecha (aaaa-mm-dd), como la tiene la pantalla. */
  salida(categoria: string, iso: string): SalidaDeSerie | undefined {
    return this.salidas.find((c) => c.name === categoria)?.departures.find((d) => d.date === iso);
  }

  politicaDeMenores(categoria: string) {
    const c = this.salidas.find((x) => x.name === categoria);
    return { freeMaxAge: c?.freeMaxAge ?? 0, childMaxAge: c?.childMaxAge ?? 0 };
  }

  // --- Paso 1: disponibilidad ---------------------------------------------------------

  get combo(): Locator { return this.page.getByRole('combobox', { name: /^(Categoría de hotelería|Hotel category|Categoria de hotelaria)$/ }); }
  get calendario(): Locator { return this.page.getByRole('grid'); }
  /** La columna del "Resumen de reserva" (desde el 04/11 un div.sbk__side; antes un aside). */
  get resumenLateral(): Locator { return this.page.locator('main .sbk__side').or(this.page.locator('main').getByRole('complementary')).last(); }

  /** El paso en curso del asistente (el que esta marcado). */
  async pasoActual(): Promise<string> {
    // Desde el pase de la 5040 la barra son div.sbk-step (el activo con is-active); antes era una lista ol/li.is-current.
    const actual = this.page.locator('main .sbk-step.is-active .sbk-step__label').or(this.page.locator('main ol li.is-current')).first();
    return (await actual.innerText()).replace(/^\s*\d+\s*/, '').trim();
  }

  // Desde noviembre la categoria es un desplegable propio (TsSelect, como el TomSelect del viejo):
  // un div con rol combobox que al tocarlo abre una lista de opciones dentro de su envoltura.
  private get desplegable(): Locator { return this.combo.locator('xpath=..').getByRole('listbox'); }

  private async abrirCombo() {
    // Despues de elegir una opcion la lista tarda en desmontarse: sigue visible con aria-expanded en
    // false. El 26/11/2026 el test la tomo por abierta, no hizo clic y la lista desaparecio. Se espera
    // a que el combo quede quieto (abierto o con la lista ya oculta) y se abre si hace falta.
    const abierto = async () => (await this.combo.getAttribute('aria-expanded')) === 'true';
    await expect.poll(async () => (await abierto()) || !(await this.desplegable.isVisible().catch(() => false)),
      { message: 'La lista de categorias tiene que terminar de cerrarse', timeout: 15_000 }).toBe(true);
    if (!(await abierto())) await this.combo.click();
    await expect(this.desplegable).toBeVisible();
    // La lista se monta ~20 ms antes de quedar abierta (TsSelect.show): en ese hueco el Escape no cierra nada.
    await expect(this.combo).toHaveAttribute('aria-expanded', 'true');
  }

  async categorias(): Promise<string[]> {
    await this.abrirCombo();
    const opciones = (await this.desplegable.getByRole('option').allInnerTexts()).map((t) => t.trim());
    // Abierto, el clic cae en el campo de busqueda (que no cierra, como el TomSelect del viejo): se cierra con Escape.
    await this.page.keyboard.press('Escape');
    await expect(this.desplegable).toBeHidden();
    return opciones;
  }

  async elegirCategoria(nombre: string) {
    await this.abrirCombo();
    await this.desplegable.getByRole('option', { name: nombre, exact: true }).click();
    await expect(this.combo).toContainText(nombre);
  }

  async categoriaElegida(): Promise<string> {
    return ((await this.combo.locator('.sbk-ts__item').textContent()) ?? '').trim();
  }

  async mesDelCalendario(): Promise<string> {
    const texto = (await this.page.locator('main').innerText());
    // Desde noviembre el encabezado dice "Diciembre 2026" (antes "diciembre de 2026"): se devuelve siempre con "de".
    const m = texto.match(new RegExp(`(${MESES.join('|')})(?: de)? (\\d{4})`, 'i'));
    return m ? `${m[1]} de ${m[2]}` : '';
  }

  /** Las salidas que el calendario ofrece en el mes a la vista: dia, clave aaaa-mm-dd y precio por persona. */
  async salidasDelMes(): Promise<{ dia: number; clave: string; precio: number }[]> {
    const [nombreMes, anio] = (await this.mesDelCalendario()).toLowerCase().split(' de ');
    const mes = MESES.indexOf(nombreMes) + 1;
    const botones = await this.calendario.getByRole('button').evaluateAll((bs) => bs
      .filter((b) => !(b as HTMLButtonElement).disabled)
      // Los dias del mes anterior o siguiente que completan la grilla (is-adjacent) son botones que cambian de mes, no salidas.
      .filter((b) => !b.classList.contains('is-adjacent'))
      // innerText y no textContent: el dia y el precio van en elementos separados y
      // textContent los pega ("26" + "1.250" = "261.250").
      .map((b) => (b as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
    return botones.map((t) => {
      const dia = Number(t.match(/^\d+/)?.[0] ?? 0);
      return { dia, clave: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, precio: importeANumero(t.replace(/^\d+\s*/, '')) ?? 0 };
    });
  }

  async mesSiguiente() {
    const antes = await this.mesDelCalendario();
    await this.page.getByRole('button', { name: /^(Mes siguiente|Next month|Próximo mês)$/ }).click();
    await expect.poll(() => this.mesDelCalendario()).not.toBe(antes);
  }

  /**
   * Como ofrece el calendario una salida (aaaa-mm-dd) de la categoria: si el dia esta a la venta
   * con precio, el precio que muestra y el cupo y la tarifa con los que la pantalla lo arma.
   */
  async estadoDeLaSalida(categoria: string, clave: string): Promise<{ ofrecida: boolean; precio: number | null; tarifa: number | null; cupo: number | null }> {
    await this.elegirCategoria(categoria);
    const [anio, mes] = clave.split('-').map(Number);
    for (let i = 0; i < 24; i++) {
      const [nombreMes, a] = (await this.mesDelCalendario()).toLowerCase().split(' de ');
      if (Number(a) === anio && MESES.indexOf(nombreMes) + 1 === mes) break;
      await this.mesSiguiente();
    }
    const delDia = (await this.salidasDelMes()).find((s) => s.clave === clave);
    const salida = this.salida(categoria, clave);
    return { ofrecida: !!delDia && delDia.precio > 0, precio: delDia?.precio ?? null, tarifa: salida?.double ?? null, cupo: salida?.quota ?? null };
  }

  /** Elige la primera salida que ofrece el calendario (avanzando de mes si hace falta). */
  async elegirPrimeraSalida(): Promise<{ fecha: string; clave: string; precio: number; tarifaPorHabitacion: number }> {
    for (let i = 0; i < 12; i++) {
      const salidas = await this.salidasDelMes();
      if (salidas.length) return this.elegirSalida(salidas[0].clave);
      await this.mesSiguiente();
    }
    throw new Error('El calendario no ofrece ninguna salida en los proximos 12 meses');
  }

  /** Elige la salida de esa fecha (aaaa-mm-dd), avanzando de mes hasta llegar. */
  async elegirSalida(clave: string): Promise<{ fecha: string; clave: string; precio: number; tarifaPorHabitacion: number }> {
    const [anio, mes, dia] = clave.split('-').map(Number);
    for (let i = 0; i < 24; i++) {
      const [nombreMes, a] = (await this.mesDelCalendario()).toLowerCase().split(' de ');
      if (Number(a) === anio && MESES.indexOf(nombreMes) + 1 === mes) break;
      await this.mesSiguiente();
    }
    const boton = this.calendario.getByRole('button', { name: new RegExp(`^${dia}(\\s|$)`) });
    const texto = (await boton.innerText()).replace(/\s+/g, ' ');
    await boton.click();
    const fecha = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
    const elegida = this.page.locator('main').getByText(/^(Fecha seleccionada|Selected date|Data selecionada):?$/).locator('xpath=following-sibling::strong[1]');
    // La pantalla escribe la fecha sin ceros a la izquierda ("20/9/2027"): vale con o sin.
    await expect(this.page.locator('main'), `Tiene que quedar elegida la salida del ${fecha}`).toContainText(new RegExp(`\\b0?${dia}/0?${mes}/${anio}\\b`));
    const tarifa = (await this.page.locator('main').innerText()).match(/(?:Tarifa por habitación|Rate per room|Tarifa por quarto):?\s*([A-Z]{3}\s*[\d.,]+)/)?.[1] ?? '';
    void elegida;
    return { fecha, clave, precio: importeANumero(texto.replace(/^\d+\s*/, '')) ?? 0, tarifaPorHabitacion: importe(tarifa) };
  }

  private contador(nombre: 'Adultos' | 'Menores'): Locator { return this.page.getByRole('group', { name: nombre }); }

  async valor(nombre: 'Adultos' | 'Menores'): Promise<number> {
    // Desde el 04/11 el valor es un span con aria-live (antes role="status").
    return Number((await this.contador(nombre).locator('[aria-live], [role="status"]').first().innerText()).trim());
  }

  /** Lleva los contadores a esa ocupacion y elige las edades de los menores. */
  async configurarOcupacion(o: { adultos: number; menores?: number; edades?: number[] }) {
    const menores = o.menores ?? 0;
    // Primero los menores a cero, para que el tope de ocupantes no frene a los adultos.
    for (let i = 0; i < 6 && (await this.valor('Menores')) > 0; i++) await this.contador('Menores').getByRole('button', { name: 'Menores −' }).click();
    for (let i = 0; i < 6 && (await this.valor('Adultos')) !== o.adultos; i++) {
      const signo = (await this.valor('Adultos')) < o.adultos ? '+' : '−';
      await this.contador('Adultos').getByRole('button', { name: `Adultos ${signo}` }).click();
    }
    for (let i = 0; i < menores; i++) await this.contador('Menores').getByRole('button', { name: 'Menores +' }).click();
    expect(await this.valor('Adultos'), `Tienen que quedar ${o.adultos} adultos`).toBe(o.adultos);
    expect(await this.valor('Menores'), `Tienen que quedar ${menores} menores`).toBe(menores);
    for (const [i, edad] of (o.edades ?? []).entries()) {
      // Desde el 04/11 la edad es el desplegable propio (TsSelect) "Edad niño N", con opciones "1 año o menos" / "N años".
      const combo = this.page.getByRole('combobox', { name: new RegExp(`^Edad (niño|menor) ${i + 1}$`) });
      await combo.click();
      const lista = combo.locator('xpath=..').getByRole('listbox');
      await expect(lista).toBeVisible();
      await lista.getByRole('option', { name: edad === 1 ? '1 año o menos' : `${edad} años`, exact: true }).click();
      await expect(lista).toBeHidden();
    }
  }

  /** Lo que dejan hacer los botones de los contadores: es lo que ve la persona. */
  async topesDeOcupacion() {
    return {
      adultos: await this.valor('Adultos'),
      menores: await this.valor('Menores'),
      masAdultos: await this.contador('Adultos').getByRole('button', { name: 'Adultos +' }).isDisabled(),
      menosAdultos: await this.contador('Adultos').getByRole('button', { name: 'Adultos −' }).isDisabled(),
      masMenores: await this.contador('Menores').getByRole('button', { name: 'Menores +' }).isDisabled(),
    };
  }

  async agregarHabitacion() {
    await this.page.getByRole('button', { name: 'Agregar habitación' }).click();
    await this.page.waitForTimeout(500);
  }

  /** Las habitaciones del resumen: un renglon .sbk-room-row por habitacion ("Habitación Nro. 1 Doble ..."). */
  habitaciones(): Locator { return this.resumenLateral.locator('.sbk-room-row'); }

  async habitacionesDelResumen(): Promise<string[]> {
    return (await this.habitaciones().allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  async totalesPorHabitacion(): Promise<number[]> {
    return (await this.habitacionesDelResumen()).map((t) => importe((t.match(/[A-Z]{3}\s*[\d.,]+/g) ?? []).at(-1) ?? ''));
  }

  async quitarLaHabitacion(indice: number) {
    const antes = await this.habitaciones().count();
    await this.habitaciones().nth(indice).locator('button[title="Quitar habitación"]').click();
    await expect(this.habitaciones()).toHaveCount(antes - 1);
  }

  /**
   * Los datos del "Resumen de reserva", y el total. Desde el 04/11: categoria y salida en dos columnas (.sbk-sum__col), habitaciones
   * y pasajeros en renglones (.sbk-sum__item) y el total en .sbk-total__price. Se leen por posicion, asi sirve en cualquier idioma.
   */
  async resumen(): Promise<{ categoria: string; salida: string; habitaciones: string; pasajeros: string; total: number }> {
    const r = this.resumenLateral;
    const texto = async (l: Locator) => ((await l.count()) ? (await l.first().innerText()).replace(/\s+/g, ' ').trim() : '');
    const cols = r.locator('.sbk-sum__col .sbk-sum__svalue');
    const items = r.locator('.sbk-sum__item .sbk-sum__value');
    const total = await texto(r.locator('.sbk-total__price'));
    return {
      categoria: await texto(cols.nth(0)), salida: await texto(cols.nth(1)),
      habitaciones: await texto(items.nth(0)), pasajeros: await texto(items.nth(1)),
      total: total && total !== '—' ? importe(/^[A-Z]{3}/.test(total) ? total : `USD ${total}`) : 0,
    };
  }

  get botonSiguiente(): Locator { return this.page.getByRole('button', { name: /^(Siguiente|Confirmar reserva)$/ }); }

  async siguiente() {
    await this.botonSiguiente.click();
    await this.page.waitForTimeout(800);
  }

  async volver() {
    await this.page.getByRole('button', { name: 'Volver', exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  /** El error del paso (rol alert); vacio si no hay. */
  async errorDelPasoActual(): Promise<string> {
    return (await this.page.locator('main').getByRole('alert').allInnerTexts()).map((t) => t.trim()).filter(Boolean).join(' | ');
  }

  async textoDelAvisoDePocosCupos(): Promise<string> {
    // Sin ancla al comienzo: el renglon arranca con un icono.
    return (await this.page.locator('main').getByText(/(Quedan \d+ habitaciones|Queda 1 habitación) disponibles? para esta fecha/).allInnerTexts()).join(' ').trim();
  }

  /** Los modales del asistente (desde el 04/11 div.sbk-modal__box con su titulo en h3, sin role=dialog, como el .cupo-modal del viejo). */
  private modalDelAsistente(titulo: RegExp): Locator {
    return this.page.locator('.sbk-modal__box').filter({ has: this.page.locator('h3', { hasText: titulo }) })
      .or(this.page.getByRole('dialog', { name: titulo })).first();
  }

  async textoDelModalDeCupo(): Promise<string> {
    const modal = this.modalDelAsistente(/^(Sin más disponibilidad|Reserva de grupo)$/);
    if (!(await modal.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false))) return '';
    return (await modal.innerText()).replace(/\s+/g, ' ').trim();
  }

  async cerrarModalDeCupo() {
    const modal = this.modalDelAsistente(/^(Sin más disponibilidad|Reserva de grupo)$/);
    await modal.getByRole('button', { name: /^(Cerrar|Cancelar)$/ }).first().click();
    await expect(modal).toBeHidden();
  }

  async textoDelCartelDeConsulta(): Promise<string> {
    return (await this.page.locator('main').getByText(/hay que consultar disponibilidad/).allInnerTexts()).join(' ').trim();
  }

  // --- Cambio de categoria ------------------------------------------------------------

  get modalDeCategoria(): Locator { return this.modalDelAsistente(/^Cambiar categoría$/); }

  async intentarCambiarCategoria(nombre: string) { await this.elegirCategoria(nombre); }

  async textoDelModalDeCategoria(): Promise<string> {
    if (!(await this.modalDeCategoria.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false))) return '';
    return (await this.modalDeCategoria.innerText()).replace(/\s+/g, ' ').trim();
  }

  async cancelarCambioDeCategoria() {
    await this.modalDeCategoria.getByRole('button', { name: /^(Cancelar|Cerrar)$/ }).first().click();
    await expect(this.modalDeCategoria).toBeHidden();
  }

  async confirmarCambioDeCategoria() {
    await this.modalDeCategoria.getByRole('button', { name: 'Sí, reiniciar' }).click();
    await expect(this.modalDeCategoria).toBeHidden();
  }

  // --- Paso 2: pasajeros --------------------------------------------------------------

  /** Un bloque por habitacion (desde el 04/11 div.sbk-paxroom, como el PassengerRoomControl del viejo). */
  bloques(): Locator { return this.page.locator('main .sbk-paxroom'); }

  /** "Habitación 1 · Doble · 2 adultos · 1 menor". */
  async titulosDeLasHabitaciones(): Promise<string[]> {
    return (await this.bloques().locator('.sbk-paxroom__header').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Los ocupantes que pide cada habitacion ("Adulto 1", "Menor 3 (8 años)"), en orden. */
  async ocupantesDeLaHabitacion(indice: number): Promise<string[]> {
    // textContent: la etiqueta se dibuja en mayusculas por CSS y innerText devolveria "ADULTO 1".
    return (await this.bloques().nth(indice).locator('.sbk-pax__label').allTextContents()).map((t) => t.trim()).filter((t) => /^(Adulto|Menor)\b/.test(t));
  }

  /**
   * Los campos no tienen etiqueta asociada (cada uno va bajo un h5 con su rotulo), asi que se ubican por ese rotulo
   * dentro del ocupante. La nacionalidad es un texto libre desde el 04/11 (antes un desplegable).
   */
  async completarPasajero(habitacion: number, indice: number, pax: PasajeroNuevo) {
    const ocupante = this.bloques().nth(habitacion).locator('.sbk-pax').nth(indice);
    const campo = (rotulo: string) => ocupante.locator('.sbk-pax__col').filter({ has: this.page.locator('h5', { hasText: new RegExp(`^${rotulo}$`) }) }).locator('input');
    await campo('Nombre').fill(pax.nombre);
    await campo('Apellido').fill(pax.apellido);
    await campo('Pasaporte').fill(pax.pasaporte);
    const nac = campo('Fecha de nacimiento');
    await nac.fill(pax.nacimiento);
    await campo('Nacionalidad').fill(pax.nacionalidad);
    await expect(nac, 'La fecha de nacimiento tiene que quedar cargada').toHaveValue(pax.nacimiento);
  }

  // --- Paso 3: resumen y confirmacion -------------------------------------------------

  async textoDelResumenFinal(): Promise<string> {
    const texto = (await this.page.locator('main').innerText()).replace(/\r/g, '');
    const desde = texto.indexOf('Detalles de la reserva');
    const hasta = texto.indexOf('Acepto los', desde);
    return texto.slice(desde, hasta > 0 ? hasta : undefined).replace(/\s+/g, ' ').trim();
  }

  async aceptarTerminos() {
    await this.page.getByRole('checkbox', { name: 'Acepto los términos y condiciones' }).check();
    await expect(this.page.getByRole('button', { name: 'Confirmar reserva' })).toBeEnabled();
  }

  /** Desde el 02/11 la confirmacion es el "pasaporte" (role=status, fuera de main) con el sello "Reserva generada" y el codigo. */
  async confirmarReserva(): Promise<string> {
    await this.page.getByRole('button', { name: 'Confirmar reserva' }).click();
    const aviso = this.page.getByRole('status').filter({ hasText: /BO\d{8}/ }).first();
    await expect(aviso, 'Confirmar tiene que registrar la reserva y mostrar su codigo').toBeVisible({ timeout: 180_000 });
    return ((await aviso.textContent()) ?? '').match(/BO\d{8}/)?.[0] ?? '';
  }
}
