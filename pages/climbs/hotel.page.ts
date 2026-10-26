import { Page, Locator, expect } from '@playwright/test';
import { formatearFecha } from '../../utils/pasos';
import { PortalNuevoPage } from './portal.page';

/** 02/11/2026 -> 2026-11-02, como viaja en la URL de la busqueda. */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Hoteles en el portal nuevo: solapa HOTELES de la portada (Destino, Check-in, Check-out,
 * Viajeros), resultados en `/site/hotels?...` y ficha en `/site/hotels/{id}?...`, con una
 * tarjeta por habitacion ("Total por habitacion", contador "Habitaciones", "Confirmar").
 */
export class HotelNuevoPage {
  constructor(private readonly page: Page) {}

  get panel(): Locator { return this.page.getByRole('tabpanel', { name: 'HOTELES' }); }

  /** Elige el hotel en el buscador "Destino" (acepta destinos y hoteles): se elige el hotel directo. */
  async elegirHotel(termino: string, nombre: string) {
    await new PortalNuevoPage(this.page).abrirInicio();
    await this.page.getByRole('tab', { name: 'HOTELES' }).click();
    const destino = this.panel.getByRole('combobox', { name: 'Destino' });
    await destino.click();
    await destino.pressSequentially(termino, { delay: 50 });
    await this.page.getByRole('option', { name: new RegExp(`^${nombre}`) }).click();
    await expect(destino, 'El buscador tiene que quedar con el hotel elegido').toHaveValue(new RegExp(`^${nombre}`));
  }

  async elegirFechas(entrada: Date, salida: Date) {
    for (const [rotulo, fecha] of [['Check-in', entrada], ['Check-out', salida]] as const) {
      const campo = this.panel.getByRole('textbox', { name: rotulo });
      await campo.fill(formatearFecha(fecha));
      await campo.press('Tab');
      await expect(campo, `${rotulo} tiene que quedar con la fecha elegida`).toHaveValue(formatearFecha(fecha));
    }
  }

  /** Los contadores del panel "Viajeros" arrancan en 0: se suben con "Uno mas" hasta el valor pedido. */
  async cargarViajeros(habitaciones: number, adultos: number) {
    await this.panel.getByRole('button', { name: 'Viajeros' }).click();
    for (const [campo, objetivo] of [['Habitaciones', habitaciones], ['Adultos', adultos]] as const) {
      const mas = this.page.getByRole('button', { name: `Uno más: ${campo}` });
      const valor = async () => Number((await mas.locator('..').innerText()).match(/\d+/)?.[0] ?? 0);
      for (let i = 0; i < 20 && (await valor()) < objetivo; i++) await mas.click();
      expect(await valor(), `${campo} tiene que quedar en ${objetivo}`).toBe(objetivo);
    }
    await this.page.keyboard.press('Escape');
    await expect(this.panel.getByRole('button', { name: 'Viajeros' }))
      .toHaveText(`${adultos} adulto${adultos === 1 ? '' : 's'} · ${habitaciones} habitaci${habitaciones === 1 ? 'ón' : 'ones'}`);
  }

  async buscar(entrada: Date, salida: Date) {
    await this.panel.getByRole('button', { name: 'Buscar' }).click();
    await expect(this.page, 'La busqueda tiene que salir con las fechas elegidas')
      .toHaveURL(new RegExp(`/site/hotels\\?.*checkin=${iso(entrada)}&checkout=${iso(salida)}`), { timeout: 60_000 });
  }

  async abrirFicha(nombre: string) {
    await this.page.locator('main').getByRole('link').filter({ hasText: nombre }).first().click();
    await expect(this.page.getByRole('heading', { level: 1, name: nombre }), `Tiene que abrir la ficha de ${nombre}`).toBeVisible({ timeout: 60_000 });
  }

  habitacion(nombre: string): Locator {
    return this.page.locator('main article').filter({ has: this.page.getByRole('heading', { name: nombre, exact: true }) }).first();
  }

  /** Tipo de tarifa que eligio la ficha para los adultos buscados ("Doble"). */
  async tipoDeTarifa(nombre: string): Promise<string> {
    return (await this.habitacion(nombre).locator('strong').first().innerText()).trim();
  }

  /** "Total por habitacion": el precio de una habitacion por la estadia. */
  async precioDeLaHabitacion(nombre: string): Promise<string> {
    const texto = (await this.habitacion(nombre).innerText()).replace(/\s+/g, ' ');
    return texto.match(/Total por habitaci[oó]n\s+([A-Z]{3}\s*[\d.,]+)/i)?.[1] ?? '';
  }

  /** Sube el contador "Habitaciones" de la tarjeta y confirma; devuelve el total que armo la tarjeta. */
  async reservarHabitacion(nombre: string, cantidad: number): Promise<string> {
    const tarjeta = this.habitacion(nombre);
    const contador = tarjeta.getByRole('group', { name: 'Habitaciones' });
    for (let i = 0; i < cantidad; i++) await contador.getByRole('button', { name: 'Agregar una habitación' }).click();
    await expect(contador.getByRole('status'), `La tarjeta tiene que quedar con ${cantidad} habitacion(es)`).toHaveText(String(cantidad));
    const total = (await tarjeta.innerText()).replace(/\s+/g, ' ').match(/\bTotal\s+([A-Z]{3}\s*[\d.,]+)/)?.[1] ?? '';
    await tarjeta.getByRole('button', { name: 'Confirmar' }).click();
    return total;
  }
}
