import { Browser, BrowserContext, Page } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { credencialesDeMarkups } from '../../../utils/markups';

/**
 * Una segunda sesion en el portal nuevo con la agencia de prueba de markups
 * ("AUTO-QA NO TOCAR - MARKUPS", usuario autoqa.markups): la agencia ajena con la que se
 * comprueba que lo de pablo1 no se ve. Entra por el formulario, como la agencia; las
 * credenciales salen del entorno (AMV_MARKUP_USER / AMV_MARKUP_PASS) y no se imprimen.
 */
export async function abrirSesionDeOtraAgencia(browser: Browser, baseURL?: string): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const { usuario, password: clave } = credencialesDeMarkups();
  // Contexto limpio: sin esto hereda la sesion del proyecto (la cookie del backoffice de pablo
  // quedaba viva al lado de la del portal de la agencia).
  const contexto = await browser.newContext({ baseURL, locale: 'es-AR', viewport: { width: 1920, height: 1080 }, storageState: { cookies: [], origins: [] } });
  const pagina = await contexto.newPage();
  await new PortalNuevoPage(pagina).ingresar(usuario!, clave!);
  return { contexto, pagina };
}
