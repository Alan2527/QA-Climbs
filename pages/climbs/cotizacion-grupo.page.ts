import { Page, Locator, expect } from '@playwright/test';
import { importe } from './habitacion.page';

export type DatosDeLaCotizacion = {
  agencia: string; sucursal: string; itinerario: string; referencia: string; titulo: string;
  pax: number; sgl: number; dbl: number; tpl: number; inicio: string;
};

/**
 * Cotizacion de grupo en el Backoffice nuevo (Ventas › Cotizaciones de grupos,
 * /sales/group-quotes): reemplaza a Budgets/BudgetDetail del WebAdmin. "Crear grupo" abre la
 * ficha "Nuevo grupo" (Sucursal, Inicio del viaje, Referencia, Titulo, Itinerario, Agencia,
 * Ejecutivo, Markup, Tipo de cambio, Pasajeros); guardada, aparecen las demas solapas
 * (Destinos, Servicios / Restaurantes...) y en la cabecera "Crear reserva".
 */
export class CotizacionGrupoNuevaPage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.getByRole('tab', { name: 'Detalle de la cotización' }) }).first(); }
  get pie(): Locator { return this.ficha.getByRole('contentinfo').last(); }
  get botonCrearReserva(): Locator { return this.ficha.getByRole('button', { name: 'Crear reserva' }); }

  async nueva() {
    await this.page.goto('/sales/group-quotes');
    await expect(this.page.locator('main tbody tr').first()).toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    // Recien cargado el listado, el primer clic a veces no abre la ficha: se reintenta.
    await expect(async () => {
      if (!(await this.ficha.isVisible())) await this.page.getByRole('button', { name: 'Crear grupo' }).click();
      await expect(this.ficha.getByRole('heading', { name: 'Nuevo grupo' })).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
  }

  async abrir(id: number, solapa = 'Detalle de la cotización') {
    await this.page.goto(`/sales/group-quotes/${id}`);
    await expect(this.ficha.locator('#bq-reference'), `La cotizacion ${id} tiene que abrir`).not.toHaveValue('', { timeout: 60_000 });
    if (solapa !== 'Detalle de la cotización') {
      await this.ficha.getByRole('tab', { name: new RegExp(`^${solapa}`) }).click();
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }
  }

  private async combo(id: string, termino: string, opcion: string | RegExp) {
    const campo = this.ficha.locator(`#${id}`);
    await campo.click();
    await campo.fill(termino);
    await this.page.getByRole('option', { name: opcion }).first().click();
  }

  /** Elige la agencia: la pantalla trae su markup, su tipo de cambio y sus ejecutivos. */
  async elegirAgencia(nombre: string) {
    const datos = this.page.waitForResponse((r) => /\/lookups\/agencies\/\d+/.test(r.url()), { timeout: 60_000 });
    await this.combo('bq-agency', nombre, new RegExp(nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await datos;
    await this.page.waitForTimeout(500);
  }

  async valores(): Promise<{ markup: number | null; tipoDeCambio: number | null }> {
    return {
      markup: importe(await this.ficha.locator('#bq-markup').inputValue()),
      tipoDeCambio: importe(await this.ficha.locator('#bq-rate').inputValue()),
    };
  }

  /** Completa y guarda la cotizacion; devuelve su numero (la direccion pasa a /sales/group-quotes/{id}). */
  async crear(d: DatosDeLaCotizacion): Promise<number> {
    await this.ficha.locator('#bq-branch').selectOption({ label: d.sucursal });
    await this.ficha.locator('#bq-in').fill(d.inicio);
    await this.ficha.locator('#bq-reference').fill(d.referencia);
    await this.ficha.locator('#bq-title').fill(d.titulo);
    await this.combo('bq-package', d.itinerario.replace(/^AUTO-QA NO TOCAR - /, '').slice(0, 30), d.itinerario);
    if (!(await this.ficha.locator('#bq-agency').inputValue()).includes(d.agencia)) await this.elegirAgencia(d.agencia);
    // El ejecutivo es un usuario de la agencia: la de prueba tiene uno solo.
    const ejecutivo = this.ficha.locator('#bq-executive');
    const opciones = await ejecutivo.locator('option:not([disabled])').allInnerTexts();
    if (opciones.length) await ejecutivo.selectOption({ label: opciones[0] });
    await this.ficha.locator('#bq-pax').fill(String(d.pax));
    await this.ficha.locator('#bq-sgl').fill(String(d.sgl));
    await this.ficha.locator('#bq-dbl').fill(String(d.dbl));
    await this.ficha.locator('#bq-tpl').fill(String(d.tpl));
    await this.pie.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(this.page, 'Guardar tiene que llevar a la ficha de la cotizacion').toHaveURL(/\/sales\/group-quotes\/\d+/, { timeout: 60_000 });
    const id = Number(this.page.url().match(/group-quotes\/(\d+)/)?.[1] ?? 0);
    await expect(this.pie).toContainText('Al día', { timeout: 30_000 });
    return id;
  }

  /** Las filas de una solapa con grilla (Destinos, Servicios / Restaurantes), como texto. */
  async filas(solapa: string): Promise<string[][]> {
    await this.ficha.getByRole('tab', { name: new RegExp(`^${solapa}`) }).click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const tabla = this.ficha.getByRole('table').first();
    await expect(tabla.or(this.ficha.getByText(/^Todavía no hay/)).first()).toBeVisible({ timeout: 60_000 });
    if (!(await tabla.isVisible())) return [];
    return tabla.locator('tbody tr').evaluateAll((trs) => trs.map((tr) =>
      Array.from(tr.querySelectorAll('td, th')).map((c) => ((c as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim())));
  }

  /** "Crear reserva" + "Aceptar": devuelve el numero del aviso ("Se creo correctamente la reserva nro. N"). */
  async crearReserva(): Promise<number> {
    await this.botonCrearReserva.click();
    const modal = this.page.getByRole('dialog', { name: 'Crear reserva' });
    await expect(modal, 'Crear reserva tiene que pedir confirmacion').toBeVisible();
    await modal.getByRole('button', { name: 'Aceptar' }).click();
    const aviso = this.page.locator('.toast .toast-text').filter({ hasText: /reserva nro\.|\S/ }).last();
    await expect(aviso).toBeVisible({ timeout: 60_000 });
    const texto = (await aviso.innerText()).trim();
    const numero = Number(texto.match(/reserva nro\. (\d+)/)?.[1] ?? 0);
    expect(numero, `El aviso tiene que dar el numero de la reserva: "${texto}"`).toBeGreaterThan(0);
    return numero;
  }

  /** La fila de la cotizacion en el listado, buscada por su referencia. */
  async filaDelListado(referencia: string): Promise<Locator> {
    await this.page.goto('/sales/group-quotes');
    await this.page.getByRole('searchbox', { name: 'ID o referencia' }).fill(referencia);
    const fila = this.page.locator('main tbody tr').filter({ hasText: referencia }).first();
    await expect(fila, `El listado tiene que mostrar la cotizacion ${referencia}`).toBeVisible({ timeout: 60_000 });
    return fila;
  }

  /** "Mas acciones" › "Borrar" y su confirmacion. */
  async borrar(referencia: string) {
    const fila = await this.filaDelListado(referencia);
    await fila.getByRole('button', { name: 'Más acciones' }).click();
    await this.page.getByRole('menuitem', { name: 'Borrar' }).click();
    const confirmacion = this.page.getByRole('alertdialog');
    await confirmacion.getByRole('button', { name: 'Borrar' }).click();
    await expect(this.page.locator('.toast .toast-text').filter({ hasText: 'Cotización borrada' }).last()).toBeVisible();
  }
}
