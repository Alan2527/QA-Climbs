import { test, expect } from '@playwright/test';
import { WebAdminTarifasHabitacionPage, Corte } from '../../pages/webadmin-tarifas-habitacion.page';
import { WebAdminExtensionMasivaPage } from '../../pages/webadmin-extension-masiva.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const E = candidatos.extensionTarifas;
const SALTO = String.fromCharCode(10);

/**
 * WebAdmin — extension masiva de tarifas (listado de hoteles).
 *
 * Es la operacion mas peligrosa del tarifario: extiende de una sola vez las tarifas
 * de todos los hoteles seleccionados y no se puede deshacer. Si el calculo se rompe,
 * quedan meses de precios mal en todos esos hoteles.
 *
 * Guardas, para no tocar nada ajeno:
 * - el listado se filtra por el nombre del hotel de prueba y el modal tiene que
 *   listar SOLO el 15422;
 * - antes de confirmar se exige que el unico tildado sea ese y que la confirmacion
 *   diga "1 hotel";
 * - el resultado tiene que informar 1 habitacion (el hotel tiene una sola).
 *
 * Modo "Extender ultimo corte tarifario" al 10%: toma el corte que llega mas lejos
 * (agosto 2031, el de la carga manual) y lo repite desde el dia siguiente hasta el
 * 30/09/2031. Antes y despues borra ese tramo, asi cada corrida arranca igual.
 */
test.describe('WebAdmin — extension masiva de tarifas', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const HOTEL_ID = E.hotelId;
  const TRAMO = { desde: '16/08/2031', hasta: '30/09/2031' };
  const PORCENTAJE = 10;
  const formato = (c: Corte) => `${c.desde} - ${c.hasta} | SGL ${c.sgl} | DBL ${c.dbl} | TPL ${c.tpl} | ${c.extendida}`;
  const fecha = (t: string) => { const [d, m, a] = t.split('/').map(Number); return new Date(a, m - 1, d).getTime(); };

  test('Extender el ultimo corte de un solo hotel crea las tarifas hasta la fecha pedida', async ({ page }) => {
    test.setTimeout(600_000);
    const habitacion = new WebAdminTarifasHabitacionPage(page);
    const masiva = new WebAdminExtensionMasivaPage(page);
    let base: Corte | undefined;

    await paso(page, `Dejar la habitacion ${ROOM} sin tarifas del ${TRAMO.desde} al ${TRAMO.hasta}`, async () => {
      // Solo si quedo algo de una corrida anterior: borrar un tramo vacio no
      // muestra ningun aviso, y no habria como saber si se hizo.
      const previos = await habitacion.cortesDelTarifario(ROOM);
      if (previos.some((c) => fecha(c.hasta) >= fecha(TRAMO.desde))) {
        await adjuntarTexto('Borrado previo', await habitacion.eliminarTarifas(ROOM, TRAMO.desde, TRAMO.hasta));
      }
      await habitacion.generarTarifario(ROOM);
      const cortes = await habitacion.cortesDelTarifario(ROOM);
      await adjuntarTexto('Tarifario de partida', cortes.map(formato).join(SALTO));
      base = [...cortes].sort((a, b) => fecha(b.hasta) - fecha(a.hasta))[0];
      expect(base, 'La habitacion tiene que tener cortes').toBeTruthy();
      expect(fecha(base!.hasta), `El ultimo corte tiene que terminar antes del ${TRAMO.desde}`).toBeLessThan(fecha(TRAMO.desde));
    });

    try {
      await paso(page, 'Listado de hoteles: el modal tiene que listar solo el hotel de prueba', async () => {
        const ids = await masiva.abrir(E.terminoBusqueda);
        await adjuntarTexto('Hoteles del modal', ids.join(', '));
        expect(ids, `Filtrando por "${E.terminoBusqueda}" el modal tiene que listar solo el ${HOTEL_ID}`).toEqual([String(HOTEL_ID)]);
      });

      await paso(page, `Extender el ultimo corte un ${PORCENTAJE}% hasta el ${TRAMO.hasta}`, async () => {
        const { confirmacion, resultado } = await masiva.extender({
          hotelId: HOTEL_ID, fechaHasta: TRAMO.hasta, porcentaje: PORCENTAJE, modo: 'ultimoCorte', tipoHabitacion: '1',
        });
        await adjuntarTexto('Confirmacion', confirmacion);
        await adjuntarTexto('Resultado', resultado);
        expect(resultado, 'Tiene que informar que genero tarifas en una sola habitacion').toMatch(/Se generaron [\d.]+ tarifas en 1 habitaci/i);
      });

      await paso(page, 'El Tarifario de la habitacion tiene el corte nuevo con el incremento', async () => {
        const cortes = await habitacion.cortesDelTarifario(ROOM);
        await adjuntarTexto('Tarifario despues de extender', cortes.map(formato).join(SALTO));
        const nuevo = cortes.find((c) => c.desde === TRAMO.desde && c.hasta === TRAMO.hasta);
        expect(nuevo, `El Tarifario tiene que tener el corte ${TRAMO.desde} - ${TRAMO.hasta}`).toBeTruthy();
        const factor = 1 + PORCENTAJE / 100;
        for (const tipo of ['sgl', 'dbl', 'tpl'] as const) {
          const esperado = (base![tipo] ?? NaN) * factor;
          expect(Math.abs((nuevo![tipo] ?? NaN) - esperado),
            `${tipo.toUpperCase()}: esperado ${base![tipo]} + ${PORCENTAJE}% = ${esperado.toFixed(2)}, se ve ${nuevo![tipo]}`)
            .toBeLessThanOrEqual(1);
        }
      });
    } finally {
      await paso(page, `Limpiar: borrar lo extendido del ${TRAMO.desde} al ${TRAMO.hasta}`, async () => {
        await adjuntarTexto('Borrado final', await habitacion.eliminarTarifas(ROOM, TRAMO.desde, TRAMO.hasta));
        await habitacion.generarTarifario(ROOM);
      });
    }
  });
});
