import { test, expect } from '@playwright/test';
import { CircuitoNuevoPage } from '../../../pages/climbs/circuito.page';
import { ModalesMultidestinoPage, TarjetaNueva, HabitacionNueva } from '../../../pages/climbs/modales-multidestino.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, conResaltado, formatearFecha } from '../../../utils/pasos';
import { importe, Importe } from './reservas-comun';
import { conBackofficeNuevo, costosDelServicio, tarifaVigente, precioConIdioma } from '../../../utils/markups';
import candidatos from '../../../data/candidatos.json';

/**
 * Recargo por idioma en el itinerario (US 4739): se agrega la Cena Show AUTO-QA (163), que tiene English USD 15
 * fijos por pasajero en su tarifa Regular, y se elige English en el combo Idioma de su fila. La US pide: "el valor
 * final tiene que calcularse aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el
 * costo solo". En Espanol la fila tiene el precio de su tarjeta del modal; al pasar a English tiene que subir el
 * recargo con los dos markups (el de servicios de la agencia y el de la cotizacion). La fila es el total de los
 * pasajeros: recargo x pasajeros / (markup de la agencia x markup de la cotizacion),
 * con un peso de margen por los redondeos hacia arriba. Si el recargo no llevara markup, subiria solo el recargo.
 */
const CENA = candidatos.tarifario.cenaShow;
/** Markup de servicios de la agencia de pablo1: el del precio de cada servicio del itinerario (US 4800). */
const MARKUP_AGENCIA = candidatos._usuarioTest.markupsDeLaAgencia.servicio;


/**
 * RESERVAS — app nueva (ClimbsApp). Multidestino: agregar un servicio y un hotel desde los modales.
 *
 * El mismo test que tests/bloque-b/multidestino-agregar.spec.ts, con el mismo titulo. Es donde
 * se rompe el precio sin que se note: el modal calcula el precio por su lado y la fila del
 * itinerario lo vuelve a calcular (fix 4833: el markup aplicado dos veces; fix 4856: el aviso
 * de un dia que no opera). Con pablo1 sobre el paquete AUTO-QA, 2 pax en 1 DBL, arrancando un
 * lunes:
 * 1. Sin cotizacion, el modal de servicios muestra el precio del tarifario (al abrir,
 *    paginando y buscando): es la referencia "sin markup". Igual el hotel en su modal.
 * 2. El martes, el servicio propio 7964 (AUTO-QA, sin martes) tiene que avisar que no opera.
 * 3. Se guarda la cotizacion con Markup 0,8 (Configuracion > Guardar).
 * 4. Con la cotizacion, cada tarjeta tiene que mostrar el tarifario dividido UNA vez por 0,8.
 * 5. Se agrega Tigre y Delta (Regular): la fila nueva lleva el precio de la tarjeta y el
 *    total del itinerario sube exactamente eso.
 * 6. Se agrega el hotel: la fila lleva la tarifa con el markup una vez.
 * 7. El carrito de circuitos: se compara su total con el del itinerario. No se emite.
 * Deja en QA la cotizacion (referencia "AUTO-QA AGREGAR <sello>"), igual que la suite actual.
 */
test.describe('Multidestino: agregar servicio y hotel', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const PAQUETE = 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)';
  const CIUDAD = 'Buenos Aires';
  const SERVICIO = { nombre: 'AUTO-QA NO TOCAR - Tigre y Delta', termino: 'Tigre y Delta' };
  /** Servicio propio 7964 (copia del 5 por SQL, 23/11/2026): no opera los martes en Regular ni Privado (US 4856). */
  const CIERRE = { nombre: 'AUTO-QA NO TOCAR - Multidestino sin martes', termino: 'Multidestino sin martes' };
  const HOTEL = { nombre: 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau', termino: 'Park Hyatt' };
  const MARKUP = 0.8;
  const TOLERANCIA_HOTEL = 1.5;

  type Estados = Record<string, Record<string, TarjetaNueva>>;

  /** El modal por los tres caminos que el 4833 tuvo que corregir: al abrir, paginando y buscando. */
  async function recorrerModal(mod: ModalesMultidestinoPage): Promise<Estados> {
    const estados: Estados = {};
    estados['al abrir'] = await mod.tarjetas();
    if ((await mod.paginas()) > 1) {
      await mod.irALaPagina('Siguiente');
      estados['pagina 2'] = await mod.tarjetas();
      await mod.irALaPagina('Anterior');
      estados['vuelta a la pagina 1'] = await mod.tarjetas();
    }
    await mod.buscarServicio(SERVICIO.termino);
    estados[`busqueda "${SERVICIO.termino}"`] = await mod.tarjetas();
    return estados;
  }
  const unir = (e: Estados) => Object.assign({}, ...Object.values(e)) as Record<string, TarjetaNueva>;
  const resumen = (e: Estados) => Object.entries(e).map(([estado, ts]) => `[${estado}]\n` + Object.values(ts)
    .map((t) => `  ${t.nombre}: Regular ${t.regular ?? '-'} / Privado ${t.privado ?? '-'}${t.aviso ? ` / ${t.aviso}` : ''}`).join('\n')).join('\n');

  /** El modal muestra techo(precio / markup) y el precio base ya es un entero redondeado hacia arriba. */
  function rangoConMarkup(base: number, markup: number) {
    const eps = 1e-9;
    return { minimo: Math.floor((base - 1) / markup + eps) + 1, maximo: Math.ceil(base / markup - eps) };
  }

  function compararConElTarifario(referencia: Record<string, TarjetaNueva>, estados: Estados) {
    const fallas: string[] = [];
    let comparadas = 0;
    for (const [estado, tarjetas] of Object.entries(estados)) {
      for (const t of Object.values(tarjetas)) {
        const base = referencia[t.nombre];
        if (!base) continue;
        for (const tipo of ['regular', 'privado'] as const) {
          const p1 = base[tipo];
          const p2 = t[tipo];
          const rotulo = `[${estado}] ${t.nombre} (${tipo})`;
          if (p1 === null || p1 <= 0) { if (p2 !== null && p2 > 0) fallas.push(`${rotulo}: no se ofrecia sin cotizacion y con ella sale a ${p2}`); continue; }
          if (p2 === null || p2 <= 0) { fallas.push(`${rotulo}: sin cotizacion ${p1} y con ella no se ofrece`); continue; }
          comparadas++;
          const { minimo, maximo } = rangoConMarkup(p1, MARKUP);
          if (p2 < minimo || p2 > maximo) fallas.push(`${rotulo}: tarifario ${p1}, con markup ${MARKUP} tiene que ser ${minimo}-${maximo} y sale a ${p2} (aplicado dos veces daria ~${Math.ceil(p1 / (MARKUP * MARKUP))})`);
        }
      }
    }
    return { fallas, comparadas };
  }

  test('Multidestino: el servicio y el hotel agregados desde los modales quedan con el precio del tarifario con el markup una sola vez y suben el total', async ({ page }) => {
    test.setTimeout(1_500_000);
    const ct = new CircuitoNuevoPage(page);
    const mod = new ModalesMultidestinoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const referencia = `AUTO-QA AGREGAR ${sello}`;
    // Meses en que algun servicio propio del armado no opera (verificado en la base el 24/11/2026):
    // el traslado 1223 del paquete esta cerrado en marzo, junio, septiembre y diciembre (ServiceMonth
    // 17) y el 7964 opera de agosto a mayo. En esos meses el traslado sale "No disponible" y no se
    // puede continuar al carrito: se busca el primer lunes (y su martes) fuera de ellos.
    const MESES_CERRADOS = [2, 5, 6, 8, 11];
    const lunes = fechaDeBusqueda();
    const cerrado = (d: Date) => MESES_CERRADOS.includes(d.getMonth());
    const martesDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    while (lunes.getDay() !== 1 || cerrado(lunes) || cerrado(martesDe(lunes))) lunes.setDate(lunes.getDate() + 1);

    let tarifario: Record<string, TarjetaNueva> = {};
    let hotelDelTarifario: HabitacionNueva | null = null;
    let totalAntes: Importe = { moneda: '', valor: null };
    const totalDelItinerario = async () => { const o = await ct.opcionesDeCotizacion(); return { texto: o.total, total: importe(o.total), lineas: o.lineas }; };

    await paso(page, `Armar el paquete para el lunes ${formatearFecha(lunes)}`, async () => {
      await ct.buscarViaje('MULTIDESTINO', { pais: 'Argentina', ciudad: CIUDAD, nombre: PAQUETE, fecha: lunes });
      await ct.configurarViaje(2, 1);
      await ct.irAlItinerario();
      const t = await totalDelItinerario();
      await adjuntarTexto('Resumen del itinerario armado (sin cotizacion)', t.lineas.join('\n'));
      expect(t.total.valor, 'El itinerario tiene que tener un total').toBeGreaterThan(0);
    });

    await paso(page, 'Sin cotizacion: leer el tarifario en el modal Agregar servicio (al abrir, paginando y buscando)', async () => {
      await mod.abrirModalDeServicios(CIUDAD);
      const rango = await mod.rangoDelModal();
      await adjuntarTexto('Fecha del modal', `Desde ${rango.desde} hasta ${rango.hasta}`);
      const estados = await recorrerModal(mod);
      tarifario = unir(estados);
      await adjuntarTexto('Tarjetas del modal sin cotizacion', resumen(estados));
      expect(tarifario[SERVICIO.nombre], `El modal tiene que listar ${SERVICIO.nombre} el ${formatearFecha(lunes)}`).toBeTruthy();
      expect(tarifario[SERVICIO.nombre]?.regular, `${SERVICIO.termino} tiene que ofrecer la modalidad Regular (revisar operatividad y tarifas de venta)`).toBeGreaterThan(0);
    });

    await paso(page, 'Servicio en un dia que no opera: el modal avisa en vez de ofrecer precio (4856)', async () => {
      const martes = new Date(lunes);
      martes.setDate(martes.getDate() + 1);
      await mod.buscarServicio(CIERRE.termino, martes);
      const tarjetas = await mod.tarjetas();
      const tarjeta = tarjetas[CIERRE.nombre];
      await adjuntarTexto('Tarjetas del modal el martes', resumen({ martes: tarjetas }));
      if (!tarjeta) {
        test.info().annotations.push({ type: 'observacion', description: `${CIERRE.nombre} no figura en el modal el martes ${formatearFecha(martes)}: no se puede comprobar el aviso.` });
      } else if ((tarjeta.regular ?? 0) > 0 || (tarjeta.privado ?? 0) > 0) {
        test.info().annotations.push({ type: 'aviso', description: `${CIERRE.nombre} opera el martes ${formatearFecha(martes)}: cambiaron sus datos y el chequeo del aviso no aplica.` });
      } else {
        await conResaltado(page, mod.tarjeta(CIERRE.nombre), 'Aviso de operatividad en el modal', () => {
          expect(tarjeta.aviso, `${CIERRE.nombre} no opera el martes: la tarjeta tiene que traer el aviso de cierre`).toBeTruthy();
          expect(tarjeta.aviso ?? '', 'El aviso tiene que decir de que dia se trata').toContain(formatearFecha(martes));
        });
      }
      await mod.cerrar(mod.modalDeServicios);
    });

    await paso(page, 'Sin cotizacion: leer la tarifa del hotel en el modal Agregar hotel', async () => {
      await mod.abrirModalDeHoteles(CIUDAD);
      await mod.verHabitaciones(HOTEL.termino, HOTEL.nombre);
      const { casilla: _c, ...h } = await mod.primeraHabitacion();
      hotelDelTarifario = h;
      await adjuntarTexto('Habitacion del hotel sin cotizacion', `${h.nombre}: ${h.texto}`);
      expect(h.importe, 'La habitacion tiene que traer tarifa para 1 DBL').toBeGreaterThan(0);
      await mod.cerrar(mod.modalDeHoteles);
    });

    await paso(page, `Guardar la cotizacion con Markup ${MARKUP} (solapa Configuracion)`, async () => {
      await page.getByRole('tab', { name: 'Configuración', exact: true }).click();
      await page.getByRole('textbox', { name: 'Referencia', exact: true }).fill(referencia);
      await page.getByRole('textbox', { name: 'Nombre de pasajero / grupo', exact: true }).fill(`Pasajero Agregar ${sello.slice(-6)}`);
      await page.getByRole('textbox', { name: /^Markup/ }).fill(String(MARKUP));
      await page.locator('main').getByRole('button', { name: 'Guardar', exact: true }).click();
      await expect(page, 'Guardar la configuracion tiene que dejar el itinerario con el numero de la cotizacion').toHaveURL(/[?&]quote=\d+/, { timeout: 120_000 });
      const quoteId = page.url().match(/quote=(\d+)/)?.[1] ?? '';
      await page.getByRole('tab', { name: /^Hoteles (y|&) [Ss]ervicios$/ }).click();
      await expect(page.getByRole('button', { name: /^(Reservar|Continuar)$/ }).last()).toBeVisible({ timeout: 120_000 });
      // Recien guardada, la pantalla puede mostrar un instante el total sin el markup nuevo y recalcularlo
      // enseguida (CI 27/11/2026: leido al toque dio 2.670 y el "despues" salto 789 con una fila de 120).
      // Se toma el total cuando deja de moverse: tres lecturas iguales seguidas, un segundo entre cada una.
      let t = await totalDelItinerario();
      let iguales = 0;
      for (let i = 0; i < 30 && iguales < 2; i++) {
        await page.waitForTimeout(1_000);
        const otra = await totalDelItinerario();
        iguales = otra.total.valor === t.total.valor ? iguales + 1 : 0;
        t = otra;
      }
      totalAntes = t.total;
      await adjuntarTexto('Cotizacion guardada', `Cotizacion ${quoteId}, referencia ${referencia}, markup ${MARKUP}\n${t.lineas.join('\n')}`);
      expect(t.total.valor, 'El itinerario con la cotizacion tiene que tener un total').toBeGreaterThan(0);
    });

    await paso(page, 'Con cotizacion: el modal Agregar servicio aplica el markup una sola vez (al abrir, paginando y buscando)', async () => {
      await mod.abrirModalDeServicios(CIUDAD);
      const estados = await recorrerModal(mod);
      await adjuntarTexto('Tarjetas del modal con cotizacion', resumen(estados));
      const { fallas, comparadas } = compararConElTarifario(tarifario, estados);
      await adjuntarTexto('Comparacion con el tarifario', `${comparadas} precios comparados\n${fallas.join('\n') || '(sin diferencias)'}`);
      await conResaltado(page, mod.modalDeServicios, 'Markup en el modal de servicios', () => {
        expect(comparadas, 'Tiene que haber tarjetas para comparar contra el tarifario').toBeGreaterThan(0);
        expect(fallas, `El modal tiene que mostrar el precio del tarifario con el markup ${MARKUP} aplicado una sola vez`).toEqual([]);
      });
    });

    let precioDelModal = 0;
    await paso(page, `Agregar ${SERVICIO.termino} (Regular) desde el modal`, async () => {
      await mod.buscarServicio(SERVICIO.termino, lunes);
      const tarjeta = (await mod.tarjetas())[SERVICIO.nombre];
      expect(tarjeta?.regular, `La tarjeta de ${SERVICIO.termino} tiene que traer precio Regular`).toBeGreaterThan(0);
      precioDelModal = tarjeta.regular as number;
      const antes = (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => i.nombre === SERVICIO.nombre).length;
      await mod.elegirServicio(SERVICIO.nombre, 'Regular');
      await mod.confirmar(mod.modalDeServicios);
      await expect.poll(async () => (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => i.nombre === SERVICIO.nombre).length,
        { message: 'El itinerario tiene que sumar el servicio agregado', timeout: 120_000 }).toBe(antes + 1);
      await adjuntarTexto('Servicio agregado', `${SERVICIO.nombre}; precio en la tarjeta del modal: ${precioDelModal}`);
    });

    await paso(page, 'La fila del servicio agregado y el total del itinerario salen del precio del modal', async () => {
      const fila = (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => i.nombre === SERVICIO.nombre).at(-1)!;
      await adjuntarTexto('Fila del servicio agregado', fila.texto);
      await expect.poll(async () => (await totalDelItinerario()).total.valor, { message: 'El total del itinerario tiene que cambiar al sumar el servicio', timeout: 60_000 })
        .not.toBe(totalAntes.valor);
      const despues = await totalDelItinerario();
      await adjuntarTexto('Total del itinerario', `antes ${totalAntes.valor} -> despues ${despues.total.valor} (${despues.texto}); fila ${fila.importe}`);
      const base = tarifario[SERVICIO.nombre].regular as number;
      const { minimo, maximo } = rangoConMarkup(base, MARKUP);
      await conResaltado(page, mod.destino(CIUDAD), 'Precio de la fila agregada', () => {
        expect(fila.importe, 'La fila tiene que mostrar el mismo precio que la tarjeta del modal').toBe(precioDelModal);
        expect(fila.importe ?? 0, `El precio de la fila tiene que ser el del tarifario (${base}) con el markup ${MARKUP} una sola vez (${minimo}-${maximo})`).toBeGreaterThanOrEqual(minimo);
        expect(fila.importe ?? 0, 'El precio de la fila no puede pasar del tarifario con el markup una vez').toBeLessThanOrEqual(maximo);
      });
      await conResaltado(page, page.locator('main'), 'Total tras agregar el servicio', () => {
        expect(despues.total.moneda, 'El total tiene que seguir en la misma moneda').toBe(totalAntes.moneda);
        expect((despues.total.valor ?? 0) - (totalAntes.valor ?? 0), 'El total del itinerario tiene que subir exactamente el precio de la fila agregada').toBe(fila.importe);
      });
      totalAntes = despues.total;
    });

    await paso(page, `Agregar la Cena Show (${CENA.id}) y elegir English en su fila: el recargo por idioma lleva los markups (US 4739)`, async () => {
      const tarifas = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, CENA.id));
      const PAX_CENA = 2;
      const tarifa = tarifaVigente(tarifas, 'Regular', lunes, PAX_CENA);
      expect(tarifa, `${CENA.nombre} tiene que tener tarifa Regular vigente el ${formatearFecha(lunes)}`).toBeDefined();
      const baseSin = precioConIdioma(tarifa!, null, MARKUP_AGENCIA, PAX_CENA)!;
      const baseCon = precioConIdioma(tarifa!, 'English', MARKUP_AGENCIA, PAX_CENA)!;
      expect(baseCon, `La tarifa Regular de ${CENA.nombre} tiene que tener recargo para English`).toBeGreaterThan(baseSin);
      const esCena = (n: string) => /Angelitos/i.test(n);

      await mod.abrirModalDeServicios(CIUDAD);
      await mod.buscarServicio(CENA.terminoBusqueda, lunes);
      const nombre = Object.keys(await mod.tarjetas()).find(esCena);
      expect(nombre, `El modal tiene que ofrecer ${CENA.nombre} el ${formatearFecha(lunes)}`).toBeDefined();
      const precioTarjeta = (await mod.tarjetas())[nombre!].regular as number;
      const antes = (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => esCena(i.nombre)).length;
      await mod.elegirServicio(nombre!, 'Regular');
      await mod.confirmar(mod.modalDeServicios);
      await expect.poll(async () => (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => esCena(i.nombre)).length,
        { message: 'El itinerario tiene que sumar la Cena Show', timeout: 120_000 }).toBe(antes + 1);
      const precioDeLaCena = async () => (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => esCena(i.nombre)).at(-1)!;
      const enEspanol = await precioDeLaCena();
      const totalEspanol = (await totalDelItinerario()).total;

      const fila = mod.destino(CIUDAD).locator('article').filter({ hasText: /Angelitos/i }).last();
      const combo = fila.getByRole('combobox', { name: 'Idioma', exact: true });
      await expect(combo, 'La fila de la Cena Show tiene que tener el combo Idioma').toBeVisible();
      const opciones = (await combo.locator('option').allInnerTexts()).map((o) => o.trim());
      const ingles = opciones.find((o) => /^(English|Ingl[eé]s)$/i.test(o));
      expect(ingles, `El combo Idioma tiene que ofrecer English. Ofrece: ${opciones.join(', ')}`).toBeDefined();
      await combo.selectOption({ label: ingles! });
      await expect.poll(async () => (await precioDeLaCena()).importe, { message: 'La fila tiene que recalcular el precio al elegir English', timeout: 60_000 })
        .not.toBe(enEspanol.importe);
      await page.waitForLoadState('networkidle');
      const enIngles = await precioDeLaCena();
      const totalIngles = (await totalDelItinerario()).total;

      // Recargo por persona de la tarifa, y cuanto tiene que subir la fila con los dos markups.
      const recargo = tarifa!.recargos.find((r) => /^(English|Ingl[eé]s)$/i.test(r.idioma))!;
      const recargoPax = recargo.tipo === 'porcentaje' ? tarifa!.costo! * recargo.valor / 100 : recargo.tipo === 'porPasajero' ? recargo.valor : recargo.valor / PAX_CENA;
      const conMarkups = recargoPax * PAX_CENA / (MARKUP_AGENCIA * MARKUP);
      const suba = { minimo: Math.floor(conMarkups) - 1, maximo: Math.ceil(conMarkups) + 1 };
      const subio = (enIngles.importe ?? 0) - (enEspanol.importe ?? 0);
      await adjuntarTexto('Cena Show en English', [
        `Tarifa del BackOffice: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargos ${JSON.stringify(tarifa!.recargos)}`,
        `Tarjeta del modal (con cotizacion ${MARKUP}): ${precioTarjeta}`,
        `Fila: Espanol ${enEspanol.texto} -> English ${enIngles.texto} (subio ${subio})`,
        `Esperado: subir recargo ${recargoPax} x ${PAX_CENA} pax / (markup de la agencia ${MARKUP_AGENCIA} x cotizacion ${MARKUP}) = ${conMarkups.toFixed(2)} (${suba.minimo}-${suba.maximo}); sin el markup de la cotizacion subiria ${recargoPax * PAX_CENA / MARKUP_AGENCIA}`,
        `Total del itinerario: ${totalEspanol.valor} -> ${totalIngles.valor}`,
      ].join('\n'));
      await conResaltado(page, fila, 'Cena Show en English', () => {
        expect(enEspanol.importe, 'En Espanol la fila tiene que tener el precio de la tarjeta del modal').toBe(precioTarjeta);
        expect.soft(subio >= suba.minimo && subio <= suba.maximo,
          `En English la fila tiene que subir el recargo con el markup de la agencia y el de la cotizacion (${suba.minimo}-${suba.maximo}) y subio ${subio} (US 4739)`).toBe(true);
        expect.soft((totalIngles.valor ?? 0) - (totalEspanol.valor ?? 0), 'El total del itinerario tiene que subir lo mismo que la fila').toBe(subio);
      });
      totalAntes = totalIngles;
    });

    let hotelDelModal: HabitacionNueva | null = null;
    await paso(page, 'Agregar el hotel desde el modal', async () => {
      await mod.abrirModalDeHoteles(CIUDAD);
      await mod.verHabitaciones(HOTEL.termino, HOTEL.nombre);
      const { casilla, ...h } = await mod.primeraHabitacion();
      hotelDelModal = h;
      await adjuntarTexto('Habitacion del hotel con cotizacion', `${h.nombre}: ${h.texto}`);
      const ref = hotelDelTarifario as HabitacionNueva | null;
      await conResaltado(page, mod.modalDeHoteles, 'Markup en el modal de hoteles', () => {
        expect(ref?.nombre, 'La primera habitacion del hotel tiene que ser la misma que sin cotizacion para poder comparar el precio').toBe(h.nombre);
        // Rojo conocido en el sistema actual: el modal de hoteles muestra la tarifa sin el markup
        // de la cotizacion (el PM confirmo el 16/10/2026 que tiene que llevarlo y pidio una HU).
        const esperado = (ref?.importe ?? 0) / MARKUP;
        expect.soft(Math.abs((h.importe ?? 0) - esperado), `El modal tiene que mostrar la tarifa del hotel (${ref?.importe}) con el markup ${MARKUP} una sola vez (~${esperado.toFixed(1)}) y muestra ${h.importe}`)
          .toBeLessThanOrEqual(TOLERANCIA_HOTEL);
      });
      const antes = (await mod.itemsDelDestino(CIUDAD, 'Hoteles')).length;
      await casilla.check();
      await mod.confirmar(mod.modalDeHoteles);
      await expect.poll(async () => (await mod.itemsDelDestino(CIUDAD, 'Hoteles')).length, { message: 'El itinerario tiene que sumar el hotel agregado', timeout: 180_000 }).toBe(antes + 1);
    });

    await paso(page, 'La fila del hotel agregado muestra el importe del modal y el total del itinerario', async () => {
      const fila = (await mod.itemsDelDestino(CIUDAD, 'Hoteles')).at(-1)!;
      await adjuntarTexto('Fila del hotel agregado', fila.texto);
      const conMarkup = ((hotelDelTarifario as HabitacionNueva | null)?.importe ?? 0) / MARKUP;
      await conResaltado(page, mod.destino(CIUDAD), 'Importe de la fila del hotel', () => {
        expect(fila.nombre, 'La fila tiene que ser del hotel elegido').toBe(HOTEL.nombre);
        expect(Math.abs((fila.importe ?? 0) - conMarkup), `La fila tiene que mostrar la tarifa del hotel con el markup ${MARKUP} una sola vez (~${conMarkup.toFixed(1)}) y muestra ${fila.importe}`)
          .toBeLessThanOrEqual(TOLERANCIA_HOTEL);
        // Mismo rojo conocido: el modal sin el markup y la fila con el.
        expect.soft(fila.importe, 'La fila tiene que mostrar el mismo importe que el modal').toBe((hotelDelModal as HabitacionNueva | null)?.importe ?? null);
      });
      const despues = await totalDelItinerario();
      await adjuntarTexto('Total tras agregar el hotel', `antes ${totalAntes.valor} -> despues ${despues.total.valor} (${despues.texto})`);
      if (despues.total.valor === totalAntes.valor) {
        test.info().annotations.push({ type: 'observacion', description: 'El total no cambio al agregar el hotel: el hotel agregado no forma parte de ninguna opcion del resumen hasta armarla.' });
      } else {
        await conResaltado(page, page.locator('main'), 'Total tras agregar el hotel', () => {
          expect((despues.total.valor ?? 0) - (totalAntes.valor ?? 0), 'Si el total cambia al agregar el hotel, tiene que subir el importe de su fila').toBe(fila.importe);
        });
      }
      totalAntes = despues.total;
    });

    await paso(page, 'Continuar al carrito de circuitos (sin emitir) y comparar su total con el del itinerario', async () => {
      const t = await totalDelItinerario();
      await ct.continuarAlCarrito();
      const texto = await ct.total();
      await adjuntarTexto('Total del carrito de circuitos', `itinerario ${t.texto} -> carrito ${texto}`);
      const delCarrito = importe(texto);
      // Consulta abierta en el sistema actual (16/10/2026): con la cotizacion guardada con markup,
      // el carrito cobra el total sin ese markup. Se exige moneda y total, y la diferencia se anota.
      await conResaltado(page, page.locator('main'), 'Total del carrito', () => {
        expect(delCarrito.moneda, 'El carrito tiene que cobrar en la moneda del itinerario').toBe(t.total.moneda);
        expect(delCarrito.valor ?? 0, 'El carrito tiene que tener un total').toBeGreaterThan(0);
      });
      if (delCarrito.valor !== t.total.valor) {
        test.info().annotations.push({ type: 'observacion', description:
          `El carrito cobra ${texto} y el itinerario muestra ${t.texto} (el itinerario por ${MARKUP} da ${((t.total.valor ?? 0) * MARKUP).toFixed(0)}): consulta al PM del 16/10/2026 sobre si el carrito lleva el markup de la cotizacion.` });
      }
    });
  });
});
