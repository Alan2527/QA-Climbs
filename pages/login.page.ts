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
}
