import { Page, Locator, expect } from '@playwright/test';
import { formatearFecha } from '../../utils/pasos';

/**
 * Programas de la app nueva (ClimbsApp, T-33): la solapa "Programas" del buscador de la portada,
 * los resultados (/site/programs), la ficha (/site/programs/{id}) con su bloque de compra, y la
 * solapa Salidas de la ficha del programa en el BackOffice (Servicios y paquetes › Programas),
 * donde se lee el cupo de cada salida.
 */
export class ProgramaNuevoPage {
  constructor(private readonly page: Page) {}

  // --- Portal: buscador y resultados ---------------------------------------------------

  /**
   * Solapa PROGRAMAS de la portada: Argentina / Buenos Aires vienen por defecto. Se cargan la
   * fecha desde la que se buscan salidas y el tipo de salida, y se busca.
   */
  async buscar(fecha: Date, salida: 'Todas' | 'Regulares' | 'En privado') {
    await this.page.getByRole('tab', { name: 'Programas', exact: true }).click();
    const panel = this.page.getByRole('tabpanel', { name: 'Programas' });
    await expect(panel.getByRole('combobox', { name: 'País' })).toHaveValue('Argentina');
    await expect(panel.getByRole('combobox', { name: 'Ciudad' })).toHaveValue('Buenos Aires');
    const desde = panel.getByRole('textbox', { name: 'Salidas desde' });
    await desde.fill(formatearFecha(fecha));
    await desde.press('Tab');
    await expect(desde, 'La fecha desde la que se buscan salidas tiene que quedar cargada').toHaveValue(formatearFecha(fecha));
    const tipo = panel.getByRole('combobox', { name: 'Salida' });
    if ((await tipo.inputValue()) !== salida) {
      await tipo.click();
      await this.page.getByRole('option', { name: salida, exact: true }).click();
    }
    await expect(tipo).toHaveValue(salida);
    // Mientras la solapa termina de cargar pais y ciudad, Buscar no hace nada: se reintenta.
    await expect(async () => {
      await panel.getByRole('button', { name: 'Buscar' }).click();
      await expect(this.page).toHaveURL(/\/site\/programs\?/, { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
  }

  /** La tarjeta de un programa en los resultados. */
  tarjeta(nombre: string): Locator {
    return this.page.locator('main article').filter({ has: this.page.getByRole('heading', { level: 2, name: nombre }) });
  }

  /** "Desde USD 800 por persona en base doble" de la tarjeta, en una sola linea. */
  async desdeDeLaTarjeta(nombre: string): Promise<string> {
    return ((await this.tarjeta(nombre).innerText()).replace(/\s+/g, ' ').match(/Desde .*?base doble/i)?.[0] ?? '').trim();
  }

  async abrirFicha(nombre: string) {
    await this.tarjeta(nombre).getByRole('link', { name: 'Ver programa' }).click();
    await expect(this.page.getByRole('heading', { level: 1, name: nombre }), `Tiene que abrir la ficha de ${nombre}`).toBeVisible({ timeout: 60_000 });
  }

  // --- Portal: bloque de compra de la ficha -------------------------------------------

  get salidas(): Locator {
    return this.page.getByRole('region', { name: 'Salidas' });
  }

  /** Fecha de salida, pasajeros y habitaciones (single, doble, triple), como la persona. */
  async elegirSalida(fecha: Date, pasajeros: number, habitaciones: { single: number; doble: number; triple: number }) {
    const f = this.salidas.getByRole('textbox', { name: 'Fecha de salida' });
    await f.fill(formatearFecha(fecha));
    await f.press('Tab');
    await expect(f, 'La fecha de salida tiene que quedar cargada').toHaveValue(formatearFecha(fecha));
    await this.salidas.getByRole('combobox', { name: 'Pasajeros' }).selectOption(String(pasajeros));
    for (const [rotulo, n] of [['Single', habitaciones.single], ['Doble', habitaciones.doble], ['Triple', habitaciones.triple]] as const) {
      const combo = this.salidas.getByRole('combobox', { name: rotulo, exact: true });
      await combo.selectOption(String(n));
      await expect(combo, `${rotulo}: la cantidad de habitaciones tiene que quedar elegida`).toHaveValue(String(n));
    }
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /** La tarjeta de la salida elegida ("lun 11/01/2027 Regular Disponible" + hotelerias + Agregar al carrito). */
  tarjetaDeLaSalida(fecha: Date): Locator {
    return this.salidas.locator('article').filter({ hasText: formatearFecha(fecha) }).first();
  }

  /** La opcion de hoteleria con su total ("Estándar USD 4.700"). */
  hoteleria(fecha: Date, nombre: string): Locator {
    return this.tarjetaDeLaSalida(fecha).getByRole('radio', { name: new RegExp(`^${nombre}\\b`) });
  }

  // --- BackOffice: cupo de la salida ------------------------------------------------------

  /**
   * Abre la ficha del programa desde el listado del BackOffice (Programas) y su solapa
   * Salidas en la vista Listado, donde cada salida tiene su cupo ("Cupo del dd/mm/aaaa").
   */
  async abrirSalidasEnElBackoffice(nombre: string) {
    await this.page.goto('/programs/programs');
    await this.page.getByRole('searchbox', { name: 'Buscar programa' }).fill(nombre);
    await this.page.getByRole('row').filter({ has: this.page.getByRole('cell', { name: nombre, exact: true }) }).first()
      .getByRole('cell', { name: nombre, exact: true }).click();
    await expect(this.page.getByRole('heading', { level: 1, name: nombre }), `Tiene que abrir la ficha de ${nombre} en el BackOffice`).toBeVisible({ timeout: 60_000 });
    await this.page.getByRole('tab', { name: 'Salidas', exact: true }).click();
    await this.page.getByRole('tab', { name: 'Listado', exact: true }).click();
  }

  cupoDeLaSalida(fecha: Date): Locator {
    return this.page.getByRole('textbox', { name: `Cupo del ${formatearFecha(fecha)}` });
  }

  /** El cupo que le queda a la salida; null si esta "A requerir" (sin cupo cargado). */
  async leerCupo(fecha: Date): Promise<number | null> {
    const campo = this.cupoDeLaSalida(fecha);
    await campo.scrollIntoViewIfNeeded();
    await expect(campo, `La salida del ${formatearFecha(fecha)} tiene que figurar en el listado`).toBeVisible({ timeout: 60_000 });
    const v = (await campo.inputValue()).trim();
    return v === '' ? null : Number(v);
  }
}
