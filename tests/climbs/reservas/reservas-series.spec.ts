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
});
