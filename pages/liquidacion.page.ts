import { Page, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Liquidacion del file (`booking/files/liqfile/{id}`).
 *
 * **No se entra por URL.** El boton "Liquidacion" del file primero guarda en la
 * sesion del BO los items tildados (`setparameterliq`, o -2 si no hay ninguno) y
 * recien despues abre la pantalla en una pestania nueva
 * (`ManageFile.aspx`, `redirectLiquidacion`). La pantalla lee ese valor de la
 * sesion al armar el documento (`Tmpl/FileLiq.aspx.cs:87`): entrando directo por
 * URL no existe, la carga falla y el editor queda vacio. Asi fallaba el primer
 * intento del test, y Alan lo confirmo a mano el 2026-09-14.
 *
 * Es el documento que se le entrega al cliente con el detalle del viaje y su
 * total. **No es una pantalla de consulta: es un documento editable.** El BO lo
 * arma la primera vez a partir del file y despues lo guarda en `BO_FileLiq`; a
 * partir de ahi muestra lo guardado y no vuelve a mirar el file
 * (`Tmpl/FileLiq.aspx.cs:88`, `if (liq != null && liq.Data.NotEmpty())`).
 *
 * Esa es la regla que hace que valga la pena probarlo: **una vez guardada, la
 * liquidacion deja de seguir al file**. Si despues se agrega un item o cambia un
 * importe, el documento sigue diciendo lo de antes hasta que alguien lo regenere.
 * "Regenerar" es el boton que borra lo guardado y lo vuelve a construir.
 *
 * El contenido no vive en el DOM de la pantalla: se pide por AJAX a
 * `Tmpl/FileLiq.aspx`, se le extrae el `#liq-data` y se inyecta en un editor
 * SummerNote (`Resources/custom/scripts/file.js:5768`). Por eso se lee del cuerpo
 * del editor y no de un literal.
 *
 * El BO no tiene selector de idioma, pero **esta pantalla si**: el documento se
 * puede emitir en espaniol, ingles o portugues, porque va al cliente.
 */
export class LiquidacionPage {
  constructor(private readonly page: Page) {}

  /** El cuerpo del editor donde queda el documento ya armado. */
  readonly documento = '.note-editable';
  readonly comboIdioma = '#ddLanguage';
  readonly btnGuardar = '#btnSaveLiq';
  readonly btnRegenerar = '#btnRemoveLiq';
  readonly btnCopiar = '#btnCopy';
  readonly btnGuardarEImprimir = '#btnPrintLiq';

  /**
   * Abre la liquidacion con el boton del file, como una persona, y devuelve la
   * pagina de la pestania nueva ya con el documento armado. `page` tiene que
   * estar en el file (`booking/files/managefile/{id}`).
   */
  static async abrirDesdeElFile(page: Page): Promise<LiquidacionPage> {
    const [pestania] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 60_000 }),
      page.locator("a[onclick*='redirectLiquidacion']").first().click(),
    ]);
    await pestania.waitForLoadState('domcontentloaded');
    const liquidacion = new LiquidacionPage(pestania);
    await liquidacion.esperarDocumento();
    return liquidacion;
  }

  /** La pagina de la pestania donde vive la liquidacion. */
  get pagina(): Page {
    return this.page;
  }

  /** Espera a que el documento, que entra por AJAX, este en el editor. */
  async esperarDocumento() {
    await esperarFinDeCarga(this.page);
    await expect(
      this.page.locator(this.documento),
      'La liquidacion tiene que abrir con su editor',
    ).toBeVisible({ timeout: 60_000 });
    await this.page.waitForFunction(
      (sel) => (document.querySelector(sel)?.textContent || '').trim().length > 0,
      this.documento, { timeout: 60_000 });
  }

  /** Texto del documento, normalizado. */
  async texto(): Promise<string> {
    return (await this.page.locator(this.documento).innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Todos los importes que muestra el documento, en orden. */
  async importes(): Promise<string[]> {
    return (await this.texto()).match(/[A-Z]{3}\s*[\d.,]+|\d[\d.,]*/g) ?? [];
  }

  /** Guarda la liquidacion: a partir de aca el documento queda congelado. */
  async guardar() {
    await this.page.locator(this.btnGuardar).click();
    // saveLiq avisa con un noty cuando termina de mandar todas las partes.
    await expect(
      this.page.locator('.noty_text, .noty_body, .noty_message')
        .filter({ hasText: 'Los datos se guardaron correctamente' }).first(),
      'El BO tiene que confirmar que guardo la liquidacion',
    ).toBeVisible({ timeout: 60_000 });
  }

  /**
   * Regenera la liquidacion desde el file, descartando la guardada. `removeLiq`
   * borra el `BO_FileLiq` y recarga la pestania, que lo vuelve a construir.
   */
  async regenerar() {
    await Promise.all([
      this.page.waitForEvent('load', { timeout: 60_000 }),
      this.page.locator(this.btnRegenerar).click(),
    ]);
    await this.esperarDocumento();
  }

  /** Idiomas que ofrece el combo, tal como se leen. */
  async idiomas(): Promise<string[]> {
    return this.page.locator(`${this.comboIdioma} option`).allInnerTexts();
  }

  /** Cambia el idioma: hace postback y el documento se vuelve a armar. */
  async elegirIdioma(idioma: string) {
    await Promise.all([
      this.page.waitForEvent('load', { timeout: 60_000 }),
      this.page.locator(this.comboIdioma).selectOption({ label: idioma }),
    ]);
    await this.esperarDocumento();
  }
}
