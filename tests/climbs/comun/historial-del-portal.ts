import { Page } from '@playwright/test';

export type FilaDeReserva = { codigo: string; id: string; agencia: string; titulo: string; texto: string };
export type FilaDeCotizacion = { codigo: string; id: string; referencia: string; pasajero: string; pdf: string; word: string; texto: string };

/** Lo que una persona ve: titulo, texto y valor de los campos, en minuscula. */
export async function contenidoVisible(page: Page): Promise<string> {
  const cuerpo = await page.locator('body').innerText().catch(() => '');
  const campos = await page.locator('input:not([type=hidden]), textarea')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).filter(Boolean)).catch(() => [] as string[]);
  return `${await page.title().catch(() => '')}\n${cuerpo}\n${campos.join('\n')}`.replace(/\s+/g, ' ').toLowerCase();
}

/** Las marcas (codigo, referencia, pasajeros) que aparecen en el contenido; ignora las muy cortas. */
export const marcasPresentes = (contenido: string, marcas: string[]) =>
  marcas.filter((m) => m.length >= 4 && contenido.toLowerCase().includes(m.toLowerCase()));

/** Abre una direccion y devuelve el estado HTTP, la direccion final y las marcas que se ven. */
export async function abrirYBuscarMarcas(page: Page, url: string, marcas: string[]) {
  const respuesta = await page.goto(url).catch(() => null);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const contenido = await contenidoVisible(page);
  return { estado: respuesta?.status() ?? 0, urlFinal: page.url(), contenido, encontradas: marcasPresentes(contenido, marcas) };
}

async function buscar(page: Page, q?: string) {
  if (q === undefined) return;
  await page.locator('main').getByRole('searchbox').first().fill(q);
  await page.locator('main').getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

/** Las filas de la solapa "Carrito de compras" del historial de reservas, en el ultimo anio. */
export async function filasDeReservas(page: Page, q?: string): Promise<FilaDeReserva[]> {
  await page.goto('/site/bookings');
  await page.getByRole('tab', { name: 'Carrito de compras', exact: true }).click();
  // El historial arranca en 30 dias: se pide el anio.
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: '1 año' }).click();
  await page.waitForLoadState('networkidle');
  await buscar(page, q);
  await page.waitForTimeout(1000);
  return page.getByRole('tabpanel').getByRole('link').evaluateAll((links) => links.map((a) => {
    const lineas = (a as HTMLElement).innerText.split('\n').map((l) => l.trim()).filter(Boolean);
    const iUsuario = lineas.findIndex((l) => /·\s*[^·]+,\s*[^,]+$/.test(l) && !/pax$/.test(l));
    return {
      codigo: lineas.find((l) => /^BO\d{8}$/.test(l)) ?? '',
      id: (a.getAttribute('href') ?? '').match(/\/bookings\/(\d+)/)?.[1] ?? '',
      agencia: iUsuario > 0 ? lineas[iUsuario - 1] : '',
      titulo: lineas[2] ?? '',
      texto: lineas.join(' '),
    };
  }));
}

/** Las filas de la solapa "Multidestino" del historial de cotizaciones, con sus links de PDF y Word. */
export async function filasDeCotizaciones(page: Page, q?: string): Promise<FilaDeCotizacion[]> {
  await page.goto('/site/quotes');
  await page.getByRole('tab', { name: 'Multidestino', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await buscar(page, q);
  await page.waitForTimeout(1000);
  return page.getByRole('tabpanel').getByRole('link', { name: 'Ver detalle' }).evaluateAll((links) => links.map((a) => {
    let fila: HTMLElement = a as HTMLElement;
    while (fila.parentElement && !/CC\d{8}/.test(fila.innerText)) fila = fila.parentElement;
    const lineas = fila.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
    const despuesDe = (r: RegExp) => { const i = lineas.findIndex((l) => r.test(l)); return i >= 0 ? lineas[i + 1] ?? '' : ''; };
    const link = (r: RegExp) => Array.from(fila.querySelectorAll('a')).find((x) => r.test((x.textContent ?? '') + ' ' + (x.getAttribute('aria-label') ?? '') + ' ' + (x.getAttribute('title') ?? '')))?.getAttribute('href') ?? '';
    return {
      codigo: lineas.find((l) => /^CC\d{8}$/.test(l)) ?? '',
      id: (a.getAttribute('href') ?? '').match(/\/quote\/(\d+)/)?.[1] ?? '',
      referencia: despuesDe(/^Referencia$/i),
      pasajero: despuesDe(/^Pax$/i),
      pdf: link(/PDF/i),
      word: link(/Word/i),
      texto: lineas.join(' '),
    };
  }));
}
