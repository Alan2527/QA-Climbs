import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

const ARCHIVO_SESION = 'playwright/.auth/front.json';

/**
 * Login una sola vez por corrida: el estado se reusa en todos los specs.
 * Evita 7 logins seguidos contra un sitio con PostBacks lentos.
 */
setup('autenticar en el front de QA', async ({ page }) => {
  const usuario  = process.env.AMV_USER;
  const password = process.env.AMV_PASS;

  expect(usuario,  'Falta AMV_USER en el entorno').toBeTruthy();
  expect(password, 'Falta AMV_PASS en el entorno').toBeTruthy();

  const login = new LoginPage(page);
  await login.ingresar(usuario!, password!);
  await login.validarSesionIniciada();

  await page.context().storageState({ path: ARCHIVO_SESION });
});
