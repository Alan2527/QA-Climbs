import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { CustomToursPage } from '../../pages/customtours.page';
import { CarritoCustomToursPage } from '../../pages/carrito-customtours.page';
import { Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda,
  formatearFecha, esperarFinDeCarga, conResaltado,
} from '../../utils/pasos';
import {
  importe, importeDelPortal, armarCircuitoYEmitir, verificarEnElBackOffice,
} from './reservas-comun';

/**
 * Bloque B - riel de CustomTours: oferta y multidestino.
 *
 * Comparten el recorrido del portal entero (`armarCircuitoYEmitir`): cambia la
 * solapa de INICIO, la ciudad y el combo donde se elige el viaje, no lo que hay
 * que hacer despues. La oferta y el paquete se componen de los mismos cuatro
 * candidatos AUTO-QA con tarifas distintas.
 */
test.describe('Reservas', () => {

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  test('Oferta: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const ct = new CustomToursPage(page);
    const carrito = new CarritoCustomToursPage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();

    const reserva = {
      oferta: 'AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)',
      ofertaId: '5060',
      // El ESTADO.md lo avisa: cruceros y ofertas se listan bajo Ushuaia.
      ciudad: 'Ushuaia',
      hotelDelPaquete: 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau',
      // El BO escribe la habitacion abreviada: la grilla muestra "1 DBL".
      modalidad: 'DBL',
      fecha: formatearFecha(fecha),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      cantidadPax: 2,
      dobles: 1,
      fechaDeSalida: '',
      // Los cuatro items que compone la oferta, todos candidatos AUTO-QA. Si se
      // pierde cualquiera en el camino al file, el test lo marca.
      items: ['Park Hyatt', 'Tigre y Delta', 'Angelitos', 'Arakur'],
      importePorItem: {} as Record<string, string>,
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
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    const codigo = await armarCircuitoYEmitir({
      page, inicio, ct, carrito, reserva, fecha, sello, importes, capturarDelPortal,
      viaje: { solapa: 'ofertas', ciudad: reserva.ciudad, id: reserva.ofertaId, combo: 'ddSelectedOpportunity' },
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      claveDeReferencia: 'itinerario (total)',
      // En circuitos el comentario del item va a CT_Service.Comment, que se
      // imprime junto al nombre del alojamiento y no en el p.pdiscl del otro riel.
      selectorDelComentario: 'td:has(h6:has-text("Park Hyatt")) p strong',
      modalidadEnElFile: 'DOBLE',
      itemUnico: false,
      itemsEsperados: reserva.items,
      importePorItemDelPortal: reserva.importePorItem,
      reserva: {
        item: reserva.oferta,
        textoEnElBO: 'Park Hyatt',
        modalidad: reserva.modalidad,
        fecha: reserva.fecha,
        fechaDeSalida: reserva.fechaDeSalida,
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
    });
  });



  test('Multidestino: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const ct = new CustomToursPage(page);
    const carrito = new CarritoCustomToursPage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();

    const reserva = {
      paquete: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)',
      paqueteId: '5059',
      // El paquete se lista bajo Buenos Aires; la oferta, bajo Ushuaia.
      ciudad: 'Buenos Aires',
      modalidad: 'DBL',
      fecha: formatearFecha(fecha),
      fechaDeSalida: '',
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      cantidadPax: 2,
      dobles: 1,
      // El paquete se compone de los mismos cuatro candidatos AUTO-QA que la
      // oferta, con otras tarifas: aca Tigre y Delta entra a USD 42 y en la
      // oferta a USD 418, porque cambia la modalidad.
      items: ['Park Hyatt', 'Tigre y Delta', 'Angelitos', 'Arakur'],
      importePorItem: {} as Record<string, string>,
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
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    const codigo = await armarCircuitoYEmitir({
      page, inicio, ct, carrito, reserva, fecha, sello, importes, capturarDelPortal,
      viaje: {
        solapa: 'multidestino',
        ciudad: reserva.ciudad,
        id: reserva.paqueteId,
        combo: 'ddSelectedTour',
      },
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      claveDeReferencia: 'itinerario (total)',
      selectorDelComentario: 'td:has(h6:has-text("Park Hyatt")) p strong',
      modalidadEnElFile: 'DOBLE',
      itemUnico: false,
      itemsEsperados: reserva.items,
      importePorItemDelPortal: reserva.importePorItem,
      reserva: {
        item: reserva.paquete,
        textoEnElBO: 'Park Hyatt',
        modalidad: reserva.modalidad,
        fecha: reserva.fecha,
        fechaDeSalida: reserva.fechaDeSalida,
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
    });
  });

});
