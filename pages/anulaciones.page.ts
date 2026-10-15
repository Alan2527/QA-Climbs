import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Anulaciones de Cobranzas: el circuito inverso al armado de la cadena.
 *
 * Dos pantallas del BO y un lector de estado:
 *
 *   Cartas emitidas  -> invoice-management/invoicing/issued-letters[?fileId=N]
 *   Bandeja de OP    -> administration/payorders           (boton Anular de cada fila)
 *   Detalle de OP    -> administration/payorder/{id}       (estado Pendiente / Pago / Anulado)
 *
 * Referencias:
 *   Invoicing/IssuedLetters.aspx(.cs) -> tblIssued, lnkDelete; el borrado esta en el
 *                                        Page_Load (IssuedLetters.aspx.cs:46-68)
 *   Resources/custom/scripts/invoicing.js:1149-1169 -> a.del-data + confirmacion
 *                                        "Sí, eliminar" (swal) + __doPostBack('lnkDelete', id)
 *   PayOrders/Default.aspx:192        -> LinkButton lnkDelete (title "Anular"), visible solo
 *                                        si CheckVisible (Default.aspx.cs:195)
 *   Resources/custom/scripts/bomain.js:332 -> checkForCancel: confirmacion "Sí, anular"
 *   PayOrders/Detail.aspx:19-27       -> h5 text-danger (Anulado) / h5 text-success (resto)
 *
 * El BO no tiene selector de idioma: no aplica la consideracion de multiidioma.
 */

const baseBO = () => process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';

/** Confirma el cartel de SweetAlert que abre el BO antes de borrar o anular. */
async function confirmarCartel(page: Page, boton: RegExp) {
  // Se espera a que SweetAlert termine de abrir el cartel (clase `visible`): un clic
  // durante la animacion lo cierra sin llamar al callback, y con los botones
  // `usepreload` (Anular de las OP) el spinner queda colgado para siempre. Medido el 15/10.
  const cartel = page.locator('.sweet-alert.visible').last();
  await expect(cartel, 'El BO tiene que pedir confirmacion antes de anular').toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await cartel.getByRole('button', { name: boton }).click();
}

/** Cartas emitidas: la lista de Cartas de Cobranza con numero y fecha de emision. */
export class CartasEmitidasPage {
  constructor(private readonly page: Page) {}

  readonly grilla = '#tblIssued';
  /** Fila que DataTables pinta cuando la consulta no devuelve nada. */
  readonly filaVacia = '#tblIssued tbody td.dataTables_empty';

  /**
   * Abre las cartas de un file. Sin `fileId` el filtro del servidor no se aplica y la
   * lista trae las de todos los files (invoicing.js:1071).
   */
  async abrirDelFile(fileId: string) {
    await this.page.goto(`${baseBO()}/invoice-management/invoicing/issued-letters?fileId=${fileId}`,
      { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await esperarFinDeCarga(this.page);
  }

  /** Fila de la grilla que contiene el texto (numero de file o de comprobante). */
  fila(texto: string): Locator {
    return this.page.locator(`${this.grilla} tbody tr`).filter({ hasText: texto }).first();
  }

  /** Celdas de una fila, normalizadas. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  /**
   * Borra la carta de la fila: papelera (`a.del-data`) y confirmacion "Sí, eliminar".
   * Despues del postback el BO recarga la pagina solo (`location.reload()`,
   * IssuedLetters.aspx.cs:67), asi que el resultado se espera mirando la grilla y no
   * una navegacion.
   */
  async anular(fila: Locator) {
    // El borrado lo dispara el callback del cartel con `__doPostBack('lnkDelete', id)`
    // (invoicing.js:1149-1168). Medido el 15/10: un clic en "Si, eliminar" mientras el
    // cartel todavia entraba lo cerraba sin llamar al callback, no salia ningun POST y
    // la carta quedaba vigente (a mano, en cambio, se borra). Por eso se espera a que
    // el cartel termine de abrirse y se exige el POST; si no sale, se reintenta una vez.
    const borrado = (r: import('@playwright/test').Request) =>
      r.method() === 'POST' && /__EVENTTARGET=lnkDelete/.test(r.postData() ?? '');
    for (let intento = 0; intento < 2; intento++) {
      await fila.locator('a.del-data').click();
      const cartel = this.page.locator('.sweet-alert.visible').last();
      await expect(cartel, 'El BO tiene que pedir confirmacion antes de borrar la carta').toBeVisible({ timeout: 30_000 });
      await this.page.waitForTimeout(500);
      const post = this.page.waitForRequest(borrado, { timeout: 15_000 }).then(() => true).catch(() => false);
      await cartel.getByRole('button', { name: /S[ií],\s*eliminar/i }).click();
      if (await post) return;
    }
    throw new Error('Confirmado el cartel, el BO no envio el borrado de la carta (no salio el POST lnkDelete)');
  }
}

/** Bandeja de ordenes de pago, solo lo que hace falta para anular. */
export class AnulacionDeOrdenesPage {
  constructor(private readonly page: Page) {}

  /** El boton Anular de la fila: LinkButton con ToolTip "Anular" (Default.aspx:192). */
  botonAnular(fila: Locator): Locator {
    return fila.locator("a[title='Anular']");
  }

  /**
   * Anula desde la bandeja: boton, confirmacion "Sí, anular" y espera a que la pagina
   * se recargue. `lnkDelete_Command` termina siempre en un `Response.Redirect` a la
   * propia bandeja (Default.aspx.cs:225), anule o no anule.
   */
  async anular(fila: Locator) {
    const recarga = this.page.waitForEvent('framenavigated', {
      predicate: (f) => f === this.page.mainFrame(), timeout: 60_000,
    }).catch(() => null);
    await this.botonAnular(fila).click();
    await confirmarCartel(this.page, /S[ií],\s*anular/i);
    await recarga;
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }

  /** Abre el detalle de una orden por su id. */
  async abrirDetalle(page: Page, id: string) {
    await page.goto(`${baseBO()}/administration/payorder/${id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await esperarFinDeCarga(page);
  }
}

/**
 * Estado que muestra el detalle de una orden de pago.
 *
 * Una orden anulada pinta su estado en un h5 `text-danger` y esconde el otro; todas las
 * demas (Pendiente, Pago) usan el h5 `text-success` (Detail.aspx.cs:283-298). El page
 * object de la orden solo lee el segundo, por eso este lector es aparte.
 */
export async function estadoDeLaOrden(page: Page): Promise<{ anulada: boolean; estado: string }> {
  const anulado = page.locator('h5.text-uppercase.text-danger');
  if (await anulado.count()) {
    return { anulada: true, estado: (await anulado.first().innerText()).replace(/\s+/g, ' ').trim() };
  }
  const vigente = page.locator('h5.text-uppercase.text-success');
  const estado = (await vigente.count()) ? (await vigente.first().innerText()).replace(/\s+/g, ' ').trim() : '';
  return { anulada: false, estado };
}
