import { test, expect, Page, BrowserContext } from '@playwright/test';
import { WebAdminMarkupsPage } from '../../pages/webadmin-markups.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import {
  abrirSesionDeMarkups, tarifasDe, porTarifa, compararPrecios, ItemDelTarifario, leerCostos, exigirImportes, CostosDelItem,
} from '../../utils/markups';
import candidatos from '../../data/candidatos.json';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage } from '../../pages/carrito.page';
import { TarifaDeServicio } from '../../pages/climbs/servicio.page';
import { conResaltado, esperarFinDeCarga } from '../../utils/pasos';
import { conBackofficeNuevo, costosDelServicio, precioConIdioma, tarifaVigente, mismoIdioma } from '../../utils/markups';
import { importeDelPortal } from '../bloque-b/reservas-comun';

const T = candidatos.tarifario;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);

/** Servicio de Cusco (sucursal Peru), creado por pantalla el 24/11/2026 como copia del 7737, con tarifas hasta 2031. */
const ID_CUSCO = 7966;
const CUSCO: ItemDelTarifario = {
  tab: T.excursiones.tab, container: T.excursiones.container,
  nombre: 'AUTO-QA NO TOCAR - Valle Sagrado (Cusco)', terminoBusqueda: 'Valle Sagrado', pais: 'Perú', destino: 'Cusco',
};
/** Servicio de Buenos Aires (sucursal Argentina), el mismo del test de markups de mercado. */
const BUENOS_AIRES: ItemDelTarifario = { tab: T.excursiones.tab, container: T.excursiones.container, nombre: T.excursiones.nombre, terminoBusqueda: T.excursiones.terminoBusqueda };
const PERU = 'Perú';
/**
 * Recargo por idioma de Cusco: English USD 15 por pasajero en sus tres tarifas Regular, cargado por
 * pantalla en el BO nuevo el 25/11/2026 (con Español y English en Idiomas en regular y en privado).
 * Fecha dentro de la tarifa Regular 2027-2029 (minimo 2 pasajeros).
 */
const IDIOMA_CON_RECARGO = /^(English|Ingl[eé]s)$/i;
const FECHA_CUSCO = new Date(2027, 1, 10);
const ARGENTINA = 'Argentina';

/**
 * WebAdmin viejo — markup del mercado por sucursal (Azure 5107, PR 8276 del 17/11/2026).
 *
 * El mismo flujo que tests/climbs/webadmin/markup-por-sucursal.spec.ts, en el WebAdmin y el portal
 * viejos. En la ficha del mercado cada sucursal tiene su fila: "Por defecto" toma el markup de la
 * sucursal; "Manual" fija el del mercado en esa sucursal. El markup que se aplica a un producto es el
 * de la sucursal que cubre el pais del destino: Peru cubre Peru y Bolivia; Argentina (casa matriz),
 * Argentina y los paises sin sucursal.
 *
 * Se mira con `autoqa.markups` (agencia 6334, mercado 37, solo esa agencia) en el tarifario del
 * portal viejo: un servicio de Cusco y uno de Buenos Aires.
 *
 * Importes: cada precio de Cusco tiene que ser exactamente techo(costo / markup de servicios de
 * Peru), con el costo de cada tarifa leido en el Backoffice nuevo (USD). Se exige con el markup
 * heredado, con Peru en Manual 0,50 y otra vez al volver a "Por defecto". Buenos Aires tiene que ser
 * techo(costo / cotizacion / markup de servicios de Argentina) y no cambiar, precio por precio.
 * El finally deja Peru en "Por defecto" aunque el test falle.
 */
test.describe('WebAdmin — markup por sucursal', () => {
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });

  let contexto: BrowserContext;
  let portal: Page;
  let costosCusco: CostosDelItem;
  let costosBA: CostosDelItem;
  let tarifasCusco: TarifaDeServicio[];

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina: portal } = await abrirSesionDeMarkups(browser, baseURL));
    costosCusco = await leerCostos(browser, { servicio: ID_CUSCO });
    costosBA = await leerCostos(browser, { servicio: T.excursiones.id });
    tarifasCusco = await conBackofficeNuevo(browser, (bo) => costosDelServicio(bo, ID_CUSCO));
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => reiniciarNumeracionDePasos());

  /** Lee el tarifario y exige techo(costo / cotizacion / markup) en cada precio. */
  async function leer(item: ItemDelTarifario, costos: CostosDelItem, markup: number, titulo: string): Promise<Map<string, number>> {
    const filas = (await tarifasDe(portal, item)).map((f) => f.map((c) => c.replace(/\s*Tarifa extendida/gi, '').trim()));
    await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
    const precios = porTarifa(filas);
    expect(precios.size, `${M.usuario.userName} tiene que ver tarifas con importe de "${item.nombre}"`).toBeGreaterThan(0);
    await exigirImportes(filas, costos, markup * M.usuario.customMarkup, titulo);
    return precios;
  }

  /**
   * Ficha y carrito de Cusco en el idioma con recargo. US 4739: "el valor final tiene que calcularse
   * aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el costo solo";
   * US 5107: el servicio toma el markup de la sucursal de su pais (Peru). Precio por persona de la
   * ficha = techo((costo + recargo) / markup de Peru / markup del usuario), y el carrito cobra eso
   * por los pasajeros. Al final vacia el carrito.
   */
  async function fichaYCarritoEnIngles(markup: number, titulo: string) {
    const inicio = new InicioPage(portal);
    const servicio = new ServicioPage(portal);
    const carrito = new CarritoPage(portal);
    const divisor = markup * M.usuario.customMarkup;
    const regular = () => servicio.bloquesDeTarifa()
      .filter({ has: portal.locator('.sd-rate__name', { hasText: /^\s*Regular\s*$/i }) }).first();
    const valor = (t: string, que: string) => {
      const v = importeDelPortal(t).valor;
      expect(v, `${que}: no se pudo leer un importe de "${t}"`).not.toBeNull();
      return v!;
    };
    try {
      await inicio.abrir();
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('servicios');
      await servicio.buscar({ panel, pais: PERU, ciudad: CUSCO.destino!, tipo: 'Excursión', fecha: FECHA_CUSCO });
      await servicio.buscarPorNombre(CUSCO.terminoBusqueda, CUSCO.nombre);
      await servicio.abrirFicha(CUSCO.nombre.slice(0, 24));

      const opciones = await portal.locator('#sdLangSelect option').evaluateAll(
        (os) => os.map((o) => ({ valor: (o as HTMLOptionElement).value, texto: (o.textContent ?? '').trim() })));
      await adjuntarTexto(`${titulo}: idiomas de la ficha`, opciones.map((o) => `${o.valor}=${o.texto}`).join(' | '));
      const ingles = opciones.find((o) => IDIOMA_CON_RECARGO.test(o.texto));
      expect(ingles, `La ficha de Cusco tiene que ofrecer el idioma English. Ofrece: ${opciones.map((o) => o.texto).join(', ')}`).toBeDefined();
      await portal.locator('#sdLangSelect').selectOption(ingles!.valor);
      await esperarFinDeCarga(portal);

      const minimo = Number((await regular().innerText()).match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
      const pax = Math.max(2, minimo);
      await regular().locator(servicio.comboPax).selectOption(String(pax));
      await esperarFinDeCarga(portal);
      const totalFicha = await servicio.esperarTotal();
      const precioFicha = valor(await regular().locator('.sd-rate__price-val').first().innerText(), 'Precio por persona de la ficha');

      const tarifa = tarifaVigente(tarifasCusco, 'Regular', FECHA_CUSCO, pax);
      expect(tarifa, `Cusco tiene que tener una tarifa Regular vigente el ${FECHA_CUSCO.toLocaleDateString('es-AR')}`).toBeDefined();
      const recargo = tarifa!.recargos.find((r) => mismoIdioma(r.idioma, ingles!.texto));
      expect(recargo, `La tarifa Regular de Cusco tiene que tener recargo para ${ingles!.texto}`).toBeDefined();
      const esperado = precioConIdioma(tarifa!, ingles!.texto, divisor, pax)!;

      await servicio.agregarAlCarrito();
      await carrito.irAlCarrito();
      const fila = portal.locator(carrito.filas).filter({ hasText: CUSCO.terminoBusqueda });
      await expect(fila, 'El carrito tiene que traer el servicio de Cusco').toHaveCount(1);
      const lineaTxt = await fila.locator('.ct-row__total').innerText();
      const linea = valor(lineaTxt, 'Linea del carrito');
      await adjuntarTexto(`${titulo}: ficha y carrito en ${ingles!.texto}`, [
        `Tarifa del BO: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargo ${JSON.stringify(recargo)}`,
        `Markup de Peru ${markup} x usuario ${M.usuario.customMarkup} = ${divisor}`,
        `Esperado por persona: techo((costo + recargo) / ${divisor}) = ${esperado}`,
        `Ficha: por persona ${precioFicha}, total ${totalFicha} (${pax} pax)`,
        `Carrito: ${lineaTxt.trim()}`,
      ].join(SALTO));
      await conResaltado(portal, fila, `${titulo}: linea del carrito en ${ingles!.texto}`, () => {
        expect.soft(precioFicha, `${titulo}: en ${ingles!.texto} la ficha tiene que cobrar por persona techo((costo + recargo) / ${divisor}) (US 4739 y 5107)`).toBe(esperado);
        expect.soft(linea, `${titulo}: el carrito tiene que cobrar techo((costo + recargo) / ${divisor}) x ${pax} pasajeros (US 4739 y 5107)`).toBe(esperado * pax);
      });
    } finally {
      await inicio.abrir().catch(() => {});
      await carrito.vaciar().catch(() => {});
    }
  }

  async function mismosPrecios(antes: Map<string, number>, despues: Map<string, number>, que: string) {
    const { lineas, fuera } = compararPrecios(antes, despues, 1, 1);
    await adjuntarTexto(`Comparacion: ${que}`, lineas.join(SALTO));
    expect(fuera, `${que}: tarifas que cambiaron` + SALTO + fuera.join(SALTO)).toEqual([]);
  }

  test('Mercado: el markup Manual de una sucursal mueve solo los precios de sus países y "Por defecto" vuelve al de la sucursal', async ({ page }) => {
    test.setTimeout(600_000);
    const admin = new WebAdminMarkupsPage(page);
    const manualPeru = 0.5;
    let peru = { manual: false, hotel: null as number | null, servicio: null as number | null };
    let argentina = { ...peru };
    let cuscoAntes = new Map<string, number>();
    let baAntes = new Map<string, number>();

    await paso(page, `Mercado ${M.mercado.id}: Perú en "Por defecto" y Argentina en Manual`, async () => {
      await admin.abrirMercado(M.mercado.id);
      peru = await admin.markupDeLaSucursalDelMercado(PERU);
      argentina = await admin.markupDeLaSucursalDelMercado(ARGENTINA);
      await adjuntarTexto('Punto de partida', `Perú: ${JSON.stringify(peru)}` + SALTO + `Argentina: ${JSON.stringify(argentina)}`);
      expect(peru.manual, `Perú tiene que arrancar en "Por defecto" en el mercado ${M.mercado.id}`).toBe(false);
      expect(peru.servicio, 'Perú tiene que mostrar el markup de servicios que hereda de su sucursal').toBeGreaterThan(0);
      expect(argentina, `Argentina tiene que arrancar en Manual ${M.mercado.hotelMarkup} / ${M.mercado.serviceMarkup}`)
        .toEqual({ manual: true, hotel: M.mercado.hotelMarkup, servicio: M.mercado.serviceMarkup });
    });

    await paso(portal, 'Portal: Cusco es techo(costo / markup de Perú) y Buenos Aires techo(costo / markup de Argentina)', async () => {
      cuscoAntes = await leer(CUSCO, costosCusco, peru.servicio!, 'Cusco con el markup heredado de Perú');
      baAntes = await leer(BUENOS_AIRES, costosBA, argentina.servicio!, 'Buenos Aires antes');
    });

    await paso(portal, 'Portal: Cusco en English cobra techo((costo + recargo) / markup de Perú) en la ficha y en el carrito', async () => {
      await fichaYCarritoEnIngles(peru.servicio!, 'Perú por defecto');
    });

    try {
      await paso(page, `Mercado ${M.mercado.id}: llevar Perú a Manual con servicios ${manualPeru}`, async () => {
        await admin.guardarSucursalDelMercado(M.mercado.id, PERU, { hotel: peru.hotel!, servicio: manualPeru });
      });

      await paso(portal, `Portal: Cusco aplica el markup Manual de Perú (${manualPeru})`, async () => {
        await leer(CUSCO, costosCusco, manualPeru, `Cusco con Perú en Manual ${manualPeru}`);
      });

      await paso(portal, `Portal: Cusco en English con Perú en Manual ${manualPeru}: el recargo también lleva ese markup`, async () => {
        await fichaYCarritoEnIngles(manualPeru, `Perú en Manual ${manualPeru}`);
      });

      await paso(portal, 'Portal: Buenos Aires no cambia', async () => {
        await mismosPrecios(baAntes, await leer(BUENOS_AIRES, costosBA, argentina.servicio!, 'Buenos Aires con Perú en Manual'), 'Buenos Aires');
      });

      await paso(page, `Mercado ${M.mercado.id}: volver Perú a "Por defecto"`, async () => {
        await admin.guardarSucursalDelMercado(M.mercado.id, PERU, 'Por defecto');
        expect(await admin.markupDeLaSucursalDelMercado(PERU), `En "Por defecto" Perú tiene que volver a heredar ${peru.hotel} / ${peru.servicio}`)
          .toEqual(peru);
      });

      await paso(portal, 'Portal: Cusco vuelve al markup de la sucursal', async () => {
        await mismosPrecios(cuscoAntes, await leer(CUSCO, costosCusco, peru.servicio!, 'Cusco con Perú otra vez en Por defecto'), 'Cusco');
      });
    } finally {
      await paso(page, `Restaurar Perú en "Por defecto" en el mercado ${M.mercado.id}`, async () => {
        await admin.guardarSucursalDelMercado(M.mercado.id, PERU, 'Por defecto');
      });
    }
  });
});
