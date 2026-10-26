import { test, expect } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { HotelNuevoPage } from '../../../pages/climbs/hotel.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, formatearFecha, conResaltado } from '../../../utils/pasos';
import { importe, Importe, pasajerosDePrueba, verificarEnElBackofficeNuevo } from './reservas-comun';

/**
 * RESERVAS — app nueva (ClimbsApp). Riel clasico: servicio suelto y alojamiento.
 *
 * Los mismos tests que tests/bloque-b/reservas-clasico.spec.ts, con los mismos titulos:
 * se reserva en el portal nuevo (`/site`) por pantalla, como la agencia, y se sigue el
 * dato hasta el file del Backoffice nuevo. Van en un mismo archivo porque el carrito es
 * del usuario: dos flujos en paralelo se pisarian.
 */
test.describe('Reservas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  // Datos del usuario con el que se reserva: los pone el sistema a partir de la sesion.
  const contexto = {
    agencia: 'AMV. TRAVEL',
    email: (process.env.BO_USER ?? '').toLowerCase(),
    ciudad: 'Buenos Aires',
    pais: 'Argentina',
  };

  test('Servicio: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);
    const portal = new PortalNuevoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();
    const reserva = {
      item: 'AUTO-QA NO TOCAR - Tigre y Delta',
      textoEnElBO: 'Tigre y Delta',
      terminoDeBusqueda: 'Tigre y Delta',
      modalidad: 'Regular',
      fecha: formatearFecha(fecha),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      cantidadPax: 0,
      pasajeros: pasajerosDePrueba(0, sello),
      solapa: 'Carrito de compras' as const,
    };
    const importes: Record<string, Importe> = {};
    let codigo = '';

    await paso(page, 'Vaciar el carrito y buscar excursiones en Buenos Aires para la fecha elegida', async () => {
      await portal.vaciarCarrito();
      await portal.buscarServicios(fecha);
      // La fecha viaja en la URL: si el calendario no la tomo, la busqueda sale con otra.
      const iso = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
      await expect(page, 'La busqueda tiene que salir con la fecha elegida').toHaveURL(new RegExp(`checkin=${iso}`));
    });

    await paso(page, 'Ubicar el servicio por nombre y entrar a su ficha', async () => {
      await portal.elegirServicio(reserva.terminoDeBusqueda, reserva.item);
      await expect(portal.bloqueDeModalidad(reserva.modalidad),
        `La ficha tiene que ofrecer la modalidad ${reserva.modalidad} para el ${reserva.fecha}. Si no, revisar la operatividad y las tarifas de venta del servicio.`)
        .toBeVisible({ timeout: 30_000 });
    });

    await paso(page, 'Elegir la modalidad Regular con la cantidad minima de pax y reservar', async () => {
      // El minimo se lee de la pantalla ("Minimo 2 pasajeros"), no se fija en el test.
      reserva.cantidadPax = await portal.minimoDePasajeros(reserva.modalidad);
      expect(reserva.cantidadPax, 'La ficha tiene que declarar la cantidad de pax').toBeGreaterThan(0);
      importes['ficha (precio unitario)'] = importe(await portal.precioDeLaModalidad(reserva.modalidad));
      await portal.elegirPasajeros(reserva.modalidad, reserva.cantidadPax);
      importes['ficha (total)'] = importe(await portal.totalDeLaFicha());
      await portal.agregarAlCarrito(reserva.modalidad, reserva.cantidadPax);
      // El contador cuenta items del carrito (confirmado por el PM): una excursion, un item.
      await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(1);
      reserva.pasajeros = pasajerosDePrueba(reserva.cantidadPax, sello);
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Revisar la fila del carrito y pasar a los datos de la reserva', async () => {
      await portal.irAlCarrito();
      const fila = portal.itemDelCarrito(reserva.item);
      await expect(fila).toBeVisible();
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Item del carrito', texto);
      await conResaltado(page, fila, 'Cantidad y modalidad en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la cantidad y la modalidad reservadas').toContain(`${reserva.cantidadPax} x ${reserva.modalidad}`);
      });
      await conResaltado(page, fila, 'Fecha en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la fecha elegida').toContain(reserva.fecha);
      });
      importes['carrito (total del item)'] = importe(texto.match(/[A-Z]{3}\s*[\d.,]+/g)?.at(-1) ?? '');
      await conResaltado(page, fila, 'Total del carrito', () => {
        expect(importes['carrito (total del item)'].valor, 'El total del carrito tiene que ser el que armo la ficha').toBe(importes['ficha (total)'].valor);
      });
      await portal.reservarDesdeElCarrito(reserva.referencia, reserva.observaciones);
    });

    await paso(page, 'Cargar los pasajeros y los datos de la reserva y confirmarla', async () => {
      await portal.completarDatosDeLaReserva(reserva.pasajeros, reserva.detalleDelItem);
      codigo = await portal.confirmarReserva();
      await adjuntarTexto('Codigo de la reserva emitida', codigo);
    });

    await verificarEnElBackofficeNuevo({ page, codigo, reserva, contexto, importes });
  });

  test('Hotel: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);
    const portal = new PortalNuevoPage(page);
    const hotel = new HotelNuevoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const entrada = fechaDeBusqueda();
    const salida = new Date(entrada);
    salida.setDate(salida.getDate() + 1);
    const reserva = {
      item: 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau',
      textoEnElBO: 'Park Hyatt',
      // La habitacion 9193 de la suite actual: una de las que tienen tarifa cargada.
      habitacion: 'King Deluxe - Edificio Posadas ..',
      modalidad: 'Doble',
      fecha: formatearFecha(entrada),
      fechaDeSalida: formatearFecha(salida),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      habitaciones: 1,
      adultos: 2,
      cantidadPax: 2,
      pasajeros: pasajerosDePrueba(2, sello),
      solapa: 'Carrito de compras' as const,
    };
    const importes: Record<string, Importe> = {};
    let codigo = '';

    await paso(page, 'Vaciar el carrito y abrir la solapa HOTELES de INICIO', async () => {
      await portal.vaciarCarrito();
    });

    await paso(page, 'Cargar el hotel, los viajeros y las fechas, y buscar', async () => {
      // El buscador acepta destinos y hoteles: se elige el hotel directo, como quien ya sabe cual quiere.
      await hotel.elegirHotel('Park Hyatt', reserva.item);
      await hotel.elegirFechas(entrada, salida);
      await hotel.cargarViajeros(reserva.habitaciones, reserva.adultos);
      await hotel.buscar(entrada, salida);
      // El hotel de prueba esta publicado solo para no residentes: la busqueda tiene que salir asi.
      await expect(page, 'La busqueda tiene que salir como no residente').not.toHaveURL(/[?&]nat=AR\b/);
    });

    await paso(page, 'Entrar a la ficha del hotel y tomar el precio de la habitacion', async () => {
      await hotel.abrirFicha(reserva.item);
      await expect(hotel.habitacion(reserva.habitacion), `La ficha tiene que ofrecer la habitacion ${reserva.habitacion} para las fechas elegidas`)
        .toBeVisible({ timeout: 60_000 });
      // El tipo de tarifa lo decide el sitio segun los adultos: con 2 corresponde Doble.
      const tipo = await hotel.tipoDeTarifa(reserva.habitacion);
      await adjuntarTexto('Tipo de tarifa que eligio la ficha', tipo);
      expect(tipo, 'Con 2 adultos la ficha tiene que ofrecer la tarifa Doble').toBe(reserva.modalidad);
      importes['ficha (precio por habitacion)'] = importe(await hotel.precioDeLaHabitacion(reserva.habitacion));
      expect(importes['ficha (precio por habitacion)'].valor, 'La ficha tiene que mostrar un precio para la habitacion elegida').not.toBeNull();
    });

    await paso(page, 'Elegir la habitacion y confirmar', async () => {
      importes['ficha (total)'] = importe(await hotel.reservarHabitacion(reserva.habitacion, reserva.habitaciones));
      expect(importes['ficha (total)'].valor, 'Con una habitacion, el total tiene que ser el precio por habitacion')
        .toBe(importes['ficha (precio por habitacion)'].valor);
      // El contador cuenta items del carrito: una habitacion, un item.
      await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(reserva.habitaciones);
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Revisar la fila del carrito y pasar a los datos de la reserva', async () => {
      await portal.irAlCarrito();
      const fila = portal.itemDelCarrito(reserva.item);
      await expect(fila).toBeVisible();
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Item del carrito', texto);
      await conResaltado(page, fila, 'Cantidad y tipo de habitacion en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la cantidad y el tipo de habitacion reservados').toContain(`${reserva.habitaciones} x ${reserva.modalidad}`);
      });
      await conResaltado(page, fila, 'Fechas en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la fecha de entrada').toContain(reserva.fecha);
        expect(texto, 'El carrito tiene que mostrar la fecha de salida').toContain(reserva.fechaDeSalida);
      });
      importes['carrito (total del item)'] = importe(texto.match(/[A-Z]{3}\s*[\d.,]+/g)?.at(-1) ?? '');
      await conResaltado(page, fila, 'Total del carrito', () => {
        expect(importes['carrito (total del item)'].valor, 'El total del carrito tiene que ser el que mostro la ficha').toBe(importes['ficha (total)'].valor);
      });
      await portal.reservarDesdeElCarrito(reserva.referencia, reserva.observaciones);
    });

    await paso(page, 'Cargar los pasajeros y los datos de la reserva y confirmarla', async () => {
      await portal.completarDatosDeLaReserva(reserva.pasajeros, reserva.detalleDelItem);
      codigo = await portal.confirmarReserva();
      await adjuntarTexto('Codigo de la reserva emitida', codigo);
    });

    await verificarEnElBackofficeNuevo({ page, codigo, reserva, contexto, importes });
  });
});
