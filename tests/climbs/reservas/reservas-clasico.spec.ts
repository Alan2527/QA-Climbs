import { test, expect } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { HotelNuevoPage } from '../../../pages/climbs/hotel.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, formatearFecha, conResaltado } from '../../../utils/pasos';
import { importe, Importe, pasajerosDePrueba, verificarEnElBackofficeNuevo } from './reservas-comun';
import { conBackofficeNuevo, costosDelServicio, precioConIdioma, tarifaVigente, mismoIdioma } from '../../../utils/markups';
import candidatos from '../../../data/candidatos.json';

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
    // Guia en ingles, el idioma con recargo del servicio (US 4739): la reserva entera se arma con
    // el recargo y sus dos numeros se anclan a la tarifa del Backoffice nuevo.
    const SERVICIO_ID = 5;
    const IDIOMA_CON_RECARGO = 'Inglés';
    const MARKUP = candidatos._formulaPrecio.markupPorDefecto;
    const costos = await conBackofficeNuevo(page.context().browser()!, (b) => costosDelServicio(b, SERVICIO_ID));
    const esperado = { porPersona: 0, total: 0, neto: 0 };

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
      await page.locator('main').getByRole('combobox', { name: 'Idioma del servicio' }).selectOption({ label: IDIOMA_CON_RECARGO });
      await portal.elegirPasajeros(reserva.modalidad, reserva.cantidadPax);
      // La ficha recalcula por API al cambiar idioma o pasajeros: se lee el total cuando deja de cambiar.
      let previo = '';
      let total = await portal.totalDeLaFicha();
      for (let i = 0; i < 10 && total !== previo; i++) {
        await page.waitForTimeout(1_000);
        previo = total;
        total = await portal.totalDeLaFicha();
      }
      importes['ficha (precio unitario)'] = importe(await portal.precioDeLaModalidad(reserva.modalidad));
      importes['ficha (total)'] = importe(total);

      // Total = techo((costo + recargo) / cotizacion / markup) por pasajero; neto = lo mismo sin el
      // markup de la agencia (lo que AMV le cobra y queda en el file).
      const tarifa = tarifaVigente(costos, reserva.modalidad, fecha, reserva.cantidadPax);
      expect(tarifa, `El servicio ${SERVICIO_ID} tiene que tener una tarifa ${reserva.modalidad} vigente el ${reserva.fecha}`).toBeDefined();
      expect(tarifa!.recargos.some((x) => mismoIdioma(x.idioma, IDIOMA_CON_RECARGO)),
        `La tarifa tiene que tener un recargo para ${IDIOMA_CON_RECARGO}. Tiene: ${tarifa!.recargos.map((x) => x.idioma).join(', ')}`).toBe(true);
      esperado.porPersona = precioConIdioma(tarifa!, IDIOMA_CON_RECARGO, MARKUP, reserva.cantidadPax)!;
      esperado.total = esperado.porPersona * reserva.cantidadPax;
      esperado.neto = precioConIdioma(tarifa!, IDIOMA_CON_RECARGO, 1, reserva.cantidadPax)! * reserva.cantidadPax;
      await adjuntarTexto('Importes esperados con el recargo del ingles', [
        `Tarifa: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargos ${JSON.stringify(tarifa!.recargos)} | markup ${MARKUP}`,
        `Precio por persona: esperado USD ${esperado.porPersona} / ficha ${JSON.stringify(importes['ficha (precio unitario)'])}`,
        `Total: esperado USD ${esperado.total} (${reserva.cantidadPax} pax) / ficha ${total}`,
        `Neto esperado (detalle, historial, bandeja y file): USD ${esperado.neto}`,
      ].join(String.fromCharCode(10)));
      await conResaltado(page, portal.bloqueDeModalidad(reserva.modalidad), 'Precio con el recargo del ingles', () => {
        expect(importes['ficha (precio unitario)'], 'La ficha tiene que mostrar el precio por persona con el recargo del ingles').toEqual({ moneda: 'USD', valor: esperado.porPersona });
        expect(importes['ficha (total)'], 'El total de la ficha tiene que ser el precio con recargo por los pasajeros').toEqual({ moneda: 'USD', valor: esperado.total });
      });
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
        expect(texto, 'El carrito tiene que mostrar la cantidad y la modalidad reservadas').toMatch(new RegExp(`\\b${reserva.cantidadPax}\\s+(x\\s+)?${reserva.modalidad}\\b`, 'i'));
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

    await paso(page, 'El neto de la reserva y del file es el de la tarifa con el recargo del ingles', async () => {
      // La cadena ya exige que el detalle, el historial, la bandeja y el file lleven el mismo neto;
      // aca se ancla ese neto a la tarifa.
      for (const donde of ['detalle (Venta del item)', 'file (Venta del item)', 'file (Venta en Totales)']) {
        expect(importes[donde]?.valor, `El importe en ${donde} tiene que ser el neto con el recargo del ingles (USD ${esperado.neto})`).toBe(esperado.neto);
      }
    });
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
        expect(texto, 'El carrito tiene que mostrar la cantidad y el tipo de habitacion reservados').toMatch(new RegExp(`\\b${reserva.habitaciones}\\s+(x\\s+)?${reserva.modalidad}\\b`, 'i'));
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
