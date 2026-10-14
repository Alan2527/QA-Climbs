import { test, expect, Page } from '@playwright/test';
import { WebAdminTarifasHabitacionPage } from '../../pages/webadmin-tarifas-habitacion.page';
import { TarifarioPage } from '../../pages/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const E = candidatos.extensionTarifas;
const C = E.cargaManual;

/**
 * WebAdmin — observaciones y regimen de comidas de una habitacion.
 *
 * Son los dos textos que la agencia lee junto al precio del hotel en el tarifario:
 * el regimen va pegado al nombre de la habitacion ("· Media Pension") y la
 * observacion del periodo, debajo de las fechas del corte. Si se pierden, se vende
 * sin avisar que no incluye comidas o sin la condicion del periodo. Los dos
 * cambiaron hace poco (4775 observaciones, 4681/4700 regimen).
 *
 * Sobre la habitacion propia 18371 (hotel 15422), corte 01/08/2031 - 15/08/2031
 * (el de la carga manual):
 * 1. Cargar una observacion para el periodo: el portal la muestra debajo de las
 *    fechas del corte. Cargar otra sobre el mismo periodo se rechaza.
 * 2. Ponerle un regimen: el portal lo muestra junto al nombre de la habitacion.
 * Al final borra la observacion y deja el regimen como estaba, aunque falle.
 *
 * En el portal se mira con pablo1 (espanol).
 */
test.describe('WebAdmin — observaciones y regimen de habitacion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const aISO = (f: string) => f.split('/').reverse().join('-');
  const PERIODO = `${C.desde} - ${C.hasta}`;
  // Un regimen que se note: Media Pension (4). El catalogo es compartido, no se toca.
  const REGIMEN = { valor: '4', texto: 'Media Pensión' };

  /** El tarifario del hotel en el portal: el encabezado de la habitacion y la observacion del corte. */
  async function enElPortal(page: Page) {
    const t = new TarifarioPage(page);
    await page.goto('/online/');
    await t.irDesdeElMenu();
    await t.seleccionarPais('Argentina');
    await t.seleccionarCiudad('Buenos Aires');
    await t.buscar();
    await t.abrirPestania('a-hotels', 'hotels-container');
    await t.buscarPorNombre(E.terminoBusqueda, E.hotelNombre);
    await t.verTarifario('hotels-container');
    const cabecera = page.locator('.accordeon-header').filter({ visible: true }).first();
    await expect(cabecera, 'El tarifario tiene que mostrar la habitacion del hotel').toBeVisible({ timeout: 60_000 });
    const fila = page.locator('tr.tariff-cut-row').filter({ visible: true }).filter({ hasText: PERIODO }).first();
    await expect(fila, `El tarifario tiene que mostrar el corte ${PERIODO}`).toBeVisible({ timeout: 60_000 });
    const estado = {
      cabecera: (await cabecera.innerText()).replace(/\s+/g, ' ').trim(),
      observacion: (await fila.locator('.promo-strg').first().innerText()).replace(/\s+/g, ' ').trim(),
    };
    await adjuntarTexto('Portal: habitacion y corte', JSON.stringify(estado, null, 1));
    return { ...estado, cabeceraLoc: cabecera, filaLoc: fila };
  }

  test('La observacion del periodo y el regimen de la habitacion se ven en el tarifario del portal', async ({ page }) => {
    test.setTimeout(900_000);
    const admin = new WebAdminTarifasHabitacionPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const texto = `Observacion AUTO-QA ${sello}: incluye traslado`;
    let regimenOriginal = { valor: '', texto: '' };

    await paso(page, 'Tomar como esta la habitacion: regimen y observaciones', async () => {
      regimenOriginal = await admin.regimen(ROOM);
      const obs = await admin.observaciones(ROOM);
      await adjuntarTexto('Antes', `regimen: ${JSON.stringify(regimenOriginal)}\nobservaciones: ${JSON.stringify(obs)}`);
      // Si quedo una observacion de una corrida cortada, se borra: el periodo tiene que estar libre.
      if (obs.some((f) => f.includes(C.desde))) await admin.borrarObservacion(ROOM, C.desde);
    });

    try {
      await paso(page, `WebAdmin: cargar una observacion para ${PERIODO}`, async () => {
        const error = await admin.crearObservacion(ROOM, aISO(C.desde), aISO(C.hasta), texto);
        expect(error, 'La observacion tiene que guardarse sin error').toBeNull();
        const obs = await admin.observaciones(ROOM);
        await adjuntarTexto('Observaciones guardadas', JSON.stringify(obs));
        expect(obs.some((f) => f.includes(C.desde) && f.includes(C.hasta) && f.some((c) => c.includes(texto))),
          'La grilla tiene que listar la observacion del periodo').toBe(true);
      });

      await paso(page, 'WebAdmin: otra observacion sobre el mismo periodo se rechaza', async () => {
        const error = await admin.crearObservacion(ROOM, aISO(C.desde), aISO(C.hasta), `${texto} (duplicada)`);
        await adjuntarTexto('Aviso', String(error));
        expect(error, 'Un periodo superpuesto tiene que rechazarse').toMatch(/Ya existe un registro que contiene la fecha indicada/i);
      });

      await paso(page, `WebAdmin: ponerle el regimen ${REGIMEN.texto}`, async () => {
        await admin.guardarDetalle(ROOM, { regimen: REGIMEN.valor });
      });

      await paso(page, 'Portal: el corte muestra la observacion y la habitacion el regimen', async () => {
        const e = await enElPortal(page);
        await conResaltado(page, e.filaLoc, 'Observacion del corte', () => {
          expect(e.observacion, 'Debajo de las fechas del corte tiene que ir la observacion cargada').toBe(texto);
        });
        await conResaltado(page, e.cabeceraLoc, 'Regimen de la habitacion', () => {
          expect(e.cabecera, 'Junto al nombre de la habitacion tiene que ir el regimen').toContain(`· ${REGIMEN.texto}`);
        });
      });
    } finally {
      await paso(page, 'Restaurar: borrar la observacion y volver el regimen al original', async () => {
        await admin.borrarObservacion(ROOM, C.desde);
        await admin.guardarDetalle(ROOM, { regimen: regimenOriginal.valor });
        const obs = await admin.observaciones(ROOM);
        expect(obs.some((f) => f.includes(C.desde)), 'No tiene que quedar la observacion de la prueba').toBe(false);
      });
    }

    await paso(page, 'Portal: sin observacion ni regimen, el tarifario vuelve a como estaba', async () => {
      const e = await enElPortal(page);
      expect(e.observacion, 'Borrada, el corte no tiene que mostrar observacion').toBe('');
      if (!regimenOriginal.valor) {
        expect(e.cabecera, 'Sin regimen, la habitacion no tiene que mostrarlo').not.toContain(`· ${REGIMEN.texto}`);
      }
    });
  });
});
