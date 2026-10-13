import { Page, expect, Locator } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

export type Corte = {
  desde: string; hasta: string; sgl: number | null; dbl: number | null; tpl: number | null;
  extendida: string; origen: string | null;
};

/**
 * WebAdmin (BaseCamp): tarifas de una habitacion (`administration/rooms/detail.aspx`).
 *
 * - Solapa Tarifas (`pnlRoomRates`, RoomRateControl): "Generar Tarifario" y el
 *   modal "Extender Tarifas".
 * - Solapa Tarifario (`pnlTariffs`, RoomTarrifCutControl): la grilla de cortes,
 *   con la columna "Tarifa Extendida" y el corte de origen en el tooltip.
 */
export class WebAdminTarifasHabitacionPage {
  constructor(private readonly page: Page) {}

  private readonly control = '[id$="pnlRoomRates_ctrlRoomRateControl_';
  private sel(id: string) { return `${this.control}${id}"]`; }

  readonly modal = '#extendRatesModal';
  readonly filasDelModal = '#extendRatesCutsBody tr[data-index]';
  readonly avisoPisar = '#extendRatesOverwrite';
  readonly errorDelModal = '#extendRatesError';
  readonly grillaTarifario = '[id$="ctrlRoomTarrifCutControl_gvwRates"]';

  async abrir(room: number, solapa: 'pnlRoomRates' | 'pnlTariffs') {
    await this.page.goto(`/administration/rooms/detail.aspx?room=${room}&TabID=${solapa}`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator('[id$="RoomTabContainer_pnlRoomRates"], [id$="RoomTabContainer_pnlTariffs"]').first(),
      'La ficha de la habitacion tiene que cargar').toBeAttached();
  }

  /** "Generar Tarifario" con su confirmacion: rearma los cortes desde las tarifas. */
  async generarTarifario(room: number) {
    await this.abrir(room, 'pnlRoomRates');
    await this.page.locator(this.sel('btnCreateTariffs')).click();
    const si = this.page.locator(this.sel('cbCreate_btnYES'));
    await expect(si, 'Generar Tarifario tiene que pedir confirmacion').toBeVisible();
    await Promise.all([this.page.waitForLoadState('load'), si.click()]);
    await esperarFinDeCarga(this.page);
  }

  /** Cortes de la solapa Tarifario, en la vista por pax (la que trae por defecto). */
  async cortesDelTarifario(room: number): Promise<Corte[]> {
    await this.abrir(room, 'pnlTariffs');
    const grilla = this.page.locator(this.grillaTarifario);
    await expect(grilla, 'El Tarifario tiene que mostrar la grilla de cortes').toBeVisible();
    const filas = await grilla.locator('tr').evaluateAll((trs) => trs.slice(1).map((tr) => {
      const celdas = Array.from(tr.querySelectorAll('td'));
      const texto = (i: number) => (celdas[i]?.textContent ?? '').replace(/\s+/g, ' ').trim();
      // El tooltip viene como `title` y el script de la pantalla lo pasa a `data-tooltip`.
      const span = celdas[5]?.querySelector('span[title], span[data-tooltip]');
      const tooltip = span?.getAttribute('data-tooltip') ?? span?.getAttribute('title') ?? null;
      return [texto(0), texto(1), texto(2), texto(3), texto(4), texto(5), tooltip];
    }));
    return filas.filter((f) => /\d{2}\/\d{2}\/\d{4}/.test(f[0] ?? '')).map((f) => ({
      desde: f[0]!, hasta: f[1]!,
      sgl: importe(f[2]!), dbl: importe(f[3]!), tpl: importe(f[4]!),
      extendida: f[5]!, origen: f[6],
    }));
  }

  async abrirExtender(room: number) {
    await this.abrir(room, 'pnlRoomRates');
    await this.page.locator(this.sel('btnExtendRates')).click();
    await expect(this.page.locator(this.modal), 'Tiene que abrirse el modal Extender Tarifas').toHaveClass(/is-open/);
    // El listado de cortes se trae por AJAX al abrir el modal.
    await expect(this.page.locator(this.filasDelModal).first(), 'El modal tiene que listar los cortes').toBeVisible({ timeout: 60_000 });
  }

  async cortesDelModal(): Promise<string[][]> {
    return this.page.locator(this.filasDelModal).evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).slice(1).map((td) => (td.textContent ?? '').trim())));
  }

  filaDelModal(desde: string, hasta: string): Locator {
    return this.page.locator(this.filasDelModal)
      .filter({ has: this.page.locator('td:nth-child(2)', { hasText: desde }) })
      .filter({ has: this.page.locator('td:nth-child(3)', { hasText: hasta }) });
  }

  async elegirCorte(desde: string, hasta: string) {
    const fila = this.filaDelModal(desde, hasta);
    await expect(fila, `El modal tiene que listar el corte ${desde} - ${hasta}`).toHaveCount(1);
    await fila.click();
    await expect(fila, 'El corte elegido tiene que quedar marcado').toHaveClass(/selected/);
  }

  async completar(desde: string, hasta: string, porcentaje: string) {
    await this.fecha('ctrlExtendFrom', desde);
    await this.fecha('ctrlExtendTo', hasta);
    const pct = this.page.locator(this.sel('txtExtendPercentage'));
    await pct.fill('');
    // Se tipea para que corran los oninput del campo: el tope de 100 y la vista previa.
    await pct.pressSequentially(porcentaje);
  }

  private async fecha(control: string, valor: string) {
    const campo = this.page.locator(this.sel(`${control}_txtDateTime`));
    // Es un flatpickr que interpreta lo tipeado recien al perder el foco, y en el
    // camino descartaba la fecha: se la carga con su propia API, como si se eligiera
    // el dia en el calendario (dispara el change igual).
    await campo.evaluate((el, v) => {
      const fp = (el as any)._flatpickr;
      if (fp) fp.setDate(v, true, 'd/m/Y');
      else (el as HTMLInputElement).value = v;
    }, valor);
    await expect(campo, `La fecha ${valor} tiene que quedar cargada`).toHaveValue(valor);
  }

  async porcentajeCargado(): Promise<string> {
    return this.page.locator(this.sel('txtExtendPercentage')).inputValue();
  }

  async vistaPrevia(): Promise<{ sgl: string; dbl: string; tpl: string }> {
    const leer = (id: string) => this.page.locator(`#${id}`).innerText().then((t) => t.trim());
    return { sgl: await leer('extendPreviewSGL'), dbl: await leer('extendPreviewDBL'), tpl: await leer('extendPreviewTPL') };
  }

  /**
   * Presiona Aceptar. Si ya hay tarifas en el rango aparece el aviso de que se van
   * a pisar y no se envia nada todavia: devuelve `true` y deja el aviso abierto.
   * Si no, el sistema guarda y redirige al Tarifario.
   */
  async aceptar(): Promise<boolean> {
    await this.page.locator(this.sel('btnExtendConfirm')).click();
    const aviso = this.page.locator(this.avisoPisar);
    const resultado = await Promise.race([
      expect(aviso).toHaveClass(/is-open/, { timeout: 60_000 }).then(() => 'aviso' as const),
      this.page.waitForURL(/extended=/, { timeout: 120_000 }).then(() => 'guardado' as const),
    ]);
    if (resultado === 'guardado') await esperarFinDeCarga(this.page);
    return resultado === 'aviso';
  }

  async textoDelAviso(): Promise<string> {
    return (await this.page.locator('#extendRatesOverwriteText').innerText()).trim();
  }

  async pisar() {
    await Promise.all([
      this.page.waitForURL(/extended=/, { timeout: 120_000 }),
      this.page.locator(this.avisoPisar).getByRole('button', { name: 'Pisar las tarifas' }).click(),
    ]);
    await esperarFinDeCarga(this.page);
  }

  async cancelarAviso() {
    await this.page.locator(this.avisoPisar).getByRole('button', { name: 'Cancelar' }).click();
    await expect(this.page.locator(this.avisoPisar)).not.toHaveClass(/is-open/);
  }

  /** Aceptar y, si avisa que pisa tarifas (corridas anteriores), confirmar. */
  async extender(): Promise<void> {
    if (await this.aceptar()) await this.pisar();
    await expect(this.page, 'Despues de extender tiene que volver a la solapa Tarifario').toHaveURL(/TabID=pnlTariffs/i);
  }
}

/** "1.234,56", "72,60", "500" -> numero; "-" o vacio -> null. */
function importe(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(limpio)) return null;
  return Number(limpio.replace(/\./g, '').replace(',', '.'));
}
