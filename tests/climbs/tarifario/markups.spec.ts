import { test, expect, Page, BrowserContext } from '@playwright/test';
import { TarifarioNuevoPage } from '../../../pages/climbs/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import {
  porTarifa, compararPrecios, conBackofficeNuevo, costosDelServicio, cortesDeLaHabitacion,
  exigirPreciosDeServicio, exigirPreciosDeHabitacion,
} from '../../../utils/markups';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import candidatos from '../../../data/candidatos.json';
import { recargoEnFichaYCarritoNuevo, ServicioConRecargo } from '../../../utils/recargo-por-idioma';

const T = candidatos.tarifario as Record<string, any>;
const M = candidatos.markups;
const SALTO = '\n';
/** La primera tabla del explorador del hotel 5003 es la de su primera habitacion, King Deluxe. */
const HABITACION_DEL_HOTEL = 9193;
/**
 * Recargo por idioma con el markup de cada usuario: el servicio AUTO-QA 7967 (copia de Tigre y Delta) tiene la
 * tarifa Regular en pesos y English ARS 15.000 fijos por pasajero. US 4739: "el valor final tiene que calcularse
 * aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el costo solo". En la ficha y
 * en el carrito, por persona: techo((costo + recargo) / cotizacion / markup), con el markup de cada usuario.
 */
const RP = candidatos.recargoFijoEnPesos;

/**
 * TARIFARIO — app nueva (ClimbsApp). Markups por tipo de producto (US 4770 / 4798).
 *
 * Los mismos dos tests que tests/bloque-a/markups.spec.ts, con los mismos titulos: el mismo
 * item con dos usuarios, precio contra precio.
 * - pablo1: agencia sin markup de mercado, CustomMarkup 0,50.
 * - autoqa.markups: mercado 37 (0,80 hoteles / 0,60 servicios), CustomMarkup 1,00.
 * Importes: el precio es techo(costo / cotizacion / markup del tipo / CustomMarkup), con el costo
 * de cada tarifa leido en el Backoffice nuevo (servicio 5 en pesos, cotizacion 1.000; habitacion
 * 9193 en dolares). Se exige con los dos usuarios, tarifa por tarifa y sin margen. Ademas el de
 * autoqa.markups tiene que ser el de pablo1 por 0,50 / markup del tipo. Solo lee.
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

  type Costos = { servicio?: number; habitacion?: number };

  async function validarMarkup(page: Page, solapa: string, item: any, titulo: string, markupDelTipo: number, desde: Costos): Promise<number> {
    let referencia = new Map<string, number>();
    let conMarkup = new Map<string, number>();
    let filasPablo: string[][] = [];
    let filasMarkups: string[][] = [];
    let markupPablo = 0;

    // Importe absoluto: cada precio = techo(costo / cotizacion / divisor), con el costo del Backoffice.
    const exigirImportes = async (filas: string[][], divisor: number, quien: string) => {
      const { lineas, fuera } = await conBackofficeNuevo(page.context().browser()!, async (bo) => desde.servicio
        ? exigirPreciosDeServicio(filas, await costosDelServicio(bo, desde.servicio), divisor)
        : exigirPreciosDeHabitacion(filas, await cortesDeLaHabitacion(bo, desde.habitacion!), divisor));
      await adjuntarTexto(`Importes de ${quien}`, `precio = techo(costo / cotizacion / ${divisor})\n\n${lineas.join(SALTO)}`);
      expect(lineas.length, `${quien}: tiene que haber precios para comparar`).toBeGreaterThan(0);
      expect(fuera, `${quien}: precios que no son techo(costo / ${divisor})\n${fuera.join(SALTO)}`).toEqual([]);
    };

    await paso(page, `Leer el tarifario de "${item.nombre}" con pablo1`, async () => {
      const filas = await tarifasDe(page, solapa, item);
      filasPablo = filas;
      const leido = await new TarifarioNuevoPage(page).markupActivo();
      // El encabezado muestra "M 0,00" cuando el usuario no tiene markup propio: no divide (vale 1).
      markupPablo = leido === 0 ? 1 : leido ?? candidatos._formulaPrecio.markupPorDefecto;
      referencia = porTarifa(filas);
      await adjuntarTexto('Tarifas de pablo1', `markup del usuario: ${markupPablo}${leido === null ? ' (no se pudo leer, se usa el documentado)' : ''}\n\n${filas.map((f) => f.join(' | ')).join(SALTO)}`);
      expect(referencia.size, 'pablo1 tiene que ver tarifas con importe').toBeGreaterThan(0);
    });

    await paso(pagina, `Leer el mismo tarifario con ${M.usuario.userName}`, async () => {
      const filas = await tarifasDe(pagina, solapa, item);
      filasMarkups = filas;
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

    await paso(page, `${titulo}: los precios de pablo1 son exactamente techo(costo / ${markupPablo})`, async () => {
      await exigirImportes(filasPablo, markupPablo, 'pablo1');
    });

    await paso(pagina, `${titulo}: los precios de ${M.usuario.userName} son exactamente techo(costo / ${markupDelTipo * M.usuario.customMarkup})`, async () => {
      await exigirImportes(filasMarkups, markupDelTipo * M.usuario.customMarkup, M.usuario.userName);
    });
    return markupPablo;
  }

  test('Hoteles: aplica el markup de hoteles del mercado', async ({ page }) => {
    test.setTimeout(600_000);
    await validarMarkup(page, 'Hoteles', T.hoteles, 'Hoteles', M.mercado.hotelMarkup, { habitacion: HABITACION_DEL_HOTEL });
  });

  test('Servicios: aplica el markup de servicios del mercado', async ({ page }) => {
    test.setTimeout(600_000);
    const markupPablo = await validarMarkup(page, 'Excursiones', T.excursiones, 'Servicios', M.mercado.serviceMarkup, { servicio: T.excursiones.id });
    const tarifas = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, RP.id));
    const recargo = (): ServicioConRecargo => ({
      pais: RP.ciudad.pais, ciudad: RP.ciudad.nombre, termino: RP.terminoBusqueda, nombre: RP.nombre, modalidad: 'Regular',
      fecha: new Date(RP.fecha + 'T00:00:00'), tipo: RP.tipo, tipoValor: String(RP.serviceTypeId), tarifas,
    });
    await paso(page, `Servicios: en English el recargo lleva el markup ${markupPablo} de pablo1, en la ficha y en el carrito`, async () => {
      await recargoEnFichaYCarritoNuevo(page, recargo(), markupPablo, 'pablo1');
    });
    await paso(pagina, `Servicios: en English el recargo lleva el markup ${M.mercado.serviceMarkup} del mercado de ${M.usuario.userName}`, async () => {
      await recargoEnFichaYCarritoNuevo(pagina, recargo(), M.mercado.serviceMarkup * M.usuario.customMarkup, M.usuario.userName);
    });
  });
});
