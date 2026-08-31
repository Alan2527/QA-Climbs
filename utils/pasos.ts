import { test, Page, Locator, TestInfo } from '@playwright/test';

/**
 * Envuelve un bloque logico como paso de Allure y adjunta una captura al terminarlo.
 * Equivale al `with allure.step(...)` + screenshot de la suite de Selenium.
 */
export async function paso(
  page: Page,
  titulo: string,
  fn: () => Promise<void>,
  opciones: { paginaCompleta?: boolean } = {},
) {
  await test.step(titulo, async () => {
    await fn();
    await adjuntarCaptura(page, titulo, opciones.paginaCompleta ?? true);
  });
}

/**
 * Adjunta una captura al reporte.
 *
 * Por defecto toma la pagina completa (todo el scroll), no solo lo visible:
 * en el tarifario la tabla de tarifas queda debajo del pliegue y con la captura
 * del viewport no se veia.
 */
export async function adjuntarCaptura(page: Page, nombre: string, paginaCompleta = true) {
  const imagen = await page.screenshot({ fullPage: paginaCompleta });
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

/**
 * Marca un elemento con un recuadro rojo y adjunta la captura.
 *
 * Se usa cuando una validacion falla: el reporte muestra la pantalla con el
 * componente o el dato problematico senalado, en vez de una captura donde hay
 * que adivinar que esta mal.
 *
 * Si el elemento no existe (es lo que suele fallar), se resalta el contenedor
 * de respaldo para al menos ubicar la zona.
 */
export async function resaltarYCapturar(
  page: Page,
  locator: Locator,
  nombre: string,
  respaldo?: Locator,
) {
  const marcar = async (loc: Locator) => {
    await loc.first().evaluate((el) => {
      const e = el as HTMLElement;
      // En una fila de tabla el outline se dibuja solo arriba y abajo: las celdas
      // no lo heredan. Por eso ahi se pinta cada td y se cierra el recuadro a mano.
      if (e.tagName === 'TR') {
        const celdas = Array.from(e.querySelectorAll('td, th')) as HTMLElement[];
        celdas.forEach((c, i) => {
          c.style.backgroundColor = 'rgba(225, 29, 72, 0.12)';
          c.style.borderTop = '3px solid #e11d48';
          c.style.borderBottom = '3px solid #e11d48';
          if (i === 0) c.style.borderLeft = '3px solid #e11d48';
          if (i === celdas.length - 1) c.style.borderRight = '3px solid #e11d48';
        });
      } else {
        e.style.outline = '4px solid #e11d48';
        e.style.outlineOffset = '2px';
        e.style.boxShadow = '0 0 0 6px rgba(225, 29, 72, 0.25)';
      }
      e.scrollIntoView({ block: 'center', inline: 'center' });
    });
  };

  try {
    if (await locator.count()) await marcar(locator);
    else if (respaldo && (await respaldo.count())) await marcar(respaldo);
  } catch {
    // Un elemento que desaparece entre el conteo y el marcado no debe tapar
    // el error real: se adjunta la captura igual.
  }
  await adjuntarCaptura(page, nombre, true);
}
