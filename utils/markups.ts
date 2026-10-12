import { expect, Browser, BrowserContext, Page } from '@playwright/test';
import { TarifarioPage } from '../pages/tarifario.page';
import { LoginPage } from '../pages/login.page';
import { numeroDelPortal } from './pasos';

/**
 * Lo comun a los tests que miran precios con el usuario propio de markups
 * (`autoqa.markups`, agencia 6334, mercado 37): el login en un contexto aparte y
 * la lectura del tarifario de un item.
 */

export type ItemDelTarifario = { tab: string; container: string; nombre: string; terminoBusqueda: string };

/**
 * Abre un contexto propio, sin la sesion de pablo1, y entra con el usuario de
 * markups. Los dos usuarios tienen que estar logueados a la vez.
 */
export async function abrirSesionDeMarkups(browser: Browser, baseURL?: string): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const usuario = process.env.AMV_MARKUP_USER;
  const password = process.env.AMV_MARKUP_PASS;
  expect(usuario, 'Falta AMV_MARKUP_USER en el entorno').toBeTruthy();
  expect(password, 'Falta AMV_MARKUP_PASS en el entorno').toBeTruthy();

  const contexto = await browser.newContext({
    baseURL,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    storageState: { cookies: [], origins: [] },
  });
  const pagina = await contexto.newPage();
  const login = new LoginPage(pagina);
  await login.ingresar(usuario!, password!);
  await login.validarSesionIniciada();
  await login.cerrarAvisosDelPortal();
  return { contexto, pagina };
}

/** Recorre el tarifario hasta el item y devuelve las filas de su tabla de tarifas. */
export async function tarifasDe(page: Page, item: ItemDelTarifario): Promise<string[][]> {
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
 * posicion, asi se empareja la misma tarifa entre dos lecturas.
 */
export function porTarifa(filas: string[][]): Map<string, number> {
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

/**
 * Compara dos lecturas del mismo tarifario hechas con divisores distintos.
 *
 * El precio es techo(x / divisor). De un precio p leido con `divisorAntes`, x esta
 * en ((p-1) * divisorAntes, p * divisorAntes]; con `divisorDespues` el precio tiene
 * que caer en [techo((p-1) * antes / despues), techo(p * antes / despues)], con 1
 * de margen por el redondeo. Con los dos divisores iguales exige el mismo precio.
 *
 * Devuelve una linea por tarifa para adjuntar y las claves que no cumplen.
 */
export function compararPrecios(
  antes: Map<string, number>, despues: Map<string, number>, divisorAntes: number, divisorDespues: number,
): { lineas: string[]; fuera: string[] } {
  const lineas: string[] = [];
  const fuera: string[] = [];
  const iguales = divisorAntes === divisorDespues;
  for (const [clave, p] of antes) {
    const q = despues.get(clave);
    const minimo = iguales ? p : Math.ceil(((p - 1) * divisorAntes) / divisorDespues) - 1;
    const maximo = iguales ? p : Math.ceil((p * divisorAntes) / divisorDespues) + 1;
    const ok = q !== undefined && q >= minimo && q <= maximo;
    lineas.push(`${ok ? 'OK  ' : 'MAL '} ${clave}  ->  antes ${p}  /  esperado ${minimo === maximo ? minimo : `${minimo}..${maximo}`}  /  obtenido ${q ?? 'sin fila'}`);
    if (!ok) fuera.push(clave);
  }
  for (const clave of despues.keys()) {
    if (!antes.has(clave)) fuera.push(`${clave} (no estaba antes)`);
  }
  return { lineas, fuera };
}
