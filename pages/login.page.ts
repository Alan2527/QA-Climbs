import { Page, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Login del sitio publico (qa.amv.travel).
 * Los IDs salen de Web/Login.aspx: txtUser, txtPassword, btnLogin.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  private readonly usuario  = '#txtUser';
  private readonly password = '#txtPassword';
  private readonly btnEntrar = '#btnLogin';

  async abrir() {
    await this.page.goto('/login.aspx');
    await esperarFinDeCarga(this.page);
  }

  async ingresar(usuario: string, password: string) {
    await this.abrir();
    await this.page.locator(this.usuario).fill(usuario);
    await this.page.locator(this.password).fill(password);
    await this.page.locator(this.btnEntrar).click();
    // El login redirige fuera de /login.aspx; si no lo hace, quedaron credenciales mal.
    await this.page.waitForURL(
      (url) => !url.pathname.toLowerCase().includes('login'),
      { timeout: 60_000 },
    );
    await esperarFinDeCarga(this.page);
  }

  async validarSesionIniciada() {
    await expect(this.page).not.toHaveURL(/login/i);
  }

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
  async cerrarAvisosDelPortal() {
    const page = this.page;
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
}
