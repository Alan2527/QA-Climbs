import { test, expect, Page, BrowserContext } from '@playwright/test';
import { TarifarioNuevoPage } from '../../../pages/climbs/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { porTarifa, compararPrecios } from '../../../utils/markups';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import candidatos from '../../../data/candidatos.json';

const T = candidatos.tarifario as Record<string, any>;
const M = candidatos.markups;
const SALTO = '\n';

/**
 * TARIFARIO — app nueva (ClimbsApp). Markups por tipo de producto (US 4770 / 4798).
 *
 * Los mismos dos tests que tests/bloque-a/markups.spec.ts, con los mismos titulos: el mismo
 * item con dos usuarios, precio contra precio.
 * - pablo1: agencia sin markup de mercado, CustomMarkup 0,50.
 * - autoqa.markups: mercado 37 (0,80 hoteles / 0,60 servicios), CustomMarkup 1,00.
 * El precio es techo(tarifa / markup del tipo / CustomMarkup): el de autoqa.markups tiene que
 * ser el de pablo1 por 0,50 / markup del tipo, con 1 de margen por el redondeo. Solo lee.
 */
test.describe('Markups por tipo de producto', () => {
  test.describe.configure({ mode: 'serial', retries: process.env.CI ? 2 : 0 });

  let contexto: BrowserContext;
  let pagina: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina } = await abrirSesionDeOtraAgencia(browser, baseURL));
  });
  test.afterAll(async () => { await contexto?.close(); });
  test.beforeEach(() => reiniciarNumeracionDePasos());

  /** Recorre el tarifario hasta el item y devuelve su tabla de tarifas (la primera habitacion en un hotel). */
  async function tarifasDe(page: Page, solapa: string, item: any): Promise<string[][]> {
    const t = new TarifarioNuevoPage(page);
    await t.irDesdeElMenu();
    await t.filtrar('Argentina', 'Buenos Aires');
    await t.abrirSolapa(solapa);
    await t.buscarPorNombre(item.terminoBusqueda, item.nombre);
    await t.verTarifario(t.card(item.nombre));
    // Sin la marca "Tarifa extendida": pablo1 (personal) la ve y la agencia no, y aca se
    // comparan precios, no la marca. Con ella las filas no se emparejaban.
    const filas = (await t.tablaDelExplorador()).map((f) => f.map((c) => c.replace(/\s*Tarifa extendida/gi, '').trim()));
    await t.cerrarDialogo();
    return filas;
  }

  async function validarMarkup(page: Page, solapa: string, item: any, titulo: string, markupDelTipo: number) {
    let referencia = new Map<string, number>();
    let conMarkup = new Map<string, number>();
    let markupPablo = 0;

    await paso(page, `Leer el tarifario de "${item.nombre}" con pablo1`, async () => {
      const filas = await tarifasDe(page, solapa, item);
      const leido = await new TarifarioNuevoPage(page).markupActivo();
      markupPablo = leido ?? candidatos._formulaPrecio.markupPorDefecto;
      referencia = porTarifa(filas);
      await adjuntarTexto('Tarifas de pablo1', `markup del usuario: ${markupPablo}${leido === null ? ' (no se pudo leer, se usa el documentado)' : ''}\n\n${filas.map((f) => f.join(' | ')).join(SALTO)}`);
      expect(referencia.size, 'pablo1 tiene que ver tarifas con importe').toBeGreaterThan(0);
    });

    await paso(pagina, `Leer el mismo tarifario con ${M.usuario.userName}`, async () => {
      const filas = await tarifasDe(pagina, solapa, item);
      conMarkup = porTarifa(filas);
      await adjuntarTexto(`Tarifas de ${M.usuario.userName}`, filas.map((f) => f.join(' | ')).join(SALTO));
      expect(conMarkup.size, `${M.usuario.userName} tiene que ver tarifas con importe`).toBeGreaterThan(0);
    });

    await paso(pagina, `${titulo}: cada precio aplica el markup ${markupDelTipo} del mercado ${M.mercado.id}`, async () => {
      const divisor = markupDelTipo * M.usuario.customMarkup;
      const { lineas, fuera } = compararPrecios(referencia, conMarkup, markupPablo, divisor);
      await adjuntarTexto('Comparacion por tarifa', `precio esperado = precio de pablo1 x ${markupPablo} / ${divisor}\n\n${lineas.join(SALTO)}`);
      expect(conMarkup.size, 'Los dos usuarios tienen que ver las mismas tarifas').toBe(referencia.size);
      expect(fuera, `Tarifas que no aplican el markup ${markupDelTipo}:\n${fuera.join(SALTO)}`).toEqual([]);
    });
  }

  test('Hoteles: aplica el markup de hoteles del mercado', async ({ page }) => {
    test.setTimeout(600_000);
    await validarMarkup(page, 'Hoteles', T.hoteles, 'Hoteles', M.mercado.hotelMarkup);
  });

  test('Servicios: aplica el markup de servicios del mercado', async ({ page }) => {
    test.setTimeout(600_000);
    await validarMarkup(page, 'Excursiones', T.excursiones, 'Servicios', M.mercado.serviceMarkup);
  });
});
