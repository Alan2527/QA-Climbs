import { test, expect, Page } from '@playwright/test';
import { CircuitoNuevoPage } from '../../../pages/climbs/circuito.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, formatearFecha, conResaltado } from '../../../utils/pasos';
import { importe, Importe, pasajerosDePrueba, verificarEnElBackofficeNuevo, ReservaEsperada } from './reservas-comun';

/**
 * RESERVAS — app nueva (ClimbsApp). Riel de circuitos: oferta y multidestino.
 *
 * Los mismos tests que tests/bloque-b/reservas-circuitos.spec.ts, con los mismos titulos.
 * La oferta y el paquete se componen de los mismos candidatos AUTO-QA con tarifas
 * distintas; cambia la solapa de la portada y el combo donde se elige el viaje.
 */
const contexto = {
  agencia: 'AMV. TRAVEL',
  email: (process.env.BO_USER ?? '').toLowerCase(),
  ciudad: 'Buenos Aires',
  pais: 'Argentina',
};

/** Del buscador de la portada a la reserva confirmada. Devuelve el codigo BOxxxxxxxx. */
async function armarCircuitoYEmitir(page: Page, opciones: {
  solapa: 'OFERTAS' | 'MULTIDESTINO'; viaje: string; fecha: Date; sello: string;
  reserva: ReservaEsperada & { dobles: number; items: string[]; importePorItem: Record<string, string> };
  importes: Record<string, Importe>;
}): Promise<string> {
  const { solapa, viaje, fecha, sello, reserva, importes } = opciones;
  const ct = new CircuitoNuevoPage(page);
  let codigo = '';

  await paso(page, `Abrir la solapa ${solapa} de INICIO y elegir el viaje`, async () => {
    await ct.buscarViaje(solapa, { pais: 'Argentina', ciudad: 'Buenos Aires', nombre: viaje, fecha });
  });

  await paso(page, 'Cargar la fecha de inicio, los pax y las habitaciones', async () => {
    await expect(ct.fechaDeSalida, 'El armado tiene que quedar con la fecha de inicio elegida').toHaveValue(reserva.fecha);
    await ct.configurarViaje(reserva.cantidadPax, reserva.dobles);
    // La salida del primer destino sale de las noches que define el viaje, no de un numero fijo.
    const noches = await ct.nochesDelDestino(0);
    const salida = new Date(fecha);
    salida.setDate(salida.getDate() + noches);
    reserva.fechaDeSalida = formatearFecha(salida);
    await adjuntarTexto('Noches del primer destino y fecha de salida', `${noches} noches -> ${reserva.fechaDeSalida}`);
  });

  await paso(page, 'Revisar el itinerario y tomar su total', async () => {
    await ct.irAlItinerario();
    const opcion = await ct.opcionesDeCotizacion();
    await adjuntarTexto('Opciones de cotizacion del itinerario', opcion.lineas.join(' | '));
    const panel = page.locator('main');
    await conResaltado(page, panel, 'Hotel del paquete en el itinerario', () => {
      expect(opcion.lineas.join(' | '), 'El itinerario tiene que armarse con el hotel del paquete').toContain('Park Hyatt');
    });
    importes['itinerario (total)'] = importe(opcion.total);
    // El total tiene que ser la habitacion mas los servicios, que es lo que el panel muestra.
    await conResaltado(page, panel, 'Total del itinerario', () => {
      expect(importes['itinerario (total)'].valor, 'El total del itinerario tiene que ser la habitacion mas los servicios')
        .toBe((importe(opcion.habitacion).valor ?? 0) + (importe(opcion.servicios).valor ?? 0));
    });
  });

  await paso(page, 'Continuar al carrito y revisar que conserve el total', async () => {
    await ct.continuarAlCarrito();
    reserva.importePorItem = await ct.importePorItem(reserva.items);
    await adjuntarTexto('Importe de cada item en el carrito', Object.entries(reserva.importePorItem).map(([k, v]) => `${k}: ${v}`).join('\n'));
    for (const [item, valor] of Object.entries(reserva.importePorItem)) {
      expect(valor, `El carrito tiene que mostrar el importe del item ${item}`).not.toBe('');
    }
    importes['carrito (total del item)'] = importe(await ct.total());
    await conResaltado(page, page.locator('main'), 'Total del carrito', () => {
      expect(importes['carrito (total del item)'].valor, 'El carrito tiene que conservar el total que mostro el itinerario')
        .toBe(importes['itinerario (total)'].valor);
    });
    reserva.pasajeros = pasajerosDePrueba(reserva.cantidadPax, sello);
    await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
  });

  await paso(page, 'Cargar los pasajeros y emitir la reserva', async () => {
    await ct.completarPasajeros(reserva.pasajeros);
    await ct.completarComentarioDelItem(reserva.detalleDelItem);
    await ct.completarDatosDeLaReserva(reserva.referencia, reserva.observaciones);
    codigo = await ct.confirmarReserva();
    await adjuntarTexto('Codigo de la reserva emitida', codigo);
    expect(codigo, 'La confirmacion tiene que mostrar el codigo de la reserva').toMatch(/^BO\d{8}$/);
  });
  return codigo;
}

function reservaDeCircuito(sello: string, fecha: Date) {
  return {
    item: '',
    textoEnElBO: 'Park Hyatt',
    // El Backoffice escribe la habitacion abreviada: "1 DBL" en el detalle, "1 X DOBLE" en el file.
    modalidad: 'DBL',
    fecha: formatearFecha(fecha),
    fechaDeSalida: '',
    referencia: `AUTO-QA ${sello}`,
    observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
    detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
    cantidadPax: 2,
    dobles: 1,
    // Los cuatro candidatos AUTO-QA que componen el viaje: si se pierde cualquiera, se marca.
    items: ['Park Hyatt', 'Tigre y Delta', 'Angelitos', 'Arakur'],
    importePorItem: {} as Record<string, string>,
    pasajeros: pasajerosDePrueba(0, sello),
    solapa: 'Multidestino' as const,
  };
}

test.describe('Reservas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Oferta: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();
    const reserva = { ...reservaDeCircuito(sello, fecha), item: 'AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)' };
    const importes: Record<string, Importe> = {};
    const codigo = await armarCircuitoYEmitir(page, { solapa: 'OFERTAS', viaje: reserva.item, fecha, sello, reserva, importes });
    await verificarEnElBackofficeNuevo({
      page, codigo, reserva, contexto, importes,
      claveDeReferencia: 'itinerario (total)', modalidadEnElFile: 'DOBLE', itemUnico: false,
      itemsEsperados: reserva.items, importePorItemDelPortal: reserva.importePorItem, ciudades: ['Buenos Aires', 'Ushuaia'],
    });
  });

  test('Multidestino: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();
    const reserva = { ...reservaDeCircuito(sello, fecha), item: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)' };
    const importes: Record<string, Importe> = {};
    const codigo = await armarCircuitoYEmitir(page, { solapa: 'MULTIDESTINO', viaje: reserva.item, fecha, sello, reserva, importes });
    await verificarEnElBackofficeNuevo({
      page, codigo, reserva, contexto, importes,
      claveDeReferencia: 'itinerario (total)', modalidadEnElFile: 'DOBLE', itemUnico: false,
      itemsEsperados: reserva.items, importePorItemDelPortal: reserva.importePorItem, ciudades: ['Buenos Aires', 'Ushuaia'],
    });
  });
});
