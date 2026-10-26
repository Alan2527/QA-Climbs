import { Page, Locator, expect } from '@playwright/test';
import { importe } from './habitacion.page';

/** Pie de una ficha del Backoffice nuevo: "Guardar" y el estado "Al dia". */
async function guardarFicha(page: Page, ficha: Locator) {
  const pie = ficha.getByRole('contentinfo').last();
  const boton = pie.getByRole('button', { name: 'Guardar', exact: true });
  await expect(boton, 'Tiene que haber cambios para guardar').toBeEnabled();
  await boton.click();
  const error = page.locator('.toast.bad .toast-text');
  await expect(boton.and(page.locator('[disabled]')).or(error).first(), 'Al guardar, el pie tiene que quedar "Al dia"').toBeVisible({ timeout: 90_000 });
  if (await error.isVisible()) throw new Error(`Guardar fue rechazado: ${(await error.allInnerTexts()).join(' | ')}`);
  await expect(pie).toContainText('Al día', { timeout: 30_000 });
}

/** Un interruptor (Switch) se activa con un clic sobre su rotulo: la pista dibujada tapa la casilla. */
async function interruptor(casilla: Locator, si: boolean) {
  if ((await casilla.isChecked()) !== si) await casilla.locator('xpath=..').click();
  await expect(casilla).toBeChecked({ checked: si });
}

/**
 * Ficha del mercado en el Backoffice nuevo (Finanzas › Mercados, /finance/markets/{id}): reemplaza
 * a Markets/Detail del WebAdmin. "Markup hoteles" y "Markup servicios" son campos numericos.
 */
export class MercadoNuevoPage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ hasText: /Mercado #\d+/ }).first(); }

  async abrir(id: number) {
    await this.page.goto(`/finance/markets/${id}`);
    await expect(this.ficha.getByRole('spinbutton', { name: 'Markup hoteles' }), `La ficha del mercado ${id} tiene que abrir`).toBeVisible({ timeout: 60_000 });
    await expect(this.ficha.getByRole('textbox', { name: 'Nombre', exact: true })).not.toHaveValue('', { timeout: 30_000 });
  }

  async markups(): Promise<{ hotel: number; servicio: number }> {
    return {
      hotel: Number(await this.ficha.getByRole('spinbutton', { name: 'Markup hoteles' }).inputValue()),
      servicio: Number(await this.ficha.getByRole('spinbutton', { name: 'Markup servicios' }).inputValue()),
    };
  }

  async guardarMarkups(id: number, hotel: number, servicio: number) {
    await this.abrir(id);
    const actual = await this.markups();
    if (actual.hotel === hotel && actual.servicio === servicio) return;
    await this.ficha.getByRole('spinbutton', { name: 'Markup hoteles' }).fill(String(hotel));
    await this.ficha.getByRole('spinbutton', { name: 'Markup servicios' }).fill(String(servicio));
    await guardarFicha(this.page, this.ficha);
    await this.abrir(id);
    expect(await this.markups(), `El mercado ${id} tiene que quedar en ${hotel} / ${servicio}`).toEqual({ hotel, servicio });
  }
}

/**
 * Ficha de la agencia en el Backoffice nuevo (Clientes › Agencias, /clients/agencies/{id}):
 * reemplaza a Agencies/Detail del WebAdmin. Solapas Datos / Usuarios / Configuracion de productos /
 * App del pasajero. En Datos: "Markup hoteles" y "Markup servicios" (vacio sigue al mercado) y,
 * en Comercial, "Usa su propia cotizacion" con "Cotizacion general".
 */
export class AgenciaNuevaPage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ hasText: /N\.º \d+/ }).first(); }

  async abrir(id: number, solapa = 'Datos') {
    await this.page.goto(`/clients/agencies/${id}`);
    await expect(this.ficha.getByRole('tab', { name: 'Datos' }), `La ficha de la agencia ${id} tiene que abrir`).toBeVisible({ timeout: 60_000 });
    await expect(this.ficha.getByRole('textbox', { name: 'Nombre', exact: true })).not.toHaveValue('', { timeout: 30_000 });
    if (solapa !== 'Datos') await this.solapa(solapa);
  }

  async solapa(nombre: string) {
    const tab = this.ficha.getByRole('tab', { name: new RegExp(`^${nombre}`) });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async guardar() { await guardarFicha(this.page, this.ficha); }

  /** Los markups propios de la agencia; null = vacio (sigue al mercado). */
  async markups(): Promise<{ hotel: number | null; servicio: number | null }> {
    return {
      hotel: importe(await this.ficha.getByRole('textbox', { name: 'Markup hoteles' }).inputValue()),
      servicio: importe(await this.ficha.getByRole('textbox', { name: 'Markup servicios' }).inputValue()),
    };
  }

  async guardarMarkups(id: number, hotel: number | null, servicio: number | null) {
    await this.abrir(id);
    const actual = await this.markups();
    if (actual.hotel === hotel && actual.servicio === servicio) return;
    const txt = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
    await this.ficha.getByRole('textbox', { name: 'Markup hoteles' }).fill(txt(hotel));
    await this.ficha.getByRole('textbox', { name: 'Markup servicios' }).fill(txt(servicio));
    await this.ficha.getByRole('textbox', { name: 'Markup servicios' }).press('Tab');
    await this.guardar();
    await this.abrir(id);
    expect(await this.markups(), `La agencia ${id} tiene que quedar con markup propio ${hotel} / ${servicio}`).toEqual({ hotel, servicio });
  }

  /** "Usa su propia cotizacion" y la cotizacion que rige: la propia o la del pais ("Sin cotizacion propia usa ... : N"). */
  async tipoDeCambio(): Promise<{ manual: boolean; valor: number | null; texto: string }> {
    const casilla = this.ficha.getByRole('checkbox', { name: 'Usa su propia cotización' });
    const manual = await casilla.isChecked();
    if (manual) {
      const valor = importe(await this.ficha.locator('#ag-exchange-general').inputValue());
      return { manual, valor, texto: `propia ${valor}` };
    }
    const texto = (await this.ficha.getByText(/^Sin cotización propia usa/).innerText()).trim();
    return { manual, valor: importe(texto.split(':').pop() ?? ''), texto };
  }

  async guardarTipoDeCambio(id: number, manual: boolean, valor?: number) {
    await this.abrir(id);
    const casilla = this.ficha.getByRole('checkbox', { name: 'Usa su propia cotización' });
    await interruptor(casilla, manual);
    if (manual && valor !== undefined) await this.ficha.locator('#ag-exchange-general').fill(String(valor).replace('.', ','));
    if (await this.ficha.getByRole('contentinfo').last().getByRole('button', { name: 'Guardar', exact: true }).isEnabled()) await this.guardar();
    await this.abrir(id);
    const leido = await this.tipoDeCambio();
    expect(leido.manual, `La agencia ${id} tiene que quedar ${manual ? 'con' : 'sin'} cotizacion propia`).toBe(manual);
    if (manual && valor !== undefined) expect(leido.valor, `La cotizacion propia tiene que quedar en ${valor}`).toBe(valor);
  }
}
