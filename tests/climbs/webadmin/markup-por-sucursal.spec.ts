import { test, expect, Page, BrowserContext } from '@playwright/test';
import { MercadoNuevoPage } from '../../../pages/climbs/agencia.page';
import { ServicioNuevoPage, TarifaDeServicio } from '../../../pages/climbs/servicio.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, numeroDelPortal } from '../../../utils/pasos';
import { porTarifa, compararPrecios } from '../../../utils/markups';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { tarifasDelPortal, ItemDelPortal } from '../comun/tarifario-del-portal';
import candidatos from '../../../data/candidatos.json';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { conResaltado } from '../../../utils/pasos';
import { precioConIdioma, tarifaVigente, mismoIdioma } from '../../../utils/markups';
import { importe } from '../reservas/reservas-comun';

const T = candidatos.tarifario as Record<string, any>;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);

/** Servicio de Cusco (sucursal Perú), creado por pantalla el 24/11/2026 como copia del 7737, con tarifas hasta 2031. */
const ID_CUSCO = 7966;
const CUSCO: ItemDelPortal = { solapa: 'Excursiones', nombre: 'AUTO-QA NO TOCAR - Valle Sagrado (Cusco)', terminoBusqueda: 'Valle Sagrado', pais: 'Perú', destino: 'Cusco' };
/** Servicio de Buenos Aires (sucursal Argentina), el mismo del test de markups de mercado. */
const BUENOS_AIRES: ItemDelPortal = { solapa: 'Excursiones', nombre: T.excursiones.nombre, terminoBusqueda: T.excursiones.terminoBusqueda };

const PERU = 'Perú';
/**
 * Recargo por idioma de Cusco: English USD 15 por pasajero en sus tres tarifas Regular, cargado por
 * pantalla en el BackOffice el 25/11/2026 (con Español y English en Idiomas en regular y en privado).
 * Fecha dentro de la tarifa Regular 2027-2029 (minimo 2 pasajeros).
 */
const IDIOMA_CON_RECARGO = /^(English|Ingl[eé]s)$/i;
const FECHA_CUSCO = new Date(2027, 1, 10);
const ARGENTINA = 'Argentina';

/**
 * WEBADMIN — app nueva (ClimbsApp). Markup del mercado por sucursal (Azure 5107, HQ T-102).
 *
 * En la ficha del mercado (Finanzas › Mercados) cada sucursal tiene su fila: "Por defecto" toma el
 * markup de la sucursal y sigue sus cambios; "Manual" fija el del mercado en esa sucursal. El
 * markup que se aplica a un producto es el de la sucursal que cubre el país del destino: Perú cubre
 * Bolivia y Perú, Argentina (casa matriz) cubre Argentina, Brasil, Uruguay y los países sin sucursal.
 *
 * Se mira con `autoqa.markups` (agencia 6334, mercado 37, solo esa agencia) en el tarifario del
 * portal: un servicio de Cusco y uno de Buenos Aires. Línea base del 24/11/2026: en el mercado 37,
 * Perú en "Por defecto" (0,88 / 0,92 de la sucursal) y Argentina en Manual 0,80 / 0,60.
 *
 * Importes: cada precio del tarifario de Cusco tiene que ser exactamente techo(costo / markup de
 * servicios de Perú), con el costo de cada tarifa leído de la ficha del servicio en el BackOffice
 * (USD, markup del servicio y de la agencia en 1). Se exige con el markup heredado (0,92), con Perú
 * en Manual 0,50 y otra vez al volver a "Por defecto", y que todas las tarifas del servicio se
 * ofrezcan. El servicio de Buenos Aires tiene que quedar con los mismos precios, uno por uno.
 * El finally deja Perú en "Por defecto" aunque el test falle.
 */
test.describe('WebAdmin — markup por sucursal', () => {
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });

  let contexto: BrowserContext;
  let portal: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina: portal } = await abrirSesionDeOtraAgencia(browser, baseURL));
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => reiniciarNumeracionDePasos());

  async function leer(item: ItemDelPortal, titulo: string): Promise<Map<string, number>> {
    // Sin la marca "Tarifa extendida": se comparan precios, no la marca.
    const filas = (await tarifasDelPortal(portal, item)).map((f) => f.map((c) => c.replace(/\s*Tarifa extendida/gi, '').trim()));
    const precios = porTarifa(filas);
    await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
    expect(precios.size, `${M.usuario.userName} tiene que ver tarifas con importe de "${item.nombre}"`).toBeGreaterThan(0);
    return precios;
  }

  /**
   * Ficha y carrito de Cusco en el idioma con recargo. US 4739: "el valor final tiene que calcularse
   * aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el costo solo";
   * US 5107: el servicio toma el markup de la sucursal de su pais (Peru). Precio por persona de la
   * ficha = techo((costo + recargo) / markup de Peru), y el carrito cobra eso por los pasajeros.
   * Al final vacia el carrito.
   */
  async function fichaYCarritoEnIngles(costos: TarifaDeServicio[], markup: number, titulo: string) {
    const web = new PortalNuevoPage(portal);
    const valor = (t: string, que: string) => {
      const v = importe(t).valor;
      expect(v, `${que}: no se pudo leer un importe de "${t}"`).not.toBeNull();
      return v!;
    };
    try {
      await web.vaciarCarrito();
      await web.buscarServicios(FECHA_CUSCO, 'Excursión', { pais: PERU, ciudad: CUSCO.destino! });
      await web.elegirServicio(CUSCO.terminoBusqueda, CUSCO.nombre);
      const idioma = portal.locator('main').getByRole('combobox', { name: 'Idioma del servicio' });
      await expect(idioma, 'La ficha de Cusco tiene que mostrar el selector "Idioma del servicio"').toBeVisible();
      const opciones = (await idioma.locator('option').allInnerTexts()).map((t) => t.trim());
      await adjuntarTexto(`${titulo}: idiomas de la ficha`, opciones.join(' | '));
      const ingles = opciones.find((o) => IDIOMA_CON_RECARGO.test(o));
      expect(ingles, `La ficha de Cusco tiene que ofrecer el idioma English. Ofrece: ${opciones.join(', ')}`).toBeDefined();
      await idioma.selectOption({ label: ingles! });

      const pax = Math.max(2, await web.minimoDePasajeros('Regular'));
      await web.elegirPasajeros('Regular', pax);
      // La ficha recalcula por API: se lee el total cuando deja de cambiar.
      let previo = '';
      let totalFicha = await web.totalDeLaFicha();
      for (let i = 0; i < 10 && totalFicha !== previo; i++) {
        await portal.waitForTimeout(1_000);
        previo = totalFicha;
        totalFicha = await web.totalDeLaFicha();
      }
      const precioFicha = valor(await web.precioDeLaModalidad('Regular'), 'Precio por persona de la ficha');

      const tarifa = tarifaVigente(costos, 'Regular', FECHA_CUSCO, pax);
      expect(tarifa, `Cusco tiene que tener una tarifa Regular vigente el ${FECHA_CUSCO.toLocaleDateString('es-AR')}`).toBeDefined();
      const recargo = tarifa!.recargos.find((r) => mismoIdioma(r.idioma, ingles!));
      expect(recargo, `La tarifa Regular de Cusco tiene que tener recargo para ${ingles}`).toBeDefined();
      const esperado = precioConIdioma(tarifa!, ingles!, markup, pax)!;

      await portal.getByRole('button', { name: 'Agregar al carrito' }).click();
      await expect(portal.getByRole('status').filter({ hasText: /Se agregó \d+ ítem al carrito/ }).last(), 'Agregar al carrito tiene que confirmar').toBeVisible();
      await web.irAlCarrito();
      const item = portal.locator('main article').filter({ hasText: CUSCO.terminoBusqueda });
      await expect(item, 'El carrito tiene que traer el servicio de Cusco').toHaveCount(1);
      const lineaTxt = (await item.innerText()).replace(/\s+/g, ' ').match(/[A-Z]{3}\s*[\d.,]+/g)?.at(-1) ?? '';
      const linea = valor(lineaTxt, 'Linea del carrito');
      await adjuntarTexto(`${titulo}: ficha y carrito en ${ingles}`, [
        `Tarifa del BackOffice: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargo ${JSON.stringify(recargo)}`,
        `Markup de Peru ${markup}`,
        `Esperado por persona: techo((costo + recargo) / ${markup}) = ${esperado}`,
        `Ficha: por persona ${precioFicha}, total ${totalFicha} (${pax} pax)`,
        `Carrito: ${lineaTxt}`,
      ].join(SALTO));
      await conResaltado(portal, item, `${titulo}: linea del carrito en ${ingles}`, () => {
        expect.soft(precioFicha, `${titulo}: en ${ingles} la ficha tiene que cobrar por persona techo((costo + recargo) / ${markup}) (US 4739 y 5107)`).toBe(esperado);
        expect.soft(linea, `${titulo}: el carrito tiene que cobrar techo((costo + recargo) / ${markup}) x ${pax} pasajeros (US 4739 y 5107)`).toBe(esperado * pax);
      });
    } finally {
      await web.vaciarCarrito().catch(() => {});
    }
  }

  async function exigir(antes: Map<string, number>, despues: Map<string, number>, divAntes: number, divDespues: number, que: string) {
    const { lineas, fuera } = compararPrecios(antes, despues, divAntes, divDespues);
    await adjuntarTexto(`Comparacion: ${que}`, `markup ${divAntes} -> ${divDespues}` + SALTO + SALTO + lineas.join(SALTO));
    expect(fuera, `${que}: tarifas fuera de lo esperado` + SALTO + fuera.join(SALTO)).toEqual([]);
  }

  /** Cada precio del tarifario = techo(costo / markup), emparejando por vigencia, modalidad y pasajeros. */
  async function exigirPrecios(filas: string[][], costos: TarifaDeServicio[], markup: number, que: string) {
    const lineas: string[] = [];
    const fuera: string[] = [];
    const conPrecio = filas.filter((f) => /[A-Z]{3}\s*\d/.test(f.at(-1) ?? ''));
    for (const f of conPrecio) {
      const vigencia = f[0].match(/\d{2}\/\d{2}\/\d{4} - \d{2}\/\d{2}\/\d{4}/)?.[0] ?? '';
      const modalidad = f[1];
      // Regular muestra "Mínimo 2 pasajeros" y tiene una sola tarifa por vigencia; Privado, una por cantidad.
      const costo = costos.find((c) => c.vigencia === vigencia && c.modalidad === modalidad && (modalidad !== 'Privado' || c.pax === f[2]));
      const precio = numeroDelPortal(f.at(-1) ?? '');
      const esperado = costo?.costo == null ? null : Math.ceil(Number((costo.costo / markup).toFixed(6)));
      const ok = esperado !== null && precio === esperado;
      lineas.push(`${ok ? 'OK  ' : 'MAL '} ${vigencia} | ${modalidad} | ${f[2]}  ->  costo ${costo ? `${costo.moneda} ${costo.costo}` : 'sin tarifa'} / ${markup} = ${esperado ?? '?'}  /  portal ${f.at(-1)}`);
      if (!ok) fuera.push(f.join(' | '));
    }
    await adjuntarTexto(`Importes: ${que}`, `precio = techo(costo / ${markup})` + SALTO + SALTO + lineas.join(SALTO));
    expect(fuera, `${que}: precios que no son techo(costo / ${markup})` + SALTO + fuera.join(SALTO)).toEqual([]);
    expect(conPrecio.length, `${que}: el tarifario tiene que ofrecer las ${costos.length} tarifas del servicio`).toBe(costos.length);
  }

  test('Mercado: el markup Manual de una sucursal mueve solo los precios de sus países y "Por defecto" vuelve al de la sucursal', async ({ page }) => {
    test.setTimeout(600_000);
    const mercado = new MercadoNuevoPage(page);
    const manualPeru = 0.5;
    const r = { peru: { hotel: NaN, servicio: NaN }, argentina: { hotel: NaN, servicio: NaN } };
    let cuscoAntes = new Map<string, number>();
    let costos: TarifaDeServicio[] = [];
    const leerCusco = async (titulo: string) => {
      const filas = (await tarifasDelPortal(portal, CUSCO)).map((f) => f.map((c) => c.replace(/\s*Tarifa extendida/gi, '').trim()));
      await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
      return { filas, precios: porTarifa(filas) };
    };
    let baAntes = new Map<string, number>();

    await paso(page, `Mercado ${M.mercado.id}: Perú en "Por defecto" y Argentina en Manual`, async () => {
      await mercado.abrir(M.mercado.id);
      const peru = await mercado.markupDeLaSucursal(PERU);
      const argentina = await mercado.markupDeLaSucursal(ARGENTINA);
      await adjuntarTexto('Punto de partida', `Perú: ${peru.manual ? 'Manual' : 'Por defecto'} ${peru.hotel} / ${peru.servicio}` + SALTO +
        `Argentina: ${argentina.manual ? 'Manual' : 'Por defecto'} ${argentina.hotel} / ${argentina.servicio}`);
      expect(peru.manual, `Perú tiene que arrancar en "Por defecto" en el mercado ${M.mercado.id}`).toBe(false);
      expect(peru.servicio, 'Perú tiene que heredar un markup de servicios de su sucursal').toBeGreaterThan(0);
      expect(argentina, `Argentina tiene que arrancar en Manual ${M.mercado.hotelMarkup} / ${M.mercado.serviceMarkup}`)
        .toEqual({ manual: true, hotel: M.mercado.hotelMarkup, servicio: M.mercado.serviceMarkup });
      r.peru = { hotel: peru.hotel!, servicio: peru.servicio! };
      r.argentina = { hotel: argentina.hotel!, servicio: argentina.servicio! };
    });

    await paso(page, `BackOffice: leer los costos de las tarifas del servicio de Cusco (#${ID_CUSCO})`, async () => {
      const servicio = new ServicioNuevoPage(page);
      await servicio.abrir(ID_CUSCO);
      costos = (await servicio.tarifas()).filter((t) => t.costo !== null);
      await adjuntarTexto('Costos del servicio', costos.map((c) => `${c.vigencia} | ${c.modalidad} | ${c.pax} | ${c.moneda} ${c.costo}`).join(SALTO));
      expect(costos.length, `El servicio #${ID_CUSCO} tiene que tener tarifas vigentes con costo`).toBeGreaterThan(0);
    });

    await paso(portal, 'Portal: los precios de Cusco son techo(costo / markup de Perú) y se lee Buenos Aires', async () => {
      const cusco = await leerCusco('Cusco antes');
      cuscoAntes = cusco.precios;
      await exigirPrecios(cusco.filas, costos, r.peru.servicio, 'Cusco con el markup heredado de Perú');
      baAntes = await leer(BUENOS_AIRES, 'Buenos Aires antes');
    });

    await paso(portal, 'Portal: Cusco en English cobra techo((costo + recargo) / markup de Perú) en la ficha y en el carrito', async () => {
      await fichaYCarritoEnIngles(costos, r.peru.servicio, 'Perú por defecto');
    });

    try {
      await paso(page, `Mercado ${M.mercado.id}: llevar Perú a Manual con servicios ${manualPeru}`, async () => {
        await mercado.guardarMarkupDeLaSucursal(M.mercado.id, PERU, { hotel: r.peru.hotel, servicio: manualPeru });
      });

      await paso(portal, `Portal: el servicio de Cusco aplica el markup Manual de Perú (${manualPeru})`, async () => {
        const cusco = await leerCusco('Cusco con Perú en Manual');
        await exigirPrecios(cusco.filas, costos, manualPeru, `Cusco con Perú en Manual ${manualPeru}`);
        await exigir(cuscoAntes, cusco.precios, r.peru.servicio, manualPeru, 'Cusco (proporción)');
      });

      await paso(portal, `Portal: Cusco en English con Perú en Manual ${manualPeru}: el recargo también lleva ese markup`, async () => {
        await fichaYCarritoEnIngles(costos, manualPeru, `Perú en Manual ${manualPeru}`);
      });

      await paso(portal, 'Portal: el servicio de Buenos Aires no cambia', async () => {
        await exigir(baAntes, await leer(BUENOS_AIRES, 'Buenos Aires con Perú en Manual'), r.argentina.servicio, r.argentina.servicio, 'Buenos Aires');
      });

      await paso(page, `Mercado ${M.mercado.id}: volver Perú a "Por defecto"`, async () => {
        await mercado.guardarMarkupDeLaSucursal(M.mercado.id, PERU, 'Por defecto');
        expect(await mercado.markupDeLaSucursal(PERU), `En "Por defecto" Perú tiene que volver a heredar ${r.peru.hotel} / ${r.peru.servicio}`)
          .toEqual({ manual: false, ...r.peru });
      });

      await paso(portal, 'Portal: el servicio de Cusco vuelve al markup de la sucursal', async () => {
        const cusco = await leerCusco('Cusco con Perú en Por defecto');
        await exigirPrecios(cusco.filas, costos, r.peru.servicio, 'Cusco con Perú otra vez en Por defecto');
        await exigir(cuscoAntes, cusco.precios, r.peru.servicio, r.peru.servicio, 'Cusco (mismos precios que antes)');
      });
    } finally {
      await paso(page, `Restaurar Perú en "Por defecto" en el mercado ${M.mercado.id}`, async () => {
        await mercado.guardarMarkupDeLaSucursal(M.mercado.id, PERU, 'Por defecto');
      });
    }
  });
});
