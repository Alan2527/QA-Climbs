import { test, expect, Page } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { HotelPage } from '../../pages/hotel.page';
import { CarritoPage, Pasajero } from '../../pages/carrito.page';
import { CustomToursPage } from '../../pages/customtours.page';
import { CarritoCustomToursPage } from '../../pages/carrito-customtours.page';
import { SeriePage } from '../../pages/serie.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, fechaDeBusqueda, formatearFecha,
  reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { armarCircuitoYEmitir, importeDelPortal } from './reservas-comun';

/**
 * BLOQUE B — anulacion de una reserva emitida.
 *
 * Los cinco flujos de reserva emiten y verifican que los datos lleguen al BO.
 * Esto cubre el otro lado: que una reserva emitida se pueda **cancelar** y que el
 * portal lo refleje.
 *
 * **Un test por riel, y no uno solo.** Hasta el 2026-09-05 aca vivia unicamente la
 * anulacion de un servicio suelto, y eso dejaba sin probar que las otras cuatro se
 * pudieran cancelar. No es lo mismo: **la ventana de cancelacion no es la misma en
 * los dos rieles**.
 *
 *   riel clasico (servicio, hotel)   fecha del servicio - 15 dias
 *   circuitos (oferta, multidestino, serie)   InDate - 48hs
 *
 * Por eso el servicio y el hotel reservan a **30 dias** y los circuitos a 7: una
 * reserva clasica a 7 dias nace ya dentro de la ventana de penalidad y el portal
 * contesta "Esta reserva no puede ser cancelada". Eso es la politica funcionando
 * bien, no un defecto — medido en QA: `ExpirationDate` 27/08 para un servicio del
 * 11/09.
 *
 * **La oferta no tiene test propio.** Comparte riel, pantalla, regla de
 * cancelacion y armado con el multidestino: lo unico que cambia es la solapa de
 * INICIO por la que se entra, que ya se cubre en `reservas-circuitos.spec.ts`. Un
 * segundo test ahi seria otra corrida de dos minutos verificando exactamente lo
 * mismo.
 *
 * **Ninguno de estos tests deja una reserva viva en QA**: la que emite cada uno es
 * la que despues cancela. Son los unicos del Bloque B que se limpian solos.
 *
 * Referencias:
 *   Online/BookingHistoryDetail.aspx:583 -> lnkCancelBook, visible solo si la
 *     reserva no esta confirmada ni cancelada (BookingHistoryDetail.aspx.cs:222)
 *   Online/Module/CancelBookControl.ascx -> modal-bookcancel, chkTerms, btnCancelBook
 *
 * El portal tiene selector de idioma pero **no tiene tema oscuro**: no aplica esa
 * consideracion transversal.
 */
test.describe('Reservas — anulacion', () => {

  const AVISO_DE_GASTOS = 'puede llegar a incurrir en gastos';
  const AVISO_DE_CANCELADA = 'Reserva cancelada';

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  /**
   * Cancela una reserva emitida y verifica que el portal lo refleje.
   *
   * Es identico para los cinco rieles: cambia como se llego a tener la reserva, no
   * lo que hay que hacer despues. Lo unico que se le pasa es en que solapa del
   * historial vive, porque las de servicios y hoteles caen en "Reservas" y las de
   * circuitos y series en "Reservas circuitos".
   */
  async function cancelarYVerificar(page: Page, opciones: {
    codigo: string; solapa: '#tabBooking' | '#tabCustomTour'; referencia?: string;
  }) {
    const { codigo, solapa } = opciones;

    // El cartel de reserva cancelada, acotado a lo visible: en la pantalla hay
    // **otro elemento con la misma frase**, oculto, asi que `getByText` a secas
    // resuelve al equivocado y la verificacion falla estando la reserva bien
    // cancelada.
    const avisoDeCancelada = page.getByText(AVISO_DE_CANCELADA, { exact: false })
      .filter({ visible: true }).first();

    await paso(page, 'Abrir el detalle y verificar que la reserva se pueda cancelar', async () => {
      await page.locator("a[href*='BookingHistoryDetail.aspx?book=']")
        .filter({ hasText: codigo }).first().click();
      await page.waitForURL(/bookinghistorydetail/i, { timeout: 60_000 });
      await esperarFinDeCarga(page);

      // Solo se ofrece si la reserva no esta confirmada ni cancelada
      // (BookingHistoryDetail.aspx.cs:222). Recien emitida, tiene que estar.
      await conResaltado(page, page.locator('body'), 'Boton de cancelar disponible', async () => {
        await expect(
          page.locator("[id$='lnkCancelBook']").first(),
          'Una reserva recien emitida tiene que ofrecer la opcion de cancelarla',
        ).toBeVisible({ timeout: 30_000 });
      });

      await conResaltado(page, page.locator('body'), 'Reserva no cancelada', async () => {
        await expect(
          avisoDeCancelada,
          'La reserva recien emitida no puede figurar como cancelada',
        ).toBeHidden({ timeout: 15_000 });
      });
    });

    await paso(page, 'Abrir el modal y verificar que avise de los gastos antes de aceptar', async () => {
      await page.locator("[id$='lnkCancelBook']").first().click();
      const modal = page.locator('#modal-bookcancel');
      await expect(modal, 'El boton tiene que abrir el modal de cancelacion')
        .toBeVisible({ timeout: 30_000 });

      const texto = (await modal.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Modal de cancelacion', texto);

      await conResaltado(page, modal, 'Aviso de gastos', () => {
        expect(texto,
          'El modal tiene que advertir que cancelar puede incurrir en gastos segun las ' +
          'politicas de cancelacion')
          .toContain(AVISO_DE_GASTOS);
      });

      // El Aceptar arranca deshabilitado y lo habilita el check: es la unica
      // barrera antes de una accion que no se puede deshacer.
      const aceptar = modal.locator("[id$='btnCancelBook']").first();
      await conResaltado(page, modal, 'Aceptar deshabilitado sin tildar', async () => {
        await expect(
          aceptar,
          'Sin tildar la confirmacion, Aceptar tiene que estar deshabilitado',
        ).toBeDisabled();
      });

      await modal.locator('#chkTerms').check();
      await conResaltado(page, modal, 'Aceptar habilitado al tildar', async () => {
        await expect(
          aceptar,
          'Tildada la confirmacion, Aceptar tiene que habilitarse',
        ).toBeEnabled({ timeout: 15_000 });
      });
    });

    await paso(page, 'Cancelar la reserva y verificar que caiga cancelada en el historial', async () => {
      // Aceptar **redirige al historial** (`CancelBookControl.ascx.cs:128`): no se
      // vuelve al detalle, asi que es ahi donde hay que mirar el resultado.
      await page.locator('#modal-bookcancel').locator("[id$='btnCancelBook']").first().click();
      await page.waitForURL(/bookinghistory/i, { timeout: 120_000 });
      await esperarFinDeCarga(page);

      const solapaDelHistorial = page.locator(`a[href='${solapa}']`).first();
      if (await solapaDelHistorial.count()) {
        await solapaDelHistorial.click();
        await esperarFinDeCarga(page);
      }

      // Acotado a la solapa: el historial tiene dos tablas y la que no esta activa
      // vive en display:none. Con `tr` a secas, `.first()` se quedaba con la fila
      // oculta de la otra solapa y el test fallaba estando la reserva bien
      // cancelada. Se noto recien en la corrida completa, cuando el historial
      // tenia reservas de los dos rieles.
      const fila = page.locator(`${solapa} tr`)
        .filter({ hasText: codigo }).filter({ visible: true }).first();
      await expect(
        fila,
        `La reserva ${codigo} tiene que seguir figurando en el historial despues de cancelarla`,
      ).toBeVisible({ timeout: 60_000 });

      const texto = (await fila.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Fila del historial', texto);

      await conResaltado(page, fila, 'Estado en el historial', () => {
        expect(texto, 'El historial tiene que mostrar la reserva como cancelada')
          .toContain(AVISO_DE_CANCELADA);
      });

      // La referencia solo se exige si el riel la tiene: el asistente de series no
      // ofrece donde cargarla y la reserva viaja con Reference en blanco.
      if (opciones.referencia) {
        await conResaltado(page, fila, 'Referencia en el historial', () => {
          expect(texto, 'Cancelada, la reserva tiene que conservar su referencia')
            .toContain(opciones.referencia!);
        });
      }
    });

    await paso(page, 'Volver al detalle y verificar que ya no se pueda cancelar', async () => {
      await page.locator("a[href*='BookingHistoryDetail.aspx?book=']")
        .filter({ hasText: codigo }).first().click();
      await page.waitForURL(/bookinghistorydetail/i, { timeout: 60_000 });
      await esperarFinDeCarga(page);

      // El detalle lo refleja como **"Elementos cancelados"**, no con el cartel de
      // reserva cancelada: lo que la cancelacion marca son los elementos, y el
      // flag `Canceled` de la reserva queda en cero. El historial deriva su cartel
      // de los elementos. Medido en QA sobre las reservas que cancelan estos
      // mismos tests.
      await conResaltado(page, page.locator('body'), 'Elementos cancelados en el detalle', async () => {
        await expect(
          page.getByText('Elementos cancelados', { exact: false }).filter({ visible: true }).first(),
          'Cancelada, el detalle tiene que listar los elementos cancelados',
        ).toBeVisible({ timeout: 60_000 });
      });

      await conResaltado(page, page.locator('body'), 'Sin opcion de volver a cancelar', async () => {
        await expect(
          page.locator("[id$='lnkCancelBook']").first(),
          'Una reserva cancelada no tiene que ofrecer la opcion de cancelarla otra vez',
        ).toBeHidden({ timeout: 30_000 });
      });
    });
  }

  /** Pasajeros de relleno: la anulacion no compara datos, solo necesita emitir. */
  const pasajerosDe = (cantidad: number, sello: string): Pasajero[] =>
    Array.from({ length: cantidad }, (_, i) => ({
      nombre: `Pasajero${i + 1}`,
      apellido: `Regresion${sello.slice(-6)}`,
      pasaporte: `QA${sello.slice(-8)}${i + 1}`,
      nacimiento: `0${i + 1}/03/1990`,
      nacionalidad: 'Argentina',
    }));

  test('Servicio: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda(30);
    const referencia = `AUTO-QA ${sello}`;
    const datos = {
      servicio: 'AUTO-QA NO TOCAR - Tigre y Delta',
      terminoDeBusqueda: 'Tigre y Delta',
      modalidad: 'Regular',
      fecha: formatearFecha(fecha),
      observaciones: `Anulacion de regresion automatica ${sello}. No operar.`,
      cantidadPax: 0,
    };

    let codigo = '';
    await paso(page, 'Reservar un servicio y emitirlo', async () => {
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('servicios');
      await servicio.buscar({
        panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha,
      });
      await servicio.buscarPorNombre(datos.terminoDeBusqueda, datos.servicio);
      await servicio.abrirFicha(datos.servicio.slice(0, 24));

      const fila = page.locator('tr')
        .filter({ has: page.locator("select[id*='ddPax']") })
        .filter({ hasText: datos.modalidad }).first();
      await expect(
        fila,
        `La ficha tiene que ofrecer la modalidad ${datos.modalidad} para el ${datos.fecha}`,
      ).toBeVisible({ timeout: 30_000 });

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      datos.cantidadPax = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
      await fila.locator("select[id*='ddPax']").selectOption(String(datos.cantidadPax));
      await esperarFinDeCarga(page);
      await page.locator("[id$='lnkBookService']").first().click();
      await esperarFinDeCarga(page);

      await carrito.irAlCarrito();
      await carrito.crearReserva(referencia, datos.observaciones);
      await carrito.asegurarPasajeros(datos.cantidadPax);
      const pasajeros = pasajerosDe(datos.cantidadPax, sello);
      for (const [i, pax] of pasajeros.entries()) await carrito.completarPasajero(i, pax);
      await carrito.completarDatosDeLaReserva(datos.cantidadPax, referencia, datos.observaciones);
      await carrito.aceptarTerminos();

      codigo = await carrito.confirmarReserva();
      expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
        .toMatch(/^BO\d{8}$/);
      await adjuntarTexto('Reserva emitida para anular', codigo);
    });

    await cancelarYVerificar(page, { codigo, solapa: '#tabBooking', referencia });
  });

  test('Hotel: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const hotel = new HotelPage(page);
    const carrito = new CarritoPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    // A 30 dias, por lo mismo que el servicio: el riel clasico pone el limite de
    // cancelacion en la fecha del servicio menos 15 dias.
    const entrada = fechaDeBusqueda(30);
    const salida = new Date(entrada);
    salida.setDate(salida.getDate() + 1);

    const referencia = `AUTO-QA ${sello}`;
    const datos = {
      hotelId: 5003,
      habitacion: 9193,
      habitaciones: 1,
      adultos: 2,
      observaciones: `Anulacion de regresion automatica ${sello}. No operar.`,
    };

    let codigo = '';
    await paso(page, 'Reservar una habitacion y emitirla', async () => {
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('hoteles');
      await expect(panel).toBeVisible();

      await hotel.verificarResidente();
      await hotel.elegirHotel(datos.hotelId, 'Park Hyatt');
      await hotel.cargarViajeros(datos.habitaciones, datos.adultos);
      await hotel.elegirFechas(entrada, salida);
      await expect(
        page.locator(hotel.campoFechas),
        'El calendario tiene que quedar con las fechas elegidas',
      ).toHaveValue(`${formatearFecha(entrada)} - ${formatearFecha(salida)}`);
      await hotel.buscar();

      await hotel.abrirFicha(datos.hotelId);
      await hotel.reservarHabitacion(datos.habitacion, datos.habitaciones);
      await expect
        .poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
        .toBe(datos.habitaciones);

      await carrito.irAlCarrito();
      await carrito.crearReserva(referencia, datos.observaciones);
      await carrito.asegurarPasajeros(datos.adultos);
      const pasajeros = pasajerosDe(datos.adultos, sello);
      for (const [i, pax] of pasajeros.entries()) await carrito.completarPasajero(i, pax);
      await carrito.completarDatosDeLaReserva(datos.adultos, referencia, datos.observaciones);
      await carrito.aceptarTerminos();

      codigo = await carrito.confirmarReserva();
      expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
        .toMatch(/^BO\d{8}$/);
      await adjuntarTexto('Reserva emitida para anular', codigo);
    });

    await cancelarYVerificar(page, { codigo, solapa: '#tabBooking', referencia });
  });

  test('Multidestino: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const ct = new CustomToursPage(page);
    const carrito = new CarritoCustomToursPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    // A 7 dias alcanza: el riel de circuitos pone el limite en InDate - 48hs.
    const fecha = fechaDeBusqueda();
    const referencia = `AUTO-QA ${sello}`;

    const reserva = {
      cantidadPax: 2,
      dobles: 1,
      fecha: formatearFecha(fecha),
      fechaDeSalida: '',
      referencia,
      observaciones: `Anulacion de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      items: ['Park Hyatt', 'Tigre y Delta', 'Angelitos', 'Arakur'],
      importePorItem: {} as Record<string, string>,
      pasajeros: [] as Pasajero[],
    };

    // El armado del circuito ya esta escrito y probado en `reservas-comun.ts`: se
    // reusa entero. Los importes no se concilian aca —eso es asunto del test que
    // verifica el BackOffice—, pero el armador los va anotando igual.
    const importes: Record<string, { moneda: string; valor: number | null }> = {};
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    const codigo = await armarCircuitoYEmitir({
      page, inicio, ct, carrito, reserva, fecha, sello, importes, capturarDelPortal,
      viaje: {
        solapa: 'multidestino', ciudad: 'Buenos Aires', id: '5059', combo: 'ddSelectedTour',
      },
    });

    await cancelarYVerificar(page, { codigo, solapa: '#tabCustomTour', referencia });
  });

  test('Serie: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
    test.setTimeout(600_000);

    const serie = new SeriePage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    const SERIE = {
      nombre: 'AUTO-QA NO TOCAR - Serie de regresion',
      circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)',
      categoria: 'Primera',
    };

    let codigo = '';
    let clave = '';
    let cupoAntes = 0;

    await paso(page, 'Reservar una salida de la serie y emitirla', async () => {
      await serie.abrirListado();
      await serie.abrirSerie(SERIE.nombre);
      await serie.abrirCircuito(SERIE.circuito);
      await serie.elegirCategoria(SERIE.categoria);

      const elegida = await serie.elegirPrimeraSalida();
      clave = elegida.clave;
      cupoAntes = (await serie.datosDelCalendario()).cupos[clave] ?? 0;
      await adjuntarTexto('Salida elegida y cupo antes de reservar',
        `${elegida.fecha} (${clave}), cupo ${cupoAntes}`);

      await serie.configurarOcupacion({ adultos: 2 });
      await serie.agregarHabitacion();
      await serie.siguiente();

      const pasajeros = pasajerosDe(2, sello);
      for (const [i, pax] of pasajeros.entries()) await serie.completarPasajero(0, i, pax);
      await serie.siguiente();
      await serie.aceptarTerminos();

      codigo = await serie.confirmarReserva();
      expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
        .toMatch(/^BO\d{8}$/);
      await adjuntarTexto('Reserva emitida para anular', codigo);
    });

    // La serie no ofrece donde cargar una referencia: la reserva viaja con
    // Reference en blanco, asi que no se le exige al historial.
    await cancelarYVerificar(page, { codigo, solapa: '#tabCustomTour' });

    await paso(page, 'Dejar registrado que pasa con el cupo al cancelar', async () => {
      // **No se exige nada**: ninguna historia define si cancelar tiene que
      // devolver el cupo a la serie. Se mide y se adjunta, que es lo que hace
      // falta para llevarselo a producto y para saber cuanto cupo consume de
      // verdad cada corrida.
      await serie.abrirListado();
      await serie.abrirSerie(SERIE.nombre);
      await serie.abrirCircuito(SERIE.circuito);
      await serie.elegirCategoria(SERIE.categoria);

      const cupoDespues = (await serie.datosDelCalendario()).cupos[clave] ?? 0;
      await adjuntarTexto('Cupo de la salida antes y despues de cancelar',
        [`salida: ${clave}`,
         `antes de reservar: ${cupoAntes}`,
         `despues de reservar y cancelar: ${cupoDespues}`,
         cupoDespues === cupoAntes
           ? 'La cancelacion devolvio el cupo.'
           : `La cancelacion NO devolvio el cupo: quedan ${cupoAntes - cupoDespues} unidades ` +
             'menos. Es dato para producto, no un resultado esperado.'].join(String.fromCharCode(10)));
    });
  });
});
