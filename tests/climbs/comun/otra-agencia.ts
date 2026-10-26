import { Browser, BrowserContext, Page, expect } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';

/**
 * Una segunda sesion en el portal nuevo con la agencia de prueba de markups
 * ("AUTO-QA NO TOCAR - MARKUPS", usuario autoqa.markups): la agencia ajena con la que se
 * comprueba que lo de pablo1 no se ve. Entra por el formulario, como la agencia; las
 * credenciales salen del entorno (AMV_MARKUP_USER / AMV_MARKUP_PASS) y no se imprimen.
 */
export async function abrirSesionDeOtraAgencia(browser: Browser, baseURL?: string): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const usuario = process.env.AMV_MARKUP_USER;
  const clave = process.env.AMV_MARKUP_PASS;
  expect(usuario && clave, 'Faltan AMV_MARKUP_USER y AMV_MARKUP_PASS: sin la agencia ajena no hay contra quien comparar').toBeTruthy();
  const contexto = await browser.newContext({ baseURL, locale: 'es-AR', viewport: { width: 1920, height: 1080 } });
  const pagina = await contexto.newPage();
  await new PortalNuevoPage(pagina).ingresar(usuario!, clave!);
  return { contexto, pagina };
}
