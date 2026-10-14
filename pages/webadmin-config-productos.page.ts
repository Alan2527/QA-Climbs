import { Page, expect, Locator } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * WebAdmin (BaseCamp): solapa "Config. de productos" de una agencia
 * (`administration/agencies/detail.aspx?agency=<id>&TabID=pnlProductSetting`,
 * ProductSettingControl).
 *
 * Cada fila es una condicion comercial de la agencia sobre un producto: un markup
 * propio (divide el precio, como el del mercado) o "Excluido" (la agencia no ve el
 * producto). Tipos: 1 HOTELES, 20 SERVICIOS, 110 CIRCUITOS, 170 OPORTUNIDADES, 40 CRUCEROS.
 */
export class WebAdminConfigProductosPage {
  constructor(private readonly page: Page) {}

  private sel(id: string) { return `[id$="ctrlProductSettingControl_${id}"]`; }
  readonly grilla = '[id$="ctrlProductSettingControl_gvProductsSetting"]';

  async abrir(agencia: number) {
    await this.page.goto(`/administration/agencies/detail.aspx?agency=${agencia}&TabID=pnlProductSetting`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.sel('btnAddProductSetting')), 'Tiene que abrir la solapa Config. de productos')
      .toBeVisible();
  }

  /** Filas de la grilla con contenido: Producto, Ciudad, Tipo, Markup, Excluido. */
  filas(producto: string): Locator {
    return this.page.locator(`${this.grilla} tr`).filter({ hasText: producto });
  }

  async leerFilas(producto: string): Promise<string[][]> {
    return this.filas(producto).evaluateAll((trs) => trs.map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => {
        const chk = td.querySelector('input[type=checkbox][disabled]') as HTMLInputElement | null;
        return chk ? (chk.checked ? 'SI' : 'NO') : (td.textContent ?? '').replace(/\s+/g, ' ').trim();
      })));
  }

  /** Los combos recargan la pantalla al cambiar: se espera la vuelta del PostBack. */
  private async elegir(id: string, valor: string) {
    const combo = this.page.locator(this.sel(id));
    await Promise.all([
      this.page.waitForLoadState('load'),
      combo.selectOption(valor, { force: true }),
    ]);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.sel(id))).toHaveValue(valor);
  }

  /**
   * Agrega una condicion para un producto puntual de una ciudad.
   * `markup` con coma decimal como la pantalla ("0,50").
   */
  async agregar(opciones: { tipo: string; pais: string; ciudad: string; producto: string; excluido: boolean; markup: number }) {
    await this.elegir('ddProductWildcard', opciones.tipo);
    await this.elegir('ddCountry', opciones.pais);
    await this.elegir('ddCity', opciones.ciudad);
    const producto = this.page.locator(this.sel('ddProduct'));
    await producto.selectOption(opciones.producto, { force: true });
    await expect(producto, `El combo Producto tiene que ofrecer el ${opciones.producto}`).toHaveValue(opciones.producto);
    const excluido = this.page.locator(this.sel('cbExclude'));
    if ((await excluido.isChecked()) !== opciones.excluido) await excluido.click({ force: true });
    await this.page.locator(this.sel('txtMarkup_txtValue')).fill(opciones.markup.toFixed(2).replace('.', ','));
    await Promise.all([this.page.waitForLoadState('load'), this.page.locator(this.sel('btnAddProductSetting')).click()]);
    await esperarFinDeCarga(this.page);
  }

  /** Borra todas las filas de un producto: tilda cada una y "Borrar seleccionados". */
  async borrar(producto: string) {
    const filas = this.filas(producto);
    const cantidad = await filas.count();
    if (cantidad === 0) return;
    for (let i = 0; i < cantidad; i++) await filas.nth(i).locator('input[type=checkbox]:not([disabled])').first().check({ force: true });
    await this.page.locator(this.sel('btnDeleteAll')).click();
    const si = this.page.locator(this.sel('cbDelete_btnYES'));
    await expect(si, 'Borrar tiene que pedir confirmacion').toBeVisible();
    await Promise.all([this.page.waitForLoadState('load'), si.click()]);
    await esperarFinDeCarga(this.page);
    await expect(this.filas(producto), `No tienen que quedar condiciones para ${producto}`).toHaveCount(0);
  }
}
