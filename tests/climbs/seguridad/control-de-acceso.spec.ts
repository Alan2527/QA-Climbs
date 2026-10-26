import { test, expect, Page, BrowserContext } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';

/**
 * SEGURIDAD — app nueva (ClimbsApp). Control de acceso: pantallas internas y cierre de sesion.
 *
 * Las mismas dos pruebas que tests/seguridad/control-de-acceso.spec.ts, con los mismos titulos:
 *  2. Las pantallas internas no se abren sin sesion: mandan al login. En la app nueva el
 *     BackOffice y la Administracion (el ex WebAdmin) son la misma aplicacion: se prueba una
 *     pantalla de cada origen (la bandeja de reservas y la ficha de habitaciones). Y el
 *     BackOffice tampoco se abre con la sesion de una agencia del portal.
 *  3. Despues de cerrar sesion en el portal no se vuelve a una pantalla protegida (historial de
 *     reservas): ni reescribiendo la URL ni con el boton "atras".
 *
 * La agencia es autoqa.markups (la sesion del portal de pablo es la del backoffice: no sirve
 * para "una agencia" y un login nuevo con su cuenta pisaria la sesion de la corrida). El cierre
 * de sesion usa un contexto propio y descartable. No escribe nada.
 */
test.describe('Seguridad — control de acceso a pantallas internas y cierre de sesion', () => {
  const urlBO = '/files/inbox';                 // bandeja de reservas (BO)
  const urlAdministracion = '/hotels/rooms';    // habitaciones (ex WebAdmin)
  const urlProtegidaPortal = '/site/bookings';  // historial de reservas (requiere sesion)

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  /** Abre una URL y resuelve si quedo en una pantalla de login (la ruta o un campo de clave a la vista). */
  async function estadoDe(page: Page, url: string) {
    const resp = await page.goto(url).catch(() => null);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);
    const ruta = new URL(page.url()).pathname;
    const hayCampoClave = await page.locator('input[type=password]').first().isVisible().catch(() => false);
    return { estado: resp?.status() ?? 0, urlFinal: page.url(), ruta, enLogin: /login/i.test(ruta) || hayCampoClave };
  }

  // =================================================================== Prueba 2
  test('Las pantallas internas no se abren sin sesion, y el BackOffice tampoco con una agencia', async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    const anon: BrowserContext = await browser.newContext({ baseURL, locale: 'es-AR', viewport: { width: 1920, height: 1080 }, storageState: { cookies: [], origins: [] } });
    const sinSesion = await anon.newPage();

    try {
      await paso(sinSesion, 'Sin sesion: el BackOffice redirige al login', async () => {
        const r = await estadoDe(sinSesion, urlBO);
        await adjuntarTexto('BO sin sesion', `HTTP ${r.estado}\nURL final: ${r.urlFinal}`);
        await conResaltado(sinSesion, sinSesion.locator('body'), 'BO sin sesion', () => {
          expect(r.enLogin, `El BackOffice sin sesion tiene que mandar al login (quedo en ${r.urlFinal})`).toBe(true);
        });
      });

      await paso(sinSesion, 'Sin sesion: Administracion redirige al login', async () => {
        const r = await estadoDe(sinSesion, urlAdministracion);
        await adjuntarTexto('Administracion sin sesion', `HTTP ${r.estado}\nURL final: ${r.urlFinal}`);
        await conResaltado(sinSesion, sinSesion.locator('body'), 'Administracion sin sesion', () => {
          expect(r.enLogin, `Administracion sin sesion tiene que mandar al login (quedo en ${r.urlFinal})`).toBe(true);
        });
      });
    } finally {
      await anon.close();
    }

    const { contexto, pagina: agencia } = await abrirSesionDeOtraAgencia(browser, baseURL);
    try {
      await paso(agencia, 'Con la sesion de una agencia (autoqa.markups): el BackOffice no se abre, manda a su login', async () => {
        const r = await estadoDe(agencia, urlBO);
        await adjuntarTexto('BO con sesion de agencia', `Agencia: autoqa.markups\nHTTP ${r.estado}\nURL final: ${r.urlFinal}`);
        await conResaltado(agencia, agencia.locator('body'), 'BO con agencia', () => {
          expect(r.enLogin, `El BackOffice no tiene que abrirse con la sesion de una agencia (quedo en ${r.urlFinal})`).toBe(true);
        });
      });
    } finally {
      await contexto.close();
    }
  });

  // =================================================================== Prueba 3
  test('Despues de cerrar sesion no se vuelve a una pantalla protegida, ni por URL ni con el boton atras', async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    // Sesion propia y descartable: no se toca la sesion compartida de la suite.
    const { contexto, pagina: page } = await abrirSesionDeOtraAgencia(browser, baseURL);
    const historial = () => page.getByRole('tab', { name: 'Carrito de compras', exact: true });

    try {
      await paso(page, 'Iniciar sesion y confirmar que la pantalla protegida se ve', async () => {
        const r = await estadoDe(page, urlProtegidaPortal);
        await adjuntarTexto('Logueado', `URL: ${r.urlFinal}`);
        await conResaltado(page, page.locator('main'), 'Pantalla protegida logueado', async () => {
          expect(r.enLogin, 'Estando logueado, la pantalla protegida no tiene que mostrar el login').toBe(false);
          await expect(historial(), 'Logueado tiene que verse el historial de reservas').toBeVisible({ timeout: 30_000 });
        });
      });

      await paso(page, 'Cerrar sesion', async () => {
        const cuenta = page.getByRole('banner').getByRole('button').filter({ hasText: 'AUTO-QA' }).first();
        const salir = page.getByRole('menuitem', { name: 'Cerrar sesión' });
        // El menu de la cuenta se abre al pasar el mouse (un clic sobre el boton lo cierra).
        await cuenta.hover();
        await salir.click();
        await expect(page, 'Cerrar sesion tiene que llevar al login').toHaveURL(/\/login/, { timeout: 30_000 });
        await adjuntarTexto('Despues del logout', `URL: ${page.url()}`);
      });

      await paso(page, 'Reescribiendo la URL de la pantalla protegida tiene que mandar al login', async () => {
        const r = await estadoDe(page, urlProtegidaPortal);
        await adjuntarTexto('Protegida tras logout', `HTTP ${r.estado}\nURL final: ${r.urlFinal}`);
        await conResaltado(page, page.locator('body'), 'Protegida tras logout', async () => {
          await expect(historial(), 'Tras cerrar sesion no tiene que verse el historial').toBeHidden();
          expect(r.ruta, `Tras cerrar sesion, la pantalla protegida tiene que redirigir al login, no quedarse en el historial (quedo en ${r.urlFinal})`).not.toBe(urlProtegidaPortal);
        });
      });

      await paso(page, 'El boton atras del navegador no tiene que devolver la pantalla protegida', async () => {
        await page.goBack().catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        // Aunque el atras muestre una copia, al recargar tiene que exigir login.
        await page.reload().catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000);
        const ruta = new URL(page.url()).pathname;
        await adjuntarTexto('Despues del atras', `URL final: ${page.url()}`);
        await conResaltado(page, page.locator('body'), 'Despues del atras', async () => {
          await expect(historial(), 'Con el boton atras no tiene que reaparecer el historial de reservas').toBeHidden();
          expect(ruta, `Con el boton atras, la pantalla protegida tiene que seguir fuera (login), no volver al historial (quedo en ${page.url()})`).not.toBe(urlProtegidaPortal);
        });
      });
    } finally {
      await contexto.close();
    }
  });
});
