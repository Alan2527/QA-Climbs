import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';
import { Pasajero } from './carrito.page';

/**
 * Asistente de reserva de series (circuitos con salidas programadas).
 *
 * Es el quinto riel de reserva del portal y no se parece a ninguno de los otros
 * cuatro: no pasa por el carrito. Es un asistente de cuatro pasos que vive en
 * una sola pantalla y emite desde ahi.
 *
 *   serieall.aspx                        listado de series
 *   serieDetail.aspx?serie=N             circuitos de esa serie
 *   serieTour.aspx?serieID=N&tourID=M    el asistente
 *
 * **Al listado se entra por URL.** Cuando esto se escribio, INICIO no tenia solapa
 * de series y el menu del encabezado no lo enlazaba en ninguna parte: no habia una
 * sola referencia a `serieall.aspx` fuera de las tres pantallas de series.
 *
 * **Eso cambio el 2026-09-05**: un deploy de QA agrego la entrada `Series` al menu,
 * apuntando a `/online/serieAll.aspx`. Queda pendiente mover la entrada del test al
 * menu, que es como entra una persona y como entran los otros cuatro rieles. No se
 * hizo en el momento porque el mismo deploy dejo media suite en rojo y no convenia
 * mezclar los dos cambios.
 *
 * Los cuatro pasos:
 *
 *   1. Disponibilidad  categoria de hoteleria + calendario de salidas + habitaciones
 *   2. Pasajeros       un bloque por habitacion, con un formulario por ocupante
 *   3. Adicionales     solo aparece si el circuito tiene extras (`ShowExtrasStep`)
 *   4. Resumen         confirmacion de solo lectura + terminos y condiciones
 *
 * Tres cosas que hay que tener presentes para operarlo:
 *
 * - **El calendario se dibuja en el cliente.** `serie-tour.js` arma las celdas
 *   desde las tarifas que el servidor inyecta, y solo las salidas con tarifa
 *   llevan `data-key`. Un dia sin salida, o una salida ya vencida, se dibuja
 *   igual pero sin ese atributo: no es clickeable.
 * - **Elegir una fecha no hace postback**: solo escribe los hidden fields desde
 *   JavaScript. El postback recien llega al agregar la habitacion.
 * - **Los combos son TomSelect**: el `<select>` original queda oculto, asi que
 *   `selectOption` no sirve. Se abre el control y se elige del dropdown, que es
 *   lo que hace una persona.
 *
 * Referencias:
 *   Online/Module/SerieBookControl.ascx(.cs)      el asistente entero
 *   Online/Module/PassengerRoomControl.ascx       el bloque de pasajeros
 *   assets/js/serie-tour.js                        calendario y steppers
 */
export class SeriePage {
  constructor(private readonly page: Page) {}

  // --- Categoria de hoteleria (TomSelect sobre ddlHotelCategory) ---
  readonly comboCategoria = '.cat-card .ts-control';
  readonly opcionesCategoria = '.cat-card .ts-dropdown .option';

  // --- Calendario ---
  /** Solo las salidas reservables traen data-key: las demas celdas no lo tienen. */
  readonly celdaConSalida = '.scal-cell[data-key]';
  readonly celdaVencida = '.scal-cell.scal-past';
  readonly etiquetaDelMes = '#spanCalLabel';
  readonly mesSiguiente = '#btnCalNext';
  readonly mesAnterior = '#btnCalPrev';
  readonly fechaElegida = '#spanFechaSeleccionada';
  readonly tarifaElegida = '#spanTarifaSeleccionada';

  // --- Habitaciones ---
  readonly masAdultos = '#btnAdultsPlus';
  readonly menosAdultos = '#btnAdultsMinus';
  readonly masMenores = '#btnChildrenPlus';
  readonly menosMenores = '#btnChildrenMinus';
  readonly contadorAdultos = '#dispAdults';
  readonly contadorMenores = '#dispChildren';
  readonly comboEdad1 = '#childAge1Group .ts-control';
  readonly opcionesEdad1 = '#childAge1Group .ts-dropdown .option';
  readonly comboEdad2 = '#childAge2Group .ts-control';
  readonly opcionesEdad2 = '#childAge2Group .ts-dropdown .option';
  readonly botonAgregarHabitacion = "[id$='btnAddRoom']";
  readonly filaDeHabitacion = '.rooms-detail-row';
  readonly errorDeHabitacion = "[id$='lblValidationError']";

  // --- Resumen y navegacion ---
  readonly totalDelResumen = '#spanResumenTarifa';
  readonly categoriaDelResumen = '#spanResumenCategoria';
  readonly fechaDelResumen = '#spanResumenFecha';
  readonly botonSiguiente = "[id$='btnNextStep']";
  readonly botonVolver = "[id$='btnPrevStep']";
  readonly errorDelPaso = "[id$='lblStepError']";
  readonly checkTerminos = "[id$='cbxTermsConditions']";
  readonly resumenDelPaso4 = "[id$='phSummaryStep4'], .step4-section";

  // --- Carteles y modales ---
  readonly sinDisponibilidad = '.booking-noavail';
  readonly cartelDeConsulta = '#consultAvailability';
  readonly avisoDePocosCupos = '#cupoLowWarning';
  readonly modalDeCupo = '#cupoModal';
  readonly modalDeCategoria = '#catResetModal';
  readonly bloqueDePasajeros = '.pax-room-section';
  readonly quitarHabitacion = '.rooms-detail-del';
  readonly totalDeLaHabitacion = '.rooms-detail-total';

  /** Paso activo del asistente, leido del indicador de arriba. */
  async pasoActual(): Promise<string> {
    return (await this.page.locator('.wizard-step.is-active .wizard-step-label').first()
      .innerText()).replace(/\s+/g, ' ').trim();
  }

  /**
   * Espera a que ASP.NET termine el postback parcial.
   *
   * `esperarFinDeCarga` ya mira el PageRequestManager, pero puede volver antes de
   * que el postback arranque. Se espera primero a que arranque —con tolerancia,
   * porque hay acciones que no lo disparan— y despues a que termine.
   */
  private async esperarPostback() {
    await this.page.waitForFunction(() => {
      const w = window as any;
      const prm = w.Sys?.WebForms?.PageRequestManager?.getInstance?.();
      return !!prm && prm.get_isInAsyncPostBack();
    }, undefined, { timeout: 5_000 }).catch(() => {});
    await esperarFinDeCarga(this.page);

    // El UpdatePanel reemplaza el DOM y serie-tour.js vuelve a enganchar los
    // handlers y a montar los TomSelect en `Sys.Application.add_load`. Operar
    // antes de eso deja clicks que no hacen nada.
    //
    // La senial de que ya corrio es que **los `<select>` de la pantalla vuelvan a
    // estar montados**: TomSelect les pone la clase `tomselected` y crea su
    // `.ts-control` al lado. Se espera eso en vez de un tiempo fijo. Los pasos que
    // no tienen combos —pasajeros y resumen— no lo cumplen nunca, asi que la
    // espera es tolerante: ahi el postback ya termino y no hay nada que montar.
    await this.page.waitForFunction(() => {
      const selects = document.querySelectorAll('select.seriebook-ts');
      if (!selects.length) return true;
      return document.querySelectorAll('select.seriebook-ts.tomselected').length === selects.length
        && !!document.querySelector('.ts-control');
    }, undefined, { timeout: 15_000 }).catch(() => {});
  }

  /**
   * Espera a que el calendario quede dibujado.
   *
   * Lo arma `serie-tour.js` en el cliente, con las tarifas que el servidor inyecta
   * despues del load: hasta que eso pasa, la grilla esta vacia y el esqueleto de
   * carga visible. Leerla antes devuelve cero salidas y parece un circuito sin
   * disponibilidad.
   */
  private async esperarCalendario() {
    await this.page.waitForFunction(() => {
      const grilla = document.querySelector('#scalGrid');
      const cargando = document.querySelector('#scalLoading') as HTMLElement | null;
      const visibleElCargando = !!cargando && getComputedStyle(cargando).display !== 'none';
      return !!grilla && grilla.querySelectorAll('.scal-cell').length > 0 && !visibleElCargando;
    }, undefined, { timeout: 60_000 });
  }

  /**
   * Espera a que el resumen quede con una cantidad de habitaciones.
   *
   * Agregar y quitar habitaciones son postbacks que redibujan el resumen: la
   * cantidad de filas es la senial exacta de que termino, y ademas es lo que se va
   * a leer despues.
   */
  private async esperarHabitaciones(cantidad: number) {
    await this.page.waitForFunction(
      (esperada) => document.querySelectorAll('.rooms-detail-row').length === esperada,
      cantidad, { timeout: 30_000 });
  }

  /** Abre el listado de series. Se entra por URL: el portal no lo enlaza. */
  async abrirListado() {
    await this.page.goto('/online/serieall.aspx');
    await esperarFinDeCarga(this.page);
  }

  /** Nombres de las series que ofrece el listado. */
  async seriesDelListado(): Promise<string[]> {
    return (await this.page.locator('.serie-card-title').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Entra al detalle de una serie desde su card, como haria una persona. */
  async abrirSerie(nombre: string) {
    const card = this.page.locator('.serie-card').filter({ hasText: nombre }).first();
    await expect(card, `El listado tiene que ofrecer la serie ${nombre}`)
      .toBeVisible({ timeout: 60_000 });
    await card.locator('a.serie-card-btn').first().click();
    await this.page.waitForURL(/seriedetail/i, { timeout: 60_000 });
    await esperarFinDeCarga(this.page);
  }

  /**
   * Nombres de los circuitos que ofrece la serie.
   *
   * La card del circuito es `.sd-tour-card`, no `.serie-card`: son dos disenios
   * distintos aunque las dos pantallas se parezcan.
   */
  async circuitosDeLaSerie(): Promise<string[]> {
    return (await this.page.locator('.sd-tour-name').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Entra al asistente de un circuito desde su card. */
  async abrirCircuito(nombre: string) {
    const card = this.page.locator('.sd-tour-card').filter({ hasText: nombre }).first();
    await expect(card, `La serie tiene que ofrecer el circuito ${nombre}`)
      .toBeVisible({ timeout: 60_000 });
    await card.locator('a.serie-card-btn').first().click();
    await this.page.waitForURL(/serietour/i, { timeout: 60_000 });
    await esperarFinDeCarga(this.page);
    // El calendario se dibuja despues del load, con las tarifas que inyecta el
    // servidor. Sin esperarlo se lee un calendario vacio.
    //
    // Se tolera que no llegue a dibujarse: un circuito sin disponibilidad abre sin
    // calendario, y ese es justamente uno de los estados que hay que poder mirar.
    await this.esperarCalendario().catch(() => {});
  }

  /**
   * Vuelve a entrar al asistente desde cero.
   *
   * El asistente guarda el paso, la fecha y las habitaciones en el ViewState, asi
   * que volver a pedir la pantalla lo devuelve al paso 1 sin nada elegido. Es lo
   * que hace una persona que quiere empezar de nuevo, y es la unica forma de
   * volver al paso 1 despues de haber cargado cuatro habitaciones.
   */
  async reabrirAsistente() {
    await this.page.goto(this.page.url().split('#')[0]);
    await esperarFinDeCarga(this.page);
    await this.esperarCalendario();
  }

  /** "Desde" que muestra la card de un circuito en el detalle de la serie. */
  async precioDesde(nombre: string): Promise<string> {
    const card = this.page.locator('.sd-tour-card').filter({ hasText: nombre }).first();
    const badge = card.locator('.serie-card-price-value').first();
    if (!(await badge.count())) return '';
    return (await badge.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Categorias de hoteleria que ofrece el asistente. */
  async categorias(): Promise<string[]> {
    await this.page.locator(this.comboCategoria).first().click();
    const opciones = this.page.locator(this.opcionesCategoria);
    await expect(opciones.first()).toBeVisible({ timeout: 30_000 });
    const nombres = (await opciones.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    await this.page.keyboard.press('Escape');
    return nombres;
  }

  /**
   * Elige una categoria de hoteleria.
   *
   * Hace postback: el servidor recalcula las salidas y las tarifas de esa
   * categoria. Con habitaciones ya cargadas abre antes un modal de confirmacion,
   * porque cambiar de categoria reinicia la seleccion.
   */
  async elegirCategoria(nombre: string) {
    await this.page.locator(this.comboCategoria).first().click();
    const opcion = this.page.locator(this.opcionesCategoria)
      .filter({ hasText: nombre }).first();
    await expect(opcion, `El asistente tiene que ofrecer la categoria ${nombre}`)
      .toBeVisible({ timeout: 30_000 });
    await opcion.click();
    await this.esperarPostback();
    // Cambiar de categoria reinyecta las tarifas y redibuja el calendario entero.
    await this.esperarCalendario();
  }

  /** Categoria que quedo elegida, tal como la muestra el combo. */
  async categoriaElegida(): Promise<string> {
    return (await this.page.locator(this.comboCategoria).first().innerText())
      .replace(/\s+/g, ' ').trim();
  }

  /** Mes que muestra el calendario ("Octubre 2026"). */
  async mesDelCalendario(): Promise<string> {
    return (await this.page.locator(this.etiquetaDelMes).first().innerText())
      .replace(/\s+/g, ' ').trim();
  }

  /** Salidas reservables del mes visible: fecha ISO y tarifa de la habitacion. */
  async salidasDelMes(): Promise<{ clave: string; tarifa: number }[]> {
    return this.page.locator(this.celdaConSalida).evaluateAll((celdas) =>
      celdas.map((c) => ({
        clave: c.getAttribute('data-key') || '',
        tarifa: Number(c.getAttribute('data-price')) || 0,
      })));
  }

  /**
   * Avanza de mes hasta encontrar una salida reservable y elige la primera.
   *
   * Devuelve la fecha en los dos formatos: el ISO que guarda el asistente y el
   * dd/MM/yyyy con el que despues hay que buscarla en el BackOffice.
   */
  async elegirPrimeraSalida(mesesAMirar = 14): Promise<{
    clave: string; fecha: string; tarifa: number; mes: string;
  }> {
    const recorridos: string[] = [];
    for (let i = 0; i < mesesAMirar; i++) {
      const mes = await this.mesDelCalendario();
      const salidas = await this.salidasDelMes();
      recorridos.push(`${mes}: ${salidas.length}`);
      if (salidas.length) {
        const primera = salidas[0];
        await this.page.locator(`${this.celdaConSalida}[data-key='${primera.clave}']`)
          .first().click();
        await expect(
          this.page.locator(this.fechaElegida),
          'Al elegir una salida el asistente tiene que mostrarla como fecha seleccionada',
        ).not.toBeEmpty({ timeout: 15_000 });
        const [anio, mm, dd] = primera.clave.split('-');
        return { clave: primera.clave, fecha: `${dd}/${mm}/${anio}`, tarifa: primera.tarifa, mes };
      }
      await this.pasarAlMesSiguiente(mes);
    }
    throw new Error(
      `El calendario no ofrecio ninguna salida reservable en ${mesesAMirar} meses. ` +
      `Salidas por mes: ${recorridos.join(' | ')}`,
    );
  }

  /**
   * Configura la ocupacion de la habitacion que se va a agregar.
   *
   * **Cada cambio en la cantidad de adultos hace postback**: las tarifas de la
   * serie son por ocupacion, asi que el calendario se redibuja con otros precios.
   * Hay que esperarlo en los dos sentidos —al subir y al bajar—, porque el
   * UpdatePanel reemplaza el DOM y TomSelect vuelve a montarse: sin esperar, el
   * click siguiente cae sobre un control que ya no esta enganchado.
   */
  async configurarOcupacion(opciones: { adultos: number; menores?: number; edades?: number[] }) {
    const menores = opciones.menores ?? 0;

    // Los steppers arrancan en 2 adultos y 0 menores. Se baja primero a 1 para
    // no chocar contra el tope de 4 ocupantes al subir con menores cargados.
    for (let i = 0; i < 3; i++) {
      if (Number(await this.page.locator(this.contadorMenores).innerText()) === 0) break;
      await this.page.locator(this.menosMenores).click();
    }
    for (let i = 0; i < 4; i++) {
      if (Number(await this.page.locator(this.contadorAdultos).innerText()) === 1) break;
      await this.page.locator(this.menosAdultos).click();
      await this.esperarPostback();
    }
    for (let i = 1; i < opciones.adultos; i++) {
      await this.page.locator(this.masAdultos).click();
      await this.esperarPostback();
    }
    for (let i = 0; i < menores; i++) await this.page.locator(this.masMenores).click();

    for (const [i, edad] of (opciones.edades ?? []).entries()) {
      await this.elegirEdadDelMenor(i, edad);
    }
  }

  /**
   * Elige la edad de un menor en su combo.
   *
   * El combo es un TomSelect sin campo de busqueda, asi que se abre y se elige de
   * la lista. Se reintenta la apertura: el combo se remonta despues de cada
   * postback y el primer click puede llegar justo mientras se esta remontando.
   */
  private async elegirEdadDelMenor(indice: number, edad: number) {
    const combo = indice === 0 ? this.comboEdad1 : this.comboEdad2;
    const opcionesDelCombo = indice === 0 ? this.opcionesEdad1 : this.opcionesEdad2;
    const etiqueta = edad === 1 ? '1 a\u00f1o o menos' : `${edad} a\u00f1os`;

    const opcion = this.page.locator(opcionesDelCombo)
      .filter({ hasText: etiqueta }).first();

    for (let intento = 0; intento < 3; intento++) {
      await this.page.locator(combo).first().click();
      if (await opcion.isVisible({ timeout: 3_000 }).catch(() => false)) break;
    }

    await expect(opcion, `El combo de edad tiene que ofrecer "${etiqueta}"`)
      .toBeVisible({ timeout: 15_000 });
    await opcion.click();
  }

  /** Estado de los steppers, para exigir los topes de ocupacion. */
  async topesDeOcupacion(): Promise<{
    adultos: number; menores: number;
    masAdultos: boolean; menosAdultos: boolean; masMenores: boolean; menosMenores: boolean;
    aviso: string;
  }> {
    const deshabilitado = async (selector: string) =>
      await this.page.locator(selector).isDisabled();
    return {
      adultos: Number(await this.page.locator(this.contadorAdultos).innerText()),
      menores: Number(await this.page.locator(this.contadorMenores).innerText()),
      masAdultos: await deshabilitado(this.masAdultos),
      menosAdultos: await deshabilitado(this.menosAdultos),
      masMenores: await deshabilitado(this.masMenores),
      menosMenores: await deshabilitado(this.menosMenores),
      aviso: (await this.page.locator(this.errorDeHabitacion).first().innerText())
        .replace(/\s+/g, ' ').trim(),
    };
  }

  /**
   * Agrega la habitacion configurada. Hace postback.
   *
   * Se espera a que el resumen tenga una fila mas, que es la senial de que el
   * postback termino de redibujar. Cuando el servidor **rechaza** la habitacion
   * —sin cupo, o mas de cuatro— no aparece ninguna fila nueva y abre un modal en
   * su lugar: por eso la espera es tolerante y no rompe el caso negativo.
   */
  async agregarHabitacion() {
    const antes = await this.page.locator(this.filaDeHabitacion).count();
    await this.page.locator(this.botonAgregarHabitacion).first().click();
    await this.esperarPostback();
    await this.esperarHabitaciones(antes + 1).catch(() => {});
  }

  /** Lineas de las habitaciones agregadas, tal como las muestra el resumen. */
  async habitacionesDelResumen(): Promise<string[]> {
    return (await this.page.locator(this.filaDeHabitacion).allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Lo que muestra el resumen de la derecha: categoria, fecha, habitaciones, total. */
  async resumen(): Promise<Record<string, string>> {
    const leer = async (selector: string) => {
      const el = this.page.locator(selector).first();
      if (!(await el.count())) return '';
      return (await el.innerText()).replace(/\s+/g, ' ').trim();
    };
    return {
      categoria: await leer(this.categoriaDelResumen),
      fecha: await leer(this.fechaDelResumen),
      habitaciones: await leer('#spanResumenHabitaciones'),
      pasajeros: await leer('#spanResumenPax'),
      total: await leer(this.totalDelResumen),
      moneda: await leer('#spanResumenCur'),
    };
  }

  /** Avanza un paso. Hace postback y puede quedarse con un error de validacion. */
  async siguiente() {
    await this.page.locator(this.botonSiguiente).first().click();
    await this.esperarPostback();
  }

  /** Vuelve un paso. */
  async volver() {
    await this.page.locator(this.botonVolver).first().click();
    await this.esperarPostback();
  }

  /** Error de validacion del paso, vacio si el asistente avanzo. */
  async errorDelPasoActual(): Promise<string> {
    return (await this.page.locator(this.errorDelPaso).first().innerText())
      .replace(/\s+/g, ' ').trim();
  }

  /**
   * Carga un pasajero del paso 2.
   *
   * El bloque de pasajeros es un control por habitacion (`paxRoom_N`) con un
   * formulario por ocupante dentro. Ni el control ni el repeater tienen id
   * estatico, asi que se ubica por posicion: bloque de la habitacion, fila del
   * ocupante y los cinco campos en el orden en que estan escritos —nombre,
   * apellido, pasaporte, fecha de nacimiento y nacionalidad.
   */
  async completarPasajero(habitacion: number, ocupante: number, pax: Pasajero) {
    const bloque = this.page.locator(this.bloqueDePasajeros).nth(habitacion);
    await expect(
      bloque,
      `El paso de pasajeros tiene que traer el bloque de la habitacion ${habitacion + 1}`,
    ).toBeVisible({ timeout: 30_000 });

    const fila = bloque.locator('.row').nth(ocupante);
    const campos = fila.locator('input.form-control');
    await campos.nth(0).fill(pax.nombre);
    await campos.nth(1).fill(pax.apellido);
    await campos.nth(2).fill(pax.pasaporte);
    // La fecha se escribe con el formateo automatico del propio campo: se tipean
    // los digitos y el script mete las barras.
    await campos.nth(3).fill('');
    await campos.nth(3).pressSequentially(pax.nacimiento.replace(/\D/g, ''), { delay: 30 });
    await campos.nth(4).fill(pax.nacionalidad);
  }

  /** Etiquetas de los ocupantes de una habitacion ("Adulto 1", "Menor 1"). */
  async ocupantesDeLaHabitacion(habitacion: number): Promise<string[]> {
    return (await this.page.locator(this.bloqueDePasajeros).nth(habitacion)
      .locator('.prc-pax-label').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Titulo del bloque de cada habitacion en el paso de pasajeros. */
  async titulosDeLasHabitaciones(): Promise<string[]> {
    return (await this.page.locator('.prc-header-label').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Texto completo del resumen de confirmacion del paso 4. */
  async textoDelResumenFinal(): Promise<string> {
    const secciones = await this.page.locator('.step4-section').allInnerTexts();
    return secciones.join(' | ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Texto del modal de aviso, si esta abierto.
   *
   * Es un solo modal con dos variantes que dispara el servidor: "sin mas cupo"
   * cuando la salida se quedo sin lugar, y "reserva de grupo" al querer agregar
   * una quinta habitacion.
   */
  async textoDelModalDeCupo(): Promise<string> {
    const modal = this.page.locator(this.modalDeCupo);
    if (!(await modal.isVisible())) return '';
    return (await modal.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Cierra el modal de aviso con la cruz. */
  async cerrarModalDeCupo() {
    await this.page.locator('#cupoModalClose').first().click();
    await expect(this.page.locator(this.modalDeCupo)).toBeHidden({ timeout: 15_000 });
  }

  /** Tilda los terminos y condiciones del paso 4. */
  async aceptarTerminos() {
    await this.page.locator(this.checkTerminos).first().check();
    // El check habilita el boton por JavaScript (`syncTermsButton`).
    await expect(
      this.page.locator(this.botonSiguiente).first(),
      'Tildados los terminos, el boton de finalizar tiene que habilitarse',
    ).toBeEnabled({ timeout: 15_000 });
  }

  /**
   * Cupo, tarifas de menor y politica de menores que el servidor le inyecta al
   * calendario.
   *
   * `InyectarTarifasDesdeDB` escribe tres variables en la pantalla:
   * `liveCupos` —el cupo disponible del grupo por fecha—, `liveChildRates` —la
   * tarifa de menor por fecha, RateTypeID 20— y `serieKidsPolicy` —hasta que edad
   * el menor no paga y cual es la edad maxima del desplegable.
   *
   * Es lo que permite exigir el consumo de cupo sin mirar la base: se lee antes de
   * reservar y despues, y tiene que haber bajado tantas unidades como habitaciones
   * se reservaron.
   */
  async datosDelCalendario(): Promise<{
    cupos: Record<string, number>;
    tarifasDeMenor: Record<string, number>;
    politicaDeMenores: { freeMaxAge: number; childMaxAge: number };
  }> {
    return this.page.evaluate(() => {
      const w = window as any;
      return {
        cupos: w.liveCupos || {},
        tarifasDeMenor: w.liveChildRates || {},
        politicaDeMenores: w.serieKidsPolicy || { freeMaxAge: 0, childMaxAge: 0 },
      };
    });
  }

  /** Aviso de pocos cupos, vacio si no esta visible. Aparece con 5 o menos. */
  async textoDelAvisoDePocosCupos(): Promise<string> {
    const el = this.page.locator(this.avisoDePocosCupos);
    if (!(await el.isVisible().catch(() => false))) return '';
    return (await el.innerText()).replace(/\s+/g, ' ').trim();
  }

  /**
   * Cartel de "consultar por email", vacio si no esta visible.
   *
   * Lo muestra el asistente cuando la salida elegida no tiene tarifa para la
   * ocupacion pedida o se quedo sin cupo. Mientras esta visible, el boton de
   * avanzar queda deshabilitado.
   */
  async textoDelCartelDeConsulta(): Promise<string> {
    const el = this.page.locator(this.cartelDeConsulta);
    if (!(await el.isVisible().catch(() => false))) return '';
    return (await el.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Si el boton de avanzar esta deshabilitado en este momento. */
  async siguienteDeshabilitado(): Promise<boolean> {
    return this.page.locator(this.botonSiguiente).first().isDisabled();
  }

  /** Total de cada habitacion, tal como lo muestra el resumen. */
  async totalesPorHabitacion(): Promise<string[]> {
    return (await this.page.locator(this.totalDeLaHabitacion).allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Quita una habitacion del resumen con su "x". Hace postback. */
  async quitarLaHabitacion(indice: number) {
    const antes = await this.page.locator(this.filaDeHabitacion).count();
    await this.page.locator(this.quitarHabitacion).nth(indice).click();
    await this.esperarPostback();
    await this.esperarHabitaciones(antes - 1);
  }

  /**
   * Elige una salida concreta del calendario, avanzando de mes hasta encontrarla.
   *
   * A diferencia de `elegirPrimeraSalida`, sirve para las fechas preparadas con
   * cupo bajo o agotado, que estan al final del calendario.
   */
  async elegirSalida(clave: string, mesesAMirar = 14) {
    for (let i = 0; i < mesesAMirar; i++) {
      const celda = this.page.locator(`.scal-cell[data-key='${clave}']`).first();
      if (await celda.count()) {
        await celda.click();
        // Elegir una fecha no hace postback: lo unico que cambia es la pantalla,
        // y la senial es que la celda quede marcada como seleccionada.
        await expect(
          this.page.locator(`.scal-cell[data-key='${clave}'].selected`).first(),
          `La salida ${clave} tiene que quedar marcada como elegida`,
        ).toBeVisible({ timeout: 15_000 });
        return;
      }
      await this.pasarAlMesSiguiente(await this.mesDelCalendario());
    }
    throw new Error(`El calendario no llego a mostrar la salida ${clave} en ${mesesAMirar} meses.`);
  }

  /**
   * Pasa al mes siguiente del calendario.
   *
   * El redibujo es en el cliente y no dispara ninguna llamada, asi que la unica
   * senial de que termino es que **cambie la etiqueta del mes**.
   */
  private async pasarAlMesSiguiente(mesActual: string) {
    await this.page.locator(this.mesSiguiente).first().click();
    await this.page.waitForFunction(
      (anterior) => {
        const el = document.querySelector('#spanCalLabel') as HTMLElement | null;
        return !!el && el.innerText.replace(/\s+/g, ' ').trim() !== anterior;
      }, mesActual, { timeout: 15_000 });
  }

  /**
   * Abre el combo de categoria y elige otra **con habitaciones ya cargadas**.
   *
   * En ese caso el asistente no cambia de una: abre un modal avisando que se
   * pierde la seleccion. Este metodo deja el modal abierto; despues hay que
   * confirmar o cancelar.
   */
  async intentarCambiarCategoria(nombre: string) {
    await this.page.locator(this.comboCategoria).first().click();
    const opcion = this.page.locator(this.opcionesCategoria)
      .filter({ hasText: nombre }).first();
    await expect(opcion, `El asistente tiene que ofrecer la categoria ${nombre}`)
      .toBeVisible({ timeout: 30_000 });
    await opcion.click();
    await expect(
      this.page.locator(this.modalDeCategoria),
      'Con habitaciones cargadas, cambiar de categoria tiene que pedir confirmacion',
    ).toBeVisible({ timeout: 30_000 });
  }

  /** Texto del modal de cambio de categoria. */
  async textoDelModalDeCategoria(): Promise<string> {
    return (await this.page.locator(this.modalDeCategoria).innerText())
      .replace(/\s+/g, ' ').trim();
  }

  /** Cancela el cambio de categoria: la seleccion tiene que quedar como estaba. */
  async cancelarCambioDeCategoria() {
    await this.page.locator('#catResetCancel').first().click();
    await expect(this.page.locator(this.modalDeCategoria)).toBeHidden({ timeout: 15_000 });
    await this.esperarPostback();
  }

  /** Confirma el cambio de categoria: se reinicia fecha y habitaciones. */
  async confirmarCambioDeCategoria() {
    await this.page.locator('#catResetConfirm').first().click();
    await expect(this.page.locator(this.modalDeCategoria)).toBeHidden({ timeout: 15_000 });
    await this.esperarPostback();
    // Confirmar reinicia la seleccion: la senial de que el postback termino de
    // redibujar es que no quede ninguna habitacion en el resumen.
    await this.esperarHabitaciones(0);
  }

  /**
   * Vuelve al historial, en la solapa donde caen las reservas de circuito.
   *
   * Hace falta despues de volver al asistente para releer el cupo: el tramo del
   * BackOffice arranca desde el historial, y sin la solapa activa el link de la
   * reserva esta en el DOM pero oculto.
   */
  async abrirHistorialDeCircuitos() {
    await this.page.goto('/online/bookinghistory.aspx');
    await esperarFinDeCarga(this.page);
    const solapa = this.page.locator("a[href='#tabCustomTour']").first();
    if (await solapa.count()) {
      await solapa.click();
      await esperarFinDeCarga(this.page);
    }
  }

  /**
   * Confirma la reserva y devuelve su codigo.
   *
   * La confirmacion redirige al historial (`bookinghistory.aspx`), no muestra
   * ninguna pantalla de exito. La reserva de una serie es un circuito, asi que
   * cae en la solapa "Reservas circuitos".
   */
  async confirmarReserva(): Promise<string> {
    await this.page.locator(this.botonSiguiente).first().click();
    await this.page.waitForURL(/bookinghistory/i, { timeout: 300_000 });
    await esperarFinDeCarga(this.page);

    const solapa = this.page.locator("a[href='#tabCustomTour']").first();
    if (await solapa.count()) await solapa.click();

    const codigo = this.page
      .locator("#tabCustomTour a[href*='BookingHistoryDetail.aspx?book=']").first();
    await expect(codigo, 'El historial tiene que mostrar la reserva de la serie recien emitida')
      .toBeVisible({ timeout: 60_000 });
    return (await codigo.innerText()).trim();
  }
}
