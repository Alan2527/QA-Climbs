import { Locator } from '@playwright/test';

export type FilaDeTabla = Record<string, string>;

/**
 * Lee una tabla como la ve la persona: una fila por registro, con el texto de cada celda
 * bajo el nombre de su columna. Las celdas con campos (rooming) devuelven el valor del
 * campo; los combos, la opcion elegida. Las columnas sin titulo quedan como "#<n>".
 */
export async function leerTabla(tabla: Locator): Promise<FilaDeTabla[]> {
  return tabla.evaluate((t: HTMLTableElement) => {
    const limpio = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    const titulos = Array.from(t.querySelectorAll('thead th')).map((th, i) => limpio(th.textContent) || `#${i}`);
    const valor = (td: Element) => {
      const campo = td.querySelector('input:not([type=checkbox]), select, textarea') as HTMLInputElement | HTMLSelectElement | null;
      if (!campo) return limpio(td.textContent);
      if (campo instanceof HTMLSelectElement) return limpio(campo.options[campo.selectedIndex]?.text);
      return limpio(campo.value);
    };
    return Array.from(t.querySelectorAll('tbody tr')).map((tr) => {
      const fila: Record<string, string> = {};
      Array.from(tr.querySelectorAll('td')).forEach((td, i) => { fila[titulos[i] ?? `#${i}`] = valor(td); });
      return fila;
    });
  });
}
