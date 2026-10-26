import { test, expect, Page } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { importe } from './reservas-comun';
import candidatos from '../../../data/candidatos.json';

const CS = candidatos.tarifario.cenaShow;

/**
 * RESERVAS — app nueva (ClimbsApp). Idioma del servicio y su recargo: de la ficha al carrito.
 *
 * El mismo test que tests/bloque-b/idioma-del-servicio.spec.ts, con el mismo titulo. La Cena
 * Show AUTO-QA (Cafe de los Angelitos) es la unica de la suite con recargo por idioma en la
 * linea base: Regular USD 137 en Espanol y Portugues, mas en Ingles. Se elige el idioma en
 * la ficha ("Idioma del servicio"), se agrega una vez en Ingles y otra en Espanol, y el
 * carrito tiene que traer cada item con su idioma y el total que mostro su ficha.
 * Fecha de enero 2031 (tarifas hasta fin de 2031). No emite: al final vacia el carrito.
 */
test.describe('Idioma del servicio: de la ficha al carrito', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const FECHA = new Date(2031, 0, 13);
  const MODALIDAD = 'Regular';
  const IDIOMAS = { base: 'Español', conRecargo: 'Inglés' };

  const valor = (texto: string, que: string) => {
    const v = importe(texto).valor;
    expect(v, `${que}: no se pudo leer un importe de "${texto}"`).not.toBeNull();
    return v!;
  };

  test('Cena Show: el idioma y el recargo de la ficha llegan iguales al carrito', async ({ page }) => {
    test.setTimeout(600_000);
    const portal = new PortalNuevoPage(page);
    const idioma = page.locator('main').getByRole('combobox', { name: 'Idioma del servicio' });
    const f = { pax: 2, precioBase: 0, precioRecargo: 0, totalBase: '', totalRecargo: '', totalBaseOtraVez: '' };

    const elegirIdioma = async (nombre: string) => {
      await idioma.selectOption({ label: nombre });
      await expect(idioma, `La ficha tiene que quedar en ${nombre}`).toHaveValue(await idioma.locator('option', { hasText: nombre }).getAttribute('value') ?? '');
    };
    const precioDeLaTarjeta = async () => valor(await portal.precioDeLaModalidad(MODALIDAD), 'Precio por persona de la tarjeta');
    const elegirPax = async () => {
      await portal.elegirPasajeros(MODALIDAD, f.pax);
      return portal.totalDeLaFicha();
    };
    const agregar = async () => {
      await page.getByRole('button', { name: 'Agregar al carrito' }).click();
      await expect(page.getByRole('status').filter({ hasText: /Se agregó \d+ ítem al carrito/ }).last(), 'Agregar al carrito tiene que confirmar').toBeVisible();
    };

    try {
      await paso(page, 'Vaciar el carrito y abrir la ficha de la Cena Show', async () => {
        await portal.vaciarCarrito();
        await portal.buscarServicios(FECHA, 'Cena Show');
        await portal.elegirServicio(CS.terminoBusqueda, CS.nombre.replace('Cafe', 'Café'));
        // El minimo que declara la ficha manda: con menos pasajeros el carrito cobra el minimo.
        f.pax = Math.max(2, await portal.minimoDePasajeros(MODALIDAD));
        await adjuntarTexto('Pasajeros que se eligen en la ficha', String(f.pax));
      });

      await paso(page, 'La ficha ofrece el idioma del servicio y arranca en el idioma base', async () => {
        await expect(idioma, 'La ficha de un servicio con idiomas tiene que mostrar el selector "Idioma del servicio"').toBeVisible();
        const opciones = (await idioma.locator('option').allInnerTexts()).map((t) => t.trim());
        await adjuntarTexto('Idiomas que ofrece la ficha', opciones.join(' | '));
        for (const nombre of [IDIOMAS.base, IDIOMAS.conRecargo]) {
          expect(opciones, `El selector tiene que ofrecer ${nombre}`).toContain(nombre);
        }
        expect(await idioma.evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text.trim()), 'El idioma por defecto de la ficha tiene que ser el base').toBe(IDIOMAS.base);
      });

      await paso(page, 'Idioma base: elegir los pasajeros y leer el total de la ficha', async () => {
        f.precioBase = await precioDeLaTarjeta();
        f.totalBase = await elegirPax();
        await adjuntarTexto('Ficha en idioma base', `${IDIOMAS.base}: precio por persona ${f.precioBase}, total ${f.totalBase}`);
      });

      await paso(page, 'Cambiar al idioma con recargo, elegir la misma cantidad y agregar al carrito', async () => {
        await elegirIdioma(IDIOMAS.conRecargo);
        f.precioRecargo = await precioDeLaTarjeta();
        f.totalRecargo = await elegirPax();
        await adjuntarTexto('Ficha en idioma con recargo', `${IDIOMAS.conRecargo}: precio por persona ${f.precioRecargo}, total ${f.totalRecargo}`);
        const base = valor(f.totalBase, 'Total en idioma base');
        const conRecargo = valor(f.totalRecargo, 'Total en idioma con recargo');
        await conResaltado(page, page.locator('main'), 'total de la ficha con recargo', () => {
          expect(conRecargo, `El total de la ficha tiene que subir con el recargo de ${IDIOMAS.conRecargo}: ${IDIOMAS.base} ${f.totalBase}, ${IDIOMAS.conRecargo} ${f.totalRecargo}`).toBeGreaterThan(base);
        });
        await conResaltado(page, portal.bloqueDeModalidad(MODALIDAD), 'precio por persona de la tarjeta', () => {
          expect(f.precioRecargo, 'La tarjeta de la modalidad tiene que mostrar el precio por persona del idioma elegido').toBeGreaterThan(f.precioBase);
          expect(conRecargo, 'El total de la ficha tiene que ser el precio por persona de la tarjeta por los pasajeros').toBe(f.precioRecargo * f.pax);
        });
        await agregar();
      });

      await paso(page, 'Volver al idioma base, elegir la cantidad y agregar al carrito', async () => {
        await elegirIdioma(IDIOMAS.base);
        f.totalBaseOtraVez = await elegirPax();
        await adjuntarTexto('Ficha otra vez en idioma base', `total ${f.totalBaseOtraVez}`);
        await conResaltado(page, page.locator('main'), 'total de la ficha al volver al idioma base', () => {
          expect(valor(f.totalBaseOtraVez, 'Total al volver al idioma base'), 'Al volver al idioma base, el total de la ficha tiene que volver al de antes del recargo')
            .toBe(valor(f.totalBase, 'Total en idioma base'));
        });
        await agregar();
      });

      await paso(page, 'El carrito trae los dos items, cada uno con su idioma y el total de su ficha', async () => {
        await portal.irAlCarrito();
        const items = page.locator('main article').filter({ hasText: CS.terminoBusqueda });
        await expect(items, 'El carrito tiene que tener los dos items').toHaveCount(2);
        // El idioma se compara sin tildes: el carrito puede escribir la eñe o la tilde
        // descompuestas (letra + marca), que a la vista son el mismo texto.
        const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
        const textos = (await items.allInnerTexts()).map(plano);
        await adjuntarTexto('Items del carrito', textos.join('\n'));
        const conIdioma = (nombre: string) => textos.map((t, i) => (new RegExp(`\\b${plano(nombre)}\\b`).test(t) ? i : -1)).filter((i) => i >= 0);
        for (const nombre of [IDIOMAS.base, IDIOMAS.conRecargo]) {
          expect(conIdioma(nombre), `El carrito tiene que mostrar un item en ${nombre}`).toHaveLength(1);
        }
        const itemBase = items.nth(conIdioma(IDIOMAS.base)[0]);
        const itemRecargo = items.nth(conIdioma(IDIOMAS.conRecargo)[0]);

        const lineaDe = async (it: typeof itemBase) => (await it.innerText()).replace(/\s+/g, ' ').match(/[A-Z]{3}\s*[\d.,]+/g)?.at(-1) ?? '';
        const lineaBaseTxt = await lineaDe(itemBase);
        const lineaRecargoTxt = await lineaDe(itemRecargo);
        const lineas = (await page.locator('main').getByRole('complementary').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
        const totalTxt = lineas[lineas.indexOf('Total') + 1] ?? '';
        const lineaBase = valor(lineaBaseTxt, `Linea ${IDIOMAS.base}`);
        const lineaRecargo = valor(lineaRecargoTxt, `Linea ${IDIOMAS.conRecargo}`);
        const total = valor(totalTxt, 'Total del carrito');
        await adjuntarTexto('Ficha contra carrito', [
          `${IDIOMAS.base}: ficha ${f.totalBase} -> carrito ${lineaBaseTxt}`,
          `${IDIOMAS.conRecargo}: ficha ${f.totalRecargo} -> carrito ${lineaRecargoTxt}`,
          `Total del carrito: ${totalTxt}`,
        ].join('\n'));

        for (const [it, nombre, linea, txt, ficha] of [[itemRecargo, IDIOMAS.conRecargo, lineaRecargo, lineaRecargoTxt, f.totalRecargo], [itemBase, IDIOMAS.base, lineaBase, lineaBaseTxt, f.totalBase]] as const) {
          await conResaltado(page, it, `linea ${nombre}`, async () => {
            expect(linea, `El carrito tiene que cobrar ${nombre} lo que mostro su ficha (${ficha})`).toBe(valor(ficha, `Ficha en ${nombre}`));
            expect(importe(txt).moneda, 'El carrito tiene que cobrar en la moneda de la ficha').toBe(importe(ficha).moneda);
            expect((await it.innerText()).replace(/\s+/g, ' '), 'El carrito tiene que traer la cantidad de pasajeros elegida en la ficha').toContain(`${f.pax} x ${MODALIDAD}`);
          });
        }
        await conResaltado(page, itemRecargo, 'recargo en el carrito', () => {
          expect(lineaRecargo, `El item en ${IDIOMAS.conRecargo} tiene que costar mas que el de ${IDIOMAS.base} por el recargo`).toBeGreaterThan(lineaBase);
        });
        await conResaltado(page, page.locator('main').getByRole('complementary'), 'total del carrito', () => {
          expect(total, 'El total del carrito tiene que ser la suma de sus lineas').toBe(lineaBase + lineaRecargo);
        });
      });
    } finally {
      await portal.vaciarCarrito().catch(() => {});
      await adjuntarTexto('Carrito vaciado', 'ok');
    }
  });
});
