import { test, expect, Page, BrowserContext } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import {
  abrirSesionDeMarkups, tarifasDe, porTarifa, compararPrecios, ItemDelTarifario as Item,
  conBackofficeNuevo, costosDelServicio, cortesDeLaHabitacion, exigirPreciosDeServicio, exigirPreciosDeHabitacion,
} from '../../utils/markups';
import candidatos from '../../data/candidatos.json';
import { recargoEnFichaYCarritoViejo, ServicioConRecargo } from '../../utils/recargo-por-idioma';

const T = candidatos.tarifario;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);
/** La tabla que muestra el tarifario del hotel 5003 es la de su primera habitacion, King Deluxe. */
const HABITACION_DEL_HOTEL = 9193;
/**
 * Recargo por idioma con el markup de cada usuario: el servicio AUTO-QA 7967 (copia de Tigre y Delta) tiene la
 * tarifa Regular en pesos y English ARS 15.000 fijos por pasajero. US 4739: "el valor final tiene que calcularse
 * aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el costo solo". En la ficha y
 * en el carrito, por persona: techo((costo + recargo) / cotizacion / markup), con el markup de cada usuario.
 */
const RP = candidatos.recargoFijoEnPesos;

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
 * Importes: el precio es techo(costo / cotizacion / markup del tipo / CustomMarkup), con el
 * costo de cada tarifa leido en el Backoffice nuevo (servicio 5 en pesos, cotizacion 1.000;
 * habitacion 9193 del hotel 5003 en dolares, cortes "Por persona"). Se exige con los dos
 * usuarios, tarifa por tarifa y sin margen. Ademas el de autoqa.markups tiene que ser el de
 * pablo1 por 0,50 / markup del tipo. Los dos markups del mercado son distintos a proposito: si
 * el sistema aplicara el de hoteles a los servicios, o al reves, no da.
 *
 * Solo lee: no reserva ni toca datos.
 */
test.describe('Markups por tipo de producto', () => {
  // Solo lee: reintentar es inocuo. En CI absorbe flakes de ambiente (login/BO lento).
  test.describe.configure({ mode: 'serial', retries: process.env.CI ? 2 : 0 });

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

  type Costos = { servicio?: number; habitacion?: number };

  async function validarMarkup(page: Page, item: Item, titulo: string, markupDelTipo: number, desde: Costos): Promise<number> {
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
      await adjuntarTexto(`Importes de ${quien}`, `precio = techo(costo / cotizacion / ${divisor})` + SALTO + SALTO + lineas.join(SALTO));
      expect(lineas.length, `${quien}: tiene que haber precios para comparar`).toBeGreaterThan(0);
      expect(fuera, `${quien}: precios que no son techo(costo / ${divisor})` + SALTO + fuera.join(SALTO)).toEqual([]);
    };

    await paso(page, `Leer el tarifario de "${item.nombre}" con pablo1`, async () => {
      const filas = await tarifasDe(page, item);
      filasPablo = filas;
      const leido = await new TarifarioPage(page).markupActivo();
      // "M 0,00" es sin markup personal: el sistema no divide (vale 1).
      markupPablo = leido === 0 ? 1 : leido ?? candidatos._formulaPrecio.markupPorDefecto;
      referencia = porTarifa(filas);
      await adjuntarTexto('Tarifas de pablo1',
        `markup del usuario: ${markupPablo}${leido === null ? ' (no se pudo leer, se usa el documentado)' : ''}` +
        SALTO + SALTO + filas.map((f) => f.join(' | ')).join(SALTO));
      expect(referencia.size, 'pablo1 tiene que ver tarifas con importe').toBeGreaterThan(0);
    });

    await paso(pagina, `Leer el mismo tarifario con ${M.usuario.userName}`, async () => {
      const filas = await tarifasDe(pagina, item);
      filasMarkups = filas;
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

    await paso(page, `${titulo}: los precios de pablo1 son exactamente techo(costo / ${markupPablo})`, async () => {
      await exigirImportes(filasPablo, markupPablo, 'pablo1');
    });

    await paso(pagina, `${titulo}: los precios de ${M.usuario.userName} son exactamente techo(costo / ${markupDelTipo * M.usuario.customMarkup})`, async () => {
      await exigirImportes(filasMarkups, markupDelTipo * M.usuario.customMarkup, M.usuario.userName);
    });
    return markupPablo;
  }

  test('Hoteles: aplica el markup de hoteles del mercado', async ({ page }) => {
    test.setTimeout(300_000);
    await validarMarkup(page, T.hoteles as Item, 'Hoteles', M.mercado.hotelMarkup, { habitacion: HABITACION_DEL_HOTEL });
  });

  test('Servicios: aplica el markup de servicios del mercado', async ({ page }) => {
    test.setTimeout(300_000);
    const markupPablo = await validarMarkup(page, T.excursiones as Item, 'Servicios', M.mercado.serviceMarkup, { servicio: T.excursiones.id });
    const tarifas = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, RP.id));
    const recargo = (): ServicioConRecargo => ({
      pais: RP.ciudad.pais, ciudad: RP.ciudad.nombre, termino: RP.terminoBusqueda, nombre: RP.nombre, modalidad: 'Regular',
      fecha: new Date(RP.fecha + 'T00:00:00'), tipo: RP.tipo, tipoValor: String(RP.serviceTypeId), tarifas,
    });
    await paso(page, `Servicios: en English el recargo lleva el markup ${markupPablo} de pablo1, en la ficha y en el carrito`, async () => {
      await recargoEnFichaYCarritoViejo(page, recargo(), markupPablo, 'pablo1');
    });
    await paso(pagina, `Servicios: en English el recargo lleva el markup ${M.mercado.serviceMarkup} del mercado de ${M.usuario.userName}`, async () => {
      await recargoEnFichaYCarritoViejo(pagina, recargo(), M.mercado.serviceMarkup * M.usuario.customMarkup, M.usuario.userName);
    });
  });
});
