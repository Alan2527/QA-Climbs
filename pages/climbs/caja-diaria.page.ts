import { Page, Locator, expect } from '@playwright/test';

export type TotalesDeCaja = { moneda: string; inicial: string; ingreso: string; salida: string; balance: string; final: string };

/**
 * Caja diaria del Backoffice nuevo (`/finance/daily-cash`).
 *
 * El listado muestra las cajas de la sucursal de trabajo; "Apertura" abre la del dia. La
 * caja tiene "Totales" (una fila por moneda, filtrable por "Medio"), "Movimientos" (las
 * ordenes de pago y de cobro aprobadas caen solas) y el "Pre-cierre" con el cuadre de cada
 * caja. El test no hace el "Cierre definitivo": bloquearia los aprobados del resto del dia.
 */
export class CajaDiariaNuevaPage {
  constructor(private readonly page: Page) {}

  async irAlListado() {
    await this.page.goto('/finance/daily-cash');
    await expect(this.page.getByRole('heading', { name: 'Caja diaria', level: 1 })).toBeVisible();
  }

  filaDeLaFecha(fecha: string): Locator {
    return this.page.locator('tbody tr').filter({ hasText: fecha });
  }

  /**
   * El listado muestra las cajas de una sucursal (la de trabajo por defecto, y vuelve a ella al
   * recargar): se elige la pedida. El filtro aparece recien cuando cargan las sucursales.
   */
  async elegirSucursal(sucursal: string) {
    const filtroSucursal = this.page.getByRole('combobox', { name: 'Sucursal', exact: true });
    if (!(await filtroSucursal.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false))) return;
    const actual = await filtroSucursal.evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? '');
    if (actual.includes(sucursal)) return;
    // Mientras carga, la tabla sigue mostrando las cajas de la sucursal anterior: se espera la
    // respuesta del listado nuevo antes de buscar la fila.
    await Promise.all([
      this.page.waitForResponse((r) => /\/api\/finance\/daily-cash\?/.test(r.url()) && r.request().method() === 'GET', { timeout: 60_000 }),
      filtroSucursal.selectOption({ label: sucursal }),
    ]);
    await this.page.waitForLoadState('networkidle');
  }

  /** Abre la caja de hoy si no existe; si ya existe, entra a la que hay. Devuelve su id y si la abrio el test. */
  async abrirCajaDelDia(fecha: string, sucursal: string, detalle: string): Promise<{ id: string; creada: boolean }> {
    await this.irAlListado();
    await this.elegirSucursal(sucursal);
    const existente = this.filaDeLaFecha(fecha).first();
    const hay = await existente.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
    if (hay) {
      await existente.click();
    } else {
      // "Apertura" tambien es el encabezado de una columna (que ordena): el boton de la cabecera es el primero.
      await this.page.getByRole('button', { name: 'Apertura', exact: true }).first().click();
      await expect(this.page.getByRole('heading', { name: 'Apertura de caja' })).toBeVisible();
      if (!(await this.page.locator('#dc-branch').evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? '')).includes(sucursal)) {
        await this.page.locator('#dc-branch').selectOption({ label: sucursal });
      }
      await this.page.locator('#dc-date').fill(fecha);
      await this.page.locator('#dc-date').press('Tab');
      await this.page.locator('#dc-detail').fill(detalle);
      await this.page.getByRole('button', { name: 'Apertura' }).click();
    }
    await expect(this.page, 'Tiene que entrar a la caja del dia').toHaveURL(/\/finance\/daily-cash\/\d+/, { timeout: 60_000 });
    await expect(this.page.locator('#dc-date')).toHaveValue(fecha);
    return { id: this.page.url().match(/daily-cash\/(\d+)/)?.[1] ?? '', creada: !hay };
  }

  /**
   * El filtro "Medio": con hasta 15 cajas es un select; con mas, un boton que abre una lista
   * con buscador (rol listbox). Argentina tiene mas de 15; las otras sucursales, menos.
   */
  private async filtroEsSelect(): Promise<boolean> {
    const filtro = this.page.locator('#dc-filter');
    await expect(filtro, 'El filtro Medio tiene que habilitarse').toBeEnabled({ timeout: 30_000 });
    return (await filtro.evaluate((e) => e.tagName)) === 'SELECT';
  }

  private async abrirFiltroDeCaja(): Promise<Locator> {
    await this.page.locator('#dc-filter').click();
    const lista = this.page.getByRole('listbox', { name: 'Medio' });
    await expect(lista).toBeVisible();
    return lista;
  }

  async cajasOfrecidas(): Promise<string[]> {
    if (await this.filtroEsSelect()) {
      return (await this.page.locator('#dc-filter option').allInnerTexts()).map((t) => t.trim());
    }
    const lista = await this.abrirFiltroDeCaja();
    const cajas = (await lista.getByRole('option').allInnerTexts()).map((t) => t.trim());
    await this.page.keyboard.press('Escape');
    await expect(lista).toBeHidden();
    return cajas;
  }

  async filtrarPorCaja(caja: string) {
    if (await this.filtroEsSelect()) {
      await this.page.locator('#dc-filter').selectOption({ label: caja });
    } else {
      const lista = await this.abrirFiltroDeCaja();
      await this.page.getByRole('combobox', { name: /Medio/ }).fill(caja);
      await lista.getByRole('option', { name: caja, exact: true }).click();
      await expect(this.page.locator('#dc-filter'), `El filtro tiene que quedar en ${caja}`).toHaveText(caja);
    }
    await this.page.waitForLoadState('networkidle');
  }

  /** Saca el filtro de Medio: vuelve a mostrar todas las cajas. */
  async quitarFiltroDeCaja() {
    if (await this.filtroEsSelect()) {
      await this.page.locator('#dc-filter').selectOption({ index: 0 });
    } else {
      const lista = await this.abrirFiltroDeCaja();
      await lista.getByRole('option').first().click();
    }
    await this.page.waitForLoadState('networkidle');
  }

  tarjeta(titulo: string): Locator {
    return this.page.locator('section, .card, article').filter({ has: this.page.getByText(titulo, { exact: true }) }).last();
  }

  filaDelMovimiento(codigo: string): Locator {
    return this.tarjeta('Movimientos').locator('tbody tr').filter({ hasText: codigo });
  }

  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  async totales(moneda: string): Promise<TotalesDeCaja | null> {
    const fila = this.tarjeta('Totales').locator('tbody tr').filter({ has: this.page.getByRole('cell', { name: moneda, exact: true }) }).first();
    // Al cambiar el filtro, los totales se recargan: se espera la fila de esa moneda.
    if (!(await fila.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false))) return null;
    // Recien recargada, la fila puede pintarse un instante con el saldo inicial en 0 (visto tras
    // borrar un movimiento): se lee hasta que dos lecturas seguidas coincidan.
    await this.page.waitForLoadState('networkidle');
    let anterior = '';
    let celdas = await this.celdas(fila);
    for (let i = 0; i < 15 && celdas.join('|') !== anterior; i++) {
      anterior = celdas.join('|');
      await this.page.waitForTimeout(700);
      celdas = await this.celdas(fila);
    }
    const [m, inicial, ingreso, salida, balance, final] = celdas;
    return { moneda: m, inicial, ingreso, salida, balance, final };
  }

  async abrirPreCierre(): Promise<Locator> {
    await this.page.getByRole('button', { name: 'Pre-cierre' }).click();
    const dialogo = this.page.getByRole('dialog', { name: 'Pre-cierre' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator('tbody tr').first()).toBeVisible({ timeout: 60_000 });
    return dialogo;
  }

  async filaDelPreCierre(dialogo: Locator, caja: string): Promise<string[]> {
    const fila = dialogo.locator('tbody tr').filter({ hasText: caja }).first();
    if (!(await fila.isVisible().catch(() => false))) return [];
    return this.celdas(fila);
  }

  async cerrarPreCierre(dialogo: Locator) {
    await dialogo.getByRole('button', { name: /^(Cerrar|Close)$/ }).first().click();
    await expect(dialogo).toBeHidden();
  }
}
