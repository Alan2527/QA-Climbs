import { Page, expect } from '@playwright/test';
import { TarifarioNuevoPage } from '../../../pages/climbs/tarifario.page';

/** Un item del tarifario del portal nuevo: la solapa, el nombre de la card y lo que se escribe para buscarlo. */
export type ItemDelPortal = { solapa: string; nombre: string; terminoBusqueda: string };

/** Las solapas del tarifario y su `tab` en la direccion (la misma que la del tarifario viejo). */
const TAB: Record<string, string> = {
  Paquetes: 'tour', Excursiones: 'excursion', Hoteles: 'hotel', Traslados: 'transfer', 'Cena show': 'show', Cruceros: 'cruise', Ofertas: 'opportunity',
};

export type Lectura = { ofrecido: boolean; filas: string[][]; detalle: string };

/**
 * Lee la tabla del explorador ("Ver Tarifario") de un item, en Argentina / Buenos Aires.
 *
 * Sin rango entra desde el menu, como la persona. Con rango usa la direccion del tarifario
 * (`from` / `to` en dd-mm-aaaa), que es como la arma el propio sitio al buscar: por defecto
 * muestra unos 18 meses. Si el buscador no ofrece el item, lo informa en vez de fallar
 * (lo decide el test: un item excluido no se tiene que ofrecer).
 */
export async function leerTarifasDelPortal(page: Page, item: ItemDelPortal, rango?: { desde: string; hasta: string }): Promise<Lectura> {
  const t = new TarifarioNuevoPage(page);
  if (rango) {
    const f = (d: string) => d.replace(/\//g, '-');
    await page.goto(`/site/tariff?country=10&city=5000&from=${f(rango.desde)}&to=${f(rango.hasta)}&tab=${TAB[item.solapa]}`);
    await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState('networkidle');
  } else {
    await t.irDesdeElMenu();
    await t.filtrar('Argentina', 'Buenos Aires');
    await t.abrirSolapa(item.solapa);
  }
  try {
    await t.buscarPorNombre(item.terminoBusqueda, item.nombre);
  } catch (e) {
    return { ofrecido: false, filas: [], detalle: String(e).split('\n')[0].slice(0, 300) };
  }
  await t.verTarifario(t.card(item.nombre));
  const vacio = await t.dialogo.getByText(/Todavía no hay/).isVisible().catch(() => false);
  const filas = vacio ? [] : await t.tablaDelExplorador();
  await t.cerrarDialogo();
  return { ofrecido: true, filas, detalle: filas.map((f) => f.join(' | ')).join('\n') };
}

/** Igual que leerTarifasDelPortal, pero exige que el item se ofrezca y devuelve solo las filas. */
export async function tarifasDelPortal(page: Page, item: ItemDelPortal, rango?: { desde: string; hasta: string }): Promise<string[][]> {
  const l = await leerTarifasDelPortal(page, item, rango);
  expect(l.ofrecido, `El tarifario del portal tiene que ofrecer "${item.nombre}": ${l.detalle}`).toBe(true);
  return l.filas;
}
