import { test, expect } from '@playwright/test';
import { SerieNuevaPage } from '../../../pages/climbs/serie.page';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, formatearFecha, conResaltado } from '../../../utils/pasos';
import { Importe, pasajerosDePrueba, verificarEnElBackofficeNuevo, CONTEXTO } from './reservas-comun';

/**
 * RESERVAS — app nueva (ClimbsApp). Riel de series: el asistente de circuitos con salidas
 * programadas, que no pasa por el carrito (tres pasos en la pantalla del circuito).
 *
 * Los mismos tres tests que tests/bloque-b/reservas-series.spec.ts, con los mismos titulos,
 * sobre los datos AUTO-QA de la serie (19, circuito 5061, 52 salidas semanales, cupo 200,
 * categorias Superior, Primera, Lujo y Estandar; dos salidas de 2027 preparadas con cupo bajo).
 */
test.describe('Reservas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const SERIE = {
    nombre: 'AUTO-QA NO TOCAR - Serie de regresion',
    circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)',
    categoria: 'Primera',
    otraCategoria: 'Lujo',
    categoriasEsperadas: ['Superior', 'Primera', 'Lujo', 'Estandar'],
    noches: 2,
    salidaConCupoBajo: '2027-09-20',
    cupoBajo: 3,
    salidaSinCupo: '2027-09-27',
    items: ['Park Hyatt', 'Serie: traslado de llegada', 'Serie: city tour'],
  };

  /** "5/10/2026" o "05/10/2026" -> "05/10/2026" */
  const conCeros = (f: string) => f.split('/').map((p, i) => (i < 2 ? p.padStart(2, '0') : p)).join('/');

  test('Serie: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(900_000);
    const serie = new SerieNuevaPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    // Dos habitaciones dobles, la segunda con un menor: ejercita el agrupamiento por
    // habitacion y el recargo del menor.
    const reserva = {
      item: SERIE.circuito, textoEnElBO: 'Park Hyatt', modalidad: 'DBL',
      fecha: '', fechaDeSalida: '', clave: '',
      referencia: '', observaciones: '', detalleDelItem: '',
      cantidadPax: 5, habitaciones: 2, edadDelMenor: 8, cupoAntes: 0,
      pasajeros: pasajerosDePrueba(0, sello),
      solapa: 'Series' as const,
    };
    const importes: Record<string, Importe> = {};
    let codigo = '';

    await paso(page, 'Abrir el listado de series y entrar a la serie de regresion', async () => {
      await serie.abrirListado();
      const series = await serie.seriesDelListado();
      await adjuntarTexto('Series del listado', series.join('\n'));
      await conResaltado(page, page.locator('main'), 'Serie en el listado', () => {
        expect(series, 'El listado tiene que ofrecer la serie de regresion').toContain(SERIE.nombre);
      });
      await serie.abrirSerie(SERIE.nombre);
      const circuitos = await serie.circuitosDeLaSerie();
      await adjuntarTexto('Circuitos de la serie', circuitos.join('\n'));
      await conResaltado(page, page.locator('main'), 'Circuito de la serie', () => {
        expect(circuitos.join(' | '), 'La serie tiene que ofrecer su circuito').toContain(SERIE.circuito);
      });
      const desde = await serie.precioDesde(SERIE.circuito);
      await adjuntarTexto('Precio "Desde" de la card', desde);
      await conResaltado(page, serie.tarjetaDelCircuito(SERIE.circuito), 'Precio desde', () => {
        expect(Number(desde.replace(/[^\d]/g, '')), 'La card del circuito tiene que mostrar un precio "Desde"').toBeGreaterThan(0);
      });
    });

    await paso(page, 'Abrir el asistente y verificar las categorias de hoteleria', async () => {
      await serie.abrirCircuito(SERIE.circuito);
      await conResaltado(page, page.locator('main'), 'Circuito con disponibilidad', async () => {
        await expect(page.getByText('Por el momento no hay disponibilidad para este circuito'), 'El circuito tiene salidas, tarifas y cupo cargados: no puede abrir sin disponibilidad').toBeHidden();
      });
      expect(await serie.pasoActual(), 'El asistente tiene que abrir en el paso de disponibilidad').toBe('Disponibilidad');
      const categorias = await serie.categorias();
      await adjuntarTexto('Categorias de hoteleria', categorias.join(' | '));
      await conResaltado(page, serie.combo, 'Categorias ofrecidas', () => {
        for (const esperada of SERIE.categoriasEsperadas) expect(categorias, `El asistente tiene que ofrecer la categoria ${esperada}`).toContain(esperada);
      });
    });

    await paso(page, 'Elegir la categoria y una salida del calendario', async () => {
      await serie.elegirCategoria(SERIE.categoria);
      expect(await serie.categoriaElegida(), 'El combo tiene que quedar con la categoria elegida').toBe(SERIE.categoria);
      await adjuntarTexto('Salidas del mes que abre el calendario', `${await serie.mesDelCalendario()}: ${(await serie.salidasDelMes()).map((s) => `${s.clave} = ${s.precio}`).join(' | ')}`);
      const elegida = await serie.elegirPrimeraSalida();
      reserva.fecha = elegida.fecha;
      reserva.clave = elegida.clave;
      const [dd, mm, anio] = elegida.fecha.split('/').map(Number);
      reserva.fechaDeSalida = formatearFecha(new Date(anio, mm - 1, dd + SERIE.noches));
      importes['asistente (tarifa de la habitacion)'] = { moneda: 'USD', valor: elegida.tarifaPorHabitacion };
      reserva.cupoAntes = serie.salida(SERIE.categoria, elegida.clave)?.quota ?? 0;
      await adjuntarTexto('Salida elegida', `${elegida.fecha}, ${elegida.precio} por persona, ${elegida.tarifaPorHabitacion} la habitacion, regreso ${reserva.fechaDeSalida}, cupo ${reserva.cupoAntes}`);
      await conResaltado(page, serie.resumenLateral, 'Fecha seleccionada', async () => {
        expect(conCeros((await serie.resumen()).salida), 'El resumen tiene que mostrar la salida elegida').toBe(elegida.fecha);
        expect(reserva.cupoAntes, 'La salida elegida tiene que tener cupo suficiente para las habitaciones a reservar').toBeGreaterThanOrEqual(reserva.habitaciones);
      });
    });

    await paso(page, 'Agregar las dos habitaciones y verificar el resumen', async () => {
      await serie.configurarOcupacion({ adultos: 2 });
      await serie.agregarHabitacion();
      await serie.configurarOcupacion({ adultos: 2, menores: 1, edades: [reserva.edadDelMenor] });
      await serie.agregarHabitacion();
      const habitaciones = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones agregadas', habitaciones.join('\n'));
      await conResaltado(page, serie.resumenLateral, 'Habitaciones agregadas', () => {
        expect(habitaciones.length, 'El resumen tiene que mostrar las dos habitaciones agregadas').toBe(reserva.habitaciones);
        for (const [i, linea] of habitaciones.entries()) expect(linea.toUpperCase(), `Con dos adultos, la habitacion ${i + 1} tiene que quedar como doble`).toContain('DOBLE');
        expect(habitaciones[1], 'La segunda habitacion tiene que mostrar que lleva un menor').toMatch(/menor/i);
      });

      // El recargo del menor: misma ocupacion de adultos, asi que la diferencia entre las dos
      // habitaciones tiene que ser la tarifa de menor de esa salida (si no es gratis por edad).
      const salida = serie.salida(SERIE.categoria, reserva.clave);
      const { freeMaxAge } = serie.politicaDeMenores(SERIE.categoria);
      const conCargo = freeMaxAge > 0 && reserva.edadDelMenor <= freeMaxAge ? 0 : 1;
      const totales = await serie.totalesPorHabitacion();
      await adjuntarTexto('Totales por habitacion y tarifa de menor', `totales: ${totales.join(' | ')}\ntarifa de menor: ${salida?.child}\nfreeMaxAge: ${freeMaxAge}\nmenores con cargo: ${conCargo}`);
      await conResaltado(page, serie.resumenLateral, 'Recargo del menor', () => {
        expect(totales.length, 'Tiene que haber un total por habitacion').toBe(reserva.habitaciones);
        expect(totales[1] - totales[0], 'Con la misma ocupacion de adultos, la diferencia entre las dos habitaciones tiene que ser la tarifa de menor de esa salida').toBe(conCargo * (salida?.child ?? 0));
      });

      const resumen = await serie.resumen();
      await adjuntarTexto('Resumen del paso 1', JSON.stringify(resumen));
      await conResaltado(page, serie.resumenLateral, 'Datos del resumen', () => {
        expect(resumen.categoria, 'El resumen tiene que mostrar la categoria elegida').toBe(SERIE.categoria);
        expect(conCeros(resumen.salida), 'El resumen tiene que mostrar la fecha de salida elegida').toBe(reserva.fecha);
        expect(resumen.pasajeros, 'El resumen tiene que mostrar la cantidad de adultos').toContain('4 adulto');
        expect(resumen.pasajeros, 'El resumen tiene que mostrar el menor de la segunda habitacion').toContain('1 menor');
      });
      importes['asistente (total)'] = { moneda: 'USD', valor: resumen.total };
      await conResaltado(page, serie.resumenLateral, 'Total del resumen', () => {
        expect(resumen.total, 'El total tiene que ser la suma de los totales de cada habitacion').toBe(totales.reduce((a, b) => a + b, 0));
      });
    });

    await paso(page, 'Avanzar al paso de pasajeros y cargarlos', async () => {
      await serie.siguiente();
      expect(await serie.errorDelPasoActual(), 'Con fecha y habitacion cargadas el asistente no tiene que rechazar el paso').toBe('');
      expect(await serie.pasoActual(), 'El asistente tiene que avanzar al paso de pasajeros').toBe('Pasajeros');
      const titulos = await serie.titulosDeLasHabitaciones();
      const ocupantes = [await serie.ocupantesDeLaHabitacion(0), await serie.ocupantesDeLaHabitacion(1)];
      await adjuntarTexto('Bloques de pasajeros', `${titulos.join(' | ')}\n${ocupantes.map((o, i) => `Habitacion ${i + 1}: ${o.join(' | ')}`).join('\n')}`);
      await conResaltado(page, serie.bloques().first(), 'Formularios de pasajeros', () => {
        expect(titulos.length, 'Tiene que haber un bloque por habitacion agregada').toBe(reserva.habitaciones);
        expect(ocupantes[0].length, 'La primera habitacion tiene que pedir los datos de sus dos adultos').toBe(2);
        expect(ocupantes[1].length, 'La segunda habitacion tiene que pedir los datos de sus dos adultos y el menor').toBe(3);
        expect(ocupantes[1].at(-1)!.toUpperCase(), 'El ultimo ocupante de la segunda habitacion tiene que ser el menor').toContain('MENOR');
      });
      // La fecha de nacimiento del menor se calcula contra la fecha de salida, que es contra
      // lo que valida el asistente.
      const [dd, mm, anio] = reserva.fecha.split('/').map(Number);
      const nacimientoDelMenor = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${anio - reserva.edadDelMenor}`;
      reserva.pasajeros = pasajerosDePrueba(reserva.cantidadPax, sello).map((p, i) => (i === reserva.cantidadPax - 1 ? { ...p, nacimiento: nacimientoDelMenor } : p));
      const porHabitacion = [reserva.pasajeros.slice(0, 2), reserva.pasajeros.slice(2)];
      for (const [h, lista] of porHabitacion.entries()) for (const [i, pax] of lista.entries()) await serie.completarPasajero(h, i, pax);
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Avanzar al resumen y verificar lo que se va a confirmar', async () => {
      await serie.siguiente();
      expect(await serie.errorDelPasoActual(), 'Con los pasajeros completos el asistente no tiene que rechazar el paso').toBe('');
      expect(await serie.pasoActual(), 'El asistente tiene que avanzar al resumen').toBe('Resumen');
      const resumenFinal = await serie.textoDelResumenFinal();
      await adjuntarTexto('Resumen de confirmacion', resumenFinal);
      await conResaltado(page, page.locator('main'), 'Resumen de confirmacion', () => {
        expect(resumenFinal, 'El resumen tiene que nombrar el circuito reservado').toContain(SERIE.circuito);
        expect(resumenFinal, 'El resumen tiene que mostrar la fecha de salida elegida').toContain(reserva.fecha);
        expect(resumenFinal, 'El resumen tiene que mostrar la categoria elegida').toContain(SERIE.categoria);
        for (const pax of reserva.pasajeros) {
          expect(resumenFinal, `El resumen tiene que mostrar al pasajero ${pax.nombre}`).toContain(`${pax.nombre} ${pax.apellido}`);
          expect(resumenFinal, `El resumen tiene que mostrar el pasaporte de ${pax.nombre}`).toContain(pax.pasaporte);
          expect(resumenFinal, `El resumen tiene que mostrar la fecha de nacimiento de ${pax.nombre}`).toContain(pax.nacimiento);
        }
      });
      const resumen = await serie.resumen();
      importes['resumen final (total)'] = { moneda: 'USD', valor: resumen.total };
      expect(resumen.total, 'El total del resumen tiene que ser el mismo que mostro el paso de disponibilidad').toBe(importes['asistente (total)'].valor);
    });

    await paso(page, 'Aceptar los terminos, confirmar y tomar el codigo de la reserva', async () => {
      await conResaltado(page, page.locator('main'), 'Finalizar deshabilitado sin terminos', async () => {
        await expect(page.getByRole('button', { name: 'Confirmar reserva' }), 'Sin aceptar los terminos, el boton de finalizar tiene que estar deshabilitado').toBeDisabled();
      });
      await serie.aceptarTerminos();
      codigo = await serie.confirmarReserva();
      await adjuntarTexto('Codigo de la reserva emitida', codigo);
      expect(codigo, 'La confirmacion tiene que mostrar el codigo de la reserva').toMatch(/^BO\d{8}$/);
    });

    await paso(page, 'Verificar que la reserva consumio el cupo de la salida', async () => {
      // Una unidad por habitacion. El cupo es por categoria: se lee el de la misma.
      await serie.reabrirAsistente();
      const cupoDespues = serie.salida(SERIE.categoria, reserva.clave)?.quota ?? 0;
      await adjuntarTexto('Cupo de la salida despues de reservar', `${reserva.clave}: antes ${reserva.cupoAntes} -> despues ${cupoDespues}`);
      await conResaltado(page, page.locator('main'), 'Consumo de cupo', () => {
        expect(cupoDespues, `La reserva de ${reserva.habitaciones} habitaciones tiene que descontar ${reserva.habitaciones} unidades del cupo de la salida`).toBe(reserva.cupoAntes - reserva.habitaciones);
      });
    });

    await verificarEnElBackofficeNuevo({
      page, codigo, reserva, contexto: CONTEXTO, importes,
      claveDeReferencia: 'asistente (total)', modalidadEnElFile: 'DOBLE', itemUnico: false,
      sinReferenciaNiComentario: true, itemsEsperados: SERIE.items,
    });
  });

  /**
   * Rechazos del asistente: no emite ninguna reserva ni consume cupo. Los textos de la app
   * nueva hablan de "usted" ("Debe seleccionar...") y los del portal actual de "vos"
   * ("Debés seleccionar..."): se aceptan las dos formas, dicen lo mismo.
   */
  test('Serie: el asistente no deja avanzar con datos incompletos', async ({ page }) => {
    test.setTimeout(900_000);
    const serie = new SerieNuevaPage(page);
    const errores = {
      sinFecha: /Deb[eé]s? seleccionar una fecha de salida en el calendario/,
      sinHabitaciones: /Deb[eé]s? agregar al menos una habitaci[oó]n/,
      pasajeros: /Complet[aeá] el nombre, apellido y fecha de nacimiento de todos los pasajeros/,
      edadDelMenor: /la fecha de nacimiento ingresada corresponde a/,
    };
    let salidaElegida = '';

    await paso(page, 'Abrir el asistente del circuito de regresion', async () => {
      await serie.abrirListado();
      await serie.abrirSerie(SERIE.nombre);
      await serie.abrirCircuito(SERIE.circuito);
      expect(await serie.pasoActual(), 'El asistente tiene que abrir en el paso de disponibilidad').toBe('Disponibilidad');
    });

    await paso(page, 'Intentar avanzar sin elegir una fecha de salida', async () => {
      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error sin fecha', error);
      await conResaltado(page, page.locator('main'), 'Rechazo sin fecha', async () => {
        expect(error, 'Sin fecha de salida el asistente tiene que rechazar el paso').toMatch(errores.sinFecha);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar').toBe('Disponibilidad');
      });
    });

    await paso(page, 'Verificar que el calendario no ofrezca salidas vencidas', async () => {
      const hoy = new Date();
      const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      const ofrecidas: string[] = [];
      for (let i = 0; i < 3; i++) {
        ofrecidas.push(...(await serie.salidasDelMes()).map((s) => s.clave));
        await serie.mesSiguiente();
      }
      await adjuntarTexto('Salidas ofrecidas en los tres primeros meses', ofrecidas.join(' | '));
      await conResaltado(page, serie.calendario, 'Salidas vencidas en el calendario', () => {
        expect(ofrecidas.length, 'El calendario tiene que ofrecer salidas reservables').toBeGreaterThan(0);
        expect(ofrecidas.filter((c) => c < hoyISO).join(' | '), `El calendario no puede ofrecer salidas anteriores a hoy (${hoyISO})`).toBe('');
      });
    });

    await paso(page, 'Elegir una salida e intentar avanzar sin agregar habitaciones', async () => {
      await serie.reabrirAsistente();
      salidaElegida = (await serie.elegirPrimeraSalida()).fecha;
      await adjuntarTexto('Salida elegida para el rechazo', salidaElegida);
      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error sin habitaciones', error);
      await conResaltado(page, page.locator('main'), 'Rechazo sin habitaciones', async () => {
        expect(error, 'Sin habitaciones agregadas el asistente tiene que rechazar el paso').toMatch(errores.sinHabitaciones);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar').toBe('Disponibilidad');
      });
    });

    await paso(page, 'Verificar los topes de ocupacion de la habitacion', async () => {
      // Topes: 3 adultos, 2 menores, nunca mas menores que adultos ni mas de 4 ocupantes.
      await serie.configurarOcupacion({ adultos: 3 });
      const conTresAdultos = await serie.topesDeOcupacion();
      await adjuntarTexto('Topes con 3 adultos', JSON.stringify(conTresAdultos));
      expect(conTresAdultos.adultos, 'La habitacion tiene que admitir hasta 3 adultos').toBe(3);
      expect(conTresAdultos.masAdultos, 'Con 3 adultos no se tiene que poder agregar un cuarto').toBe(true);
      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      const conUnAdulto = await serie.topesDeOcupacion();
      await adjuntarTexto('Topes con 1 adulto y 1 menor', JSON.stringify(conUnAdulto));
      expect(conUnAdulto.menores, 'Con un adulto la habitacion admite un menor').toBe(1);
      expect(conUnAdulto.masMenores, 'Con un solo adulto no se tiene que poder agregar un segundo menor').toBe(true);
      expect(conUnAdulto.menosAdultos, 'Con un solo adulto no se tiene que poder bajar a cero').toBe(true);
    });

    await paso(page, 'Verificar que no se puedan agregar mas de cuatro habitaciones', async () => {
      for (let i = 0; i < 4; i++) {
        await serie.configurarOcupacion({ adultos: 1 });
        await serie.agregarHabitacion();
      }
      const cargadas = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones cargadas', cargadas.join('\n'));
      expect(cargadas.length, 'El asistente tiene que dejar cargar cuatro habitaciones').toBe(4);
      await serie.configurarOcupacion({ adultos: 1 });
      await serie.agregarHabitacion();
      const modal = await serie.textoDelModalDeCupo();
      await adjuntarTexto('Modal al agregar la quinta habitacion', modal);
      await conResaltado(page, serie.resumenLateral, 'Quinta habitacion', async () => {
        expect(modal, 'Al querer agregar una quinta habitacion tiene que avisar por pantalla').not.toBe('');
        expect((await serie.habitacionesDelResumen()).length, 'La quinta habitacion no se tiene que agregar').toBe(4);
      });
      if (modal) await serie.cerrarModalDeCupo();
    });

    await paso(page, 'Quitar habitaciones del resumen', async () => {
      await serie.quitarLaHabitacion(3);
      await serie.quitarLaHabitacion(2);
      const quedaron = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones despues de quitar dos', quedaron.join('\n'));
      expect(quedaron.length, 'Quitando dos de las cuatro habitaciones tienen que quedar dos').toBe(2);
    });

    await paso(page, 'Volver a entrar y armar una habitacion con un menor', async () => {
      await serie.reabrirAsistente();
      salidaElegida = (await serie.elegirPrimeraSalida()).fecha;
      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      await serie.agregarHabitacion();
      expect((await serie.habitacionesDelResumen()).length, 'La habitacion se tiene que agregar').toBe(1);
      await serie.siguiente();
      expect(await serie.pasoActual(), 'El asistente tiene que avanzar al paso de pasajeros').toBe('Pasajeros');
    });

    await paso(page, 'Volver un paso y verificar que no se pierda lo cargado', async () => {
      await serie.volver();
      await conResaltado(page, serie.resumenLateral, 'Volver al paso anterior', async () => {
        expect(await serie.pasoActual(), 'Volver tiene que devolver al paso de disponibilidad').toBe('Disponibilidad');
        expect((await serie.habitacionesDelResumen()).length, 'Al volver, la habitacion cargada tiene que seguir estando').toBe(1);
      });
      await serie.siguiente();
      expect(await serie.pasoActual(), 'Se tiene que poder volver a avanzar').toBe('Pasajeros');
    });

    await paso(page, 'Cambiar de categoria con un menor cargado y cancelar', async () => {
      // Con menores cargados el cambio no se aplica de una: cada categoria tiene su politica
      // de edades, asi que avisa que se pierde la seleccion y pide confirmar.
      await serie.volver();
      const antes = await serie.categoriaElegida();
      await serie.intentarCambiarCategoria(SERIE.otraCategoria);
      const texto = await serie.textoDelModalDeCategoria();
      await adjuntarTexto('Modal de cambio de categoria', texto);
      expect(texto, 'Cambiar de categoria con habitaciones cargadas tiene que avisar que se pierde la seleccion').not.toBe('');
      await serie.cancelarCambioDeCategoria();
      await conResaltado(page, serie.resumenLateral, 'Cancelar el cambio de categoria', async () => {
        expect((await serie.habitacionesDelResumen()).length, 'Cancelado el cambio, la habitacion cargada tiene que seguir estando').toBe(1);
        expect(await serie.categoriaElegida(), 'Cancelado el cambio, el combo tiene que volver a la categoria anterior').toBe(antes);
      });
    });

    await paso(page, 'Cambiar de categoria y confirmar el reinicio', async () => {
      await serie.intentarCambiarCategoria(SERIE.otraCategoria);
      await serie.confirmarCambioDeCategoria();
      await conResaltado(page, serie.resumenLateral, 'Confirmar el cambio de categoria', async () => {
        expect((await serie.habitacionesDelResumen()).length, 'Confirmado el cambio, la seleccion de habitaciones se tiene que reiniciar').toBe(0);
        expect(await serie.categoriaElegida(), 'Confirmado el cambio, el combo tiene que quedar en la categoria nueva').toBe(SERIE.otraCategoria);
      });
      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      await serie.agregarHabitacion();
      await serie.siguiente();
      expect(await serie.pasoActual(), 'Rearmada la habitacion, el asistente tiene que avanzar').toBe('Pasajeros');
    });

    await paso(page, 'Intentar avanzar con los pasajeros vacios', async () => {
      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error con pasajeros vacios', error);
      await conResaltado(page, serie.bloques().first(), 'Rechazo por pasajeros vacios', async () => {
        expect(error, 'Sin cargar los pasajeros el asistente tiene que rechazar el paso').toMatch(errores.pasajeros);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar').toBe('Pasajeros');
      });
    });

    await paso(page, 'Intentar avanzar con la fecha de nacimiento del menor de un adulto', async () => {
      await serie.completarPasajero(0, 0, { nombre: 'Adulto', apellido: 'Regresion', pasaporte: 'QA0001', nacimiento: '01/03/1990', nacionalidad: 'Argentina' });
      await serie.completarPasajero(0, 1, { nombre: 'Menor', apellido: 'Regresion', pasaporte: 'QA0002', nacimiento: '01/03/1990', nacionalidad: 'Argentina' });
      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error por la edad del menor', error);
      await conResaltado(page, serie.bloques().first(), 'Rechazo por la edad del menor', async () => {
        expect(error, 'Si la fecha de nacimiento no coincide con la edad elegida, el asistente tiene que rechazarla').toMatch(errores.edadDelMenor);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar').toBe('Pasajeros');
      });
    });

    await paso(page, 'Corregir la fecha del menor y verificar el freno de los terminos', async () => {
      // 8 anios a la fecha de salida, que es contra lo que valida el asistente.
      const [dd, mm, anio] = salidaElegida.split('/').map(Number);
      await serie.completarPasajero(0, 1, { nombre: 'Menor', apellido: 'Regresion', pasaporte: 'QA0002', nacimiento: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${anio - 8}`, nacionalidad: 'Argentina' });
      await serie.siguiente();
      expect(await serie.errorDelPasoActual(), 'Corregida la fecha, el asistente no tiene que rechazar el paso').toBe('');
      expect(await serie.pasoActual(), 'Corregida la fecha, el asistente tiene que avanzar').toBe('Resumen');
      await expect(page.getByRole('button', { name: 'Confirmar reserva' }), 'Sin aceptar los terminos, el boton de finalizar tiene que estar deshabilitado').toBeDisabled();
      // Se tilda y se verifica que habilite, sin confirmar: este test no emite.
      await serie.aceptarTerminos();
    });

    await paso(page, 'Avisar cuando quedan pocos cupos y frenar al agotarlos', async () => {
      await serie.reabrirAsistente();
      const categoria = await serie.categoriaElegida();
      await serie.elegirSalida(SERIE.salidaConCupoBajo);
      const aviso = await serie.textoDelAvisoDePocosCupos();
      await adjuntarTexto('Aviso de pocos cupos', `${aviso} (categoria ${categoria})`);
      await conResaltado(page, page.locator('main'), 'Aviso de pocos cupos', () => {
        expect(serie.salida(categoria, SERIE.salidaConCupoBajo)?.quota, `La salida ${SERIE.salidaConCupoBajo} tiene que estar preparada con cupo ${SERIE.cupoBajo}`).toBe(SERIE.cupoBajo);
        expect(aviso, 'Con pocos cupos el asistente tiene que avisar cuantos quedan').toContain(String(SERIE.cupoBajo));
      });
      for (let i = 0; i < SERIE.cupoBajo; i++) {
        await serie.configurarOcupacion({ adultos: 1 });
        await serie.agregarHabitacion();
      }
      await conResaltado(page, serie.resumenLateral, 'Cupo consumido por las habitaciones', async () => {
        expect((await serie.habitacionesDelResumen()).length, 'Se tienen que poder cargar tantas habitaciones como cupo hay').toBe(SERIE.cupoBajo);
        expect(await serie.textoDelAvisoDePocosCupos(), 'Consumido todo el cupo con habitaciones cargadas, el aviso ya no tiene que mostrarse').toBe('');
      });
      await serie.configurarOcupacion({ adultos: 1 });
      await serie.agregarHabitacion();
      const modal = await serie.textoDelModalDeCupo();
      await adjuntarTexto('Modal al pedir mas habitaciones que cupo', modal);
      await conResaltado(page, serie.resumenLateral, 'Cupo agotado', async () => {
        expect(modal, 'Sin cupo para otra habitacion, el asistente tiene que avisarlo por pantalla').not.toBe('');
        expect((await serie.habitacionesDelResumen()).length, 'La habitacion que no tiene cupo no se tiene que agregar').toBe(SERIE.cupoBajo);
      });
      if (modal) await serie.cerrarModalDeCupo();
    });

    await paso(page, 'Derivar a consulta la salida que se quedo sin cupo', async () => {
      await serie.reabrirAsistente();
      const categoria = await serie.categoriaElegida();
      const cupo = serie.salida(categoria, SERIE.salidaSinCupo)?.quota;
      await adjuntarTexto('Cupo de la salida preparada sin cupo', `${SERIE.salidaSinCupo}: ${cupo}`);
      expect(cupo, `La salida ${SERIE.salidaSinCupo} tiene que estar preparada sin cupo`).toBe(0);
      const elegida = await serie.elegirSalida(SERIE.salidaSinCupo);
      await adjuntarTexto('Salida sin cupo elegida', `${elegida.fecha}: tarifa por habitacion ${elegida.tarifaPorHabitacion}`);
      // En el portal actual, elegir la salida sin cupo muestra el cartel de consultar por email,
      // sin habitaciones para configurar y con el avance bloqueado. La app nueva muestra la
      // tarifa y deja configurar habitaciones: DIFERENCIA (soft, el test queda en rojo).
      const cartel = await serie.textoDelCartelDeConsulta();
      await adjuntarTexto('Cartel de consulta', cartel || '(no aparecio)');
      await conResaltado(page, page.locator('main'), 'Salida sin cupo', async () => {
        expect.soft(cartel, 'Elegida una salida sin cupo, el asistente tiene que derivar la consulta en vez de ofrecer habitaciones').not.toBe('');
        await expect.soft(page.getByRole('button', { name: 'Agregar habitación' }), 'Sin cupo no se tienen que poder configurar habitaciones').toBeHidden();
        await expect.soft(page.getByRole('button', { name: 'Siguiente', exact: true }), 'Con el cartel de consulta, el boton de avanzar tiene que estar deshabilitado').toBeDisabled();
      });
      // Lo que si se exige en firme: sin cupo no entra ninguna habitacion.
      if (await page.getByRole('button', { name: 'Agregar habitación' }).isVisible()) {
        await serie.configurarOcupacion({ adultos: 1 });
        await serie.agregarHabitacion();
        const modal = await serie.textoDelModalDeCupo();
        await adjuntarTexto('Al agregar una habitacion en la salida sin cupo', modal || '(sin aviso)');
        await conResaltado(page, serie.resumenLateral, 'Habitacion en salida sin cupo', async () => {
          expect(modal, 'Sin cupo, agregar una habitacion tiene que avisar que no hay disponibilidad').not.toBe('');
          expect((await serie.habitacionesDelResumen()).length, 'Sin cupo no se tiene que agregar ninguna habitacion').toBe(0);
        });
        if (modal) await serie.cerrarModalDeCupo();
      }
    });
  });

  /**
   * Multiidioma de las tres pantallas de series: lo que se exige es que el contenido sea el
   * de ese idioma (el nombre de la serie y del circuito, cargados en los tres). Las etiquetas
   * se adjuntan y no se exigen (ninguna US las define). No emite. Deja el sitio en espanol.
   */
  test('Serie: las pantallas se muestran en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);
    const serie = new SerieNuevaPage(page);
    const portal = new PortalNuevoPage(page);
    const IDIOMAS = [
      { codigo: 'ES' as const, nombre: 'Español', serie: 'AUTO-QA NO TOCAR - Serie de regresion', circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)' },
      { codigo: 'EN' as const, nombre: 'Inglés', serie: 'AUTO-QA NO TOCAR - Regression Series', circuito: 'AUTO-QA NO TOCAR - Series: Buenos Aires (3 days / 2 nights)' },
      { codigo: 'PT' as const, nombre: 'Portugués', serie: 'AUTO-QA NO TOCAR - Serie de regressao', circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noites)' },
    ];

    try {
      for (const idioma of IDIOMAS) {
        await paso(page, `Pasar el sitio a ${idioma.nombre} y abrir el listado de series`, async () => {
          await portal.abrirInicio();
          await portal.cambiarIdioma(idioma.codigo);
          expect(await portal.idiomaActivo(), `El encabezado tiene que quedar en ${idioma.codigo} despues de elegir ${idioma.nombre}`).toBe(idioma.codigo);
          await serie.abrirListado();
          const series = await serie.seriesDelListado();
          await adjuntarTexto(`Listado de series en ${idioma.nombre}`, series.join('\n'));
          await conResaltado(page, page.locator('main'), `Nombre de la serie en ${idioma.nombre}`, () => {
            expect(series, `En ${idioma.nombre} el listado tiene que mostrar el nombre de ese idioma, el que tiene cargado la serie`).toContain(idioma.serie);
            if (idioma.codigo !== 'ES') expect(series, `En ${idioma.nombre} el nombre no puede ser el espanol: seria el filtro por idioma sin aplicar`).not.toContain(IDIOMAS[0].serie);
          });
        });

        await paso(page, `Abrir la serie y el asistente en ${idioma.nombre}`, async () => {
          await serie.abrirSerie(idioma.serie);
          const circuitos = await serie.circuitosDeLaSerie();
          await adjuntarTexto(`Circuitos en ${idioma.nombre}`, circuitos.join('\n'));
          await conResaltado(page, page.locator('main'), `Nombre del circuito en ${idioma.nombre}`, () => {
            expect(circuitos.join(' | '), `En ${idioma.nombre} el circuito tiene que mostrar el nombre de ese idioma`).toContain(idioma.circuito);
            if (idioma.codigo !== 'ES') expect(circuitos.join(' | '), `En ${idioma.nombre} el circuito no puede mostrar el nombre en espanol`).not.toContain(IDIOMAS[0].circuito);
          });
          await serie.abrirCircuito(idioma.circuito);
          await conResaltado(page, page.locator('main'), `Asistente en ${idioma.nombre}`, async () => {
            await expect(page.getByRole('grid'), `En ${idioma.nombre} el circuito tiene que abrir con disponibilidad, igual que en espanol`).toBeVisible();
            await expect(page.getByRole('heading', { level: 1 }), `El encabezado del asistente tiene que traer el nombre del circuito en ${idioma.nombre}`).toContainText(idioma.circuito);
          });
          // Las etiquetas del asistente se adjuntan como evidencia, sin exigirlas.
          const pasos = (await page.locator('main ol li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
          await adjuntarTexto(`Etiquetas del asistente en ${idioma.nombre}`, `pasos: ${pasos.join(' | ')}\nmes: ${(await page.locator('main').innerText()).match(/\w+ (de|of|De|Of)? ?20\d\d/)?.[0] ?? ''}`);
        });
      }
    } finally {
      await portal.abrirInicio().catch(() => {});
      await portal.cambiarIdioma('ES').catch(() => {});
    }
  });
});
