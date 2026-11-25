import { test } from '@playwright/test';
import { reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { Importe, verificarEnElBackofficeNuevo, armarCircuitoYEmitir, reservaDeCircuito, CONTEXTO, fechaDelPaquete } from './reservas-comun';
import candidatos from '../../../data/candidatos.json';

/**
 * RESERVAS — app nueva (ClimbsApp). Riel de circuitos: oferta y multidestino.
 *
 * Los mismos tests que tests/bloque-b/reservas-circuitos.spec.ts, con los mismos titulos.
 * La oferta y el paquete se componen de los mismos candidatos AUTO-QA con tarifas
 * distintas; cambia la solapa de la portada y el combo donde se elige el viaje.
 */
test.describe('Reservas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Oferta: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    // La oferta lleva el mismo traslado que el paquete (cerrado en marzo, junio, septiembre y diciembre) y el mismo hotel.
    const fecha = fechaDelPaquete();
    const reserva = { ...reservaDeCircuito(sello, fecha), item: 'AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)' };
    const importes: Record<string, Importe> = {};
    const codigo = await armarCircuitoYEmitir(page, { solapa: 'OFERTAS', viaje: reserva.item, fecha, sello, reserva, importes });
    await verificarEnElBackofficeNuevo({
      page, codigo, reserva, contexto: CONTEXTO, importes,
      claveDeReferencia: 'itinerario (total)', modalidadEnElFile: 'DOBLE', itemUnico: false,
      itemsEsperados: reserva.items, importePorItemDelPortal: reserva.importePorItem, ciudades: ['Buenos Aires', 'Ushuaia'],
    });
  });

  test('Multidestino: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDelPaquete();
    const reserva = { ...reservaDeCircuito(sello, fecha), item: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)' };
    const importes: Record<string, Importe> = {};
    // La Cena Show AUTO-QA (163) del paquete tiene English USD 15 por pasajero en su tarifa Regular.
    const codigo = await armarCircuitoYEmitir(page, { solapa: 'MULTIDESTINO', viaje: reserva.item, fecha, sello, reserva, importes,
      idioma: { servicioId: candidatos.tarifario.cenaShow.id, item: 'Angelitos' } });
    await verificarEnElBackofficeNuevo({
      page, codigo, reserva, contexto: CONTEXTO, importes,
      claveDeReferencia: 'itinerario (total)', modalidadEnElFile: 'DOBLE', itemUnico: false,
      itemsEsperados: reserva.items, importePorItemDelPortal: reserva.importePorItem, ciudades: ['Buenos Aires', 'Ushuaia'],
    });
  });
});
