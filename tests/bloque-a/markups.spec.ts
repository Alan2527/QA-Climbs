import { test, expect, Page, BrowserContext } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import { LoginPage } from '../../pages/login.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, numeroDelPortal } from '../../utils/pasos';
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
    const usuario = process.env.AMV_MARKUP_USER;
    const password = process.env.AMV_MARKUP_PASS;
    expect(usuario, 'Falta AMV_MARKUP_USER en el entorno').toBeTruthy();
    expect(password, 'Falta AMV_MARKUP_PASS en el entorno').toBeTruthy();

    // Contexto propio y sin la sesion de pablo1: los dos usuarios tienen que estar
    // logueados a la vez para mirar el mismo item.
    contexto = await browser.newContext({
      baseURL,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });
    pagina = await contexto.newPage();
    const login = new LoginPage(pagina);
    await login.ingresar(usuario!, password!);
    await login.validarSesionIniciada();
    await login.cerrarAvisosDelPortal();
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  type Item = { tab: string; container: string; nombre: string; terminoBusqueda: string };

  /** Recorre el tarifario hasta el item y devuelve las filas de su tabla de tarifas. */
  async function tarifasDe(page: Page, item: Item): Promise<string[][]> {
    const t = new TarifarioPage(page);
    await page.goto('/online/');
    await t.irDesdeElMenu();
    await t.seleccionarPais('Argentina');
    await t.seleccionarCiudad('Buenos Aires');
    await t.buscar();
    await t.abrirPestania(item.tab, item.container);
    await t.buscarPorNombre(item.terminoBusqueda, item.nombre);
    await t.verTarifario(item.container);
    const filas = await t.leerTablaTarifas(item.container);
    await t.cerrarExplorador();
    return filas;
  }

  /**
   * Tabla -> precio por celda. Los hoteles traen un precio por columna (SGL, DBL,
   * TPL) y los servicios uno por fila: se toma cada celda con importe y se la
   * identifica por las celdas sin importe de su fila (fechas, tipo, pax) mas su
   * posicion, asi se empareja la misma tarifa en los dos usuarios.
   */
  function porTarifa(filas: string[][]): Map<string, number> {
    const conImporte = (c: string) => /(USD|ARS|\$)\s*[0-9]/.test(c);
    const mapa = new Map<string, number>();
    for (const f of filas) {
      const fila = f.filter((c) => !conImporte(c)).join(' | ');
      f.forEach((celda, i) => {
        if (!conImporte(celda)) return;
        const precio = numeroDelPortal(celda);
        if (precio !== null) mapa.set(`${fila} | columna ${i + 1}`, precio);
      });
    }
    return mapa;
  }

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
      const lineas: string[] = [];
      const fuera: string[] = [];
      for (const [clave, p] of referencia) {
        const q = conMarkup.get(clave);
        const minimo = Math.ceil(((p - 1) * markupPablo) / divisor) - 1;
        const maximo = Math.ceil((p * markupPablo) / divisor) + 1;
        const ok = q !== undefined && q >= minimo && q <= maximo;
        lineas.push(`${ok ? 'OK  ' : 'MAL '} ${clave}  ->  pablo1 ${p}  /  esperado ${minimo}..${maximo}  /  obtenido ${q ?? 'sin fila'}`);
        if (!ok) fuera.push(clave);
      }
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
