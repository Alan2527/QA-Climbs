import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { SeriePage } from '../../pages/serie.page';
import { Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda,
  formatearFecha, esperarFinDeCarga, conResaltado,
} from '../../utils/pasos';
import {
  SALTO, sinCeros, importe, importeDelPortal, verificarEnElBackOffice,
} from './reservas-comun';

/**
 * Bloque B - riel de series: el asistente de circuitos con salidas programadas.
 *
 * Es el unico que **no pasa por el carrito**: un asistente de tres pasos que vive
 * en una sola pantalla y emite desde ahi. Al listado se entra por URL, porque
 * INICIO no tiene solapa de series y el menu no lo enlaza en ninguna parte.
 */
test.describe('Reservas', () => {

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  /**
   * Datos AUTO-QA de la serie, creados por SQL para este test.
   *
   *   Serie 19          AUTO-QA NO TOCAR - Serie de regresion
   *   Circuito 5061     Buenos Aires, 2 noches, 52 salidas semanales desde el
   *                     05/10/2026, cupo 200 por salida y grupo
   *   Categorias        Superior, Primera, Lujo y Estandar
   *   Items propios     dos servicios y cuatro habitaciones marcadas IsSerie
   *
   * Se armo aparte y no sobre una serie de QA por lo mismo que el resto de los
   * datos del bloque: reservar consume cupo (`SerieQuotaManager.UseQuota` resta
   * una unidad por habitacion), asi que correr la regresion contra una serie real
   * le sacaria lugar a la operacion.
   */
  const SERIE = {
    nombre: 'AUTO-QA NO TOCAR - Serie de regresion',
    circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)',
    categoria: 'Primera',
    // La que usa el caso de cambio de categoria: tiene que ser otra de la lista.
    otraCategoria: 'Lujo',
    categoriasEsperadas: ['Superior', 'Primera', 'Lujo', 'Estandar'],
    noches: 2,
    /**
     * Dos salidas del final del calendario, preparadas por SQL con el cupo bajo.
     *
     * Estan en 2027 a proposito: el flujo que emite toma siempre la primera salida
     * del calendario (05/10/2026), asi que nunca las toca. Las cuatro categorias
     * tienen el mismo cupo en esas fechas, para que el caso no dependa de cual se
     * elija.
     *
     *   20/09/2027  cupo 3  -> aviso de pocos cupos, y la cuarta habitacion choca
     *                          contra el cupo agotado
     *   27/09/2027  cupo 0  -> la salida se dibuja sin tarifa y elegirla muestra el
     *                          cartel de consultar por email
     */
    salidaConCupoBajo: '2027-09-20',
    cupoBajo: 3,
    salidaSinCupo: '2027-09-27',
    // Lo que la reserva tiene que generar: el alojamiento de la categoria elegida
    // y los dos servicios propios de la serie, uno por dia.
    items: [
      'Park Hyatt',
      'Serie: traslado de llegada',
      'Serie: city tour',
    ],
  };


  test('Serie: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(900_000);

    const serie = new SeriePage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    /**
     * Dos habitaciones, y una de ellas **con un menor**.
     *
     * Con una sola habitacion de adultos no se ejercitaria ni el agrupamiento por
     * habitacion —la reserva arma un grupo por cada una— ni el recargo del menor.
     * Las dos son dobles a proposito: asi las dos filas del file dicen DOBLE y la
     * comparacion de la modalidad no depende de cual fila se mire primero.
     */
    const reserva = {
      fecha: '',
      fechaDeSalida: '',
      cantidadPax: 5,          // 4 adultos + 1 menor
      habitaciones: 2,
      edadDelMenor: 8,
      tarifaDeLaSalida: 0,
      cupoAntes: 0,
      urlDelAsistente: '',
      pasajeros: [] as Pasajero[],
    };

    const contexto = {
      agencia: 'AMV. TRAVEL',
      email: (process.env.AMV_USER ?? '').toLowerCase(),
      ciudad: 'Buenos Aires',
      pais: 'Argentina',
    };

    const importes: Record<string, { moneda: string; valor: number | null }> = {};
    const capturar = (donde: string, texto: string) => {
      importes[donde] = importe(texto);
      return importes[donde];
    };
    // El asistente escribe los importes con `toLocaleString('es-AR')` —punto de
    // miles—, pero el historial los escribe con `ToMoney()`, que usa la coma para
    // los miles. Es el mismo formato invertido que ya tienen la oferta y el
    // multidestino, y necesita el otro parser.
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    await paso(page, 'Abrir el listado de series y entrar a la serie de regresion', async () => {
      // Al listado se entra por URL: INICIO no tiene solapa de series y el menu
      // del encabezado no lo enlaza. Los otros cuatro flujos entran por INICIO
      // porque ahi si hay puerta.
      await serie.abrirListado();
      const series = await serie.seriesDelListado();
      await adjuntarTexto('Series del listado', series.join(SALTO));

      await conResaltado(page, page.locator('.serie-grid'), 'Serie en el listado', () => {
        expect(series.join(' | '), 'El listado tiene que ofrecer la serie de regresion')
          .toContain(SERIE.nombre);
      });

      await serie.abrirSerie(SERIE.nombre);
      const circuitos = await serie.circuitosDeLaSerie();
      await adjuntarTexto('Circuitos de la serie', circuitos.join(SALTO));
      await conResaltado(page, page.locator('body'), 'Circuito de la serie', () => {
        expect(circuitos.join(' | '), 'La serie tiene que ofrecer su circuito')
          .toContain(SERIE.circuito);
      });

      // El "Desde" de la card es lo primero que ve la persona: si sale en cero o
      // vacio, la serie parece sin tarifa aunque tenga salidas cargadas.
      const desde = await serie.precioDesde(SERIE.circuito);
      await adjuntarTexto('Precio "Desde" de la card', desde);
      await conResaltado(page, page.locator('.sd-tour-card').first(), 'Precio desde', () => {
        expect(importe(desde).valor, 'La card del circuito tiene que mostrar un precio "Desde"')
          .toBeGreaterThan(0);
      });
    });

    await paso(page, 'Abrir el asistente y verificar las categorias de hoteleria', async () => {
      await serie.abrirCircuito(SERIE.circuito);
      reserva.urlDelAsistente = page.url();

      await conResaltado(page, page.locator('body'), 'Circuito con disponibilidad', async () => {
        await expect(
          page.locator(serie.sinDisponibilidad),
          'El circuito tiene salidas, tarifas y cupo cargados: no puede abrir sin disponibilidad',
        ).toBeHidden({ timeout: 15_000 });
      });

      await conResaltado(page, page.locator('.wizard-steps'), 'Paso inicial del asistente', async () => {
        expect(await serie.pasoActual(), 'El asistente tiene que abrir en el paso de disponibilidad')
          .toBe('Disponibilidad');
      });

      const categorias = await serie.categorias();
      await adjuntarTexto('Categorias de hoteleria', categorias.join(' | '));
      await conResaltado(page, page.locator('.cat-card'), 'Categorias ofrecidas', () => {
        for (const esperada of SERIE.categoriasEsperadas) {
          expect(categorias, `El asistente tiene que ofrecer la categoria ${esperada}`)
            .toContain(esperada);
        }
      });
    });

    await paso(page, 'Elegir la categoria y una salida del calendario', async () => {
      await serie.elegirCategoria(SERIE.categoria);
      await conResaltado(page, page.locator('.cat-card'), 'Categoria elegida', async () => {
        expect(await serie.categoriaElegida(), 'El combo tiene que quedar con la categoria elegida')
          .toContain(SERIE.categoria);
      });

      const mes = await serie.mesDelCalendario();
      const salidas = await serie.salidasDelMes();
      await adjuntarTexto('Salidas del mes que abre el calendario',
        `${mes}: ${salidas.map((s) => `${s.clave} = ${s.tarifa}`).join(' | ')}`);

      const elegida = await serie.elegirPrimeraSalida();
      reserva.fecha = elegida.fecha;
      reserva.tarifaDeLaSalida = elegida.tarifa;

      // La fecha de regreso sale de las noches que declara el circuito, no de un
      // numero fijo en el test.
      const [dd, mm, anio] = elegida.fecha.split('/').map(Number);
      const salida = new Date(anio, mm - 1, dd + SERIE.noches);
      reserva.fechaDeSalida = formatearFecha(salida);
      await adjuntarTexto('Salida elegida',
        `${elegida.fecha} (${elegida.clave}) en ${elegida.mes}, tarifa ${elegida.tarifa}, ` +
        `regreso ${reserva.fechaDeSalida}`);

      // El asistente escribe la fecha **sin ceros a la izquierda** ("5/10/2026"):
      // `serieTourFormatDate` la arma con parseInt. El resumen de confirmacion del
      // ultimo paso, en cambio, la arma en el servidor con dd/MM/yyyy y si los
      // lleva. Son dos formatos de la misma fecha, y hay que exigir cada uno donde
      // corresponde.
      await conResaltado(page, page.locator('#divSelectedInfo'), 'Fecha seleccionada', async () => {
        expect(
          (await page.locator(serie.fechaElegida).innerText()).replace(/\s+/g, ' ').trim(),
          'El asistente tiene que mostrar la salida elegida como fecha seleccionada',
        ).toBe(sinCeros(elegida.fecha));
      });

      capturar('asistente (tarifa de la habitacion)',
        (await page.locator(serie.tarifaElegida).innerText()).trim());

      // Cupo de esa salida antes de reservar. Al final se vuelve a leer: tiene que
      // haber bajado una unidad por habitacion reservada.
      const { cupos } = await serie.datosDelCalendario();
      reserva.cupoAntes = cupos[elegida.clave] ?? 0;
      await adjuntarTexto('Cupo de la salida antes de reservar',
        `${elegida.clave}: ${reserva.cupoAntes}`);
      await conResaltado(page, page.locator('.scal-card'), 'Cupo disponible', () => {
        expect(reserva.cupoAntes,
          'La salida elegida tiene que tener cupo suficiente para las habitaciones a reservar')
          .toBeGreaterThanOrEqual(reserva.habitaciones);
      });
    });

    await paso(page, 'Agregar las dos habitaciones y verificar el resumen', async () => {
      await serie.configurarOcupacion({ adultos: 2 });
      await serie.agregarHabitacion();
      await serie.configurarOcupacion({ adultos: 2, menores: 1, edades: [reserva.edadDelMenor] });
      await serie.agregarHabitacion();

      const habitaciones = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones agregadas', habitaciones.join(SALTO));
      await conResaltado(page, page.locator('#summaryFilled'), 'Habitaciones agregadas', () => {
        expect(habitaciones.length, 'El resumen tiene que mostrar las dos habitaciones agregadas')
          .toBe(reserva.habitaciones);
        for (const [i, linea] of habitaciones.entries()) {
          expect(linea.toUpperCase(),
            `Con dos adultos, la habitacion ${i + 1} tiene que quedar como doble`)
            .toContain('DOBLE');
        }
        expect(habitaciones[1],
          'La segunda habitacion tiene que mostrar que lleva un menor')
          .toMatch(/menor|1\s*ni/i);
      });

      // El recargo del menor: las dos habitaciones tienen la misma ocupacion de
      // adultos, asi que la diferencia entre sus totales tiene que ser exactamente
      // la tarifa de menor de esa salida por los menores con cargo. Con
      // `freeMaxAge` en cero no hay gratuidad: el menor paga si hay tarifa
      // cargada, y si no hay tarifa de menor la diferencia tiene que ser cero.
      const { tarifasDeMenor, politicaDeMenores } = await serie.datosDelCalendario();
      const tarifaDeMenor = tarifasDeMenor[reserva.fecha.split('/').reverse().join('-')] ?? 0;
      const conCargo = politicaDeMenores.freeMaxAge > 0
        && reserva.edadDelMenor <= politicaDeMenores.freeMaxAge ? 0 : 1;
      const totales = (await serie.totalesPorHabitacion()).map((t) => importe(t).valor ?? 0);
      await adjuntarTexto('Totales por habitacion y tarifa de menor',
        [`totales: ${totales.join(' | ')}`,
         `tarifa de menor de la salida: ${tarifaDeMenor}`,
         `politica de menores: ${JSON.stringify(politicaDeMenores)}`,
         `menores con cargo: ${conCargo}`].join(SALTO));

      await conResaltado(page, page.locator('#summaryFilled'), 'Recargo del menor', () => {
        expect(totales.length, 'Tiene que haber un total por habitacion')
          .toBe(reserva.habitaciones);
        expect(totales[1] - totales[0],
          'Con la misma ocupacion de adultos, la diferencia entre las dos habitaciones ' +
          'tiene que ser la tarifa de menor de esa salida por los menores con cargo')
          .toBe(conCargo * tarifaDeMenor);
      });

      const resumen = await serie.resumen();
      await adjuntarTexto('Resumen del paso 1',
        Object.entries(resumen).map(([k, v]) => `${k}: ${v}`).join(SALTO));

      await conResaltado(page, page.locator('#summaryCard'), 'Datos del resumen', () => {
        expect(resumen.categoria, 'El resumen tiene que mostrar la categoria elegida')
          .toContain(SERIE.categoria);
        expect(resumen.fecha, 'El resumen tiene que mostrar la fecha de salida elegida')
          .toContain(sinCeros(reserva.fecha));
        // El resumen no escribe el total de pasajeros sino su composicion:
        // "4 adultos . 1 menor". Se exigen las dos partes.
        expect(resumen.pasajeros, 'El resumen tiene que mostrar la cantidad de adultos')
          .toContain('4 adulto');
        expect(resumen.pasajeros, 'El resumen tiene que mostrar el menor de la segunda habitacion')
          .toContain('1 menor');
      });

      capturar('asistente (total)', `USD ${resumen.total}`);
      const sumaDeLasHabitaciones = (await serie.totalesPorHabitacion())
        .map((t) => importe(t).valor ?? 0).reduce((a, b) => a + b, 0);
      await conResaltado(page, page.locator('#summaryCard'), 'Total del resumen', () => {
        expect(importes['asistente (total)'].valor,
          'El total tiene que ser la suma de los totales de cada habitacion')
          .toBe(sumaDeLasHabitaciones);
      });
    });

    await paso(page, 'Avanzar al paso de pasajeros y cargarlos', async () => {
      await serie.siguiente();
      await conResaltado(page, page.locator('.wizard-steps'), 'Paso de pasajeros', async () => {
        expect(await serie.errorDelPasoActual(),
          'Con fecha y habitacion cargadas el asistente no tiene que rechazar el paso').toBe('');
        expect(await serie.pasoActual(), 'El asistente tiene que avanzar al paso de pasajeros')
          .toBe('Pasajeros');
      });

      const titulos = await serie.titulosDeLasHabitaciones();
      const ocupantesPorHabitacion = [
        await serie.ocupantesDeLaHabitacion(0),
        await serie.ocupantesDeLaHabitacion(1),
      ];
      await adjuntarTexto('Bloques de pasajeros',
        `${titulos.join(' | ')}${SALTO}` +
        ocupantesPorHabitacion.map((o, i) => `Habitacion ${i + 1}: ${o.join(' | ')}`).join(SALTO));

      await conResaltado(page, page.locator(serie.bloqueDePasajeros).first(), 'Formularios de pasajeros', () => {
        expect(titulos.length, 'Tiene que haber un bloque por habitacion agregada')
          .toBe(reserva.habitaciones);
        expect(ocupantesPorHabitacion[0].length,
          'La primera habitacion tiene que pedir los datos de sus dos adultos').toBe(2);
        expect(ocupantesPorHabitacion[1].length,
          'La segunda habitacion tiene que pedir los datos de sus dos adultos y el menor').toBe(3);
        // El menor va **despues** de los adultos y la pantalla lo distingue: si se
        // mezclara el orden, la validacion de la edad compararia contra otro pasajero.
        expect(ocupantesPorHabitacion[1].at(-1)!.toUpperCase(),
          'El ultimo ocupante de la segunda habitacion tiene que ser el menor')
          .toContain('MENOR');
      });

      /**
       * La fecha de nacimiento del menor se calcula **contra la fecha de salida**,
       * que es lo que hace el asistente al validar. Poner un anio fijo dejaria el
       * test dependiendo del dia en que se corre.
       */
      const [dd, mm, anio] = reserva.fecha.split('/').map(Number);
      const nacimientoDelMenor = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/` +
        `${anio - reserva.edadDelMenor}`;

      reserva.pasajeros = Array.from({ length: reserva.cantidadPax }, (_, i) => ({
        nombre: `Pasajero${i + 1}`,
        apellido: `Regresion${sello.slice(-6)}`,
        pasaporte: `QA${sello.slice(-8)}${i + 1}`,
        nacimiento: i === reserva.cantidadPax - 1 ? nacimientoDelMenor : `0${i + 1}/03/1990`,
        nacionalidad: 'Argentina',
      }));

      // Los pasajeros se reparten por habitacion en el mismo orden en que se
      // cargaron las habitaciones: dos en la primera y tres en la segunda.
      const porHabitacion = [reserva.pasajeros.slice(0, 2), reserva.pasajeros.slice(2)];
      for (const [h, lista] of porHabitacion.entries()) {
        for (const [i, pax] of lista.entries()) await serie.completarPasajero(h, i, pax);
      }
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Avanzar al resumen y verificar lo que se va a confirmar', async () => {
      await serie.siguiente();
      await conResaltado(page, page.locator('.wizard-steps'), 'Paso de resumen', async () => {
        expect(await serie.errorDelPasoActual(),
          'Con los pasajeros completos el asistente no tiene que rechazar el paso').toBe('');
        expect(await serie.pasoActual(), 'El asistente tiene que avanzar al resumen').toBe('Resumen');
      });

      const resumenFinal = await serie.textoDelResumenFinal();
      await adjuntarTexto('Resumen de confirmacion', resumenFinal);

      await conResaltado(page, page.locator('.step4-section').first(), 'Resumen de confirmacion', () => {
        expect(resumenFinal, 'El resumen tiene que nombrar el circuito reservado')
          .toContain(SERIE.circuito);
        expect(resumenFinal, 'El resumen tiene que mostrar la fecha de salida elegida')
          .toContain(reserva.fecha);
        expect(resumenFinal, 'El resumen tiene que mostrar la categoria elegida')
          .toContain(SERIE.categoria);
        for (const pax of reserva.pasajeros) {
          expect(resumenFinal, `El resumen tiene que mostrar al pasajero ${pax.nombre}`)
            .toContain(`${pax.nombre} ${pax.apellido}`);
          expect(resumenFinal, `El resumen tiene que mostrar el pasaporte de ${pax.nombre}`)
            .toContain(pax.pasaporte);
          expect(resumenFinal, `El resumen tiene que mostrar la fecha de nacimiento de ${pax.nombre}`)
            .toContain(pax.nacimiento);
        }
      });

      // El total no puede cambiar entre el paso 1 y la confirmacion: es el
      // numero con el que la persona decide.
      const resumen = await serie.resumen();
      capturar('resumen final (total)', `USD ${resumen.total}`);
      await conResaltado(page, page.locator('#summaryCard'), 'Total en el resumen final', () => {
        expect(importes['resumen final (total)'].valor,
          'El total del resumen tiene que ser el mismo que mostro el paso de disponibilidad')
          .toBe(importes['asistente (total)'].valor);
      });
    });

    let codigo = '';
    await paso(page, 'Aceptar los terminos, confirmar y tomar el codigo del historial', async () => {
      // Sin tildar los terminos el boton de finalizar esta deshabilitado: es la
      // unica barrera antes de emitir.
      await conResaltado(page, page.locator('.terms-panel'), 'Finalizar deshabilitado sin terminos', async () => {
        await expect(
          page.locator(serie.botonSiguiente).first(),
          'Sin aceptar los terminos, el boton de finalizar tiene que estar deshabilitado',
        ).toBeDisabled();
      });

      await serie.aceptarTerminos();
      codigo = await serie.confirmarReserva();
      await adjuntarTexto('Codigo de la reserva emitida', codigo);
      expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
        .toMatch(/^BO\d{8}$/);

      const filaHistorial = page.locator('#tabCustomTour tr').filter({ hasText: codigo }).first();
      const deLaFila = ((await filaHistorial.innerText()).match(/[A-Z]{3}\s*\d[\d.,]*/g) ?? []);
      capturarDelPortal('historial (total)', deLaFila.at(-1) ?? '');
      await adjuntarTexto('Importes de la fila del historial', deLaFila.join(' | '));
    });


    await paso(page, 'Verificar que la reserva consumio el cupo de la salida', async () => {
      // `SerieQuotaManager.UseQuota` resta una unidad por habitacion. El asistente
      // publica el cupo disponible por fecha en `liveCupos`, asi que se comprueba
      // desde la misma pantalla, sin mirar la base. El cupo es por categoria, asi
      // que hay que volver a elegir la misma.
      await page.goto(reserva.urlDelAsistente);
      await esperarFinDeCarga(page);
      await page.waitForTimeout(2_000);
      await serie.elegirCategoria(SERIE.categoria);

      const { cupos } = await serie.datosDelCalendario();
      const clave = reserva.fecha.split('/').reverse().join('-');
      const cupoDespues = cupos[clave] ?? 0;
      await adjuntarTexto('Cupo de la salida despues de reservar',
        `${clave}: antes ${reserva.cupoAntes} -> despues ${cupoDespues}`);

      await conResaltado(page, page.locator('.scal-card'), 'Consumo de cupo', () => {
        expect(cupoDespues,
          `La reserva de ${reserva.habitaciones} habitaciones tiene que descontar ` +
          `${reserva.habitaciones} unidades del cupo de la salida`)
          .toBe(reserva.cupoAntes - reserva.habitaciones);
      });

      // El tramo del BackOffice arranca desde el historial: hay que volver ahi.
      await serie.abrirHistorialDeCircuitos();
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      claveDeReferencia: 'asistente (total)',
      modalidadEnElFile: 'DOBLE',
      itemUnico: false,
      sinReferenciaNiComentario: true,
      itemsEsperados: SERIE.items,
      reserva: {
        item: SERIE.circuito,
        textoEnElBO: 'Park Hyatt',
        modalidad: 'DBL',
        fecha: reserva.fecha,
        fechaDeSalida: reserva.fechaDeSalida,
        referencia: '',
        observaciones: '',
        detalleDelItem: '',
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
    });
  });


  /**
   * Rechazos del asistente de series.
   *
   * Es el companiero negativo del test de arriba, con el mismo criterio que
   * `validaciones.spec.ts` tiene para el checkout: **no emite ninguna reserva**,
   * asi que no deja nada vivo en QA ni consume cupo de la serie.
   *
   * Va en dos arranques porque el asistente no tiene marcha atras para todo: el
   * primero cubre los rechazos del paso de disponibilidad y el segundo los del
   * paso de pasajeros, entrando de nuevo al circuito.
   */
  test('Serie: el asistente no deja avanzar con datos incompletos', async ({ page }) => {
    test.setTimeout(900_000);

    const serie = new SeriePage(page);

    const errores = {
      sinFecha: 'Debés seleccionar una fecha de salida en el calendario.',
      sinHabitaciones: 'Debés agregar al menos una habitación.',
      pasajeros: 'Completá el nombre, apellido y fecha de nacimiento de todos los pasajeros.',
      edadDelMenor: 'la fecha de nacimiento ingresada corresponde a',
    };

    await paso(page, 'Abrir el asistente del circuito de regresion', async () => {
      await serie.abrirListado();
      await serie.abrirSerie(SERIE.nombre);
      await serie.abrirCircuito(SERIE.circuito);
      expect(await serie.pasoActual(), 'El asistente tiene que abrir en el paso de disponibilidad')
        .toBe('Disponibilidad');
    });

    await paso(page, 'Intentar avanzar sin elegir una fecha de salida', async () => {
      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error sin fecha', error);

      await conResaltado(page, page.locator('.wizard-nav'), 'Rechazo sin fecha', async () => {
        expect(error, 'Sin fecha de salida el asistente tiene que rechazar el paso')
          .toContain(errores.sinFecha);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
          .toBe('Disponibilidad');
      });
    });

    await paso(page, 'Verificar que el calendario no ofrezca salidas vencidas', async () => {
      // Una salida pasada se dibuja igual pero sin `data-key`: no es clickeable.
      // Es la unica forma de llegar al rechazo por fecha vencida, asi que lo que
      // se exige es que el calendario no la ofrezca.
      const hoy = new Date();
      const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-` +
        `${String(hoy.getDate()).padStart(2, '0')}`;

      const ofrecidas: string[] = [];
      for (let i = 0; i < 3; i++) {
        const salidas = await serie.salidasDelMes();
        ofrecidas.push(...salidas.map((s) => s.clave));
        await page.locator(serie.mesSiguiente).first().click();
        await page.waitForTimeout(400);
      }
      await adjuntarTexto('Salidas ofrecidas en los tres primeros meses', ofrecidas.join(' | '));

      const vencidas = ofrecidas.filter((clave) => clave < hoyISO);
      await conResaltado(page, page.locator('.scal-card'), 'Salidas vencidas en el calendario', () => {
        expect(ofrecidas.length, 'El calendario tiene que ofrecer salidas reservables')
          .toBeGreaterThan(0);
        expect(vencidas.join(' | '),
          `El calendario no puede ofrecer salidas anteriores a hoy (${hoyISO})`)
          .toBe('');
      });
    });

    await paso(page, 'Elegir una salida e intentar avanzar sin agregar habitaciones', async () => {
      // Se vuelve a pedir la pantalla para arrancar de cero: el paso anterior
      // dejo el calendario tres meses adelante.
      await serie.reabrirAsistente();
      const elegida = await serie.elegirPrimeraSalida();
      await adjuntarTexto('Salida elegida para el rechazo', elegida.fecha);

      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error sin habitaciones', error);

      await conResaltado(page, page.locator('.wizard-nav'), 'Rechazo sin habitaciones', async () => {
        expect(error, 'Sin habitaciones agregadas el asistente tiene que rechazar el paso')
          .toContain(errores.sinHabitaciones);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
          .toBe('Disponibilidad');
      });
    });

    await paso(page, 'Verificar los topes de ocupacion de la habitacion', async () => {
      // Los topes son 3 adultos, 2 menores, nunca mas menores que adultos y
      // nunca mas de 4 ocupantes. Se verifican sobre los propios botones: lo que
      // ve la persona es que dejan de responder.
      await serie.configurarOcupacion({ adultos: 3 });
      const conTresAdultos = await serie.topesDeOcupacion();
      await adjuntarTexto('Topes con 3 adultos', JSON.stringify(conTresAdultos, null, 1));
      await conResaltado(page, page.locator('#roomsSection'), 'Tope de adultos', () => {
        expect(conTresAdultos.adultos, 'La habitacion tiene que admitir hasta 3 adultos').toBe(3);
        expect(conTresAdultos.masAdultos,
          'Con 3 adultos no se tiene que poder agregar un cuarto').toBe(true);
      });

      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      const conUnAdulto = await serie.topesDeOcupacion();
      await adjuntarTexto('Topes con 1 adulto y 1 menor', JSON.stringify(conUnAdulto, null, 1));
      await conResaltado(page, page.locator('#roomsSection'), 'Menores contra adultos', () => {
        expect(conUnAdulto.menores, 'Con un adulto la habitacion admite un menor').toBe(1);
        expect(conUnAdulto.masMenores,
          'Con un solo adulto no se tiene que poder agregar un segundo menor').toBe(true);
        expect(conUnAdulto.menosAdultos,
          'Con un solo adulto no se tiene que poder bajar a cero').toBe(true);
      });
    });

    await paso(page, 'Verificar que no se puedan agregar mas de cuatro habitaciones', async () => {
      // La quinta habitacion no se rechaza con un error de campo: el asistente
      // abre el modal que deriva la consulta a una reserva de grupo.
      for (let i = 0; i < 4; i++) {
        await serie.configurarOcupacion({ adultos: 1 });
        await serie.agregarHabitacion();
      }
      const cargadas = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones cargadas', cargadas.join(SALTO));
      expect(cargadas.length, 'El asistente tiene que dejar cargar cuatro habitaciones').toBe(4);

      await serie.configurarOcupacion({ adultos: 1 });
      await serie.agregarHabitacion();

      const modal = await serie.textoDelModalDeCupo();
      await adjuntarTexto('Modal al agregar la quinta habitacion', modal);
      await conResaltado(page, page.locator('#summaryCard'), 'Quinta habitacion', async () => {
        expect(modal, 'Al querer agregar una quinta habitacion tiene que avisar por pantalla')
          .not.toBe('');
        expect((await serie.habitacionesDelResumen()).length,
          'La quinta habitacion no se tiene que agregar').toBe(4);
      });
      if (modal) await serie.cerrarModalDeCupo();
    });

    await paso(page, 'Quitar habitaciones del resumen', async () => {
      // La "x" de cada fila las saca de a una. Es la unica forma de corregir una
      // habitacion mal cargada sin empezar todo de nuevo.
      await serie.quitarLaHabitacion(3);
      await serie.quitarLaHabitacion(2);
      const quedaron = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones despues de quitar dos', quedaron.join(SALTO));

      await conResaltado(page, page.locator('#summaryCard'), 'Quitar habitaciones', () => {
        expect(quedaron.length, 'Quitando dos de las cuatro habitaciones tienen que quedar dos')
          .toBe(2);
      });
    });

    await paso(page, 'Volver a entrar y armar una habitacion con un menor', async () => {
      await serie.reabrirAsistente();
      await serie.elegirPrimeraSalida();
      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      await serie.agregarHabitacion();

      const habitaciones = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitacion con un menor', habitaciones.join(SALTO));
      expect(habitaciones.length, 'La habitacion se tiene que agregar').toBe(1);

      await serie.siguiente();
      expect(await serie.pasoActual(), 'El asistente tiene que avanzar al paso de pasajeros')
        .toBe('Pasajeros');
    });

    await paso(page, 'Volver un paso y verificar que no se pierda lo cargado', async () => {
      // Volver regenera los formularios de pasajeros desde cero. Si la habitacion
      // no sobreviviera, la persona tendria que rearmar todo para corregir un dato.
      await serie.volver();
      await conResaltado(page, page.locator('#summaryCard'), 'Volver al paso anterior', async () => {
        expect(await serie.pasoActual(), 'Volver tiene que devolver al paso de disponibilidad')
          .toBe('Disponibilidad');
        expect((await serie.habitacionesDelResumen()).length,
          'Al volver, la habitacion cargada tiene que seguir estando').toBe(1);
      });

      await serie.siguiente();
      expect(await serie.pasoActual(), 'Se tiene que poder volver a avanzar').toBe('Pasajeros');
    });

    await paso(page, 'Cambiar de categoria con un menor cargado y cancelar', async () => {
      // Con menores cargados el cambio de categoria **no se aplica de una**: cada
      // categoria tiene su propia politica de edades, asi que el asistente avisa
      // que se pierde la seleccion y pide confirmar. Sin menores se aplica directo,
      // por eso este caso va con la habitacion que tiene el menor.
      await serie.volver();
      await serie.intentarCambiarCategoria(SERIE.otraCategoria);

      const texto = await serie.textoDelModalDeCategoria();
      await adjuntarTexto('Modal de cambio de categoria', texto);
      await conResaltado(page, page.locator(serie.modalDeCategoria), 'Aviso al cambiar de categoria', () => {
        expect(texto,
          'Cambiar de categoria con habitaciones cargadas tiene que avisar que se pierde la seleccion')
          .not.toBe('');
      });

      await serie.cancelarCambioDeCategoria();
      await conResaltado(page, page.locator('#summaryCard'), 'Cancelar el cambio de categoria', async () => {
        expect((await serie.habitacionesDelResumen()).length,
          'Cancelado el cambio, la habitacion cargada tiene que seguir estando').toBe(1);
        expect(await serie.categoriaElegida(),
          'Cancelado el cambio, el combo tiene que volver a la categoria anterior')
          .not.toContain(SERIE.otraCategoria);
      });
    });

    await paso(page, 'Cambiar de categoria y confirmar el reinicio', async () => {
      await serie.intentarCambiarCategoria(SERIE.otraCategoria);
      await serie.confirmarCambioDeCategoria();

      await conResaltado(page, page.locator('#summaryCard'), 'Confirmar el cambio de categoria', async () => {
        expect((await serie.habitacionesDelResumen()).length,
          'Confirmado el cambio, la seleccion de habitaciones se tiene que reiniciar').toBe(0);
        expect(await serie.categoriaElegida(),
          'Confirmado el cambio, el combo tiene que quedar en la categoria nueva')
          .toContain(SERIE.otraCategoria);
      });

      // Se rearma la habitacion para seguir con los rechazos del paso de pasajeros.
      // La fecha sobrevive al reinicio: lo que se limpia son las habitaciones.
      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      await serie.agregarHabitacion();
      await serie.siguiente();
      expect(await serie.pasoActual(), 'Rearmada la habitacion, el asistente tiene que avanzar')
        .toBe('Pasajeros');
    });

    await paso(page, 'Intentar avanzar con los pasajeros vacios', async () => {
      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error con pasajeros vacios', error);

      await conResaltado(page, page.locator(serie.bloqueDePasajeros).first(), 'Rechazo por pasajeros vacios', async () => {
        expect(error, 'Sin cargar los pasajeros el asistente tiene que rechazar el paso')
          .toContain(errores.pasajeros);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
          .toBe('Pasajeros');
      });
    });

    await paso(page, 'Intentar avanzar con la fecha de nacimiento del menor de un adulto', async () => {
      // La edad se calcula a la fecha de salida y se compara contra la que se
      // eligio al armar la habitacion: un menor de 8 con fecha de 1990 no es el
      // mismo pasajero.
      await serie.completarPasajero(0, 0, {
        nombre: 'Adulto', apellido: 'Regresion', pasaporte: 'QA0001',
        nacimiento: '01/03/1990', nacionalidad: 'Argentina',
      });
      await serie.completarPasajero(0, 1, {
        nombre: 'Menor', apellido: 'Regresion', pasaporte: 'QA0002',
        nacimiento: '01/03/1990', nacionalidad: 'Argentina',
      });
      await serie.siguiente();

      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error por la edad del menor', error);
      await conResaltado(page, page.locator(serie.bloqueDePasajeros).first(), 'Rechazo por la edad del menor', async () => {
        expect(error,
          'Si la fecha de nacimiento no coincide con la edad elegida, el asistente tiene que rechazarla')
          .toContain(errores.edadDelMenor);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
          .toBe('Pasajeros');
      });
    });

    await paso(page, 'Corregir la fecha del menor y verificar el freno de los terminos', async () => {
      const hoy = new Date();
      const nacimientoDelMenor = `01/03/${hoy.getFullYear() - 8}`;
      await serie.completarPasajero(0, 1, {
        nombre: 'Menor', apellido: 'Regresion', pasaporte: 'QA0002',
        nacimiento: nacimientoDelMenor, nacionalidad: 'Argentina',
      });
      await serie.siguiente();

      await conResaltado(page, page.locator('.wizard-steps'), 'Avance con la edad corregida', async () => {
        expect(await serie.errorDelPasoActual(),
          'Corregida la fecha, el asistente no tiene que rechazar el paso').toBe('');
        expect(await serie.pasoActual(), 'Corregida la fecha, el asistente tiene que avanzar')
          .toBe('Resumen');
      });

      // El ultimo freno: sin aceptar los terminos no se puede emitir. Se verifica
      // que el boton este deshabilitado y que tildar lo habilite, y **no se
      // confirma**: este test no emite ninguna reserva.
      await conResaltado(page, page.locator('.terms-panel'), 'Finalizar deshabilitado sin terminos', async () => {
        await expect(
          page.locator(serie.botonSiguiente).first(),
          'Sin aceptar los terminos, el boton de finalizar tiene que estar deshabilitado',
        ).toBeDisabled();
      });
      await serie.aceptarTerminos();
    });

    await paso(page, 'Avisar cuando quedan pocos cupos y frenar al agotarlos', async () => {
      // El aviso aparece con 5 cupos o menos, y descuenta las habitaciones ya
      // cargadas: es lo que empuja a la persona a decidir.
      await serie.reabrirAsistente();
      await serie.elegirSalida(SERIE.salidaConCupoBajo);

      const aviso = await serie.textoDelAvisoDePocosCupos();
      await adjuntarTexto('Aviso de pocos cupos', aviso);
      await conResaltado(page, page.locator('.scal-card'), 'Aviso de pocos cupos', async () => {
        const { cupos } = await serie.datosDelCalendario();
        expect(cupos[SERIE.salidaConCupoBajo],
          `La salida ${SERIE.salidaConCupoBajo} tiene que estar preparada con cupo ${SERIE.cupoBajo}`)
          .toBe(SERIE.cupoBajo);
        expect(aviso, 'Con pocos cupos el asistente tiene que avisar cuantos quedan')
          .toContain(String(SERIE.cupoBajo));
      });

      // Cargadas las tres habitaciones que hay de cupo, no queda ninguna: el aviso
      // se apaga porque ya no queda nada que avisar.
      for (let i = 0; i < SERIE.cupoBajo; i++) {
        await serie.configurarOcupacion({ adultos: 1 });
        await serie.agregarHabitacion();
      }
      await conResaltado(page, page.locator('#summaryCard'), 'Cupo consumido por las habitaciones', async () => {
        expect((await serie.habitacionesDelResumen()).length,
          'Se tienen que poder cargar tantas habitaciones como cupo hay').toBe(SERIE.cupoBajo);
        expect(await serie.textoDelAvisoDePocosCupos(),
          'Consumido todo el cupo con habitaciones cargadas, el aviso ya no tiene que mostrarse')
          .toBe('');
      });

      // Y una mas no entra. No es el modal de reserva de grupo —para eso hacen
      // falta cinco—: es el de cupo agotado.
      await serie.configurarOcupacion({ adultos: 1 });
      await serie.agregarHabitacion();
      const modal = await serie.textoDelModalDeCupo();
      await adjuntarTexto('Modal al pedir mas habitaciones que cupo', modal);
      await conResaltado(page, page.locator('#summaryCard'), 'Cupo agotado', async () => {
        expect(modal, 'Sin cupo para otra habitacion, el asistente tiene que avisarlo por pantalla')
          .not.toBe('');
        expect((await serie.habitacionesDelResumen()).length,
          'La habitacion que no tiene cupo no se tiene que agregar').toBe(SERIE.cupoBajo);
      });
      if (modal) await serie.cerrarModalDeCupo();
    });

    await paso(page, 'Derivar a consulta la salida que se quedo sin cupo', async () => {
      // Sin cupo, el servidor manda la salida **sin tarifa**: la celda se dibuja
      // igual, pero elegirla no habilita habitaciones. En su lugar aparece el
      // cartel de consultar por email, y el boton de avanzar queda bloqueado.
      await serie.reabrirAsistente();

      const { cupos } = await serie.datosDelCalendario();
      await adjuntarTexto('Cupo de la salida preparada sin cupo',
        `${SERIE.salidaSinCupo}: ${cupos[SERIE.salidaSinCupo]}`);
      expect(cupos[SERIE.salidaSinCupo],
        `La salida ${SERIE.salidaSinCupo} tiene que estar preparada sin cupo`).toBe(0);

      await serie.elegirSalida(SERIE.salidaSinCupo);

      const cartel = await serie.textoDelCartelDeConsulta();
      await adjuntarTexto('Cartel de consulta', cartel);
      await conResaltado(page, page.locator('#roomsConfigPanel'), 'Salida sin cupo', async () => {
        expect(cartel,
          'Elegida una salida sin cupo, el asistente tiene que derivar la consulta en vez de ' +
          'ofrecer habitaciones')
          .not.toBe('');
        await expect(
          page.locator('#roomsSection'),
          'Sin cupo no se tienen que poder configurar habitaciones',
        ).toBeHidden({ timeout: 15_000 });
        expect(await serie.siguienteDeshabilitado(),
          'Con el cartel de consulta visible, el boton de avanzar tiene que estar deshabilitado')
          .toBe(true);
      });
    });
  });


  /**
   * Multiidioma de las tres pantallas de series.
   *
   * El portal tiene selector de idioma en el encabezado, y las pantallas de
   * series estan llenas de `data-i18n`. Lo que se exige no es que las etiquetas
   * cambien, sino que **el contenido sea el de ese idioma**: el nombre de la serie
   * y el del circuito salen de `SerieDetail` y `ReceptiveTourDetail`, cargados en
   * los tres idiomas. El defecto tipico es que el filtro por idioma no aplique y
   * el contenido caiga al espaniol por defecto.
   *
   * El idioma vive en una cookie del contexto (`Advisor.CustomerLanguage`), que
   * muere con el test: no contamina a los demas.
   *
   * No emite ninguna reserva.
   */
  test('Serie: las pantallas se muestran en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);

    const serie = new SeriePage(page);

    const IDIOMAS = [
      { codigo: 'ES', link: 'lnkEsp', nombre: 'Español',
        serie: 'AUTO-QA NO TOCAR - Serie de regresion',
        circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)' },
      { codigo: 'EN', link: 'lnkEng', nombre: 'Inglés',
        serie: 'AUTO-QA NO TOCAR - Regression Series',
        circuito: 'AUTO-QA NO TOCAR - Series: Buenos Aires (3 days / 2 nights)' },
      { codigo: 'PT', link: 'lnkPor', nombre: 'Portugués',
        serie: 'AUTO-QA NO TOCAR - Serie de regressao',
        circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noites)' },
    ];

    /** Codigo del idioma activo, tal como lo muestra el encabezado. */
    const idiomaActivo = async () =>
      (await page.locator('.ddLanguage a.header-flug span').first().innerText())
        .replace(/\s+/g, ' ').trim().toUpperCase();

    /**
     * Cambia el idioma desde el encabezado.
     *
     * El control **esconde el idioma activo**, asi que si ya es el buscado no hay
     * nada que hacer: sin esto el test se cuelga esperando una opcion que no
     * existe.
     */
    const cambiarIdioma = async (idioma: { link: string; codigo: string; nombre: string }) => {
      if (await idiomaActivo() === idioma.codigo) return;
      await page.locator('.ddLanguage a.header-flug').first().click();
      const opcion = page.locator(`[id$='${idioma.link}']`).first();
      await expect(opcion, `El selector tiene que ofrecer ${idioma.nombre}`)
        .toBeVisible({ timeout: 30_000 });
      await opcion.click();
      await page.waitForLoadState('domcontentloaded');
      await esperarFinDeCarga(page);
    };

    for (const idioma of IDIOMAS) {
      await paso(page, `Pasar el sitio a ${idioma.nombre} y abrir el listado de series`, async () => {
        await page.goto('/online/');
        await esperarFinDeCarga(page);
        await cambiarIdioma(idioma);

        await conResaltado(page, page.locator('.ddLanguage').first(), `Encabezado en ${idioma.nombre}`, async () => {
          expect(await idiomaActivo(),
            `El encabezado tiene que quedar en ${idioma.codigo} despues de elegir ${idioma.nombre}`)
            .toBe(idioma.codigo);
        });

        await serie.abrirListado();
        const series = await serie.seriesDelListado();
        await adjuntarTexto(`Listado de series en ${idioma.nombre}`, series.join(SALTO));

        await conResaltado(page, page.locator('.serie-grid'), `Nombre de la serie en ${idioma.nombre}`, () => {
          expect(series.join(' | '),
            `En ${idioma.nombre} el listado tiene que mostrar el nombre de ese idioma, ` +
            'el que tiene cargado SerieDetail')
            .toContain(idioma.serie);
        });

        if (idioma.codigo !== 'ES') {
          await conResaltado(page, page.locator('.serie-grid'), `Sin caer al espaniol en ${idioma.nombre}`, () => {
            expect(series.join(' | '),
              `En ${idioma.nombre} el nombre no puede ser el espaniol: seria el filtro por ` +
              'idioma sin aplicar')
              .not.toContain(IDIOMAS[0].serie);
          });
        }
      });

      await paso(page, `Abrir la serie y el asistente en ${idioma.nombre}`, async () => {
        await serie.abrirSerie(idioma.serie);
        const circuitos = await serie.circuitosDeLaSerie();
        await adjuntarTexto(`Circuitos en ${idioma.nombre}`, circuitos.join(SALTO));

        await conResaltado(page, page.locator('body'), `Nombre del circuito en ${idioma.nombre}`, () => {
          expect(circuitos.join(' | '),
            `En ${idioma.nombre} el circuito tiene que mostrar el nombre de ese idioma`)
            .toContain(idioma.circuito);
          if (idioma.codigo !== 'ES') {
            expect(circuitos.join(' | '),
              `En ${idioma.nombre} el circuito no puede mostrar el nombre en espaniol`)
              .not.toContain(IDIOMAS[0].circuito);
          }
        });

        await serie.abrirCircuito(idioma.circuito);
        await conResaltado(page, page.locator('body'), `Asistente en ${idioma.nombre}`, async () => {
          await expect(
            page.locator(serie.sinDisponibilidad),
            `En ${idioma.nombre} el circuito tiene que abrir con disponibilidad, igual que en espaniol`,
          ).toBeHidden({ timeout: 15_000 });
          expect(await page.locator('h1').first().innerText(),
            `El encabezado del asistente tiene que traer el nombre del circuito en ${idioma.nombre}`)
            .toContain(idioma.circuito);
        });

        // Las etiquetas del asistente y el mes del calendario se adjuntan como
        // evidencia y no se exigen: ninguna historia define que tengan que estar
        // traducidas, asi que compararlas seria inventar un resultado esperado.
        const etiquetas = await page.evaluate(() => ({
          pasos: Array.from(document.querySelectorAll('.wizard-step-label'))
            .map((e) => (e as HTMLElement).innerText.trim()),
          mes: document.querySelector('#spanCalLabel')
            ? (document.querySelector('#spanCalLabel') as HTMLElement).innerText.trim() : '',
        }));
        await adjuntarTexto(`Etiquetas del asistente en ${idioma.nombre}`,
          `pasos: ${etiquetas.pasos.join(' | ')}${SALTO}mes del calendario: ${etiquetas.mes}`);
      });
    }
  });

});
