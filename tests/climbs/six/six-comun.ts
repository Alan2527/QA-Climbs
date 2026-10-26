import { Page, expect } from '@playwright/test';

/**
 * SIX contra la app nueva.
 *
 * La app del pasajero (qa.six.amv.travel) no se migra: es la misma, y le pide los datos a la API
 * mayorista. En el sistema actual esa API es qa.api.amv.travel/<servicio>/<metodo>; en la app
 * nueva es /api/wholesale/<servicio>/<metodo>, "con los mismos contratos JSON, asi la app SIX y
 * los integradores no se enteran del cambio" (docs/ARQUITECTURA.md de ClimbsApp). Mientras SIX no
 * apunte a la nueva, cada pedido de la app se desvia a la API nueva: es la app tal como va a
 * quedar despues del pasaje.
 */
export const API_VIEJA = 'https://qa.api.amv.travel';
export const API_NUEVA = `${process.env.CLIMBS_URL ?? 'https://climbs-qa.amv.travel'}/api/wholesale`;

let ultimoAutologin = '';

/**
 * Desvia a la API nueva todo lo que la app del pasajero le pide a la API vieja: el pedido sale tal
 * cual (metodo, cabeceras, cuerpo) hacia /api/wholesale y su respuesta vuelve a la app. Del
 * autologin se guarda el resultado (codigo y mensaje, nunca los datos) para explicar un "no entro".
 */
export async function usarApiNueva(page: Page) {
  ultimoAutologin = '';
  await page.route(`${API_VIEJA}/**`, async (route) => {
    const respuesta = await route.fetch({ url: route.request().url().replace(API_VIEJA, API_NUEVA) });
    if (route.request().method() === 'POST' && route.request().url().endsWith('/passenger/autologin')) {
      let cuerpo: { Code?: number; Message?: string; Data?: unknown } | null = null;
      try { cuerpo = JSON.parse(await respuesta.text()); } catch { /* sin cuerpo legible */ }
      ultimoAutologin = `HTTP ${respuesta.status()} · Code ${cuerpo?.Code} · "${cuerpo?.Message ?? ''}"${cuerpo?.Data ? '' : ' · sin datos del pasajero'}`;
    }
    await route.fulfill({ response: respuesta });
  });
}

/** El link de autologin del pasajero AUTO-QA (credencial: .env y secrets). */
export function link(): string {
  const url = process.env.AMV_SIX_AUTOLOGIN_URL;
  expect(url, 'Falta AMV_SIX_AUTOLOGIN_URL en el entorno (.env o secrets): el link de autologin del pasajero AUTO-QA')
    .toMatch(/^https:\/\/[^/]+\/autologin\?token=.+/);
  return url!;
}

/**
 * Abre un link de autologin sin que el token quede en el reporte: se navega desde la pagina con
 * `location.assign` (el paso queda como "Evaluate" sin argumentos) y si falla se relanza el error
 * sin la URL.
 */
export async function abrirLink(page: Page, url: string, destino: RegExp) {
  try {
    await page.evaluate((u) => { window.location.assign(u); }, url);
    await page.waitForURL(destino, { timeout: 90_000 });
  } catch (e) {
    const limpio = String((e as Error).message ?? e).replace(/token=[^\s"'&]+/gi, 'token=***');
    throw new Error(`No se pudo abrir el link de autologin: ${limpio.split(String.fromCharCode(10))[0]}`);
  }
}

/** Pasa la bienvenida del primer ingreso si aparece: el pasaporte ("Saltar") y la carta ("Empezar mi viaje"). */
export async function pasarBienvenida(page: Page) {
  const saltar = page.getByRole('button', { name: 'Saltar' });
  if (await saltar.isVisible().catch(() => false)) await saltar.click();
  const empezar = page.getByRole('button', { name: /Empezar mi viaje/ });
  await empezar.waitFor({ timeout: 5_000 }).catch(() => {});
  if (await empezar.isVisible().catch(() => false)) await empezar.click();
}

/** Lo que respondio la API nueva al ultimo autologin (codigo y mensaje). */
export function escucharAutologin(_page: Page): () => string {
  return () => ultimoAutologin || 'sin respuesta';
}
