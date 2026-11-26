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
  /** El texto de la confirmacion "Pisar las tarifas" de la ultima operacion ("" si no aparecio). */
  avisoDePisar = '';

  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.getByRole('button', { name: /^Copiar #\d+/ }) }).first(); }
  get pie(): Locator { return this.ficha.getByRole('contentinfo').last(); }
  get pendientes(): Locator { return this.ficha.locator('.rr-pending'); }

  async abrir(id: number, solapa = 'Detalle') {
    await this.page.goto(`/hotels/rooms/${id}`);
    await expect(this.ficha.getByRole('tab', { name: 'Detalle' }), `La ficha de la habitacion ${id} tiene que abrir`).toBeVisible({ timeout: 60_000 });
    await expect(this.ficha.getByRole('textbox', { name: 'Nombre', exact: true })).not.toHaveValue('', { timeout: 30_000 });
    if (solapa !== 'Detalle') await this.solapa(solapa);
  }

  async solapa(nombre: string) {
    // Desde noviembre la solapa "Tarifario" ya no existe: su vista "Por persona" es un selector
    // dentro de "Tarifas" (Por habitación / Por persona).
    if (nombre === 'Tarifario' && !(await this.ficha.getByRole('tab', { name: /^Tarifario/ }).count())) nombre = 'Tarifas';
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
      // Desde noviembre la marca es "+N %" (o "Manual") en la columna Extension.
      extendida: /Extendida|Manual|\+\s*[\d.,]+\s*%/i.test(f['Extensión'] ?? ''),
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
  private async agregarALosCambios(panel: Locator, fechas?: { desde: string; hasta: string }): Promise<string | null> {
    const pendientesAntes = await this.textoDePendientes();
    await panel.getByRole('button', { name: /^(Agregar a los cambios|Aplicar cupo|Cargar cupo)$/ }).click();
    // Desde noviembre, si el rango ya tiene tarifas pide confirmar ("Pisar las tarifas"): el test
    // pisa a proposito, asi que acepta y deja el texto del aviso para quien lo quiera leer.
    const pisar = this.page.getByRole('button', { name: 'Pisar las tarifas', exact: true });
    this.avisoDePisar = '';
    if (await pisar.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
      this.avisoDePisar = await pisar.evaluate((b) => {
        const caja = b.closest('[role="alertdialog"], [role="dialog"], .dialog, .confirm') ?? b.parentElement?.parentElement ?? b;
        return (caja as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
      });
      await pisar.click();
    }
    // T-246 (26/11/2026): "el botón de agregar con el mouse se comporta igual que Enter: guarda la
    // tarifa y el modal queda abierto". Sale bien si el panel se cierra (cupo, extender) o si queda
    // abierto sin error y el aviso de "Cambios sin guardar" cambio; en ese caso se cierra con Volver.
    const resultado = await Promise.race([
      panel.waitFor({ state: 'hidden', timeout: 15_000 }).then(() => 'cerrado' as const),
      expect.poll(() => this.textoDePendientes(), { timeout: 15_000 }).not.toBe(pendientesAntes).then(() => 'sumado' as const),
    ]).catch(() => 'nada' as const);
    const sinError = !(await panel.locator('.error').count()) && !(await this.page.locator('.toast.bad .toast-text').count());
    if (resultado === 'cerrado' || (resultado === 'sumado' && sinError)) {
      if (await panel.isVisible().catch(() => false)) {
        // T-246, "Como se prueba": "el modal sigue abierto con las mismas fechas e idiomas. Igual en habitacion 14853".
        if (fechas) {
          expect.soft(await panel.getByRole('textbox', { name: 'Desde' }).inputValue(), 'T-246: tras Agregar, el modal tiene que seguir con la misma fecha Desde').toBe(fechas.desde);
          expect.soft(await panel.getByRole('textbox', { name: 'Hasta' }).inputValue(), 'T-246: tras Agregar, el modal tiene que seguir con la misma fecha Hasta').toBe(fechas.hasta);
        }
        await panel.getByRole('button', { name: 'Volver' }).click();
        await expect(panel, 'Volver tiene que cerrar el panel').toBeHidden();
      }
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
    return this.agregarALosCambios(panel, { desde, hasta });
  }

  /** Las opciones del combo Origen de "Extender" (cortes con sus importes por pax). */
  async origenesParaExtender(): Promise<string[]> {
    await this.solapa('Tarifas');
    const panel = await this.abrirOperacion('Extender');
    // Desde noviembre el origen es la tabla "Corte tarifario base": una fila (con su radio) por corte.
    await expect.poll(() => this.cortesDeOrigen(panel).count(), { timeout: 30_000 }).toBeGreaterThan(0);
    const opciones = (await panel.locator('#rr-source tbody tr').allInnerTexts()).map((o) => o.replace(/\s+/g, ' ').trim());
    await panel.getByRole('button', { name: /^(Cancelar|Volver)/ }).click();
    return opciones;
  }

  private cortesDeOrigen(panel: Locator): Locator { return panel.locator('#rr-source').getByRole('radio'); }

  /** Extender desde un corte (sus fechas) un porcentaje a un rango. */
  async extender(origen: { desde: string; hasta: string }, desde: string, hasta: string, porcentaje: string): Promise<string | null> {
    await this.solapa('Tarifas');
    const panel = await this.abrirOperacion('Extender');
    await this.rango(panel, desde, hasta);
    // Los cortes llegan despues de abrir el panel.
    await expect.poll(() => this.cortesDeOrigen(panel).count(), { timeout: 30_000 }).toBeGreaterThan(0);
    const corte = panel.getByRole('radio', { name: `${origen.desde} – ${origen.hasta}`, exact: true });
    const ofrecidos = (await this.cortesDeOrigen(panel).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))).join('\n');
    expect(await corte.count(), `La tabla de cortes tiene que ofrecer ${origen.desde} - ${origen.hasta}. Ofrece:\n${ofrecidos}`).toBe(1);
    await corte.check();
    await panel.getByRole('textbox', { name: 'Incremento %' }).fill(porcentaje);
    return this.agregarALosCambios(panel);
  }

  async borrarRango(desde: string, hasta: string): Promise<string | null> {
    await this.solapa('Tarifas');
    if (await this.ficha.getByRole('button', { name: 'Borrar rango', exact: true }).count()) {
      const panel = await this.abrirOperacion('Borrar rango');
      await this.rango(panel, desde, hasta);
      return this.agregarALosCambios(panel);
    }
    // Desde noviembre no hay "Borrar rango" con fechas libres: cada tramo tiene su papelera
    // ("Borrar del X al Y"). Se borran los tramos que caen enteros dentro del rango; borrado, el
    // tramo queda tachado y sin papelera, asi que el ciclo termina.
    const ms = (t: string) => { const [d, m, a] = t.split('/').map(Number); return new Date(a, m - 1, d).getTime(); };
    const papeleras = this.ficha.getByRole('button', { name: /^Borrar del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}$/ });
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const nombres = await papeleras.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      const nombre = nombres.find((n) => {
        const [, de, a] = n.match(/del (\S+) al (\S+)$/) ?? [];
        return !!de && ms(de) >= ms(desde) && ms(a) <= ms(hasta);
      });
      if (!nombre) break;
      await this.ficha.getByRole('button', { name: nombre, exact: true }).click();
      const error = this.page.locator('.toast.bad .toast-text');
      await expect(this.ficha.getByRole('button', { name: nombre, exact: true })).toBeHidden({ timeout: 30_000 }).catch(() => {});
      if (await error.isVisible()) return (await error.allInnerTexts()).join(' | ');
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }
    return null;
  }

  /** Solapa Freesale: "Aplicar cupo" para un rango. */
  async aplicarCupo(desde: string, hasta: string, cupo: number): Promise<string | null> {
    await this.solapa('Freesale');
    // Desde noviembre el boton y el panel se llaman "Cargar cupo" (antes "Aplicar cupo").
    await this.ficha.getByRole('button', { name: /^(Cargar cupo|Aplicar cupo)$/ }).first().click();
    const panel = this.page.getByRole('dialog', { name: /^(Cargar cupo|Aplicar cupo)$/ });
    await expect(panel).toBeVisible();
    await this.rango(panel, desde, hasta);
    await panel.getByRole('textbox', { name: 'Cupo' }).fill(String(cupo));
    return this.agregarALosCambios(panel);
  }

  /** El cupo de un dia en el calendario de Freesale (el titulo del dia: "dd/mm/aaaa: cupo N"); null sin tarifa. */
  async cupoDelDia(fecha: string): Promise<number | null> {
    await this.solapa('Freesale');
    // Desde noviembre el dia no tiene title (el cupo sale en un tooltip al pasar el mouse): se lee
    // del dibujo. Mes por su encabezado ("Enero de 2028"), dia por su posicion; la clase dice si
    // tiene tarifa (rr-day--none) y el numero chico es el cupo (sin numero y con tarifa: cupo 0).
    const [d, m, a] = fecha.split('/').map(Number);
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mes = this.ficha.locator('.cal-month').filter({ has: this.page.locator('h4', { hasText: new RegExp(`^${MESES[m - 1]}.*${a}$`, 'i') }) });
    const dia = mes.locator('.cal-day').nth(d - 1);
    await expect(dia, `El calendario tiene que mostrar el ${fecha}`).toBeAttached({ timeout: 30_000 });
    const { clase, cupo } = await dia.evaluate((e) => ({ clase: e.className, cupo: e.querySelector('small')?.textContent ?? '' }));
    if (clase.includes('rr-day--none')) return null;
    return cupo ? Number(cupo) : 0;
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
    await expect(this.pie.getByRole('button', { name: /^Guardar/ }).first(), 'Guardado, el boton Guardar del pie queda deshabilitado (antes el pie decia "Al dia")').toBeDisabled({ timeout: 30_000 });
    await expect(this.pendientes).toBeHidden({ timeout: 30_000 });
  }

  /** Para restaurar: guarda solo si quedo algo por guardar. */
  async guardarSiHayCambios() {
    if (await this.pie.getByRole('button', { name: 'Guardar', exact: true }).isEnabled()) await this.guardar();
  }

  /** "Regenerar tarifario" de la solapa Tarifario (el "Generar Tarifario" del WebAdmin). */
  async regenerarTarifario() {
    await this.solapa('Tarifario');
    // Desde el 28/10 (70d2a8e0) no hay boton: el tarifario del sitio se rearma al guardar las tarifas.
    if (!(await this.ficha.getByRole('button', { name: 'Regenerar tarifario' }).count())) return;
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
    // Desde noviembre "Habilitar freesale" vive en la solapa Freesale (antes, en Detalle).
    await this.solapa('Freesale');
    return this.ficha.getByRole('checkbox', { name: 'Habilitar freesale' }).isChecked();
  }

  // --- Observaciones -----------------------------------------------------------------

  async observaciones(): Promise<FilaDeTabla[]> {
    await this.solapa('Observaciones');
    return this.tabla();
  }

  /**
   * "Nueva observacion": el mismo texto en cada idioma (la app nueva la exige en todos: "Escriba
   * la observacion en todos los idiomas."). Devuelve el aviso si la rechaza.
   */
  async nuevaObservacion(desde: string, hasta: string, texto: string): Promise<string | null> {
    await this.solapa('Observaciones');
    await this.ficha.getByRole('button', { name: 'Nueva observación' }).click();
    const panel = this.page.getByRole('dialog', { name: 'Nueva observación' });
    await expect(panel).toBeVisible();
    await this.rango(panel, desde, hasta);
    const idiomas = panel.getByRole('tablist', { name: /Idiomas: Texto/ }).getByRole('tab');
    for (const idioma of await idiomas.all()) {
      await idioma.click();
      await panel.locator('#rn-text').fill(texto);
    }
    return this.agregarALosCambios(panel);
  }

  async borrarObservacion(desde: string) {
    await this.solapa('Observaciones');
    const fila = this.ficha.locator('tbody tr').filter({ hasText: desde }).first();
    await fila.getByRole('button', { name: 'Borrar observación' }).click();
    // El borrado se suma a los cambios sin guardar: se espera a que figure antes de seguir.
    await expect(this.pendientes, 'El borrado de la observacion tiene que quedar como cambio pendiente').toBeVisible({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
