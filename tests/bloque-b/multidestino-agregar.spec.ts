import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { CustomToursPage } from '../../pages/customtours.page';
import { CarritoCustomToursPage } from '../../pages/carrito-customtours.page';
import {
  ModalesCustomToursPage, TarjetaDeServicio, HabitacionDeHotel,
} from '../../pages/customtours-modales.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, conResaltado,
} from '../../utils/pasos';
import { importeDelPortal } from './reservas-comun';

/**
 * BLOQUE B — Multidestino: agregar un servicio y un hotel desde los modales.
 *
 * Es de lo que mas usa la agencia al armar el viaje (cada cotizacion termina con alguien
 * sumando o cambiando un servicio) y es donde se rompe el precio sin que se note: el
 * modal calcula el precio por su lado y la fila del itinerario lo vuelve a calcular. El
 * fix 4833 (efa5d0c7) arreglo que el modal aplicara dos veces el markup de la cotizacion
 * al buscar y paginar, y el 4856 (a000e79b) hizo que un servicio en un dia que no opera
 * se avise en vez de mostrarse con un precio. Ninguno de los dos lo cubria un test.
 *
 * Con pablo1 sobre el paquete AUTO-QA 5059 (Buenos Aires y Ushuaia), 2 pax en 1 DBL:
 * 1. Arma el viaje (arranca un lunes, para que Buenos Aires incluya un martes).
 * 2. Sin cotizacion el markup del modal es 1: se lee ahi el precio del tarifario de cada
 *    tarjeta (al abrir, paginando y buscando). Es la referencia "sin markup".
 * 3. Dia que no opera (4856): con la fecha del modal en el martes, el servicio 1 (City
 *    Tour Clasico, sin martes en Regular ni Privado) tiene que traer el aviso de cierre.
 * 4. Lee tambien la tarifa del hotel 5003 en el modal de hoteles (referencia del hotel).
 * 5. Guarda la cotizacion con Markup 0,8 (solapa CONFIGURACION > Guardar). Es lo que
 *    activa el markup en los modales: `CT_QuoteManager.LoadMarkUpByTourCustom` solo
 *    devuelve algo si el viaje ya tiene cotizacion.
 * 6. Con la cotizacion, el modal de servicios tiene que mostrar el precio del tarifario
 *    dividido UNA vez por 0,8 en cada tarjeta, al abrir, paginando y buscando (4833). El
 *    precio base es un entero ya redondeado hacia arriba, asi que se verifica contra un
 *    rango: aplicado dos veces daria ~25% mas y queda afuera del rango.
 * 7. Agrega Tigre y Delta (servicio 5, Regular): la fila nueva muestra el mismo precio
 *    que la tarjeta y el total del itinerario sube exactamente ese importe.
 * 8. Agrega el hotel 5003 desde su modal: el importe es el de la referencia dividido por
 *    0,8 y la fila nueva lo muestra igual que el modal.
 * 9. Continua al carrito de circuitos: el total es el del itinerario. No se emite.
 *
 * Deja en QA la cotizacion (`CT_Quote` con Reference `AUTO-QA AGREGAR <sello>`) y su viaje
 * (`CT_Tour`, `CT_City`, `CT_Service`, `CT_Group`, `CT_GroupService`): el portal no tiene
 * como borrarlas, solo se limpian por SQL por la referencia. Deja ademas el carrito de
 * circuitos de pablo1 con el viaje (igual que cotizacion-multidestino.spec.ts).
 */
test.describe('Multidestino: agregar servicio y hotel', () => {
  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  const PAQUETE = { id: '5059', ciudad: 'Buenos Aires', nombre: 'Paquete Buenos Aires y Ushuaia' };
  /** Tigre y Delta: servicio AUTO-QA, opera todos los dias del anio y tiene Regular y Privado. */
  const SERVICIO = { id: '5', termino: 'Tigre y Delta' };
  /** City Tour Clasico (no es AUTO-QA): habitual sin martes en Regular y Privado (medido el 13/10, US 4856). */
  const CIERRE = { id: '1', termino: 'City Tour' };
  const HOTEL = { id: '5003', termino: 'Park Hyatt' };
  const MARKUP = 0.8;
  const PAX = 2;
  const DOBLES = 1;
  /** Los importes de los modales salen de ToMoney() = "N0": el hotel se compara con esta tolerancia. */
  const TOLERANCIA_HOTEL = 1.5;

  /** El primer lunes desde la fecha: asi el primer destino (3 noches) incluye un martes. */
  function proximoLunes(desde: Date): Date {
    const d = new Date(desde);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    return d;
  }

  const comoSeVe = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  /** El total del resumen del itinerario: el ultimo importe del panel `.ct-sum`. */
  async function totalDelItinerario(ct: CustomToursPage) {
    const lineas = await ct.filaDeTotales();
    const conImporte = lineas.filter((c) => /[A-Z]{3}\s*\d[\d.,]*/.test(c));
    const texto = conImporte.at(-1) ?? '';
    return { lineas, texto, total: importeDelPortal(texto) };
  }

  type Estados = Record<string, Record<string, TarjetaDeServicio>>;

  /**
   * Recorre el modal de servicios por los tres caminos del servidor: el que lo abre
   * (`BindData`), el que pagina (`ChangePage`) y el que busca (`SearchCommand`). Son los tres
   * que el 4833 tuvo que corregir, porque cada uno recalcula las tarjetas por su cuenta.
   */
  async function recorrerModalDeServicios(mod: ModalesCustomToursPage): Promise<Estados> {
    const estados: Estados = {};
    estados['al abrir'] = await mod.tarjetas();
    const paginas = await mod.paginasDelModal();
    if (paginas.includes(2)) {
      await mod.irAPaginaDelModal(2);
      estados['pagina 2'] = await mod.tarjetas();
      await mod.irAPaginaDelModal(1);
      estados['vuelta a la pagina 1'] = await mod.tarjetas();
    }
    await mod.buscarServicio({ termino: SERVICIO.termino });
    estados[`busqueda "${SERVICIO.termino}"`] = await mod.tarjetas();
    return estados;
  }

  function unir(estados: Estados): Record<string, TarjetaDeServicio> {
    return Object.assign({}, ...Object.values(estados)) as Record<string, TarjetaDeServicio>;
  }

  function resumenDeEstados(estados: Estados): string {
    return Object.entries(estados).map(([estado, tarjetas]) =>
      `[${estado}]\n` + Object.values(tarjetas)
        .map((t) => `  ${t.id} ${t.nombre}: Regular ${t.regular ?? '-'} / Privado ${t.privado ?? '-'}`).join('\n'))
      .join('\n');
  }

  /**
   * Rango de precios con markup que admite un precio base entero.
   *
   * El modal muestra `Math.Ceiling(precio / markup)` y el precio base ya es
   * `Math.Ceiling(crudo)`: del base solo se sabe que `crudo` esta en (base - 1, base].
   */
  function rangoConMarkup(base: number, markup: number) {
    const eps = 1e-9;
    return { minimo: Math.floor((base - 1) / markup + eps) + 1, maximo: Math.ceil(base / markup - eps) };
  }

  /** Compara cada tarjeta con la de referencia (sin cotizacion) y lista las que no cierran. */
  function compararConElTarifario(referencia: Record<string, TarjetaDeServicio>, estados: Estados) {
    const fallas: string[] = [];
    let comparadas = 0;
    for (const [estado, tarjetas] of Object.entries(estados)) {
      for (const tarjeta of Object.values(tarjetas)) {
        const base = referencia[tarjeta.id];
        if (!base) continue;
        for (const tipo of ['regular', 'privado'] as const) {
          const p1 = base[tipo];
          const p2 = tarjeta[tipo];
          const rotulo = `[${estado}] ${tarjeta.id} ${tarjeta.nombre} (${tipo})`;
          if (p1 === null || p1 <= 0) {
            if (p2 !== null && p2 > 0) fallas.push(`${rotulo}: no se ofrecia sin cotizacion y con ella sale a ${p2}`);
            continue;
          }
          if (p2 === null || p2 <= 0) {
            fallas.push(`${rotulo}: sin cotizacion ${p1} y con ella no se ofrece`);
            continue;
          }
          comparadas++;
          const { minimo, maximo } = rangoConMarkup(p1, MARKUP);
          if (p2 < minimo || p2 > maximo) {
            fallas.push(`${rotulo}: tarifario ${p1}, con markup ${MARKUP} tiene que ser ${minimo}-${maximo} y sale a ${p2}`
              + ` (aplicado dos veces daria ~${Math.ceil(p1 / (MARKUP * MARKUP))})`);
          }
        }
      }
    }
    return { fallas, comparadas };
  }

  test('Multidestino: el servicio y el hotel agregados desde los modales quedan con el precio del tarifario con el markup una sola vez y suben el total', async ({ page }) => {
    test.setTimeout(1_500_000);
    const inicio = new InicioPage(page);
    const ct = new CustomToursPage(page);
    const carrito = new CarritoCustomToursPage(page);
    const mod = new ModalesCustomToursPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const referencia = `AUTO-QA AGREGAR ${sello}`;
    const fechaDelViaje = proximoLunes(fechaDeBusqueda());

    // Lo que se arrastra de un paso al otro.
    let tarifarioDeServicios: Record<string, TarjetaDeServicio> = {};
    let lunes = fechaDelViaje;
    let hotelDelTarifario: HabitacionDeHotel | null = null;
    let totalAntes = importeDelPortal('');
    let quoteId = '';

    await paso(page, `Armar el paquete ${PAQUETE.id} para el lunes ${comoSeVe(fechaDelViaje)}`, async () => {
      const panel = await inicio.abrirSolapa('multidestino');
      await ct.buscarPaquete(panel, { pais: 'Argentina', ciudad: PAQUETE.ciudad, paqueteId: PAQUETE.id });
      await ct.configurarViaje(fechaDelViaje, PAX, DOBLES);
      await ct.irAlItinerario();
      await mod.esperarCalma();
      const t = await totalDelItinerario(ct);
      await adjuntarTexto('Resumen del itinerario armado (sin cotizacion)', t.lineas.join('\n'));
      expect(t.total.valor, 'El itinerario tiene que tener un total').toBeGreaterThan(0);
      await mod.cerrarAvisoDeVariacion();
    });

    await paso(page, 'Sin cotizacion: leer el tarifario en el modal Agregar servicio (al abrir, paginando y buscando)', async () => {
      await mod.abrirModalDeServicios();
      const rango = await mod.rangoDelModal();
      lunes = rango.desde;
      await adjuntarTexto('Fecha del modal', `Desde ${comoSeVe(rango.desde)} hasta ${comoSeVe(rango.hasta)} (formato ${rango.formato})`);
      if (lunes.getDay() !== 1) {
        test.info().annotations.push({ type: 'aviso', description: `El primer destino arranca el ${comoSeVe(lunes)} y no un lunes: el chequeo del martes puede no caer dentro del destino.` });
      }
      const estados = await recorrerModalDeServicios(mod);
      tarifarioDeServicios = unir(estados);
      await adjuntarTexto('Tarjetas del modal sin cotizacion', resumenDeEstados(estados));
      const tigre = tarifarioDeServicios[SERVICIO.id];
      expect(tigre, `El modal tiene que listar el servicio ${SERVICIO.id} (${SERVICIO.termino}) el ${comoSeVe(lunes)}`).toBeTruthy();
      expect(tigre.regular, `${SERVICIO.termino} tiene que ofrecer la modalidad Regular el ${comoSeVe(lunes)} (revisar operatividad y tarifas de venta)`).toBeGreaterThan(0);
    });

    await paso(page, 'Servicio en un dia que no opera: el modal avisa en vez de ofrecer precio (4856)', async () => {
      const martes = new Date(lunes);
      martes.setDate(martes.getDate() + 1);
      const rango = await mod.rangoDelModal();
      expect(martes <= rango.hasta, 'El martes tiene que caer dentro del destino para poder elegirlo en el modal').toBe(true);

      await mod.buscarServicio({ termino: CIERRE.termino, fecha: martes });
      const tarjetas = await mod.tarjetas();
      const tarjeta = tarjetas[CIERRE.id];
      await adjuntarTexto('Tarjetas del modal el martes', Object.values(tarjetas)
        .map((t) => `${t.id} ${t.nombre}: Regular ${t.regular ?? '-'} / Privado ${t.privado ?? '-'} / aviso: ${t.avisoDeCierre ?? '(ninguno)'}`).join('\n'));

      if (!tarjeta) {
        test.info().annotations.push({ type: 'observacion', description: `El servicio ${CIERRE.id} no figura en el modal el martes ${comoSeVe(martes)}: no se puede comprobar el aviso (puede ser a proposito o un cambio en los datos).` });
      } else if ((tarjeta.regular ?? 0) > 0 || (tarjeta.privado ?? 0) > 0) {
        test.info().annotations.push({ type: 'aviso', description: `El servicio ${CIERRE.id} opera el martes ${comoSeVe(martes)} (Regular ${tarjeta.regular ?? '-'}, Privado ${tarjeta.privado ?? '-'}): cambiaron sus datos y el chequeo del aviso no aplica. Buscar otro servicio con martes cerrado.` });
      } else {
        await conResaltado(page, mod.tarjetaDeServicio(CIERRE.id), 'Aviso de operatividad en el modal', () => {
          expect(tarjeta.avisoDeCierre, `El servicio ${CIERRE.id} no opera el martes ${comoSeVe(martes)}: la tarjeta tiene que traer el aviso de cierre`).toBeTruthy();
          expect(tarjeta.avisoDeCierre ?? '', 'El aviso tiene que decir de que dia se trata').toContain(comoSeVe(martes));
        });
      }
      await mod.cerrarModalDeServicios();
    });

    await paso(page, `Sin cotizacion: leer la tarifa del hotel ${HOTEL.id} en el modal Agregar hotel`, async () => {
      await mod.abrirModalDeHoteles();
      await mod.buscarHotel(HOTEL.termino);
      const tarjeta = mod.tarjetaDeHotel(HOTEL.termino);
      await expect(tarjeta, `El modal tiene que listar el hotel ${HOTEL.id} (${HOTEL.termino})`).toBeVisible();
      await mod.expandirHotel(tarjeta);
      hotelDelTarifario = await mod.leerHabitacion(mod.habitacionDeHotel(tarjeta));
      await adjuntarTexto('Habitacion del hotel sin cotizacion', `${hotelDelTarifario.nombre}: ${hotelDelTarifario.texto}`);
      expect(hotelDelTarifario.importe, 'La habitacion tiene que traer tarifa para 1 DBL').toBeGreaterThan(0);
      await mod.cerrarModalDeHoteles();
    });

    await paso(page, `Guardar la cotizacion con Markup ${MARKUP} (solapa CONFIGURACION)`, async () => {
      await page.locator("a[href='#config']").first().click();
      await page.locator("[id$='txtReference']").fill(referencia);
      await page.locator("[id$='txtPaxName']").fill(`Pasajero Agregar ${sello.slice(-6)}`);
      await page.locator("[id$='txtMarkupCustom']").fill(String(MARKUP));
      // "Guardar" de la solapa (lnkGuardarConfig) guarda y vuelve al itinerario con &quote=N
      // (Detail.aspx.cs:4286); es el camino normal, el que no duplica la cotizacion.
      await page.locator("[id$='lnkGuardarConfig']").first().click();
      await page.waitForURL(/detail\.aspx.*quote=\d+/i, { timeout: 120_000 });
      quoteId = page.url().match(/quote=(\d+)/i)?.[1] ?? '';
      await mod.esperarCalma();
      const t = await totalDelItinerario(ct);
      totalAntes = t.total;
      await adjuntarTexto('Cotizacion guardada', `CT_Quote ${quoteId}, referencia ${referencia}, markup ${MARKUP}\n${t.lineas.join('\n')}`);
      expect(quoteId, 'Al guardar tiene que volver al itinerario con el numero de la cotizacion').toMatch(/^\d+$/);
      expect(t.total.valor, 'El itinerario con la cotizacion tiene que tener un total').toBeGreaterThan(0);
      await mod.cerrarAvisoDeVariacion();
    });

    await paso(page, 'Con cotizacion: el modal Agregar servicio aplica el markup una sola vez (al abrir, paginando y buscando)', async () => {
      await mod.abrirModalDeServicios();
      const estados = await recorrerModalDeServicios(mod);
      await adjuntarTexto('Tarjetas del modal con cotizacion', resumenDeEstados(estados));
      const { fallas, comparadas } = compararConElTarifario(tarifarioDeServicios, estados);
      await adjuntarTexto('Comparacion con el tarifario', `${comparadas} precios comparados\n${fallas.join('\n') || '(sin diferencias)'}`);
      await conResaltado(page, mod.modal(), 'Markup en el modal de servicios', () => {
        expect(comparadas, 'Tiene que haber tarjetas para comparar contra el tarifario').toBeGreaterThan(0);
        expect(fallas, `El modal tiene que mostrar el precio del tarifario con el markup ${MARKUP} aplicado una sola vez`).toEqual([]);
      });
    });

    let precioDelModal = 0;
    let idNuevo = '';
    await paso(page, `Agregar ${SERVICIO.termino} (Regular) desde el modal`, async () => {
      // Se vuelve a la busqueda: la tarjeta que se tilda es la que acaba de calcular el servidor.
      await mod.buscarServicio({ termino: SERVICIO.termino });
      const tarjeta = (await mod.tarjetas())[SERVICIO.id];
      expect(tarjeta?.regular, `La tarjeta de ${SERVICIO.termino} tiene que traer precio Regular`).toBeGreaterThan(0);
      precioDelModal = tarjeta.regular as number;

      await mod.elegirServicio(SERVICIO.id, 'regular');
      await expect(mod.rotuloDelBotonAgregarServicio(), 'El boton tiene que contar el servicio tildado').toContainText('(1)');

      const antes = await mod.idsDeServicios();
      await mod.confirmarServicios();
      await expect.poll(async () => (await mod.idsDeServicios()).length, {
        message: 'El itinerario tiene que sumar el servicio agregado', timeout: 120_000,
      }).toBe(antes.length + 1);
      const despues = await mod.idsDeServicios();
      const nuevos = despues.filter((id) => !antes.includes(id));
      expect(nuevos, 'Tiene que haber exactamente un servicio nuevo').toHaveLength(1);
      idNuevo = nuevos[0];
      await mod.esperarCalma();
      const aviso = await mod.cerrarAvisoDeVariacion();
      if (aviso) {
        test.info().annotations.push({ type: 'observacion', description: `Al agregar ${SERVICIO.termino} el itinerario mostro el aviso "${aviso}": el servidor recalculo un precio distinto del que guardo al agregarlo.` });
      }
      await adjuntarTexto('Servicio agregado', `CT_Service ${idNuevo}; precio en la tarjeta del modal: ${precioDelModal}`);
    });

    await paso(page, 'La fila del servicio agregado y el total del itinerario salen del precio del modal', async () => {
      const fila = mod.filaDeServicio(idNuevo);
      await expect(fila, 'La fila del servicio agregado tiene que figurar en el itinerario').toBeVisible();
      const precio = await mod.precioDeServicio(fila);
      await adjuntarTexto('Fila del servicio agregado', precio.texto);

      await expect.poll(async () => (await totalDelItinerario(ct)).total.valor, {
        message: 'El total del itinerario tiene que cambiar al sumar el servicio', timeout: 60_000,
      }).not.toBe(totalAntes.valor);
      const despues = await totalDelItinerario(ct);
      await adjuntarTexto('Total del itinerario', `antes ${totalAntes.valor} -> despues ${despues.total.valor} (${despues.texto}); fila ${precio.valor}`);

      const base = tarifarioDeServicios[SERVICIO.id].regular as number;
      const { minimo, maximo } = rangoConMarkup(base, MARKUP);
      await conResaltado(page, fila, 'Precio de la fila agregada', async () => {
        await expect(fila.locator('.ct-row__name'), 'La fila tiene que ser del servicio elegido').toContainText(SERVICIO.termino);
        expect(precio.valor, 'La fila tiene que mostrar el mismo precio que la tarjeta del modal').toBe(precioDelModal);
        expect(precio.valor ?? 0, `El precio de la fila tiene que ser el del tarifario (${base}) con el markup ${MARKUP} una sola vez (${minimo}-${maximo})`)
          .toBeGreaterThanOrEqual(minimo);
        expect(precio.valor ?? 0, 'El precio de la fila no puede pasar del tarifario con el markup una vez').toBeLessThanOrEqual(maximo);
      });
      await conResaltado(page, ct.tablaDeTotales(), 'Total tras agregar el servicio', () => {
        expect(despues.total.moneda, 'El total tiene que seguir en la misma moneda').toBe(totalAntes.moneda);
        expect((despues.total.valor ?? 0) - (totalAntes.valor ?? 0), 'El total del itinerario tiene que subir exactamente el precio de la fila agregada')
          .toBe(precio.valor);
      });
      totalAntes = despues.total;
    });

    let hotelDelModal: HabitacionDeHotel | null = null;
    let idHotelNuevo = '';
    await paso(page, `Agregar el hotel ${HOTEL.id} desde el modal`, async () => {
      await mod.abrirModalDeHoteles();
      await mod.buscarHotel(HOTEL.termino);
      const tarjeta = mod.tarjetaDeHotel(HOTEL.termino);
      await expect(tarjeta, `El modal tiene que listar el hotel ${HOTEL.id} (${HOTEL.termino})`).toBeVisible();
      await mod.expandirHotel(tarjeta);
      const habitacion = mod.habitacionDeHotel(tarjeta);
      hotelDelModal = await mod.leerHabitacion(habitacion);
      await adjuntarTexto('Habitacion del hotel con cotizacion', `${hotelDelModal.nombre}: ${hotelDelModal.texto}`);

      const referenciaDelHotel = hotelDelTarifario as HabitacionDeHotel | null;
      await conResaltado(page, mod.modalDeHotel(), 'Markup en el modal de hoteles', () => {
        expect(referenciaDelHotel && hotelDelModal && referenciaDelHotel.nombre === hotelDelModal.nombre,
          'La primera habitacion del hotel tiene que ser la misma que sin cotizacion para poder comparar el precio').toBe(true);
        // Rojo conocido: el modal de hoteles muestra la tarifa sin el markup de la cotizacion
        // (CC00054781: 1.500 en el modal, 1.875 en el itinerario). El PM confirmo el 16/10/2026
        // que tiene que llevarlo y pidio una HU de fix. Es blando para que el test siga y
        // compruebe el itinerario y el carrito.
        const esperado = (referenciaDelHotel?.importe ?? 0) / MARKUP;
        expect.soft(Math.abs((hotelDelModal?.importe ?? 0) - esperado),
          `El modal tiene que mostrar la tarifa del hotel (${referenciaDelHotel?.importe}) con el markup ${MARKUP} una sola vez (~${esperado.toFixed(1)}) y muestra ${hotelDelModal?.importe} (HU de fix pedida por el PM el 16/10/2026)`)
          .toBeLessThanOrEqual(TOLERANCIA_HOTEL);
      });

      await mod.elegirHabitacion(habitacion);
      const antes = await mod.idsDeHoteles();
      await mod.confirmarHoteles();
      await expect.poll(async () => (await mod.idsDeHoteles()).length, {
        message: 'El itinerario tiene que sumar el hotel agregado', timeout: 180_000,
      }).toBe(antes.length + 1);
      const nuevos = (await mod.idsDeHoteles()).filter((id) => !antes.includes(id));
      expect(nuevos, 'Tiene que haber exactamente un hotel nuevo').toHaveLength(1);
      idHotelNuevo = nuevos[0];
      await mod.esperarCalma();
      const aviso = await mod.cerrarAvisoDeVariacion();
      if (aviso) {
        test.info().annotations.push({ type: 'observacion', description: `Al agregar el hotel ${HOTEL.id} el itinerario mostro el aviso "${aviso}": el servidor recalculo un precio distinto del que guardo al agregarlo.` });
      }
      await adjuntarTexto('Hotel agregado', `CT_Service ${idHotelNuevo}`);
    });

    await paso(page, 'La fila del hotel agregado muestra el importe del modal y el total del itinerario', async () => {
      const fila = mod.filaDeHotel(idHotelNuevo);
      await expect(fila, 'La fila del hotel agregado tiene que figurar en el itinerario').toBeVisible();
      const precio = await mod.precioDeHotel(fila);
      await adjuntarTexto('Fila del hotel agregado', `${precio.texto}${precio.variacion ? ' (con una linea tachada: el precio cambio al dibujarse)' : ''}`);

      await conResaltado(page, fila, 'Importe de la fila del hotel', async () => {
        await expect(fila.locator('.ct-row__name'), 'La fila tiene que ser del hotel elegido').toContainText(HOTEL.termino);
        const conMarkup = ((hotelDelTarifario as HabitacionDeHotel | null)?.importe ?? 0) / MARKUP;
        expect(Math.abs((precio.valor ?? 0) - conMarkup),
          `La fila tiene que mostrar la tarifa del hotel con el markup ${MARKUP} una sola vez (~${conMarkup.toFixed(1)}) y muestra ${precio.valor}`)
          .toBeLessThanOrEqual(TOLERANCIA_HOTEL);
        // Mismo rojo conocido que el modal: hoy el modal no lleva el markup y la fila si.
        expect.soft(precio.valor, 'La fila tiene que mostrar el mismo importe que el modal (HU de fix pedida por el PM el 16/10/2026)').toBe(hotelDelModal?.importe ?? null);
      });

      // En un viaje de 2 destinos el hotel agregado no entra en ninguna opcion hasta que se la
      // arma ("+", AddHotelCTControl): `AddHotel` solo crea el grupo si el viaje tiene un
      // destino (CustomTourWebService.cs:398). Se mide y se adjunta; solo se exige si cambio.
      const despues = await totalDelItinerario(ct);
      await adjuntarTexto('Total tras agregar el hotel', `antes ${totalAntes.valor} -> despues ${despues.total.valor} (${despues.texto})`);
      if (despues.total.valor === totalAntes.valor) {
        test.info().annotations.push({ type: 'observacion', description: 'El total no cambio al agregar el hotel: el hotel agregado no forma parte de ninguna opcion del resumen hasta armarla.' });
      } else {
        await conResaltado(page, ct.tablaDeTotales(), 'Total tras agregar el hotel', () => {
          expect((despues.total.valor ?? 0) - (totalAntes.valor ?? 0), 'Si el total cambia al agregar el hotel, tiene que subir el importe de su fila')
            .toBe(precio.valor);
        });
      }
      totalAntes = despues.total;
    });

    await paso(page, 'Continuar al carrito de circuitos (sin emitir) y comparar su total con el del itinerario', async () => {
      const t = await totalDelItinerario(ct);
      await ct.continuarAlCarrito();
      const texto = await carrito.total();
      await adjuntarTexto('Total del carrito de circuitos', `itinerario ${t.texto} -> carrito ${texto}`);
      const delCarrito = importeDelPortal(texto);
      // Consulta abierta (16/10/2026): con la cotizacion guardada con markup, el carrito cobra
      // el total SIN ese markup (CC00054781: itinerario 3.344, carrito 2.674). Hasta que el PM
      // diga cual de los dos tiene que cobrar, se exige la moneda y que haya total, y la
      // diferencia se registra como observacion sin hacer fallar el test.
      await conResaltado(page, page.locator('body'), 'Total del carrito', () => {
        expect(delCarrito.moneda, 'El carrito tiene que cobrar en la moneda del itinerario').toBe(t.total.moneda);
        expect(delCarrito.valor ?? 0, 'El carrito tiene que tener un total').toBeGreaterThan(0);
      });
      if (delCarrito.valor !== t.total.valor) {
        const sinMarkup = (t.total.valor ?? 0) * MARKUP;
        test.info().annotations.push({ type: 'observacion', description:
          `El carrito cobra ${texto} y el itinerario muestra ${t.texto} (el itinerario por ${MARKUP} da ${sinMarkup.toFixed(0)}): ` +
          'consulta al PM del 16/10/2026 sobre si el carrito lleva el markup de la cotizacion.' });
      }
    });
  });
});
