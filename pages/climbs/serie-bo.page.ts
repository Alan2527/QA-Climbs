import { Page, Locator, expect } from '@playwright/test';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Tarifas por categoria (GroupOrder): SGL, DBL, TPL y menor, por persona. */
export type TarifasPorCategoria = Record<number, { sgl: number; dbl: number; tpl: number; mnr: number }>;

/**
 * Ficha de la serie en el Backoffice nuevo (Servicios y paquetes › Series, /series/series/{id}):
 * reemplaza a Series/Detail del WebAdmin. Solapas Detalle / Paquetes / Salidas / Tarifas / Cupos /
 * Opcionales. Salidas y Tarifas muestran tres meses de calendario (un boton por dia); Cupos, la
 * grilla del mes con su "Carga masiva".
 */
export class SerieBackofficePage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.getByRole('button', { name: /^Copiar #\d+/ }) }).first(); }

  async abrir(id: number, solapa: string) {
    await this.page.goto(`/series/series/${id}`);
    await expect(this.ficha.getByRole('tab', { name: 'Detalle' }), `La ficha de la serie ${id} tiene que abrir`).toBeVisible({ timeout: 60_000 });
    const tab = this.ficha.getByRole('tab', { name: new RegExp(`^${solapa}`) });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  private async aviso(): Promise<string> {
    // Desde noviembre el aviso de exito no sale si la ficha ya lo confirmo con el tilde de su
    // boton; los de error siempre salen. Sin aviso en 15 s se da por bueno (lo que importa se
    // verifica despues en el portal o en la respuesta).
    const aviso = this.page.locator('.toast .toast-text').last();
    if (!(await aviso.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false))) return '(sin aviso: la ficha lo confirmo en su boton)';
    const texto = (await aviso.innerText()).trim();
    if (await this.page.locator('.toast.bad').last().isVisible().catch(() => false)) throw new Error(`La ficha de la serie rechazo el cambio: ${texto}`);
    return texto;
  }

  /** El dia (aaaa-mm-dd) en el calendario de tres meses de la solapa: avanza hasta que el mes este a la vista. */
  private async dia(iso: string): Promise<Locator> {
    const [anio, mes, dia] = iso.split('-').map(Number);
    const titulo = new RegExp(`^${MESES[mes - 1]} de ${anio}$`, 'i');
    const bloque = this.ficha.locator('.month').filter({ has: this.page.getByRole('heading', { level: 4, name: titulo }) });
    for (let i = 0; i < 8 && !(await bloque.count()); i++) {
      await this.ficha.getByRole('button', { name: 'Meses siguientes' }).first().click();
      await this.page.waitForTimeout(300);
    }
    await expect(bloque, `El calendario tiene que mostrar ${MESES[mes - 1]} de ${anio}`).toHaveCount(1);
    return bloque.locator('.mc-day').filter({ has: this.page.locator('b', { hasText: new RegExp(`^${dia}$`) }) }).first();
  }

  /** Solapa Salidas: si la fecha esta entre las salidas. */
  async esSalida(id: number, iso: string): Promise<boolean> {
    await this.abrir(id, 'Salidas');
    const dia = await this.dia(iso);
    return /\bon\b/.test((await dia.getAttribute('class')) ?? '');
  }

  /** Solapa Salidas: agrega (`incluida`) o quita la salida y guarda. */
  async salida(id: number, iso: string, incluida: boolean) {
    if ((await this.esSalida(id, iso)) === incluida) return;
    const dia = await this.dia(iso);
    // Desde noviembre un clic suelto marca el inicio de un rango: un solo dia se cambia con Ctrl+clic.
    await dia.click({ modifiers: ['Control'] });
    await expect(dia).toHaveClass(incluida ? /\bon\b/ : /^(?!.*\bon\b)/);
    await this.guardarFicha(/^Guardar( y generar)? salidas$/);
    expect(await this.esSalida(id, iso), `La salida ${iso} tiene que quedar ${incluida ? 'agregada' : 'quitada'}`).toBe(incluida);
  }

  /** Solapa Cupos, "Carga masiva" para un solo dia: todas las habitaciones de la serie. */
  async cupoDelDia(id: number, iso: string, cantidad: number): Promise<string> {
    await this.abrir(id, 'Cupos');
    await this.ficha.getByRole('button', { name: 'Carga masiva' }).click();
    const modal = this.page.getByRole('dialog', { name: 'Carga masiva' });
    await expect(modal).toBeVisible();
    const fecha = iso.split('-').reverse().join('/');
    await modal.locator('#sq-from').fill(fecha);
    await modal.locator('#sq-to').fill(fecha);
    await modal.locator('#sq-qty').fill(String(cantidad));
    const respuesta = this.page.waitForResponse((r) => /\/quotas\/bulk$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 60_000 });
    await modal.getByRole('button', { name: 'Aplicar' }).click();
    const r = await respuesta;
    if (!r.ok()) throw new Error(`La carga masiva de cupos fue rechazada: HTTP ${r.status()} ${(await r.text()).slice(0, 300)}`);
    const { applied } = (await r.json()) as { applied?: number };
    await expect(modal).toBeHidden({ timeout: 30_000 });
    return `Carga masiva aplicada: ${applied ?? '?'} cupos`;
  }

  /**
   * Solapa Tarifas: doble clic en la salida ("doble clic carga solo esa salida") abre "Precios para
   * 1 salida", con SGL / DBL / TPL / Menores por grupo de hoteleria.
   */
  async tarifas(id: number, iso: string, valores: TarifasPorCategoria): Promise<string> {
    await this.abrir(id, 'Tarifas');
    const dia = await this.dia(iso);
    await dia.dblclick();
    const modal = this.page.getByRole('dialog', { name: /^Precios para 1 salida$/ });
    await expect(modal).toBeVisible();
    for (const [grupo, v] of Object.entries(valores)) {
      const campos: [string, number][] = [['SGL', v.sgl], ['DBL', v.dbl], ['TPL', v.tpl], ['Menores', v.mnr]];
      for (const [tipo, valor] of campos) {
        const campo = modal.getByRole('textbox', { name: `${tipo} ${grupo}`, exact: true });
        if (await campo.count()) await campo.fill(String(valor));
      }
    }
    // Desde noviembre "Aplicar" suma los precios a los cambios y se graban con el Guardar del pie.
    await modal.getByRole('button', { name: /^(Guardar|Aplicar)$/ }).click();
    await expect(modal).toBeHidden({ timeout: 30_000 });
    return this.guardarFicha();
  }

  /** El Guardar del pie de la ficha (o el boton viejo de la solapa, si esta) y su aviso. */
  private async guardarFicha(botonViejo?: RegExp): Promise<string> {
    const viejo = botonViejo ? this.ficha.getByRole('button', { name: botonViejo }) : null;
    if (viejo && (await viejo.count())) { await viejo.click(); return this.aviso(); }
    const pie = this.ficha.getByRole('contentinfo').last().getByRole('button', { name: 'Guardar', exact: true });
    await expect(pie, 'Tiene que haber cambios para guardar').toBeEnabled({ timeout: 30_000 });
    await pie.click();
    const texto = await this.aviso();
    await expect(pie, 'Guardado, el boton Guardar del pie queda deshabilitado').toBeDisabled({ timeout: 60_000 });
    return texto;
  }
}
