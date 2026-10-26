import { Page, Locator, expect } from '@playwright/test';

/**
 * Liquidacion del file en el Backoffice nuevo: boton "Liquidación" de la ficha del file.
 *
 * Abre el dialogo "Liquidación del File". Si no hay una guardada, primero pide tildar los
 * items y destinos que llevan precio ("Generar"); despues muestra el documento en un editor
 * con "Guardar", "Regenerar" y el combo "Idioma". Una guardada se abre directo, tal cual.
 */
export class LiquidacionNuevaPage {
  constructor(private readonly page: Page) {}

  get dialogo(): Locator {
    return this.page.getByRole('dialog', { name: 'Liquidación del File' });
  }

  get editor(): Locator {
    return this.dialogo.locator('[contenteditable="true"]').first();
  }

  async abrirDesdeElFile(fileId: string) {
    await this.page.goto(`/files/files/${fileId}`);
    await this.page.getByRole('dialog').first().getByRole('button', { name: 'Liquidación', exact: true }).click();
    await expect(this.dialogo, 'El boton Liquidación tiene que abrir el dialogo de la liquidacion').toBeVisible();
  }

  /**
   * Paso de eleccion: si aparece, se genera con lo tildado (o sin nada tildado).
   *
   * Hay que esperar a que el dialogo termine de cargar: una liquidacion guardada muestra
   * primero, completa, la lista para tildar con "Generar" habilitado, y recien despues pasa al
   * documento, donde el boton del mismo lugar es "Guardar e Imprimir". Un clic en ese
   * instante abre la impresion (observado el 26/10/2026).
   */
  async generarSiHaceFalta() {
    const eleccion = this.dialogo.getByRole('checkbox').first();
    await expect(this.editor.or(eleccion), 'La liquidacion tiene que terminar de cargar').toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
    if (!(await this.editor.isVisible())) await this.dialogo.getByRole('button', { name: 'Generar', exact: true }).click();
    await expect(this.editor, 'Tiene que mostrarse el documento de la liquidacion').toBeVisible({ timeout: 60_000 });
    await expect(this.editor).not.toHaveText('', { timeout: 60_000 });
  }

  async texto(): Promise<string> {
    return (await this.editor.innerText()).replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
  }

  async agregarAlFinal(texto: string) {
    await this.editor.click();
    await this.page.keyboard.press('Control+End');
    await this.page.keyboard.type(` ${texto}`);
  }

  async guardar() {
    await this.dialogo.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(this.dialogo.getByText(/Esta liquidación está guardada/), 'Guardada, la liquidacion tiene que avisar que se muestra tal cual')
      .toBeVisible({ timeout: 30_000 });
  }

  async cerrar() {
    await this.dialogo.getByRole('button', { name: /^(Cerrar|Close)$/ }).first().click();
    await expect(this.dialogo).toBeHidden();
  }

  /** Regenerar descarta lo guardado (pide confirmacion) y vuelve al paso de eleccion. */
  async regenerar() {
    await this.dialogo.getByRole('button', { name: 'Regenerar', exact: true }).click();
    const pregunta = this.page.getByRole('alertdialog').filter({ hasText: 'Regenerar la liquidación' });
    if (await pregunta.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) {
      await pregunta.getByRole('button', { name: 'Regenerar', exact: true }).click();
      await expect(pregunta).toBeHidden();
    }
    // Vuelve al paso de eleccion: se espera a que el documento se vaya y aparezca la lista.
    await expect(this.editor, 'Regenerar tiene que descartar el documento').toBeHidden({ timeout: 30_000 });
    await expect(this.dialogo.getByRole('checkbox').first(), 'Regenerar tiene que volver a la eleccion de items').toBeVisible({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle');
    await this.dialogo.getByRole('button', { name: 'Generar', exact: true }).click();
    await expect(this.editor, 'Tiene que mostrarse el documento regenerado').toBeVisible({ timeout: 60_000 });
    await expect(this.editor).not.toHaveText('', { timeout: 60_000 });
  }

  get comboIdioma(): Locator {
    return this.dialogo.getByRole('combobox', { name: 'Idioma' });
  }

  async idiomas(): Promise<string[]> {
    return (await this.comboIdioma.locator('option').allInnerTexts()).map((t) => t.trim());
  }

  async elegirIdioma(idioma: string) {
    await this.comboIdioma.selectOption({ label: idioma });
    await expect(this.editor).not.toHaveText('', { timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
  }
}
