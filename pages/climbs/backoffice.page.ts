import { Page, Locator, expect } from '@playwright/test';

export type ImporteNuevo = { moneda: string; valor: number | null };

/** "94.600 ARS" / "96 USD" / "65,24" -> { moneda, valor } */
const leerImporte = (numero: string, moneda = ''): ImporteNuevo => ({
  moneda,
  valor: numero ? Number(numero.replace(/\./g, '').replace(',', '.')) : null,
});

/**
 * Backoffice de la app nueva (ClimbsApp, raiz del sitio).
 *
 * Bandeja de reservas en `/files/inbox`: muestra cada reserva por su numero sin el
 * prefijo del portal ("BO00025832" se ve como "25832"). Al abrirla se despliega un
 * dialogo con los datos del file a generar y el boton "Generar file". Generado, la
 * ficha del file se abre como dialogo sobre el listado, en `/files/files/{id}`.
 */
export class BackofficeNuevoPage {
  constructor(private readonly page: Page) {}

  /** "BO00025832" -> "25832" */
  static numeroDeReserva(codigo: string): string {
    return String(Number(codigo.replace(/\D/g, '')));
  }

  get fichaDelFile(): Locator {
    return this.page.getByRole('dialog').first();
  }

  async abrirReservaDeLaBandeja(codigo: string): Promise<Locator> {
    const numero = BackofficeNuevoPage.numeroDeReserva(codigo);
    await this.page.goto('/files/inbox');
    await this.page.getByRole('searchbox', { name: 'Número, referencia, pasajero o agencia' }).fill(numero);
    const fila = this.page.locator('tbody tr').filter({ has: this.page.getByRole('cell', { name: numero, exact: true }) }).first();
    await expect(fila, `La reserva ${codigo} tiene que aparecer en la bandeja de reservas`).toBeVisible({ timeout: 60_000 });
    await fila.click();
    const dialogo = this.page.getByRole('dialog').filter({ hasText: numero }).first();
    await expect(dialogo, `Tiene que abrir el detalle de la reserva ${codigo}`).toBeVisible();
    await expect(dialogo.getByText(/Sin emitir/), 'La reserva recien hecha tiene que estar sin emitir').toBeVisible();
    return dialogo;
  }

  /** Elige la sucursal y genera el file. Devuelve el id y el codigo del file ("AMV-AR-30444"). */
  async generarFile(dialogo: Locator, sucursal: string): Promise<{ fileId: string; fileCode: string }> {
    await dialogo.getByRole('combobox', { name: 'Sucursal', exact: true }).selectOption({ label: sucursal });
    await dialogo.getByRole('button', { name: 'Generar file', exact: true }).click();
    await expect(this.page, 'Generar el file tiene que abrir la ficha del file').toHaveURL(/\/files\/files\/\d+/, { timeout: 90_000 });
    const encabezado = this.fichaDelFile.getByRole('banner');
    await expect(encabezado, 'La ficha tiene que mostrar el codigo del file').toContainText(/AMV-[A-Z]{2}-\d+/);
    return {
      fileId: this.page.url().match(/\/files\/files\/(\d+)/)?.[1] ?? '',
      fileCode: (await encabezado.innerText()).match(/AMV-[A-Z]{2}-\d+/)?.[0] ?? '',
    };
  }

  async clienteDelFile(): Promise<string> {
    await this.fichaDelFile.getByRole('tab', { name: 'Datos', exact: true }).click();
    return (await this.fichaDelFile.getByRole('combobox', { name: 'Cliente', exact: true }).inputValue()).trim();
  }

  /**
   * Fila del servicio en "Destinos y servicios": el costo va en la moneda del proveedor
   * (ARS para GRUPO SUMMA) y la venta en la del file. Son los dos primeros importes
   * con moneda de la fila; despues viene el porcentaje de utilidad.
   */
  async importesDelItem(servicio: string): Promise<{ costo: ImporteNuevo; venta: ImporteNuevo; texto: string }> {
    await this.fichaDelFile.getByRole('tab', { name: /^Destinos y servicios/ }).click();
    const fila = this.fichaDelFile.locator('tr, [role="row"]').filter({ hasText: servicio }).first();
    await expect(fila, `El file tiene que tener el servicio ${servicio}`).toBeVisible();
    const texto = (await fila.innerText()).replace(/\s+/g, ' ');
    // Solo codigos de moneda: el nombre corto del servicio ("1 TIG/DEL") tambien es numero + tres letras.
    const importes = [...texto.matchAll(/(\d[\d.]*(?:,\d+)?)\s*(ARS|USD|EUR|BRL|CLP|COP|PEN|MXN|UYU)\b/g)];
    return {
      costo: leerImporte(importes[0]?.[1] ?? '', importes[0]?.[2]),
      venta: leerImporte(importes[1]?.[1] ?? '', importes[1]?.[2]),
      texto,
    };
  }
}
