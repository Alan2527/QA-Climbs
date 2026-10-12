import { test, expect, Page, BrowserContext } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import { abrirSesionDeMarkups, tarifasDe, porTarifa, compararPrecios, ItemDelTarifario as Item } from '../../utils/markups';
import candidatos from '../../data/candidatos.json';

const T = candidatos.tarifario;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);

/**
 * Bloque A — Markups por tipo de producto (US 4770 / 4798).
 *
 * El mismo item se mira con dos usuarios y se compara precio contra precio:
 *
 * - **pablo1**, el usuario de toda la suite: agencia 1 sin markup de mercado y
 *   `CustomMarkup` 0,50.
 * - **autoqa.markups**, propio de este test: agencia 6334 en el mercado 37, que
 *   divide por 0,80 en hoteles y por 0,60 en servicios, con `CustomMarkup` 1,00.
 *
 * El precio es techo(tarifa / markup del tipo / CustomMarkup), asi que no hace falta
 * conocer la tarifa base: el de autoqa.markups tiene que ser el de pablo1 por
 * 0,50 / markup del tipo, con un margen de 1 por el redondeo hacia arriba. Los dos
 * markups del mercado son distintos a proposito: si el sistema aplicara el de
 * hoteles a los servicios, o al reves, la proporcion no da.
 *
 * Solo lee: no reserva ni toca datos.
 */
test.describe('Markups por tipo de producto', () => {
  test.describe.configure({ mode: 'serial' });

  let contexto: BrowserContext;
  let pagina: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina } = await abrirSesionDeMarkups(browser, baseURL));
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  async function validarMarkup(page: Page, item: Item, titulo: string, markupDelTipo: number) {
    let referencia = new Map<string, number>();
    let conMarkup = new Map<string, number>();
    let markupPablo = 0;

    await paso(page, `Leer el tarifario de "${item.nombre}" con pablo1`, async () => {
      const filas = await tarifasDe(page, item);
      const leido = await new TarifarioPage(page).markupActivo();
      markupPablo = leido ?? candidatos._formulaPrecio.markupPorDefecto;
      referencia = porTarifa(filas);
      await adjuntarTexto('Tarifas de pablo1',
        `markup del usuario: ${markupPablo}${leido === null ? ' (no se pudo leer, se usa el documentado)' : ''}` +
        SALTO + SALTO + filas.map((f) => f.join(' | ')).join(SALTO));
      expect(referencia.size, 'pablo1 tiene que ver tarifas con importe').toBeGreaterThan(0);
    });

    await paso(pagina, `Leer el mismo tarifario con ${M.usuario.userName}`, async () => {
      const filas = await tarifasDe(pagina, item);
      conMarkup = porTarifa(filas);
      await adjuntarTexto(`Tarifas de ${M.usuario.userName}`, filas.map((f) => f.join(' | ')).join(SALTO));
      expect(conMarkup.size, `${M.usuario.userName} tiene que ver tarifas con importe`).toBeGreaterThan(0);
    });

    await paso(pagina, `${titulo}: cada precio aplica el markup ${markupDelTipo} del mercado ${M.mercado.id}`, async () => {
      // pablo1 ve techo(x / markupPablo); el usuario nuevo, techo(x / markupDelTipo / CustomMarkup).
      // De un precio p de pablo1, x esta en ((p-1) * markupPablo, p * markupPablo].
      const divisor = markupDelTipo * M.usuario.customMarkup;
      const { lineas, fuera } = compararPrecios(referencia, conMarkup, markupPablo, divisor);
      await adjuntarTexto('Comparacion por tarifa',
        `precio esperado = precio de pablo1 x ${markupPablo} / ${divisor}` + SALTO + SALTO + lineas.join(SALTO));

      expect(conMarkup.size, 'Los dos usuarios tienen que ver las mismas tarifas').toBe(referencia.size);
      expect(fuera, `Tarifas que no aplican el markup ${markupDelTipo}:` + SALTO + fuera.join(SALTO)).toEqual([]);
    });
  }

  test('Hoteles: aplica el markup de hoteles del mercado', async ({ page }) => {
    await validarMarkup(page, T.hoteles as Item, 'Hoteles', M.mercado.hotelMarkup);
  });

  test('Servicios: aplica el markup de servicios del mercado', async ({ page }) => {
    await validarMarkup(page, T.excursiones as Item, 'Servicios', M.mercado.serviceMarkup);
  });
});
