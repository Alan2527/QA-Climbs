import { Page, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

export type TarifasPorCategoria = Record<number, { sgl: number; dbl: number; tpl: number; mnr: number }>;

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * WebAdmin (BaseCamp): ficha de una serie (`administration/series/detail.aspx?SerieID=<id>`).
 *
 * - Cupos (`pnlSeriesQuotas`): carga masiva con rango, dias y cantidad; pide un
 *   `confirm()` del navegador.
 * - Salidas (`pnlSeriesDepartures`): calendario de 6 meses. Clic normal sobre una
 *   fecha marcada la desmarca; Ctrl+clic sobre una sin marcar la agrega. La seleccion
 *   viaja en `ctrlCalendar_hfSelectedDates` (yyyy-MM-dd separadas por coma). Quitar
 *   una salida borra tambien sus tarifas; volver a agregarla la crea sin tarifas.
 * - Tarifas (`pnlSeriesTariffs`): calendario de 3 meses con `div.tariff-day[data-key]`.
 *   "Cargar Tarifas" abre el modal con una fila por categoria (`hfGroupOrder`) y los
 *   importes SGL / DBL / TPL / Menores. Un campo vacio borra esa tarifa.
 *
 * Todo es PostBack asincronico: se espera el aviso de la pantalla, que se va solo.
 */
export class WebAdminSeriePage {
  constructor(private readonly page: Page) {}

  async abrir(serie: number, solapa: string) {
    await this.page.goto(`/administration/series/detail.aspx?SerieID=${serie}&TabID=${solapa}`);
    await esperarFinDeCarga(this.page);
  }

  /** Espera el aviso de exito o error de la pantalla (consulta repetida, se va solo). */
  private async aviso(patron: RegExp, que: string): Promise<string> {
    let texto: string | null = null;
    const limite = Date.now() + 90_000;
    while (!texto && Date.now() < limite) {
      const error = await this.page.locator('.messageBox.messageBoxError').first().textContent({ timeout: 1_000 }).catch(() => null);
      if (error && error.trim()) throw new Error(`${que}: la pantalla mostro un error: ${error.trim()}`);
      const cuerpo = await this.page.locator('body').innerText({ timeout: 2_000 }).catch(() => '');
      texto = cuerpo.match(new RegExp(patron.source, 'i'))?.[0] ?? null;
      if (!texto) await this.page.waitForTimeout(300);
    }
    expect(texto, que).not.toBeNull();
    await esperarFinDeCarga(this.page);
    return texto!;
  }

  /** Carga masiva de cupos para un solo dia (todas las habitaciones de la serie). */
  async cupoDelDia(serie: number, clave: string, cantidad: number) {
    await this.abrir(serie, 'pnlSeriesQuotas');
    await this.page.evaluate(() => (window as any).openBulkModal());
    await this.page.locator('[id$="txtBulkDateFrom"]').fill(clave);
    await this.page.locator('[id$="txtBulkDateTo"]').fill(clave);
    await this.page.locator('[id$="txtBulkQuantity"]').fill(String(cantidad));
    this.page.once('dialog', (d) => d.accept());
    await this.page.locator('[id$="btnApplyBulk"]').click();
    await this.aviso(/cupos del rango masivo se aplicaron correctamente/, 'La carga masiva de cupos tiene que confirmar');
  }

  private diaDelCalendarioDeSalidas(clave: string) {
    const [a, m, d] = clave.split('-').map(Number);
    return this.page.locator('[id$="ctrlCalendar_grid"] .cal-month', { hasText: `${MESES[m - 1]} ${a}` })
      .locator('.cal-day').getByText(String(d), { exact: true });
  }

  private async fechasDeSalida(): Promise<string[]> {
    const v = await this.page.locator('[id$="ctrlCalendar_hfSelectedDates"]').inputValue();
    return v.split(',').map((x) => x.trim()).filter(Boolean);
  }

  /** Quita (`incluida=false`) o agrega una salida y guarda. */
  async salida(serie: number, clave: string, incluida: boolean) {
    await this.abrir(serie, 'pnlSeriesDepartures');
    const dia = this.diaDelCalendarioDeSalidas(clave);
    await expect(dia, `El calendario de salidas tiene que mostrar el ${clave}`).toBeVisible();
    const estaba = (await this.fechasDeSalida()).includes(clave);
    if (estaba !== incluida) {
      if (incluida) await dia.click({ modifiers: ['Control'] });
      else await dia.click();
    }
    expect((await this.fechasDeSalida()).includes(clave),
      `La seleccion de salidas tiene que ${incluida ? 'incluir' : 'excluir'} el ${clave}`).toBe(incluida);
    await this.page.locator('[id$="ctrlSerieDeparturesControl_btnGuardar"]').click();
    await this.aviso(/salidas se guardaron correctamente/, 'Guardar las salidas tiene que confirmar');
  }

  /** Carga las tarifas de una salida para todas las categorias. Punto decimal. */
  async tarifas(serie: number, clave: string, valores: TarifasPorCategoria) {
    await this.abrir(serie, 'pnlSeriesTariffs');
    const dia = this.page.locator(`[id$="ctrlSerieTariffsControl_grid"] .tariff-day[data-key="${clave}"]`);
    for (let i = 0; i < 4 && !(await dia.isVisible().catch(() => false)); i++) {
      await this.page.locator('a.tcal-btn', { hasText: '→' }).first().click();
      await this.page.waitForTimeout(500);
    }
    await expect(dia, `El calendario de tarifas tiene que mostrar la salida ${clave}`).toHaveClass(/valid-departure/);
    await dia.click();
    await expect(this.page.locator('#hfSelectedDates'), 'Tiene que quedar elegida solo esa salida').toHaveValue(clave);
    await this.page.locator('#btnCargarTarifas').click();
    const modal = this.page.locator('.tariff-modal');
    await expect(modal, 'Tiene que abrirse el modal de tarifas').toBeVisible({ timeout: 60_000 });
    const filas = modal.locator('tr').filter({ has: this.page.locator('input[id$="hfGroupOrder"]') });
    const n = await filas.count();
    expect(n, 'El modal tiene que mostrar las categorias del paquete').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const fila = filas.nth(i);
      const g = Number(await fila.locator('input[id$="hfGroupOrder"]').inputValue());
      const v = valores[g];
      expect(v, `Faltan los importes de la categoria ${g}`).toBeTruthy();
      await fila.locator('input[id$="_txtSglRate"]').fill(v.sgl.toFixed(2));
      await fila.locator('input[id$="_txtDblRate"]').fill(v.dbl.toFixed(2));
      await fila.locator('input[id$="_txtTplRate"]').fill(v.tpl.toFixed(2));
      await fila.locator('input[id$="_txtMnrRate"]').fill(v.mnr.toFixed(2));
    }
    await this.page.locator('[id$="ctrlSerieTariffsControl_btnSave"]').click();
    await this.aviso(/tarifas se guardaron correctamente/, 'Guardar las tarifas tiene que confirmar');
  }
}
