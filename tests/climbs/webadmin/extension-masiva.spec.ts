import { test, expect } from '@playwright/test';
import { HabitacionNuevaPage, Corte } from '../../../pages/climbs/habitacion.page';
import { HotelesNuevoPage } from '../../../pages/climbs/hoteles.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import candidatos from '../../../data/candidatos.json';

const E = candidatos.extensionTarifas;
const SALTO = String.fromCharCode(10);

/**
 * WEBADMIN — app nueva (ClimbsApp). Extension masiva de tarifas desde el listado de hoteles.
 *
 * El mismo test que tests/webadmin/extension-masiva.spec.ts, con el mismo titulo. En la app
 * nueva es "Extender tarifas" del listado de hoteles del Backoffice (/hotels/hotels): se
 * eligen los hoteles en la grilla y la hoja calcula y despues extiende, con confirmacion.
 *
 * Guardas, para no tocar nada ajeno:
 * - el listado se filtra por el nombre del hotel de prueba y tiene que quedar SOLO el 15422;
 * - la barra tiene que decir "1 hotel elegido" y el calculo y la confirmacion, 1 habitacion.
 *
 * Modo "Extender ultimo tramo tarifario" al 10%: toma el tramo que llega mas lejos (el de la
 * carga manual de agosto 2028) y lo repite desde el dia siguiente hasta el 30/09/2028. Antes y
 * despues borra ese tramo desde la ficha de la habitacion, asi cada corrida arranca igual.
 */
test.describe('WebAdmin — extension masiva de tarifas', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const HOTEL_ID = E.hotelId;
  const TRAMO = { desde: '16/08/2028', hasta: '30/09/2028' };
  const PORCENTAJE = 10;
  const formato = (c: Corte) => `${c.desde} - ${c.hasta} | SGL ${c.sgl} | DBL ${c.dbl} | TPL ${c.tpl} | ${c.extendida ? 'Extendida' : '-'}`;
  const fecha = (t: string) => { const [d, m, a] = t.split('/').map(Number); return new Date(a, m - 1, d).getTime(); };

  async function borrarTramo(hab: HabitacionNuevaPage): Promise<string> {
    await hab.abrir(ROOM);
    const error = await hab.borrarRango(TRAMO.desde, TRAMO.hasta);
    expect(error, 'Borrar el rango tiene que sumarse a los cambios').toBeNull();
    const pendientes = await hab.textoDePendientes();
    // Si el tramo ya estaba vacio no hay diferencias para guardar.
    if (/Sin diferencias en los días/i.test(pendientes)) await hab.descartarCambios();
    else await hab.guardar();
    return pendientes;
  }

  test('Extender el ultimo corte de un solo hotel crea las tarifas hasta la fecha pedida', async ({ page }) => {
    test.setTimeout(600_000);
    const hab = new HabitacionNuevaPage(page);
    const hoteles = new HotelesNuevoPage(page);
    let base: Corte | undefined;

    await paso(page, `Dejar la habitacion ${ROOM} sin tarifas del ${TRAMO.desde} al ${TRAMO.hasta}`, async () => {
      await hab.abrir(ROOM);
      const previos = await hab.tarifario();
      if (previos.some((c) => fecha(c.hasta) >= fecha(TRAMO.desde))) {
        await adjuntarTexto('Borrado previo', await borrarTramo(hab));
        await hab.abrir(ROOM);
      }
      const cortes = await hab.tarifario();
      await adjuntarTexto('Tarifario de partida', cortes.map(formato).join(SALTO));
      base = [...cortes].sort((a, b) => fecha(b.hasta) - fecha(a.hasta))[0];
      expect(base, 'La habitacion tiene que tener cortes').toBeTruthy();
      expect(fecha(base!.hasta), `El ultimo corte tiene que terminar antes del ${TRAMO.desde}`).toBeLessThan(fecha(TRAMO.desde));
    });

    try {
      await paso(page, 'Listado de hoteles: el modal tiene que listar solo el hotel de prueba', async () => {
        const ids = await hoteles.buscar(E.terminoBusqueda);
        await adjuntarTexto('Hoteles del listado', ids.join(', '));
        expect(ids, `Filtrando por "${E.terminoBusqueda}" el listado tiene que mostrar solo el ${HOTEL_ID}`).toEqual([String(HOTEL_ID)]);
        await hoteles.elegirParaExtender(E.hotelNombre);
        const elegidos = await hoteles.abrirHoja();
        expect(elegidos, 'Tiene que haber un solo hotel elegido').toBe('1 hotel elegido');
        expect(await hoteles.textoDeLaHoja(), 'La hoja tiene que extender un solo hotel').toContain('de 1 hotel');
      });

      await paso(page, `Extender el ultimo corte un ${PORCENTAJE}% hasta el ${TRAMO.hasta}`, async () => {
        await hoteles.completarHoja({ hasta: TRAMO.hasta, porcentaje: PORCENTAJE, modo: 'Extender último tramo tarifario' });
        const calculo = await hoteles.calcular();
        await adjuntarTexto('Calculo', calculo);
        expect(calculo, 'El calculo tiene que crear tarifas en una sola habitacion').toMatch(/Se crearán [\d.]+ tarifas en 1 habitación/i);
        const { confirmacion, resultado } = await hoteles.extender();
        await adjuntarTexto('Confirmacion', confirmacion);
        await adjuntarTexto('Resultado', resultado);
        expect(confirmacion, 'La confirmacion tiene que hablar de una sola habitacion').toMatch(/en 1 habitación/i);
        expect(resultado, 'Tiene que informar que genero tarifas en una sola habitacion').toMatch(/[\d.]+ tarifas nuevas en 1 habitación/i);
      });

      await paso(page, 'El Tarifario de la habitacion tiene el corte nuevo con el incremento', async () => {
        await hab.abrir(ROOM);
        const cortes = await hab.tarifario();
        await adjuntarTexto('Tarifario despues de extender', cortes.map(formato).join(SALTO));
        const nuevo = cortes.find((c) => c.desde === TRAMO.desde && c.hasta === TRAMO.hasta);
        expect(nuevo, `El Tarifario tiene que tener el corte ${TRAMO.desde} - ${TRAMO.hasta}`).toBeTruthy();
        const factor = 1 + PORCENTAJE / 100;
        for (const tipo of ['sgl', 'dbl', 'tpl'] as const) {
          const esperado = (base![tipo] ?? NaN) * factor;
          expect(Math.abs((nuevo![tipo] ?? NaN) - esperado),
            `${tipo.toUpperCase()}: esperado ${base![tipo]} + ${PORCENTAJE}% = ${esperado.toFixed(2)}, se ve ${nuevo![tipo]}`)
            .toBeLessThanOrEqual(0.01);
        }
      });
    } finally {
      await paso(page, `Limpiar: borrar lo extendido del ${TRAMO.desde} al ${TRAMO.hasta}`, async () => {
        await adjuntarTexto('Borrado final', await borrarTramo(hab));
      });
    }
  });
});
