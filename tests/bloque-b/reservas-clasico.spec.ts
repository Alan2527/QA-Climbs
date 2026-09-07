import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { HotelPage } from '../../pages/hotel.page';
import { CarritoPage, Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda,
  formatearFecha, esperarFinDeCarga, conResaltado,
} from '../../utils/pasos';
import {
  SALTO, importe, completarCheckoutYEmitir, verificarEnElBackOffice,
} from './reservas-comun';

/**
 * Bloque B - riel clasico: servicio suelto y alojamiento.
 *
 * Los dos entran por INICIO, pasan por el carrito y emiten desde el checkout.
 * Comparten `completarCheckoutYEmitir`, que es el checkout de este riel: el de
 * CustomTours tiene el carrito y la emision en una sola pantalla, con otros ids.
 *
 * Van en un mismo archivo porque el carrito es del lado del servidor y esta atado
 * a la cookie de sesion: dos flujos en paralelo se pisarian entre si.
 */
test.describe('Reservas', () => {

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  test('Servicio: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    // El recorrido cruza dos aplicaciones y 16 pasos con PostBacks lentos: el
    // timeout de la suite, pensado para el tarifario, no alcanza.
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();

    // El dato esperado es este objeto: lo que el test carga es lo que despues
    // tiene que aparecer, identico, en el BO.
    const reserva = {
      servicio: 'AUTO-QA NO TOCAR - Tigre y Delta',
      terminoDeBusqueda: 'Tigre y Delta',
      modalidad: 'Regular',
      fecha: formatearFecha(fecha),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      cantidadPax: 0,                        // se toma del minimo que declara la ficha
      pasajeros: [] as Pasajero[],
    };

    /**
     * Importes capturados en cada pantalla del recorrido.
     *
     * No se recalculan: el total no es cantidad por precio unitario. Con 2 pax a
     * USD 10 el portal muestra USD 19, porque el redondeo hacia arriba se aplica
     * sobre el total y no sobre el unitario. Lo que se exige es que el numero
     * que mostro el portal sea el mismo que muestran la reserva, la bandeja y
     * el file: si en algun eslabon cambia, ahi esta el problema.
     */
    // Datos del usuario con el que se reserva. No los carga el test, los pone el
    // sistema a partir de la sesion, pero son parte del contenido de la reserva:
    // si el BO mostrara otra agencia u otro usuario, la reserva llego mal.
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
    // Los importes del portal se leen con el otro parser: alla la coma es de miles.
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    await paso(page, 'Vaciar el carrito y abrir la solapa SERVICIOS de INICIO', async () => {
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('servicios');
      await expect(panel).toBeVisible();
    });

    await paso(page, 'Buscar excursiones en Buenos Aires para la fecha elegida', async () => {
      const panel = await inicio.abrirSolapa('servicios');
      await servicio.buscar({
        panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha,
      });
      // La fecha viaja en la URL: si el calendario no la tomo, la busqueda sale
      // con la del dia y la reserva quedaria para otro dia sin que se note.
      await expect(page).toHaveURL(new RegExp(`checkin=${reserva.fecha.replace(/\//g, '\\/')}`));
    });

    await paso(page, 'Ubicar el servicio por nombre y entrar a su ficha', async () => {
      // El listado pagina de a 10 con scroll infinito, asi que se usa el
      // buscador por nombre de la propia pantalla. Se exige el nombre completo:
      // buscando solo "Tigre y Delta" el listado ofrece otra excursion.
      await servicio.buscarPorNombre(reserva.terminoDeBusqueda, reserva.servicio);
      await servicio.abrirFicha(reserva.servicio.slice(0, 24));
      await expect(page).toHaveURL(/servicedetail/i);

      // La ficha de reserva no muestra la operatividad — ese calendario vive en
      // la ficha del tarifario (ServiceSheetCalendarHtml), no aca —, asi que el
      // test no puede elegir un dia operable: la persona tampoco lo ve. Lo que
      // si se hace es cortar con el motivo si la fecha no tiene tarifas, en vez
      // de morir mas adelante en un timeout que parece un defecto.
      const filasDeTarifa = page.locator('tr').filter({ has: page.locator("select[id*='ddPax']") });
      await expect(
        filasDeTarifa.first(),
        `La ficha tiene que ofrecer tarifas para el ${reserva.fecha}. Si no las ofrece, ` +
        'revisar la operatividad del servicio y la vigencia de sus tarifas de venta.',
      ).toBeVisible({ timeout: 30_000 });
    });

    await paso(page, 'Elegir la modalidad Regular con la cantidad minima de pax y reservar', async () => {
      const fila = page.locator('tr')
        .filter({ has: page.locator("select[id*='ddPax']") })
        .filter({ hasText: reserva.modalidad }).first();

      // El minimo se lee de la pantalla, no se fija en el test: es lo que ve la
      // persona ("Minimo 2 pasajeros") y lo que la ficha manda a la API.
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      reserva.cantidadPax = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
      expect(reserva.cantidadPax, 'La ficha tiene que declarar la cantidad de pax').toBeGreaterThan(0);

      // Precio unitario de la modalidad, tal como lo ve la persona en la fila.
      capturarDelPortal('ficha (precio unitario)', texto.match(/[A-Z]{3}\s*\d[\d.,]*/)?.[0] ?? '');

      await fila.locator("select[id*='ddPax']").selectOption(String(reserva.cantidadPax));
      await esperarFinDeCarga(page);

      // Total que arma la ficha al elegir la cantidad: es el primer importe de
      // la cadena y el que despues tiene que reaparecer en el BO.
      capturarDelPortal('ficha (total)', await page.locator('.sd-total-amount').first().innerText());

      await page.locator("[id$='lnkBookService']").first().click();
      await esperarFinDeCarga(page);

      await expect
        .poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
        .toBe(reserva.cantidadPax);

      reserva.pasajeros = Array.from({ length: reserva.cantidadPax }, (_, i) => ({
        nombre: `Pasajero${i + 1}`,
        apellido: `Regresion${sello.slice(-6)}`,
        pasaporte: `QA${sello.slice(-8)}${i + 1}`,
        nacimiento: `0${i + 1}/03/1990`,
        nacionalidad: 'Argentina',
      }));
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Revisar la fila del carrito y pasar a los datos de la reserva', async () => {
      await carrito.irAlCarrito();
      const fila = carrito.filaDelCarrito(reserva.servicio);
      await expect(fila).toBeVisible();

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await conResaltado(page, fila, 'Cantidad y modalidad en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la cantidad y la modalidad reservadas')
          .toContain(`${reserva.cantidadPax} ${reserva.modalidad}`);
      });
      await conResaltado(page, fila, 'Fecha en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la fecha elegida').toContain(reserva.fecha);
      });

      // Ultima celda de la fila: el total del item.
      const celdas = await fila.locator('td').allInnerTexts();
      const conImporte = celdas.filter((c) => /[A-Z]{3}\s*\d[\d.,]*/.test(c));
      capturarDelPortal('carrito (total del item)', conImporte.at(-1) ?? '');
      await conResaltado(page, fila, 'Total del carrito', () => {
        expect(importes['carrito (total del item)'].valor,
          'El total del carrito tiene que ser el que armo la ficha')
          .toBe(importes['ficha (total)'].valor);
      });

      await carrito.crearReserva(reserva.referencia, reserva.observaciones);
    });

    const codigo = await completarCheckoutYEmitir({
      page, carrito, capturar: capturarDelPortal,
      reserva: {
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
      selectorDetalleDelItem: "[id$='ctrlBookingServiceDetailControl_txtDetail']",
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      reserva: {
        item: reserva.servicio,
        textoEnElBO: 'Tigre y Delta',
        modalidad: reserva.modalidad,
        fecha: reserva.fecha,
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
    });
  });


  test('Hotel: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const hotel = new HotelPage(page);
    const carrito = new CarritoPage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const entrada = fechaDeBusqueda();
    const salida = new Date(entrada);
    salida.setDate(salida.getDate() + 1);

    const reserva = {
      hotel: 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau',
      hotelId: 5003,
      // Una de las siete habitaciones que tienen tarifa cargada. Las otras tres
      // del hotel (13803, 16832, 17771) no tienen y no se pueden reservar.
      habitacion: 9193,
      modalidad: 'Doble',
      fecha: formatearFecha(entrada),
      fechaDeSalida: formatearFecha(salida),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      habitaciones: 1,
      adultos: 2,
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
    // Los importes del portal se leen con el otro parser: alla la coma es de miles.
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    await paso(page, 'Vaciar el carrito y abrir la solapa HOTELES de INICIO', async () => {
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('hoteles');
      await expect(panel).toBeVisible();
    });

    await paso(page, 'Cargar el hotel, los viajeros y las fechas, y buscar', async () => {
      // El hotel de prueba esta publicado solo para no residentes: si la
      // busqueda saliera como residente no aparece, y el rojo pareceria un
      // defecto. El combo no es visible, asi que se exige su valor por defecto.
      await hotel.verificarResidente();

      // El buscador acepta destinos y hoteles: se elige el hotel directo, que es
      // lo que hace quien ya sabe cual quiere.
      await hotel.elegirHotel(reserva.hotelId, 'Park Hyatt');
      await hotel.cargarViajeros(reserva.habitaciones, reserva.adultos);
      await hotel.elegirFechas(entrada, salida);

      // Las fechas viajan en el campo, no en la URL como en servicios: si el
      // widget no las tomo, la reserva saldria para otro dia sin que se note.
      await expect(
        page.locator(hotel.campoFechas),
        'El calendario tiene que quedar con las fechas elegidas',
      ).toHaveValue(`${reserva.fecha} - ${reserva.fechaDeSalida}`);

      await hotel.buscar();
    });

    await paso(page, 'Entrar a la ficha del hotel y tomar el precio de la habitacion', async () => {
      await hotel.abrirFicha(reserva.hotelId);

      // El tipo de tarifa lo decide el sitio segun la cantidad de adultos: con 2
      // corresponde Doble. Se lee de la ficha en vez de fijarlo en el test.
      const tipo = await hotel.tipoDeTarifa(reserva.habitacion);
      await adjuntarTexto('Tipo de tarifa que eligio la ficha', tipo);

      capturarDelPortal('ficha (total)', `USD ${await hotel.precioDeLaHabitacion(reserva.habitacion)}`);
      expect(
        importes['ficha (total)'].valor,
        'La ficha tiene que mostrar un precio para la habitacion elegida',
      ).not.toBeNull();
    });

    await paso(page, 'Elegir la habitacion y confirmar', async () => {
      await hotel.reservarHabitacion(reserva.habitacion, reserva.habitaciones);

      // El contador del encabezado cuenta habitaciones, no pasajeros: en el
      // flujo de servicio contaba pax.
      await expect
        .poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
        .toBe(reserva.habitaciones);

      reserva.pasajeros = Array.from({ length: reserva.adultos }, (_, i) => ({
        nombre: `Pasajero${i + 1}`,
        apellido: `Regresion${sello.slice(-6)}`,
        pasaporte: `QA${sello.slice(-8)}${i + 1}`,
        nacimiento: `0${i + 1}/03/1990`,
        nacionalidad: 'Argentina',
      }));
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Revisar la fila del carrito y pasar a los datos de la reserva', async () => {
      await carrito.irAlCarrito();
      const fila = carrito.filaDelCarrito(reserva.hotel);
      await expect(fila).toBeVisible();

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await conResaltado(page, fila, 'Cantidad y tipo de habitacion en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la cantidad y el tipo de habitacion reservados')
          .toContain(`${reserva.habitaciones} ${reserva.modalidad}`);
      });
      await conResaltado(page, fila, 'Fechas en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la fecha de entrada').toContain(reserva.fecha);
        expect(texto, 'El carrito tiene que mostrar la fecha de salida').toContain(reserva.fechaDeSalida);
      });

      const celdas = await fila.locator('td').allInnerTexts();
      const conImporte = celdas.filter((c) => /[A-Z]{3}\s*\d[\d.,]*/.test(c));
      capturarDelPortal('carrito (total del item)', conImporte.at(-1) ?? '');
      await conResaltado(page, fila, 'Total del carrito', () => {
        expect(importes['carrito (total del item)'].valor,
          'El total del carrito tiene que ser el que mostro la ficha')
          .toBe(importes['ficha (total)'].valor);
      });

      await carrito.crearReserva(reserva.referencia, reserva.observaciones);
    });

    const codigo = await completarCheckoutYEmitir({
      page, carrito, capturar: capturarDelPortal,
      reserva: {
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.adultos,
        pasajeros: reserva.pasajeros,
      },
      selectorDetalleDelItem: "[id$='ctrlBookingHotelDetailControl_txtDetail']",
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      reserva: {
        item: reserva.hotel,
        textoEnElBO: 'Park Hyatt',
        modalidad: reserva.modalidad,
        fecha: reserva.fecha,
        fechaDeSalida: reserva.fechaDeSalida,
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.adultos,
        pasajeros: reserva.pasajeros,
      },
    });
  });

});
