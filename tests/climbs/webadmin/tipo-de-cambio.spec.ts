import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AgenciaNuevaPage } from '../../../pages/climbs/agencia.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { porTarifa, compararPrecios, leerCostos, exigirImportes, CostosDelItem } from '../../../utils/markups';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { tarifasDelPortal, ItemDelPortal } from '../comun/tarifario-del-portal';
import candidatos from '../../../data/candidatos.json';
import { conBackofficeNuevo, costosDelServicio } from '../../../utils/markups';
import { TarifaDeServicio } from '../../../pages/climbs/servicio.page';
import { recargoEnFichaYCarritoNuevo, ServicioConRecargo } from '../../../utils/recargo-por-idioma';

const T = candidatos.tarifario as Record<string, any>;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);
// La excursion tiene tarifa en pesos y el hotel en dolares: el tipo de cambio solo tiene que
// mover el precio de la excursion.
const EN_PESOS: ItemDelPortal = { solapa: 'Excursiones', nombre: T.excursiones.nombre, terminoBusqueda: T.excursiones.terminoBusqueda };
const EN_DOLARES: ItemDelPortal = { solapa: 'Hoteles', nombre: T.hoteles.nombre, terminoBusqueda: T.hoteles.terminoBusqueda };
/** La primera tabla del explorador del hotel 5003 es la de su primera habitacion, King Deluxe. */
const HABITACION_DEL_HOTEL = 9193;
/**
 * Recargo por idioma con el tipo de cambio: el servicio AUTO-QA 7967 (copia de Tigre y Delta) tiene la
 * tarifa Regular en pesos (ARS 47.300) y English ARS 15.000 fijos por pasajero. US 4739: "el valor final
 * tiene que calcularse aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el
 * costo solo". En la ficha y en el carrito, por persona: techo((costo + recargo) / cotizacion / markup), con
 * la cotizacion vigente (la del pais y despues la manual): el recargo en pesos se convierte igual que el costo.
 */
const RP = candidatos.recargoFijoEnPesos;

/**
 * WEBADMIN — app nueva (ClimbsApp). Tipo de cambio manual por agencia.
 *
 * El mismo test que tests/webadmin/tipo-de-cambio.spec.ts, con el mismo titulo. En la app nueva
 * es "Usa su propia cotizacion" / "Cotizacion general" de la ficha de la agencia (Backoffice,
 * Clientes › Agencias, solapa Datos, bloque Comercial). Sin cotizacion propia la ficha dice
 * "Sin cotizacion propia usa la del pais o la general: N".
 *
 * El portal muestra todo en dolares: lo que tiene tarifa en pesos se convierte con la cotizacion
 * de la agencia y, si no tiene una propia, con la de su pais. Con el usuario propio de markups
 * (agencia 6334, pais 10, cotizacion del pais 1.000): se le carga una cotizacion manual de 2.000
 * y la excursion en pesos tiene que costar la mitad en dolares; el hotel en dolares no cambia.
 * Al desactivarla tiene que volver a la del pais (en el sistema actual es el rojo de la US 4910).
 *
 * Importes: en cada lectura, cada precio tiene que ser exactamente techo(costo / cotizacion / markup
 * del mercado), con el costo leido en el Backoffice nuevo (servicio 5 en pesos, habitacion 9193 en
 * dolares) y la cotizacion que tiene que estar vigente. Ademas se exige la proporcion.
 *
 * Arranque: la fila de cotizacion propia que el WebAdmin dejo marcada como borrada la ficha nueva
 * la muestra tildada (lee la fila sin mirar la marca). Si aparece asi, se la destilda y se guarda
 * (la app nueva borra la fila), para arrancar sin cotizacion propia como el test actual.
 */
test.describe('WebAdmin — tipo de cambio manual por agencia', () => {
  test.describe.configure({ mode: 'serial' });

  let contexto: BrowserContext;
  let portal: Page;
  const DEL_PAIS = 1000;
  const MANUAL = 2000;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina: portal } = await abrirSesionDeOtraAgencia(browser, baseURL));
    costosPesos = await leerCostos(browser, { servicio: T.excursiones.id });
    costosDolares = await leerCostos(browser, { habitacion: HABITACION_DEL_HOTEL });
  });

  let costosPesos: CostosDelItem;
  let costosDolares: CostosDelItem;

  let tarifasRecargo: TarifaDeServicio[] | undefined;
  /** Ficha y carrito del servicio con recargo fijo en pesos, en English, con la cotizacion dada. */
  async function recargoEnPesos(cotizacion: number, titulo: string) {
    tarifasRecargo ??= await conBackofficeNuevo(portal.context().browser()!, (bo) => costosDelServicio(bo, RP.id));
    const s: ServicioConRecargo = {
      pais: RP.ciudad.pais, ciudad: RP.ciudad.nombre, termino: RP.terminoBusqueda, nombre: RP.nombre, modalidad: 'Regular',
      fecha: new Date(RP.fecha + 'T00:00:00'), tipo: RP.tipo, tipoValor: String(RP.serviceTypeId), tarifas: tarifasRecargo,
      cotizaciones: { USD: 1, ARS: cotizacion },
    };
    await recargoEnFichaYCarritoNuevo(portal, s, M.mercado.serviceMarkup * M.usuario.customMarkup, titulo);
  }

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  /** Lee el tarifario y exige techo(costo / cotizacion / markup del mercado) con la cotizacion de pesos vigente. */
  async function leer(item: ItemDelPortal, titulo: string, cotizacionPesos = DEL_PAIS): Promise<Map<string, number>> {
    const filas = (await tarifasDelPortal(portal, item)).map((f) => f.map((c) => c.replace(/\s*Tarifa extendida/gi, '').trim()));
    const precios = porTarifa(filas);
    await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
    expect(precios.size, `${M.usuario.userName} tiene que ver tarifas con importe`).toBeGreaterThan(0);
    const enPesos = item === EN_PESOS;
    await exigirImportes(filas, enPesos ? costosPesos : costosDolares,
      (enPesos ? M.mercado.serviceMarkup : M.mercado.hotelMarkup) * M.usuario.customMarkup, titulo, { USD: 1, ARS: cotizacionPesos });
    return precios;
  }

  async function exigir(antes: Map<string, number>, despues: Map<string, number>, cotAntes: number, cotDespues: number, que: string) {
    const { lineas, fuera } = compararPrecios(antes, despues, cotAntes, cotDespues);
    await adjuntarTexto(`Comparacion: ${que}`, `cotizacion ${cotAntes} -> ${cotDespues}` + SALTO + SALTO + lineas.join(SALTO));
    expect(fuera, `${que}: tarifas fuera de lo esperado` + SALTO + fuera.join(SALTO)).toEqual([]);
  }

  test('Una cotizacion manual cambia el precio de lo que esta en pesos y al desactivarla vuelve a la del pais', async ({ page }) => {
    test.setTimeout(900_000);
    const agencia = new AgenciaNuevaPage(page);
    let pesosAntes = new Map<string, number>();
    let dolaresAntes = new Map<string, number>();

    await paso(page, `Verificar que la agencia ${M.agencia.id} usa la cotizacion del pais`, async () => {
      await agencia.abrir(M.agencia.id);
      const inicial = await agencia.tipoDeCambio();
      await adjuntarTexto('Tipo de cambio de la agencia al abrir', JSON.stringify(inicial));
      if (inicial.manual) await agencia.guardarTipoDeCambio(M.agencia.id, false);
      const cambio = await agencia.tipoDeCambio();
      await adjuntarTexto('Tipo de cambio de la agencia', JSON.stringify(cambio));
      expect(cambio.manual, 'La agencia tiene que arrancar sin tipo de cambio manual').toBe(false);
      expect(cambio.valor, `La cotizacion del pais tiene que ser ${DEL_PAIS}`).toBe(DEL_PAIS);
    });

    await paso(portal, 'Leer en el portal la excursion (pesos) y el hotel (dolares)', async () => {
      pesosAntes = await leer(EN_PESOS, 'Excursion antes');
      dolaresAntes = await leer(EN_DOLARES, 'Hotel antes');
    });

    await paso(portal, `Portal: el servicio en pesos en English cobra techo((costo + recargo) / ${DEL_PAIS} / markup) en la ficha y en el carrito`, async () => {
      await recargoEnPesos(DEL_PAIS, `Cotizacion del pais ${DEL_PAIS}`);
    });

    try {
      await paso(page, `WebAdmin: cargar a la agencia ${M.agencia.id} una cotizacion manual de ${MANUAL}`, async () => {
        await agencia.guardarTipoDeCambio(M.agencia.id, true, MANUAL);
      });

      await paso(portal, `Portal: la excursion en pesos se convierte a ${MANUAL}`, async () => {
        await exigir(pesosAntes, await leer(EN_PESOS, 'Excursion con cotizacion manual', MANUAL), DEL_PAIS, MANUAL, 'excursion');
      });

      await paso(portal, `Portal: con la cotizacion manual ${MANUAL}, el servicio en English cobra techo((costo + recargo) / ${MANUAL} / markup)`, async () => {
        await recargoEnPesos(MANUAL, `Cotizacion manual ${MANUAL}`);
      });

      await paso(portal, 'Portal: el hotel en dolares no cambia', async () => {
        await exigir(dolaresAntes, await leer(EN_DOLARES, 'Hotel con cotizacion manual', MANUAL), 1, 1, 'hotel');
      });

      await paso(page, 'WebAdmin: desactivar la cotizacion manual', async () => {
        await agencia.guardarTipoDeCambio(M.agencia.id, false);
      });

      await paso(portal, `Portal: la excursion vuelve a la cotizacion del pais (${DEL_PAIS})`, async () => {
        await exigir(pesosAntes, await leer(EN_PESOS, 'Excursion sin cotizacion manual'), DEL_PAIS, DEL_PAIS, 'excursion');
      });
    } finally {
      await paso(page, 'Restaurar: sin cotizacion manual', async () => {
        await agencia.guardarTipoDeCambio(M.agencia.id, false);
      });
    }
  });
});
