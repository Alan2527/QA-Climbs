import { test, Page, TestInfo } from '@playwright/test';

/**
 * Envuelve un bloque logico como paso de Allure y adjunta una captura al terminarlo.
 * Equivale al `with allure.step(...)` + screenshot de la suite de Selenium.
 */
export async function paso(page: Page, titulo: string, fn: () => Promise<void>) {
  await test.step(titulo, async () => {
    await fn();
    await adjuntarCaptura(page, titulo);
  });
}

/** Adjunta una captura de pantalla al reporte con el nombre indicado. */
export async function adjuntarCaptura(page: Page, nombre: string) {
  const imagen = await page.screenshot({ fullPage: false });
  await test.info().attach(nombre, { body: imagen, contentType: 'image/png' });
}

/** Adjunta texto plano al reporte (valores esperados vs obtenidos, ids, etc.). */
export async function adjuntarTexto(nombre: string, contenido: string) {
  await test.info().attach(nombre, { body: contenido, contentType: 'text/plain' });
}

/**
 * Espera a que terminen los PostBacks asincronicos de ASP.NET y las llamadas jQuery.
 * El tarifario carga cada pestania por AJAX, asi que sin esto se lee el contenedor vacio.
 */
export async function esperarFinDeCarga(page: Page, timeout = 60_000) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const w = window as any;
    const sinPostBack =
      !w.Sys?.WebForms?.PageRequestManager?.getInstance ||
      w.Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack() === false;
    const sinAjax = typeof w.jQuery === 'undefined' || w.jQuery.active === 0;
    return sinPostBack && sinAjax;
  }, undefined, { timeout });
}

/** Fecha de busqueda estandar de la suite: hoy + 7 dias. */
export function fechaDeBusqueda(diasExtra = 7): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diasExtra);
  return d;
}

/** Formatea una fecha como dd/mm/aaaa, que es el formato que usan los campos del sitio. */
export function formatearFecha(d: Date): string {
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

/**
 * Normaliza un importe que viene de pantalla ("USD 1.234,50", "$ 143,00") a numero.
 * Necesario porque la base guarda hasta 3 decimales y el front redondea a 2.
 */
export function importeANumero(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,-]/g, '').trim();
  if (!limpio) return null;
  // Formato es-AR: punto de miles, coma decimal.
  const normalizado = limpio.replace(/\./g, '').replace(',', '.');
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Precio tal como lo muestra el tarifario a partir del valor de la base.
 *
 * Fuente: AdvisorHelper.AddMarkUpDiv(price, markup) => price / markup
 *         AdvisorHelper.RoundUp(x, 0)              => Math.Ceiling(x)
 *
 * Con markup 0,50: 68,20 / 0,50 = 136,40 -> 137
 */
export function precioMostrado(totalRate: number, markup: number): number {
  const conMarkup = markup > 0 ? totalRate / markup : totalRate;
  // Se redondea a 2 antes de Ceiling para evitar arrastres binarios (136.39999...).
  return Math.ceil(Number(conMarkup.toFixed(2)));
}
