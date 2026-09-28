import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

import type { Page } from '@playwright/test';

const ARCHIVO_SESION = 'playwright/.auth/front.json';

/**
 * Deja el portal sin los avisos que se abren solos y tapan la pantalla: el modal de
 * Novedades y los popups por pantalla.
 *
 * Lo agrego el deploy del 2026-09-26 (`4d68a511`, "nuevo modal de Novedades"): se
 * abre solo al cargar la pagina y tapa todo, asi que el 28/09 la corrida 88 murio en
 * las precondiciones con timeouts al presionar Buscar. El propio modal guarda en
 * localStorage que ya se vio, por usuario (`amv.news.<release>.<userId>`), asi que
 * alcanza con cerrarlo una vez aca: el navegador de cada corrida arranca limpio.
 *
 * Si no aparece no pasa nada: el paso no falla.
 */
async function cerrarAvisosDelPortal(page: Page) {
  // Se entra al portal a proposito: el modal se abre al cargar sus pantallas, no en
  // el login.
  await page.goto('/online/');

  // No se espera a que se abra para cerrarlo: tarda lo que tarde la pagina y, si
  // aparece despues de guardar la sesion, la corrida entera se lo come. Se deja
  // marcado como visto con LA MISMA clave que usa el sistema
  // (`amv.news.<release>.<userId>`, assets/js/release-notes.js), leyendo de la
  // propia pagina el usuario y las novedades publicadas.
  const marcadas = await page.evaluate(() => {
    const cfg = (window as any).releaseNotesConfig;
    const novedades = (window as any).AdvisorReleases as Array<{ id: string }> | undefined;

    // Los popups del portal (los que se cargan por pantalla, como el AUTO QA de la
    // US 4753) tapan la portada hasta que se cierran. El propio portal los muestra
    // una vez por dia y por navegador, guardando la fecha en `popupShownDate`
    // (SearchControl.ascx): se deja puesta con el mismo formato, sin ceros.
    const hoy = new Date();
    window.localStorage.setItem('popupShownDate',
      `${hoy.getFullYear()}-${hoy.getMonth() + 1}-${hoy.getDate()}`);

    if (!cfg || !novedades?.length) return 0;
    for (const n of novedades) window.localStorage.setItem(`amv.news.${n.id}.${cfg.userId}`, '1');
    return novedades.length;
  });
  expect(marcadas, 'El portal tiene que publicar sus novedades para poder marcarlas como vistas').toBeGreaterThan(0);

  // Si ya se abrio en esta pagina, se cierra como lo haria el usuario.
  const cerrar = page.locator('.rn-scrim [data-rn-action="close"]').first();
  if (await cerrar.count()) {
    await cerrar.click().catch(() => {});
    await expect(page.locator('.rn-scrim')).toBeHidden({ timeout: 15_000 });
  }
}

/**
 * Login una sola vez por corrida: el estado se reusa en todos los specs.
 * Evita 7 logins seguidos contra un sitio con PostBacks lentos.
 */
setup('Login en el front de QA', async ({ page }) => {
  const usuario  = process.env.AMV_USER;
  const password = process.env.AMV_PASS;

  expect(usuario,  'Falta AMV_USER en el entorno').toBeTruthy();
  expect(password, 'Falta AMV_PASS en el entorno').toBeTruthy();

  const login = new LoginPage(page);
  await login.ingresar(usuario!, password!);
  await login.validarSesionIniciada();

  await cerrarAvisosDelPortal(page);

  // El estado incluye el localStorage, asi que la marca de "novedades vistas" viaja
  // a todos los specs y el modal no vuelve a abrirse en la corrida.
  await page.context().storageState({ path: ARCHIVO_SESION });
});
