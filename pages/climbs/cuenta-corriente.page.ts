import { Page, Locator, expect } from '@playwright/test';

/**
 * Agenda de pendientes y cuentas corrientes (cliente y proveedor) del Backoffice nuevo.
 *
 * Todas las grillas escriben en cada celda el nombre de su columna (`data-label`): se leen
 * por nombre y no por posicion. Los importes van con 3 decimales y sin moneda en las
 * cuentas, y con 2 decimales y la moneda en la agenda (donde un cero es celda vacia).
 */

/**
 * Elige una opcion en un filtro de Finanzas. Con hasta 15 opciones es un select comun; con
 * mas, un boton que abre una lista con buscador.
 */
export async function elegirFiltro(page: Page, id: string, opcion: string | RegExp) {
  const filtro = page.locator(`#${id}`);
  // Mientras carga sus opciones el filtro es un select deshabilitado; al terminar, si son mas
  // de 15, pasa a ser el boton con buscador. Se decide recien con el filtro habilitado.
  await expect(filtro, `El filtro ${id} tiene que habilitarse`).toBeEnabled({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  if ((await filtro.evaluate((e) => e.tagName)) === 'SELECT') {
    const etiqueta = typeof opcion === 'string' ? opcion
      : (await filtro.locator('option').allInnerTexts()).find((t) => opcion.test(t.trim()))?.trim() ?? '';
    expect(etiqueta, `El filtro ${id} tiene que ofrecer ${opcion}`).not.toBe('');
    await filtro.selectOption({ label: etiqueta });
    return;
  }
  await filtro.click();
  const lista = page.getByRole('listbox').last();
  await expect(lista).toBeVisible();
  await lista.getByRole('option', { name: opcion }).first().click();
}

/** Una celda de la fila por el nombre de su columna. */
export const celda = (fila: Locator, columna: string) => fila.locator(`td[data-label="${columna}"]`).first();

/** "CC00010-00058541" -> /CC0*10-0*58541/: el mismo codigo con o sin ceros a la izquierda. */
export const codigoFlexible = (codigo: string) =>
  new RegExp(codigo.replace(/\d+/g, (g) => `0*${Number(g)}`).replace(/-/g, '\\-'));

export type FilaDeLaAgenda = { gestion: string; venta: number; facturado: number; cobrado: number; faltaFacturar: number; faltaCobrar: number; texto: string };

export class CuentaCorrienteNuevaPage {
  constructor(private readonly page: Page) {}

  private numero(texto: string): number {
    const t = (texto || '').replace(/[A-Z]{3}/g, '').trim();
    if (!t || /^[-—–]+$/.test(t)) return 0;
    return Number(t.replace(/\./g, '').replace(',', '.'));
  }

  private async esperarCarga() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
    await this.page.waitForLoadState('networkidle');
  }

  // --- Agenda de pendientes de clientes ---------------------------------------------

  /** Abre la agenda para todos los responsables, hasta la fecha IN dada, y busca el file. */
  async agendaDelFile(numeroDeFile: string, fileCode: string, hasta: string): Promise<FilaDeLaAgenda[]> {
    await this.page.goto('/finance/customer-agenda');
    await expect(this.page.getByRole('heading', { name: 'Agenda de pendientes de clientes', level: 1 })).toBeVisible();
    await elegirFiltro(this.page, 'ag-responsible', /todos/i);
    const campoHasta = this.page.locator('#ag-to');
    await campoHasta.fill(hasta);
    await campoHasta.press('Tab');
    await this.page.locator('#ag-customer').fill(numeroDeFile);
    await this.page.locator('#ag-customer').press('Enter');
    await this.esperarCarga();
    const filas = this.page.locator('tbody tr').filter({ hasText: fileCode });
    const out: FilaDeLaAgenda[] = [];
    for (const f of await filas.all()) {
      const v = async (c: string) => this.numero((await celda(f, c).innerText().catch(() => '')).trim());
      out.push({
        gestion: (await celda(f, 'Gestión').innerText()).trim(),
        venta: await v('Venta total'), facturado: await v('Total facturado'), cobrado: await v('Total cobrado'),
        faltaFacturar: await v('Falta facturar'), faltaCobrar: await v('Falta cobrar'),
        texto: (await f.innerText()).replace(/\s+/g, ' '),
      });
    }
    return out;
  }

  // --- Cuenta corriente del cliente ------------------------------------------------

  /** Desde el listado de cuentas de clientes (origen CTA CTE), abre la cuenta del cliente en su pestaña. */
  async abrirCuentaDelCliente(cliente: string): Promise<Page> {
    await this.page.goto('/finance/customer-accounts');
    await expect(this.page.getByRole('heading', { name: 'Cuentas corrientes de clientes', level: 1 })).toBeVisible();
    await elegirFiltro(this.page, 'ca-origin', 'CTA CTE');
    await this.page.locator('#search-customer-accounts').fill(cliente);
    await this.esperarCarga();
    const fila = this.page.locator('tbody tr').filter({ hasText: cliente }).first();
    await expect(fila, `El listado tiene que traer la cuenta de ${cliente}`).toBeVisible({ timeout: 60_000 });
    const [cuenta] = await Promise.all([
      this.page.context().waitForEvent('page'),
      fila.getByRole('link', { name: 'Cuenta corriente', exact: true }).click(),
    ]);
    await cuenta.waitForLoadState();
    await expect(cuenta.getByRole('heading', { name: 'Cuenta corriente del cliente', level: 1 })).toBeVisible({ timeout: 60_000 });
    return cuenta;
  }

  // --- Cuenta corriente del proveedor ----------------------------------------------

  /** Desde el listado de cuentas de proveedores, abre la cuenta del proveedor en su pestaña. */
  async abrirCuentaDelProveedor(proveedor: string): Promise<Page> {
    await this.page.goto('/finance/supplier-accounts');
    await expect(this.page.getByRole('heading', { name: 'Cuentas corrientes de proveedores', level: 1 })).toBeVisible();
    // El listado pone sus filtros por defecto recien al cargar y borra lo que se haya
    // escrito antes: se espera la carga y se confirma que la busqueda quedo escrita.
    await expect(this.page.getByText(/\d+ resultados/)).toBeVisible({ timeout: 60_000 });
    await this.esperarCarga();
    const buscador = this.page.locator('#search-supplier-accounts');
    await expect(async () => {
      if ((await buscador.inputValue()) !== proveedor) await buscador.fill(proveedor);
      await this.esperarCarga();
      await expect(buscador).toHaveValue(proveedor);
    }).toPass({ timeout: 60_000 });
    const fila = this.page.locator('tbody tr').filter({ hasText: proveedor }).first();
    await expect(fila, `El listado tiene que traer la cuenta de ${proveedor}`).toBeVisible({ timeout: 60_000 });
    const [cuenta] = await Promise.all([
      this.page.context().waitForEvent('page'),
      fila.getByRole('link', { name: 'Cuenta corriente', exact: true }).click(),
    ]);
    await cuenta.waitForLoadState();
    await expect(cuenta.getByRole('heading', { name: 'Cuenta corriente del proveedor', level: 1 })).toBeVisible({ timeout: 60_000 });
    return cuenta;
  }
}

/** Lo comun a las dos cuentas, sobre la pestaña donde se abrio. */
export class CuentaAbierta {
  constructor(readonly page: Page) {}

  numero(texto: string): number {
    const t = (texto || '').trim();
    if (!t || /^[-—–]+$/.test(t)) return 0;
    return Number(t.replace(/\./g, '').replace(',', '.'));
  }

  async esperarCarga() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
    await this.page.waitForLoadState('networkidle');
  }

  filas(): Locator {
    return this.page.locator('table.acc-table tbody tr:not(.acc-section)');
  }

  filaPorComprobante(codigo: string): Locator {
    return this.filas().filter({ has: this.page.locator('td[data-label="Comprobante"]', { hasText: codigoFlexible(codigo) }) });
  }

  async totales(): Promise<Record<string, number>> {
    const fila = this.page.locator('table.acc-totals tbody tr').first();
    const out: Record<string, number> = {};
    for (const c of ['Debe', 'Haber', 'Saldo']) out[c] = this.numero(await celda(fila, c).innerText());
    return out;
  }

  /** Suma una columna de las filas de la grilla, con un filtro opcional por fila. */
  async sumar(columna: string, incluir: (fila: Locator) => Promise<boolean> = async () => true): Promise<{ suma: number; filas: number }> {
    let suma = 0;
    const filas = await this.filas().all();
    for (const f of filas) if (await incluir(f)) suma += this.numero(await celda(f, columna).innerText());
    return { suma, filas: filas.length };
  }
}
