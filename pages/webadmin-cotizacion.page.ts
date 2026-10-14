import { Page, expect, Locator } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * WebAdmin (BaseCamp): cotizaciones de grupo (`administration/budgets/`).
 *
 * - Alta: `budgetdetail.aspx` sin parametro. Al guardar redirige a `?budget=<id>`.
 *   Elegir un Itinerario arma solos los destinos y los servicios del paquete.
 * - "Crear reserva" abre un panel propio; "Aceptar" crea la reserva (WholesalerBook)
 *   y la ficha muestra su numero en la tarjeta de Auditoria (`litReservation`).
 * - Borrar la cotizacion es logico, desde el listado (kebab de la fila).
 */
export class WebAdminCotizacionPage {
  constructor(private readonly page: Page) {}

  private det(id: string) { return `[id*="pnlDetails"][id$="${id}"]`; }

  async nueva() {
    await this.page.goto('/administration/budgets/budgetdetail.aspx');
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.det('btnSave')), 'Tiene que abrir el alta de la cotizacion').toBeVisible();
  }

  /** Los combos largos son TomSelect: se elige en el select de abajo y se dispara el change. */
  private async elegir(id: string, valor: string, conPostBack = false) {
    const combo = this.page.locator(this.det(id));
    if (conPostBack) {
      await Promise.all([this.page.waitForLoadState('load'), combo.selectOption(valor, { force: true })]);
      await esperarFinDeCarga(this.page);
    } else {
      await combo.selectOption(valor, { force: true });
    }
    await expect(this.page.locator(this.det(id)), `El combo ${id} tiene que quedar en ${valor}`).toHaveValue(valor);
  }

  private async numero(id: string, valor: number) {
    await this.page.locator(this.det(`${id}_txtValue`)).fill(String(valor));
  }

  /**
   * Completa la cabecera y guarda. Devuelve el ID de la cotizacion, que sale de la
   * URL a la que redirige el guardado.
   */
  async crear(c: {
    agencia: string; ejecutivo: string; sucursal: string; itinerario: string;
    referencia: string; titulo: string; pax: number; sgl: number; dbl: number; tpl: number; inicio: string;
  }): Promise<number> {
    // La agencia primero: su PostBack rearma el combo Ejecutivo con los usuarios de la agencia.
    await this.elegir('ddAgency', c.agencia, true);
    await this.elegir('ddAccountExecutive', c.ejecutivo);
    await this.elegir('ddBranch', c.sucursal);
    await this.elegir('ddItinerary', c.itinerario);
    await this.page.locator(this.det('txtReference_txtValue')).fill(c.referencia);
    await this.page.locator(this.det('txtTitle_txtValue')).fill(c.titulo);
    await this.numero('txtPaxCountBudget', c.pax);
    await this.numero('txtBudgetSGL', c.sgl);
    await this.numero('txtBudgetDBL', c.dbl);
    await this.numero('txtBudgetTPL', c.tpl);
    await this.page.locator(this.det('ctrlInDate_txtDateTime')).evaluate((el, v) => {
      const fp = (el as any)._flatpickr;
      if (fp) fp.setDate(v, true, 'd/m/Y');
      else (el as HTMLInputElement).value = v;
    }, c.inicio);
    await Promise.all([
      this.page.waitForURL(/budgetdetail\.aspx\?budget=\d+/i, { timeout: 120_000 }),
      this.page.locator(this.det('btnSave')).click(),
    ]);
    await esperarFinDeCarga(this.page);
    return Number(new URL(this.page.url()).searchParams.get('budget'));
  }

  async abrir(id: number, solapa?: string) {
    await this.page.goto(`/administration/budgets/budgetdetail.aspx?budget=${id}${solapa ? `&TabID=${solapa}` : ''}`);
    await esperarFinDeCarga(this.page);
  }

  /** Filas de una grilla de solapa (Destinos o Servicios), como texto por celda. */
  async filas(solapa: 'pnlBudgetDestination' | 'pnlBudgeService'): Promise<string[][]> {
    return this.page.locator(`[id*="${solapa}"][id$="gvRels"] tr`).evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim()))
        .filter((f) => f.length > 1));
  }

  readonly botonCrearReserva = '[id$="btnCreateReservation"]';

  /** "Crear reserva" + "Aceptar". Devuelve el numero de reserva de la tarjeta de Auditoria. */
  async crearReserva(): Promise<number> {
    await this.page.locator(this.botonCrearReserva).click();
    const aceptar = this.page.locator('[id$="btnConfirmReservation"]');
    await expect(aceptar, 'Crear reserva tiene que pedir confirmacion').toBeVisible();
    await Promise.all([this.page.waitForLoadState('load'), aceptar.click()]);
    await esperarFinDeCarga(this.page);
    const etiqueta = this.page.locator('[id$="litReservation"]');
    await expect(etiqueta, 'La ficha tiene que mostrar la reserva creada').toBeVisible({ timeout: 60_000 });
    const n = (await etiqueta.innerText()).match(/\d+/)?.[0];
    expect(n, 'La tarjeta de la reserva tiene que mostrar su numero').toBeTruthy();
    return Number(n);
  }

  /** Borrado logico desde el listado, buscando la cotizacion por su referencia. */
  async borrar(id: number, referencia: string) {
    await this.page.goto(`/administration/budgets/default.aspx?refs=${encodeURIComponent(referencia)}`);
    await esperarFinDeCarga(this.page);
    const fila = this.filaDelListado(id);
    await expect(fila, `El listado tiene que mostrar la cotizacion ${id}`).toBeVisible();
    await fila.locator('.bgrid-btn-more').click();
    await fila.locator('[id$="lnkDelete"]').click();
    const si = fila.locator('[id$="cbDelete_btnYES"]');
    await expect(si, 'Borrar tiene que pedir confirmacion').toBeVisible();
    await Promise.all([this.page.waitForLoadState('load'), si.click()]);
    await esperarFinDeCarga(this.page);
  }

  filaDelListado(id: number): Locator {
    return this.page.locator('tr, .bgrid-row').filter({ has: this.page.locator(`a[href*="budget=${id}"]`) }).first();
  }

  /** Borrado logico de la reserva desde su ficha del WebAdmin ("Eliminar reserva"). */
  async eliminarReserva(reserva: number) {
    await this.page.goto(`/administration/booking/detail.aspx?book=${reserva}`);
    await esperarFinDeCarga(this.page);
    this.page.once('dialog', (d) => d.accept());
    await this.page.locator('[id$="btnDelete"]').first().click();
    const si = this.page.locator('[id$="cbDelete_btnYES"]:visible, [id$="btnYES"]:visible').first();
    if (await si.isVisible({ timeout: 5_000 }).catch(() => false)) await si.click();
    await this.page.waitForLoadState('load');
    await esperarFinDeCarga(this.page);
  }
}
