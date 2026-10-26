import { Page, Locator, expect } from '@playwright/test';
import { AgenciaNuevaPage } from './agencia.page';

export type DatosDelUsuario = { nombre: string; apellido: string; email: string; usuario: string };
export type FichaDelUsuario = {
  nombre: string; apellido: string; email: string; usuario: string; agencia: string; pais: string; tipo: string;
  moneda: string; estado: string; estadoEditable: boolean; habilitado: boolean; veMarkup: boolean;
};

/**
 * Usuarios de agencia en el Backoffice nuevo (Clientes › Usuarios de agencias,
 * /clients/agency-users): reemplaza a Customers/Detail del WebAdmin. El alta se abre desde la
 * solapa "Usuarios" de la agencia ("Nuevo usuario"), que viene con la agencia elegida. La clave la
 * escribe quien da el alta (no la genera la pantalla). La ficha tiene "Borrar" en el pie.
 *
 * La clave nunca sale de aca: no se adjunta ni se loguea.
 */
export class UsuarioDeAgenciaPage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.locator('#au-email') }).first(); }
  get pie(): Locator { return this.ficha.getByRole('contentinfo').last(); }

  async abrirAlta(agencia: number) {
    const a = new AgenciaNuevaPage(this.page);
    await a.abrir(agencia, 'Usuarios');
    await a.ficha.getByRole('button', { name: 'Nuevo usuario' }).click();
    await expect(this.ficha, 'Nuevo usuario tiene que abrir el alta').toBeVisible({ timeout: 60_000 });
    // Los combos llegan despues de abrir: tipo, monedas y la lista de agencias (la elegida se ve recien entonces).
    await expect(this.ficha.locator('#au-type option').first()).toBeAttached({ timeout: 30_000 });
    await expect(this.ficha.locator('#au-agency')).not.toHaveValue('', { timeout: 30_000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async abrir(id: number) {
    await this.page.goto(`/clients/agency-users/${id}`);
    await expect(this.ficha.locator('#au-email'), `La ficha del usuario ${id} tiene que abrir`).not.toHaveValue('', { timeout: 60_000 });
  }

  private async elegido(id: string): Promise<string> {
    return this.ficha.locator(`#${id}`).evaluate((s: HTMLSelectElement) => (s.value ? s.options[s.selectedIndex]?.text.trim() ?? '' : ''));
  }

  async leer(): Promise<FichaDelUsuario> {
    const v = (id: string) => this.ficha.locator(`#${id}`).inputValue();
    return {
      nombre: await v('au-name'), apellido: await v('au-lastName'), email: await v('au-email'), usuario: await v('au-userName'),
      agencia: await v('au-agency'), pais: await this.elegido('au-country'), tipo: await this.elegido('au-type'),
      moneda: await this.elegido('au-currency'), estado: await this.elegido('au-status'),
      estadoEditable: await this.ficha.locator('#au-status').isEnabled(),
      habilitado: await this.ficha.locator('#au-pub').isChecked(), veMarkup: await this.ficha.locator('#au-markup').isChecked(),
    };
  }

  async completar(d: DatosDelUsuario, clave: string) {
    await this.ficha.locator('#au-name').fill(d.nombre);
    await this.ficha.locator('#au-lastName').fill(d.apellido);
    await this.ficha.locator('#au-email').fill(d.email);
    await this.ficha.locator('#au-userName').fill(d.usuario);
    await this.ficha.locator('#au-pass').fill(clave);
  }

  /** "Guardar": devuelve el id si llevo a la ficha nueva, o el aviso del rechazo. */
  async guardarAlta(): Promise<{ id: number | null; aviso: string }> {
    await this.pie.getByRole('button', { name: 'Guardar', exact: true }).click();
    const ficha = this.page.waitForURL(/\/clients\/agency-users\/\d+/, { timeout: 30_000 }).then(() => true).catch(() => false);
    if (await ficha) {
      await expect(this.pie).toContainText('Al día', { timeout: 30_000 });
      return { id: Number(this.page.url().match(/agency-users\/(\d+)/)?.[1]), aviso: '' };
    }
    const avisos = [
      ...(await this.ficha.locator('.error').allInnerTexts()),
      ...(await this.page.locator('.toast.bad .toast-text').allInnerTexts()),
    ];
    return { id: null, aviso: avisos.join(' | ').replace(/\s+/g, ' ').trim() };
  }

  /** Las filas de la solapa Usuarios de la agencia con ese email. */
  async filasDelListado(agencia: number, email: string): Promise<string[]> {
    const a = new AgenciaNuevaPage(this.page);
    await a.abrir(agencia, 'Usuarios');
    await expect(a.ficha.getByRole('table').or(a.ficha.getByText('La agencia no tiene usuarios.')).first()).toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return (await a.ficha.getByRole('table').locator('tbody tr').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t.includes(email));
  }

  /** "Borrar" del pie de la ficha, con su confirmacion. */
  async darDeBaja(id: number) {
    await this.abrir(id);
    await this.pie.getByRole('button', { name: 'Borrar' }).click();
    const confirmacion = this.page.getByRole('alertdialog');
    await confirmacion.getByRole('button').last().click();
    await expect(this.page).not.toHaveURL(new RegExp(`agency-users/${id}`), { timeout: 30_000 });
  }
}

/** Intenta entrar al portal nuevo con usuario y clave en un contexto limpio; true si entra. */
export async function intentarIngresoAlPortalNuevo(page: Page, usuario: string, clave: string): Promise<boolean> {
  await page.goto('/site/login');
  await page.getByRole('textbox', { name: 'Usuario o email' }).fill(usuario);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  const entro = await page.waitForURL((u) => !/\/site\/login/.test(u.pathname), { timeout: 30_000 }).then(() => true).catch(() => false);
  return entro;
}
