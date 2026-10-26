import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AgenciaNuevaPage } from '../../../pages/climbs/agencia.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { porTarifa, compararPrecios } from '../../../utils/markups';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { tarifasDelPortal, ItemDelPortal } from '../comun/tarifario-del-portal';
import candidatos from '../../../data/candidatos.json';

const T = candidatos.tarifario as Record<string, any>;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);
// La excursion tiene tarifa en pesos y el hotel en dolares: el tipo de cambio solo tiene que
// mover el precio de la excursion.
const EN_PESOS: ItemDelPortal = { solapa: 'Excursiones', nombre: T.excursiones.nombre, terminoBusqueda: T.excursiones.terminoBusqueda };
const EN_DOLARES: ItemDelPortal = { solapa: 'Hoteles', nombre: T.hoteles.nombre, terminoBusqueda: T.hoteles.terminoBusqueda };

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
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  async function leer(item: ItemDelPortal, titulo: string): Promise<Map<string, number>> {
    const filas = (await tarifasDelPortal(portal, item)).map((f) => f.map((c) => c.replace(/\s*Tarifa extendida/gi, '').trim()));
    const precios = porTarifa(filas);
    await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
    expect(precios.size, `${M.usuario.userName} tiene que ver tarifas con importe`).toBeGreaterThan(0);
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

    try {
      await paso(page, `WebAdmin: cargar a la agencia ${M.agencia.id} una cotizacion manual de ${MANUAL}`, async () => {
        await agencia.guardarTipoDeCambio(M.agencia.id, true, MANUAL);
      });

      await paso(portal, `Portal: la excursion en pesos se convierte a ${MANUAL}`, async () => {
        await exigir(pesosAntes, await leer(EN_PESOS, 'Excursion con cotizacion manual'), DEL_PAIS, MANUAL, 'excursion');
      });

      await paso(portal, 'Portal: el hotel en dolares no cambia', async () => {
        await exigir(dolaresAntes, await leer(EN_DOLARES, 'Hotel con cotizacion manual'), 1, 1, 'hotel');
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
