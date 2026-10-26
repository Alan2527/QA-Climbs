import { test, expect, Page } from '@playwright/test';
import { HabitacionNuevaPage } from '../../../pages/climbs/habitacion.page';
import { TarifarioNuevoPage } from '../../../pages/climbs/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import candidatos from '../../../data/candidatos.json';

const E = candidatos.extensionTarifas;
const C = E.cargaManual;

/**
 * WEBADMIN — app nueva (ClimbsApp). Observaciones y regimen de comidas de una habitacion.
 *
 * El mismo test que tests/webadmin/observaciones-y-regimen.spec.ts, con el mismo titulo. En la
 * app nueva la observacion se carga en la solapa Observaciones de la habitacion del Backoffice
 * ("Nueva observacion", texto por idioma) y el regimen es el combo "Regimen de comidas" de
 * Detalle; los dos se graban con el "Guardar" de la ficha. En el tarifario del portal nuevo el
 * regimen va junto al nombre de la habitacion ("· Media Pension") y la observacion, debajo de
 * las fechas del corte.
 *
 * Sobre la habitacion propia 18371 (hotel 15422), corte de la carga manual de agosto 2028:
 * 1. Cargar una observacion para el periodo: el portal la muestra debajo de las fechas del
 *    corte. Cargar otra sobre el mismo periodo se rechaza.
 * 2. Ponerle un regimen: el portal lo muestra junto al nombre de la habitacion.
 * Al final borra la observacion y deja el regimen como estaba, aunque falle.
 */
test.describe('WebAdmin — observaciones y regimen de habitacion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const PERIODO = `${C.desde} - ${C.hasta}`;
  const REGIMEN = 'Media Pensión';

  /** El explorador del hotel en el portal: el encabezado de la habitacion y la observacion del corte. */
  async function enElPortal(page: Page) {
    const t = new TarifarioNuevoPage(page);
    await t.irDesdeElMenu();
    await t.filtrar('Argentina', 'Buenos Aires');
    await t.abrirSolapa('Hoteles');
    await t.buscarPorNombre(E.terminoBusqueda, E.hotelNombre);
    const dialogo = await t.verTarifario(t.card(E.hotelNombre));
    const cabecera = dialogo.locator('.hr__room-name').first();
    await expect(cabecera, 'El tarifario tiene que mostrar la habitacion del hotel').toBeVisible({ timeout: 60_000 });
    const fila = dialogo.locator('tbody tr').filter({ has: page.locator('.hr__dates', { hasText: PERIODO }) }).first();
    await expect(fila, `El tarifario tiene que mostrar el corte ${PERIODO}`).toBeVisible({ timeout: 60_000 });
    const observacion = fila.locator('th small:not(.hr__extended)');
    const estado = {
      cabecera: (await cabecera.innerText()).replace(/\s+/g, ' ').trim(),
      observacion: (await observacion.count()) ? (await observacion.first().innerText()).replace(/\s+/g, ' ').trim() : '',
    };
    await adjuntarTexto('Portal: habitacion y corte', JSON.stringify(estado, null, 1));
    return { ...estado, cabeceraLoc: cabecera, filaLoc: fila, cerrar: () => t.cerrarDialogo() };
  }

  test('La observacion del periodo y el regimen de la habitacion se ven en el tarifario del portal', async ({ page }) => {
    test.setTimeout(900_000);
    const hab = new HabitacionNuevaPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const texto = `Observacion AUTO-QA ${sello}: incluye traslado`;
    let regimenOriginal = '';

    await paso(page, 'Tomar como esta la habitacion: regimen y observaciones', async () => {
      await hab.abrir(ROOM);
      regimenOriginal = await hab.regimen();
      const obs = await hab.observaciones();
      await adjuntarTexto('Antes', `regimen: ${regimenOriginal}\nobservaciones: ${JSON.stringify(obs)}`);
      // Si quedo una observacion de una corrida cortada, se borra: el periodo tiene que estar libre.
      if (obs.some((f) => f['Desde'] === C.desde)) {
        await hab.borrarObservacion(C.desde);
        await hab.guardar();
      }
    });

    try {
      await paso(page, `WebAdmin: cargar una observacion para ${PERIODO}`, async () => {
        await hab.abrir(ROOM);
        const error = await hab.nuevaObservacion(C.desde, C.hasta, texto);
        expect(error, 'La observacion tiene que sumarse a los cambios sin error').toBeNull();
        await hab.guardar();
        await hab.abrir(ROOM);
        const obs = await hab.observaciones();
        await adjuntarTexto('Observaciones guardadas', JSON.stringify(obs));
        expect(obs.some((f) => f['Desde'] === C.desde && f['Hasta'] === C.hasta && f['Texto'] === texto),
          'La grilla tiene que listar la observacion del periodo').toBe(true);
      });

      await paso(page, 'WebAdmin: otra observacion sobre el mismo periodo se rechaza', async () => {
        const error = await hab.nuevaObservacion(C.desde, C.hasta, `${texto} (duplicada)`);
        await adjuntarTexto('Aviso', String(error));
        expect(error, 'Un periodo superpuesto tiene que rechazarse').not.toBeNull();
        expect(await hab.textoDePendientes(), 'Rechazada, no tiene que quedar un cambio pendiente').toBe('');
      });

      await paso(page, `WebAdmin: ponerle el regimen ${REGIMEN}`, async () => {
        await hab.abrir(ROOM);
        await hab.elegirRegimen(REGIMEN);
        await hab.guardar();
        await hab.abrir(ROOM);
        expect(await hab.regimen(), 'El regimen tiene que quedar guardado').toBe(REGIMEN);
      });

      await paso(page, 'Portal: el corte muestra la observacion y la habitacion el regimen', async () => {
        const e = await enElPortal(page);
        await conResaltado(page, e.filaLoc, 'Observacion del corte', () => {
          expect(e.observacion, 'Debajo de las fechas del corte tiene que ir la observacion cargada').toBe(texto);
        });
        await conResaltado(page, e.cabeceraLoc, 'Regimen de la habitacion', () => {
          expect(e.cabecera, 'Junto al nombre de la habitacion tiene que ir el regimen').toContain(`· ${REGIMEN}`);
        });
        await e.cerrar();
      });
    } finally {
      await paso(page, 'Restaurar: borrar la observacion y volver el regimen al original', async () => {
        await hab.abrir(ROOM);
        if ((await hab.observaciones()).some((f) => f['Desde'] === C.desde)) await hab.borrarObservacion(C.desde);
        await hab.elegirRegimen(regimenOriginal || 'Sin régimen');
        await hab.guardarSiHayCambios();
        await hab.abrir(ROOM);
        const obs = await hab.observaciones();
        expect(obs.some((f) => f['Desde'] === C.desde), 'No tiene que quedar la observacion de la prueba').toBe(false);
      });
    }

    await paso(page, 'Portal: sin observacion ni regimen, el tarifario vuelve a como estaba', async () => {
      const e = await enElPortal(page);
      expect(e.observacion, 'Borrada, el corte no tiene que mostrar observacion').toBe('');
      if (regimenOriginal === 'Sin régimen') {
        expect(e.cabecera, 'Sin regimen, la habitacion no tiene que mostrarlo').not.toContain(`· ${REGIMEN}`);
      }
    });
  });
});
