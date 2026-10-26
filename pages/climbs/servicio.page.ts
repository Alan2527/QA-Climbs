import { Page, Locator, expect } from '@playwright/test';
import { leerTabla } from './tabla';
import { importe } from './habitacion.page';

export type TarifaDeServicio = { modalidad: string; vigencia: string; pax: string; moneda: string; costo: number | null; extension: string; fila: number };

/**
 * Ficha del servicio en el Backoffice nuevo (/services/services/{id}), solapa Tarifas: reemplaza
 * a la grilla de tarifas del servicio del WebAdmin. Cada tarifa tiene su casilla "Elegir"; con
 * tarifas elegidas aparecen "Extender elegidas" y "Borrar elegidas". Como en la habitacion, los
 * cambios quedan en "Cambios sin guardar" y se escriben con el "Guardar" de la ficha.
 */
export class ServicioNuevoPage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.getByRole('tab', { name: 'Tarifas' }) }).first(); }
  get pie(): Locator { return this.ficha.getByRole('contentinfo').last(); }
  get grilla(): Locator { return this.ficha.getByRole('table').first(); }

  async abrir(id: number) {
    await this.page.goto(`/services/services/${id}`);
    await expect(this.ficha.getByRole('tab', { name: 'Tarifas' }), `La ficha del servicio ${id} tiene que abrir`).toBeVisible({ timeout: 60_000 });
    await this.ficha.getByRole('tab', { name: 'Tarifas' }).click();
    await expect(this.grilla.or(this.ficha.getByText(/^(No hay tarifas vigentes|El servicio no tiene tarifas)$/)).first()).toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /** Las tarifas vigentes de la grilla. "fila" es su posicion, para elegirla despues. */
  async tarifas(): Promise<TarifaDeServicio[]> {
    if (!(await this.grilla.isVisible())) return [];
    let previa = '';
    let filas: Record<string, string>[] = [];
    for (let i = 0; i < 15; i++) {
      filas = await leerTabla(this.grilla);
      const firma = JSON.stringify(filas);
      if (firma === previa) break;
      previa = firma;
      await this.page.waitForTimeout(600);
    }
    return filas.map((f, i) => {
      const costo = f['Costo por persona'] ?? '';
      return {
        modalidad: f['Modalidad'], vigencia: (f['Vigencia'] ?? '').replace(/\s*–\s*/, ' - '), pax: f['Pasajeros'],
        moneda: costo.match(/[A-Z]{3}/)?.[0] ?? '', costo: importe(costo.replace(/[A-Z]{3}/, '')), extension: f['Extensión'] ?? '', fila: i,
      };
    });
  }

  async elegir(tarifas: TarifaDeServicio[]) {
    for (const t of tarifas) await this.grilla.locator('tbody tr').nth(t.fila).getByRole('checkbox', { name: 'Elegir' }).check();
    await expect(this.ficha.getByText(new RegExp(`^${tarifas.length} tarifas? elegidas?$`))).toBeVisible();
  }

  async textoDePendientes(): Promise<string> {
    const p = this.ficha.locator('.rr-pending');
    if (!(await p.isVisible().catch(() => false))) return '';
    return (await p.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** "Extender elegidas": rango y aumento; devuelve el aviso si lo rechaza. */
  async extenderElegidas(desde: string, hasta: string, porcentaje: number): Promise<string | null> {
    await this.ficha.getByRole('button', { name: 'Extender elegidas' }).click();
    const panel = this.page.getByRole('dialog', { name: 'Extender tarifas elegidas' });
    await expect(panel).toBeVisible();
    await panel.locator('#se-from').fill(desde);
    await panel.locator('#se-to').fill(hasta);
    await panel.locator('#se-percent').fill(String(porcentaje).replace('.', ','));
    await panel.locator('#se-percent').press('Tab');
    await panel.getByRole('button', { name: 'Agregar a los cambios' }).click();
    if (await panel.waitFor({ state: 'hidden', timeout: 15_000 }).then(() => true).catch(() => false)) return null;
    return ((await panel.locator('.error').allInnerTexts()).join(' | ') + ' ' + (await this.page.locator('.toast.bad .toast-text').allInnerTexts()).join(' | ')).trim() || 'no se cerro';
  }

  async borrarElegidas() {
    await this.ficha.getByRole('button', { name: 'Borrar elegidas' }).click();
    const confirmacion = this.page.getByRole('alertdialog');
    if (await confirmacion.waitFor({ timeout: 3_000 }).then(() => true).catch(() => false)) {
      await confirmacion.getByRole('button').last().click();
    }
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async guardar() {
    const boton = this.pie.getByRole('button', { name: 'Guardar', exact: true });
    await expect(boton, 'Tiene que haber cambios para guardar').toBeEnabled();
    await boton.click();
    await expect(boton, 'Al guardar, el pie tiene que quedar "Al dia"').toBeDisabled({ timeout: 90_000 });
    await expect(this.pie).toContainText('Al día', { timeout: 30_000 });
  }
}
