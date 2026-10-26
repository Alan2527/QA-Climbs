import { Page, Locator, expect } from '@playwright/test';
import { leerTabla, FilaDeTabla } from './tabla';

/** "1.234,50" -> 1234.5; vacio -> null */
export const importe = (t: string): number | null => {
  const limpio = (t || '').replace(/[^\d,.-]/g, '');
  return limpio ? Number(limpio.replace(/\./g, '').replace(',', '.')) : null;
};

export type Tramo = {
  desde: string; hasta: string; dias: number;
  single: number | null; doble: number | null; triple: number | null; menores: number | null;
  cupo: number; extension: string;
};
export type Corte = {
  desde: string; hasta: string;
  sgl: number | null; dbl: number | null; tpl: number | null;
  extendida: boolean; observacion: string;
};
export type Precios = { single?: number | null; doble?: number | null; triple?: number | null; menores?: number | null };

/**
 * Ficha de la habitacion en el Backoffice nuevo (/hotels/rooms/{id}): reemplaza a la
 * Gestion de Tarifas, el Tarifario, las observaciones y el freesale del WebAdmin.
 *
 * Solapas Detalle / Tarifas / Tarifario / Observaciones / Freesale. Las operaciones de
 * tarifas (Cargar tarifas, Extender, Borrar rango, Aplicar cupo, observaciones) no se
 * graban al aceptarlas: se suman a "Cambios sin guardar" y se escriben todas juntas con el
 * "Guardar" del pie. Hasta entonces el Tarifario muestra la vista previa.
 */
export class HabitacionNuevaPage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ hasText: /Habitación #\d+/ }).first(); }
  get pie(): Locator { return this.ficha.getByRole('contentinfo').last(); }
  get pendientes(): Locator { return this.ficha.locator('.rr-pending'); }

  async abrir(id: number, solapa = 'Detalle') {
    await this.page.goto(`/hotels/rooms/${id}`);
    await expect(this.ficha.getByRole('tab', { name: 'Detalle' }), `La ficha de la habitacion ${id} tiene que abrir`).toBeVisible({ timeout: 60_000 });
    await expect(this.ficha.getByRole('textbox', { name: 'Nombre' })).not.toHaveValue('', { timeout: 30_000 });
    if (solapa !== 'Detalle') await this.solapa(solapa);
  }

  async solapa(nombre: string) {
    await this.ficha.getByRole('tab', { name: new RegExp(`^${nombre}`) }).click();
    await expect(this.ficha.getByRole('tab', { name: new RegExp(`^${nombre}`) })).toHaveAttribute('aria-selected', 'true');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  private async tabla(): Promise<FilaDeTabla[]> {
    const tabla = this.ficha.locator('table').first();
    const vacia = this.ficha.getByText(/^Sin tarifas desde hoy|^Sin tarifario|^Sin observaciones/);
    await expect(tabla.or(vacia).first()).toBeVisible({ timeout: 60_000 });
    if (!(await tabla.isVisible())) return [];
    // La grilla se recalcula en el servidor (vista previa): se lee cuando dos lecturas coinciden.
    let previa = '';
    for (let i = 0; i < 20; i++) {
      const filas = await leerTabla(tabla);
      const firma = JSON.stringify(filas);
      if (firma === previa) return filas;
      previa = firma;
      await this.page.waitForTimeout(700);
    }
    return JSON.parse(previa);
  }

  /** Solapa Tarifas: los tramos de dias seguidos con los mismos valores. */
  async tramos(): Promise<Tramo[]> {
    await this.solapa('Tarifas');
    return (await this.tabla()).map((f) => ({
      desde: f['Desde'], hasta: f['Hasta'], dias: Number(f['Días']),
      single: importe(f['Single']), doble: importe(f['Doble']), triple: importe(f['Triple']), menores: importe(f['Menores']),
      cupo: Number(f['Cupo'] || 0), extension: f['Extensión'],
    }));
  }

  /** Solapa Tarifario, "Por persona": los cortes como los arma el sistema para el sitio. */
  async tarifario(): Promise<Corte[]> {
    await this.solapa('Tarifario');
    const porPersona = this.ficha.getByRole('tab', { name: 'Por persona' });
    if ((await porPersona.getAttribute('aria-selected')) !== 'true') await porPersona.click();
    return (await this.tabla()).map((f) => ({
      desde: f['Desde'], hasta: f['Hasta'],
      sgl: importe(f['Single']), dbl: importe(f['Doble']), tpl: importe(f['Triple']),
      extendida: /Extendida/i.test(f['Extensión'] ?? ''),
      // Sin observacion la celda trae el boton "Agregar".
      observacion: /^Agregar$/.test(f['Observación'] ?? '') ? '' : (f['Observación'] ?? ''),
    }));
  }

  async textoDePendientes(): Promise<string> {
    if (!(await this.pendientes.isVisible().catch(() => false))) return '';
    return (await this.pendientes.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Abre el panel de una operacion de la solapa Tarifas ("Cargar tarifas", "Extender", "Borrar rango"). */
  private async abrirOperacion(boton: string): Promise<Locator> {
    await this.ficha.getByRole('button', { name: boton, exact: true }).click();
    const panel = this.page.getByRole('dialog', { name: boton });
    await expect(panel).toBeVisible();
    return panel;
  }

  private async rango(panel: Locator, desde: string, hasta: string) {
    await panel.getByRole('textbox', { name: 'Desde' }).fill(desde);
    await panel.getByRole('textbox', { name: 'Hasta' }).fill(hasta);
    await panel.getByRole('textbox', { name: 'Hasta' }).press('Tab');
  }

  /** "Agregar a los cambios": devuelve el aviso de error si lo rechaza, o null. */
  private async agregarALosCambios(panel: Locator): Promise<string | null> {
    await panel.getByRole('button', { name: /^(Agregar a los cambios|Aplicar cupo)$/ }).click();
    const cerrado = await panel.waitFor({ state: 'hidden', timeout: 15_000 }).then(() => true).catch(() => false);
    if (cerrado) {
      await this.page.waitForLoadState('networkidle').catch(() => {});
      return null;
    }
    // El rechazo va en el campo (span.error con rol alert) y en un aviso rojo (toast).
    const avisos = [
      ...(await panel.locator('.error').allInnerTexts()),
      ...(await this.page.locator('.toast.bad .toast-text').allInnerTexts()),
    ];
    const texto = avisos.join(' | ').replace(/\s+/g, ' ').trim();
    return texto || 'el panel no se cerro y no mostro aviso';
  }

  async cargarTarifas(desde: string, hasta: string, precios: Precios): Promise<string | null> {
    await this.solapa('Tarifas');
    const panel = await this.abrirOperacion('Cargar tarifas');
    await this.rango(panel, desde, hasta);
    const ids: Record<keyof Precios, string> = { single: 'rr-single', doble: 'rr-double', triple: 'rr-triple', menores: 'rr-child' };
    for (const [k, id] of Object.entries(ids) as [keyof Precios, string][]) {
      const v = precios[k];
      const campo = panel.locator(`#${id}`);
      await campo.fill(v ? String(v).replace('.', ',') : '');
    }
    return this.agregarALosCambios(panel);
  }

  /** Las opciones del combo Origen de "Extender" (cortes con sus importes por pax). */
  async origenesParaExtender(): Promise<string[]> {
    await this.solapa('Tarifas');
    const panel = await this.abrirOperacion('Extender');
    await expect.poll(() => panel.getByRole('combobox', { name: 'Origen' }).locator('option').count(), { timeout: 30_000 }).toBeGreaterThan(2);
    const opciones = (await panel.getByRole('combobox', { name: 'Origen' }).locator('option').allInnerTexts()).map((o) => o.trim());
    await panel.getByRole('button', { name: 'Cancelar' }).click();
    return opciones;
  }

  /** Extender desde un corte (sus fechas) un porcentaje a un rango. */
  async extender(origen: { desde: string; hasta: string }, desde: string, hasta: string, porcentaje: string): Promise<string | null> {
    await this.solapa('Tarifas');
    const panel = await this.abrirOperacion('Extender');
    await this.rango(panel, desde, hasta);
    const combo = panel.getByRole('combobox', { name: 'Origen' });
    // Los cortes llegan despues de abrir el panel: antes solo estan "Elegir tramo" y "Recuperar".
    await expect.poll(() => combo.locator('option').count(), { timeout: 30_000 }).toBeGreaterThan(2);
    const opciones = await combo.locator('option').allInnerTexts();
    const opcion = opciones.find((o) => o.trim().startsWith(`${origen.desde} – ${origen.hasta}`));
    expect(opcion, `El combo Origen tiene que ofrecer el corte ${origen.desde} - ${origen.hasta}. Ofrece:\n${opciones.join('\n')}`).toBeTruthy();
    await combo.selectOption({ label: opcion!.trim() });
    await panel.getByRole('textbox', { name: 'Incremento %' }).fill(porcentaje);
    return this.agregarALosCambios(panel);
  }

  async borrarRango(desde: string, hasta: string): Promise<string | null> {
    await this.solapa('Tarifas');
    const panel = await this.abrirOperacion('Borrar rango');
    await this.rango(panel, desde, hasta);
    return this.agregarALosCambios(panel);
  }

  /** Solapa Freesale: "Aplicar cupo" para un rango. */
  async aplicarCupo(desde: string, hasta: string, cupo: number): Promise<string | null> {
    await this.solapa('Freesale');
    await this.ficha.getByRole('button', { name: 'Aplicar cupo', exact: true }).first().click();
    const panel = this.page.getByRole('dialog', { name: 'Aplicar cupo' });
    await expect(panel).toBeVisible();
    await this.rango(panel, desde, hasta);
    await panel.getByRole('textbox', { name: 'Cupo' }).fill(String(cupo));
    return this.agregarALosCambios(panel);
  }

  /** El cupo de un dia en el calendario de Freesale (el titulo del dia: "dd/mm/aaaa: cupo N"); null sin tarifa. */
  async cupoDelDia(fecha: string): Promise<number | null> {
    await this.solapa('Freesale');
    const dia = this.ficha.locator(`.cal-day[title^="${fecha}:"]`).first();
    await expect(dia, `El calendario tiene que mostrar el ${fecha}`).toBeAttached({ timeout: 30_000 });
    const titulo = (await dia.getAttribute('title')) ?? '';
    const m = titulo.match(/cupo (\d+)/);
    return m ? Number(m[1]) : null;
  }

  async descartarCambios() {
    await this.pendientes.getByRole('button', { name: 'Descartar todo' }).click();
    await expect(this.pendientes).toBeHidden();
  }

  /** "Guardar" del pie: escribe la habitacion y los cambios pendientes; espera "Al dia". */
  async guardar() {
    const boton = this.pie.getByRole('button', { name: 'Guardar', exact: true });
    await expect(boton, 'Tiene que haber cambios para guardar').toBeEnabled();
    await boton.click();
    await expect(boton, 'Al guardar, el pie tiene que quedar "Al dia"').toBeDisabled({ timeout: 90_000 });
    await expect(this.pie).toContainText('Al día', { timeout: 30_000 });
    await expect(this.pendientes).toBeHidden({ timeout: 30_000 });
  }

  /** "Regenerar tarifario" de la solapa Tarifario (el "Generar Tarifario" del WebAdmin). */
  async regenerarTarifario() {
    await this.solapa('Tarifario');
    const respuesta = this.page.waitForResponse((r) => /\/rates$/.test(new URL(r.url()).pathname) && r.request().method() !== 'GET', { timeout: 90_000 });
    await this.ficha.getByRole('button', { name: 'Regenerar tarifario' }).click();
    expect((await respuesta).ok(), 'Regenerar el tarifario tiene que responder bien').toBe(true);
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  // --- Detalle ---------------------------------------------------------------------

  async regimen(): Promise<string> {
    await this.solapa('Detalle');
    const combo = this.ficha.getByRole('combobox', { name: 'Régimen de comidas' });
    return (await combo.locator('option:checked').innerText()).trim();
  }

  async elegirRegimen(texto: string) {
    await this.solapa('Detalle');
    await this.ficha.getByRole('combobox', { name: 'Régimen de comidas' }).selectOption({ label: texto });
  }

  async publicada(): Promise<boolean> {
    await this.solapa('Detalle');
    return this.ficha.getByRole('checkbox', { name: 'Publicada' }).isChecked();
  }

  async marcarPublicada(si: boolean) {
    await this.solapa('Detalle');
    const casilla = this.ficha.getByRole('checkbox', { name: 'Publicada' });
    // Es un interruptor: la pista dibujada encima recibe el clic, no la casilla.
    if ((await casilla.isChecked()) !== si) await casilla.locator('xpath=..').click();
    await expect(casilla).toBeChecked({ checked: si });
  }

  async freesaleHabilitado(): Promise<boolean> {
    await this.solapa('Detalle');
    return this.ficha.getByRole('checkbox', { name: 'Habilitar freesale' }).isChecked();
  }

  // --- Observaciones -----------------------------------------------------------------

  async observaciones(): Promise<FilaDeTabla[]> {
    await this.solapa('Observaciones');
    return this.tabla();
  }

  /** "Nueva observacion" con el texto en espanol; devuelve el aviso si la rechaza. */
  async nuevaObservacion(desde: string, hasta: string, texto: string): Promise<string | null> {
    await this.solapa('Observaciones');
    await this.ficha.getByRole('button', { name: 'Nueva observación' }).click();
    const panel = this.page.getByRole('dialog', { name: 'Nueva observación' });
    await expect(panel).toBeVisible();
    await this.rango(panel, desde, hasta);
    await panel.getByRole('textbox', { name: 'Texto' }).first().fill(texto);
    return this.agregarALosCambios(panel);
  }

  async borrarObservacion(desde: string) {
    await this.solapa('Observaciones');
    const fila = this.ficha.locator('tbody tr').filter({ hasText: desde }).first();
    await fila.getByRole('button', { name: 'Borrar observación' }).click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
