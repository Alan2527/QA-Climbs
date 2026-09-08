import { Page, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Liquidacion del file (`booking/files/liqfile/{id}`).
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

  /** Abre la liquidacion de un file y espera a que el documento este armado. */
  async abrir(fileId: string) {
    await this.page.goto(`${process.env.AMV_BO_URL}/booking/files/liqfile/${fileId}`);
    await esperarFinDeCarga(this.page);

    // El documento entra por AJAX despues de la carga: la pantalla existe vacia
    // un instante, y leerla ahi devuelve un editor en blanco.
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
    await esperarFinDeCarga(this.page);
    await this.page.waitForTimeout(2_000);
  }

  /**
   * Regenera la liquidacion desde el file, descartando la guardada.
   *
   * El boton se llama "Regenerar" y por debajo hace `removeliq`: borra el
   * `BO_FileLiq` y deja que la pantalla lo vuelva a construir.
   */
  async regenerar() {
    this.page.once('dialog', (d) => d.accept().catch(() => {}));
    await this.page.locator(this.btnRegenerar).click();
    await esperarFinDeCarga(this.page);
    await this.page.waitForTimeout(3_000);
  }

  /** Cambia el idioma del documento. Hace postback y lo vuelve a armar. */
  async elegirIdioma(idioma: 'Español' | 'Inglés' | 'Portugués') {
    await this.page.locator(this.comboIdioma).selectOption({ label: idioma });
    await esperarFinDeCarga(this.page);
    await this.page.waitForTimeout(2_000);
  }
}
