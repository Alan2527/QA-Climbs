import { test, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';

/**
 * BLOQUE SEGURIDAD — control de acceso: pantallas internas y cierre de sesion.
 *
 * Dos cosas que no dependen de ver datos ajenos sino del borde mismo del sistema:
 *  2. Las pantallas internas (BackOffice y Administracion) no se abren sin sesion:
 *     redirigen al login. Y el BackOffice, que es el nucleo contable interno, tampoco
 *     se abre con la sesion de una agencia del portal.
 *  3. Despues de cerrar sesion no se puede volver a una pantalla protegida: ni
 *     reescribiendo la URL ni con el boton "atras" del navegador.
 *
 * No escribe nada. El test de cierre de sesion usa una sesion propia y descartable
 * (login fresco de pablo1 en un contexto aparte), no la sesion compartida de la suite,
 * asi el logout no invalida la sesion que usan los demas tests.
 *
 * Aclaracion del alcance de la prueba 2: pablo1 es el usuario de la suite y SI tiene
 * acceso a /administration/ (es la WebAdmin que la agencia usa para sus markups y
 * tarifas). Por eso "una agencia no entra a Administracion" no se puede afirmar con
 * pablo1 y queda fuera; lo que si se prueba es que Administracion sin sesion manda al
 * login, y que el BackOffice (dominio y login propios) no se abre ni sin sesion ni con
 * la sesion de la agencia.
 */
test.describe('Seguridad — control de acceso a pantallas internas y cierre de sesion', () => {
  const baseBO = () => process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';
  // Pantallas claramente internas de cada back.
  const urlBO = () => `${baseBO()}/Files/Inbox.aspx`;             // bandeja de reservas del BO
  const urlAdministracion = '/administration/default.aspx';       // inicio de Administracion
  const urlProtegidaPortal = '/online/BookingHistory.aspx?tab=booking'; // historial (requiere sesion)

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  /**
   * Abre una URL y resuelve si quedo en una pantalla de login: lo decide la ruta final
   * (contiene "login") o la presencia de un campo de contrasena. BO y portal comparten
   * los ids #txtUser/#txtPassword en su login.
   */
  async function estadoDe(page: Page, url: string) {
    const resp = await page.goto(url).catch(() => null);
    await esperarFinDeCarga(page).catch(() => {});
    let ruta = page.url();
    try { ruta = new URL(page.url()).pathname; } catch { /* queda la url entera */ }
    const hayCampoClave = await page.locator('#txtPassword, input[type=password]').first().isVisible().catch(() => false);
    const enLogin = /login/i.test(ruta) || hayCampoClave;
    return { estado: resp?.status() ?? 0, urlFinal: page.url(), ruta, enLogin };
  }

  // =================================================================== Prueba 2
  test('Las pantallas internas no se abren sin sesion, y el BackOffice tampoco con una agencia', async ({ page, browser, baseURL }) => {
    test.setTimeout(300_000);

    // Contexto sin sesion para los dos primeros casos.
    const anon: BrowserContext = await browser.newContext({
      baseURL, viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });
    const sinSesion = await anon.newPage();

    try {
      await paso(sinSesion, 'Sin sesion: el BackOffice redirige al login', async () => {
        const r = await estadoDe(sinSesion, urlBO());
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

    await paso(page, 'Con la sesion de una agencia (pablo1): el BackOffice no se abre, manda a su login', async () => {
      const r = await estadoDe(page, urlBO());
      await adjuntarTexto('BO con sesion de agencia', `HTTP ${r.estado}\nURL final: ${r.urlFinal}`);
      await conResaltado(page, page.locator('body'), 'BO con agencia', () => {
        expect(r.enLogin, `El BackOffice no tiene que abrirse con la sesion de una agencia (quedo en ${r.urlFinal})`).toBe(true);
      });
    });
  });

  // =================================================================== Prueba 3
  test('Despues de cerrar sesion no se vuelve a una pantalla protegida, ni por URL ni con el boton atras', async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    const usuario = process.env.AMV_USER;
    const password = process.env.AMV_PASS;
    expect(usuario, 'Falta AMV_USER en el entorno').toBeTruthy();
    expect(password, 'Falta AMV_PASS en el entorno').toBeTruthy();

    // Sesion propia y descartable: no se toca la sesion compartida de la suite.
    const propio: BrowserContext = await browser.newContext({
      baseURL, viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });
    const page = await propio.newPage();

    try {
      await paso(page, 'Iniciar sesion y confirmar que la pantalla protegida se ve', async () => {
        await new LoginPage(page).ingresar(usuario!, password!);
        const r = await estadoDe(page, urlProtegidaPortal);
        await adjuntarTexto('Logueado', `URL: ${r.urlFinal}`);
        await conResaltado(page, page.locator('#tabBooking'), 'Pantalla protegida logueado', async () => {
          expect(r.enLogin, 'Estando logueado, la pantalla protegida no tiene que mostrar el login').toBe(false);
          await expect(page.locator('#tabBooking'), 'Logueado tiene que verse el historial de reservas').toBeVisible({ timeout: 30_000 });
        });
      });

      await paso(page, 'Cerrar sesion', async () => {
        await page.goto('/Logout.aspx');
        await esperarFinDeCarga(page).catch(() => {});
        await adjuntarTexto('Despues del logout', `URL: ${page.url()}`);
      });

      await paso(page, 'Reescribiendo la URL de la pantalla protegida tiene que mandar al login', async () => {
        const r = await estadoDe(page, urlProtegidaPortal);
        await adjuntarTexto('Protegida tras logout', `HTTP ${r.estado}\nURL final: ${r.urlFinal}`);
        // El sistema sin sesion redirige a la raiz con ?return=<ruta>; se mira el PATHNAME
        // final (el ?return lleva "BookingHistory" adentro y no cuenta).
        const rutaFinal = (() => { try { return new URL(r.urlFinal).pathname; } catch { return r.urlFinal; } })();
        await conResaltado(page, page.locator('body'), 'Protegida tras logout', async () => {
          await expect(page.locator('#tabBooking'), 'Tras cerrar sesion no tiene que verse el historial').toBeHidden();
          expect(/BookingHistory/i.test(rutaFinal), `Tras cerrar sesion, la pantalla protegida tiene que redirigir al inicio o al login, no quedarse en el historial (quedo en ${r.urlFinal})`).toBe(false);
        });
      });

      await paso(page, 'El boton atras del navegador no tiene que devolver la pantalla protegida', async () => {
        await page.goBack().catch(() => {});
        await esperarFinDeCarga(page).catch(() => {});
        // Vuelta definitiva del servidor: aunque el back muestre una copia del cache,
        // al recargar tiene que exigir login.
        await page.reload().catch(() => {});
        await esperarFinDeCarga(page).catch(() => {});
        let ruta = page.url();
        try { ruta = new URL(page.url()).pathname; } catch { /* queda la url entera */ }
        await adjuntarTexto('Despues del atras', `URL final: ${page.url()}`);
        await conResaltado(page, page.locator('body'), 'Despues del atras', async () => {
          await expect(page.locator('#tabBooking'), 'Con el boton atras no tiene que reaparecer el historial de reservas').toBeHidden();
          expect(/BookingHistory/i.test(ruta), `Con el boton atras, la pantalla protegida tiene que seguir fuera (inicio o login), no volver al historial (quedo en ${page.url()})`).toBe(false);
        });
      });
    } finally {
      await propio.close();
    }
  });
});
