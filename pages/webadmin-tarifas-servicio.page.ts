import { Page, expect, Locator } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

export type TarifaDeServicio = {
  fila: Locator; fechas: string; tarifa: number | null; moneda: string; pax: string; tipo: string; extension: string;
};

/**
 * WebAdmin (BaseCamp): solapa Tarifas de un servicio
 * (`administration/services/detail.aspx?service=<id>&TabID=pnlRates`, ServiceRateControl).
 *
 * Grilla: Fechas | Tarifa | Pax | Tipo | Min Pax | Mercado | Vehiculo | Observacion |
 * Recargos | Extension | Fecha Extension. La extension toma las filas tildadas y crea
 * una tarifa nueva por cada una en el rango pedido, con el incremento aplicado.
 */
export class WebAdminTarifasServicioPage {
  constructor(private readonly page: Page) {}

  private sel(id: string) { return `[id$="ctrlServiceRateControl_${id}"]`; }
  readonly grilla = '[id$="ctrlServiceRateControl_gvwRates"]';

  async abrir(servicio: number) {
    await this.page.goto(`/administration/services/detail.aspx?service=${servicio}&TabID=pnlRates`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.grilla), 'La solapa Tarifas tiene que mostrar la grilla').toBeVisible();
  }

  async tarifas(): Promise<TarifaDeServicio[]> {
    const filas = this.page.locator(`${this.grilla} tr`).filter({ has: this.page.locator('input[id$="cbObject"]') });
    const n = await filas.count();
    const out: TarifaDeServicio[] = [];
    for (let i = 0; i < n; i++) {
      const fila = filas.nth(i);
      const c = (await fila.locator('td').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      const m = (c[2] ?? '').match(/([\d.,]+)\s*([A-Z]{3})?/);
      out.push({
        fila, fechas: c[1] ?? '', pax: c[3] ?? '', tipo: c[4] ?? '', extension: c[10] ?? '',
        tarifa: m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null, moneda: m?.[2] ?? '',
      });
    }
    return out;
  }

  private async tildar(filas: TarifaDeServicio[]) {
    for (const f of filas) await f.fila.locator('input[id$="cbObject"]').check({ force: true });
  }

  private async fecha(id: string, valor: string) {
    // Se tipea y se pasa con Tab, como una persona. Cargarla con `_flatpickr.setDate`
    // (como en la ficha de habitacion) no sirve aca: al pasar el foco al porcentaje la
    // fecha Desde se borraba y Extender quedaba deshabilitado.
    const campo = this.page.locator(this.sel(`${id}_txtDateTime`));
    await campo.click();
    await campo.fill('');
    await campo.pressSequentially(valor, { delay: 30 });
    await campo.press('Tab');
    await expect(campo).toHaveValue(valor);
  }

  /**
   * Tilda `filas`, abre "Extender seleccionados" y extiende al rango con el
   * porcentaje. Si el sistema avisa que pisa una vigencia existente, confirma.
   */
  async extender(filas: TarifaDeServicio[], desde: string, hasta: string, porcentaje: number) {
    await this.tildar(filas);
    await this.page.locator(this.sel('btnShowPopUpAnchor')).click();
    await expect(this.page.locator(this.sel('pnlPopup')), 'Tiene que abrirse el popup Extender tarifas').toBeVisible();
    await this.fecha('ctrlPopUpDesdeDatePicker', desde);
    await this.fecha('ctrlPopUpHastaDatePicker', hasta);
    const pct = this.page.locator(this.sel('txtPopUpPercentage'));
    // El boton Extender lo habilita `validateDates()`, que la pantalla corre cuando el
    // porcentaje recibe el foco (onfocus): se dispara ese evento con las fechas ya cargadas.
    await pct.focus();
    await pct.dispatchEvent('focus');
    await pct.fill(String(porcentaje));
    await pct.blur();
    const extender = this.page.locator(this.sel('btnProcessChecked'));
    await expect(extender, 'Con las fechas cargadas, Extender se tiene que habilitar').toBeEnabled();
    await Promise.all([this.page.waitForLoadState('load'), extender.click()]);
    await esperarFinDeCarga(this.page);
    const confirmar = this.page.locator(this.sel('btnConfirm'));
    if (await confirmar.isVisible().catch(() => false)) {
      await Promise.all([this.page.waitForLoadState('load'), confirmar.click()]);
      await esperarFinDeCarga(this.page);
    }
  }

  /** Tilda `filas` y "Borrar seleccionados" con su confirmacion. */
  async borrar(filas: TarifaDeServicio[]) {
    if (!filas.length) return;
    await this.tildar(filas);
    await this.page.locator(this.sel('btnDeleteAll')).click();
    const si = this.page.locator(this.sel('cbDelete_btnYES'));
    await expect(si, 'Borrar tiene que pedir confirmacion').toBeVisible();
    await Promise.all([this.page.waitForLoadState('load'), si.click()]);
    await esperarFinDeCarga(this.page);
  }
}
