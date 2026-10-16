import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage } from '../../pages/carrito.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, esperarFinDeCarga } from '../../utils/pasos';
import { importeDelPortal } from './reservas-comun';
import candidatos from '../../data/candidatos.json';

const CS = candidatos.tarifario.cenaShow;

/**
 * BLOQUE B — Idioma del servicio y su recargo: de la ficha al carrito.
 *
 * La ficha del servicio (ServiceDetail.aspx) deja elegir el idioma en el que se da el
 * servicio (`#sdLangSelect`, se guarda en `#hiddenServiceLanguage`). Si el servicio tiene
 * una fila de recargo para ese idioma, el total de la ficha cambia, y ese total y ese
 * idioma tienen que llegar iguales al carrito (ShoppingCartPage.aspx, etiqueta de idioma
 * de cada item). Lo que cambia entre el idioma base y el de recargo es justamente lo que
 * se compara en el carrito.
 *
 * Servicio: la Cena Show AUTO-QA (163, Cafe de los Angelitos). Es la unica de la suite con
 * una fila de recargo por idioma en la linea base del tarifario
 * (data/importes-lineabase.json, cenaShow: Regular USD 137 en Espanol y Portugues, USD 167
 * en Ingles). Los servicios 3925 / 2846 / 3317 de la US 4739 que figuran en la memoria del
 * equipo NO estan en la suite ni en data/*.json: no se pudo confirmar que tengan recargo,
 * asi que no se usan. Si el recargo de 163 cambia o se prefiere otro servicio, se cambia
 * SERVICIO y IDIOMAS aca arriba; el resto del test no depende del valor del recargo, solo
 * exige que el idioma con recargo cueste mas que el base.
 *
 * Recorrido, con pablo1 (el usuario por defecto de la suite):
 * 1. Ficha en Espanol (idioma base, sin fila de recargo): se eligen los pasajeros y se lee
 *    el total.
 * 2. Cambiar a Ingles con los pasajeros ya elegidos (la ficha los reinicia) y volver a
 *    elegir la misma cantidad: el total se recalcula y tiene que ser mayor. Se agrega.
 * 3. Volver a Espanol, elegir la cantidad y agregar: vuelve al total del paso 1.
 * 4. Carrito: dos lineas, cada una con su etiqueta de idioma y con el total que mostro su
 *    ficha (la ficha y el carrito redondean por pasajero y despues multiplican), y el total
 *    del carrito es la suma.
 *
 * Fecha de enero 2031: el servicio tiene tarifas hasta fin de 2031 y enero esta entre sus
 * meses con salida, asi no depende de lo que dejen otros tests.
 * No emite: al final vacia el carrito.
 */
test.describe('Idioma del servicio: de la ficha al carrito', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const FECHA = new Date(2031, 0, 13);
  const SERVICIO = {
    id: CS.id,
    // Se busca y se ubica la card por esta palabra: el nombre completo lleva tilde y
    // la card puede mostrarlo cortado.
    termino: CS.terminoBusqueda,
    // Valor del combo Tipo del buscador (ServiceSearchControl.ascx.cs:128: 3 = Cena Show).
    // Se elige por valor y no por etiqueta porque la etiqueta sale de un recurso traducible.
    tipoValor: String(CS.serviceTypeId),
    modalidad: 'Regular',
    paxMinimos: 2,
  };
  // Los values del combo `#sdLangSelect` son los LanguageID del servicio
  // (ServiceDetail.aspx:439-452): 1 Espanol (el idioma por defecto, `DefaultServiceLanguageId`)
  // y 2 Ingles. El idioma con recargo de la linea base es el Ingles.
  const IDIOMAS = { base: '1', conRecargo: '2' };

  const valor = (texto: string, que: string) => {
    const v = importeDelPortal(texto).valor;
    expect(v, `${que}: no se pudo leer un importe de "${texto}"`).not.toBeNull();
    return v!;
  };
  const moneda = (texto: string) => importeDelPortal(texto).moneda;

  /** Bloque de la modalidad por su nombre exacto: "Menores en regular" tambien contiene "regular". */
  const bloqueDe = (page: Page, servicio: ServicioPage): Locator =>
    servicio.bloquesDeTarifa()
      .filter({ has: page.locator('.sd-rate__name', { hasText: new RegExp(`^\\s*${SERVICIO.modalidad}\\s*$`, 'i') }) })
      .first();

  test('Cena Show: el idioma y el recargo de la ficha llegan iguales al carrito', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);

    // Lo que mostro la ficha en cada idioma y lo que cobro el carrito.
    const f = {
      pax: SERVICIO.paxMinimos,
      nombreBase: '', nombreRecargo: '',
      precioBase: 0, precioRecargo: 0,
      totalBase: '', totalRecargo: '', totalBaseOtraVez: '',
    };
    const nombreDelIdioma = async (id: string) =>
      ((await page.locator(`#sdLangSelect option[value='${id}']`).first().textContent()) ?? '').trim();
    const precioDeLaTarjeta = async () =>
      valor(await bloqueDe(page, servicio).locator('.js-sd-price').first().innerText(), 'Precio por persona de la tarjeta');
    const elegirPax = async () => {
      await bloqueDe(page, servicio).locator(servicio.comboPax).selectOption(String(f.pax));
      await esperarFinDeCarga(page);
      return servicio.esperarTotal();
    };
    const elegirIdioma = async (id: string) => {
      await page.locator('#sdLangSelect').selectOption(id);
      await esperarFinDeCarga(page);
      await expect(page.locator('#hiddenServiceLanguage'),
        'La ficha tiene que guardar el idioma elegido para mandarlo al carrito').toHaveValue(id);
    };

    try {
      await paso(page, 'Vaciar el carrito y abrir la ficha de la Cena Show', async () => {
        await inicio.abrir();
        await carrito.vaciar();
        await inicio.abrir();
        const panel = await inicio.abrirSolapa('servicios');

        // Igual que ServicioPage.buscar, pero el tipo se elige por valor (ver SERVICIO).
        await page.locator(servicio.comboPais).selectOption({ label: 'Argentina' });
        await esperarFinDeCarga(page);
        await page.locator(servicio.comboCiudad).selectOption({ label: 'Buenos Aires' });
        await page.locator(servicio.comboTipo).selectOption({ value: SERVICIO.tipoValor });
        await servicio.elegirFecha(servicio.campoFecha, servicio.hiddenFecha, FECHA);
        await panel.locator(servicio.btnBuscar).first().click();
        await page.waitForURL(/serviceall/i, { timeout: 90_000 });
        await esperarFinDeCarga(page);

        await servicio.buscarPorNombre(SERVICIO.termino);
        // Despues de elegirlo en el buscador, el h4 de la card corta el nombre a 27
        // caracteres ("AUTO-QA NO TOCAR - Café de .."): "Angelitos" queda afuera, asi
        // que la card se ubica por el comienzo del nombre.
        await servicio.abrirFicha(CS.nombre.slice(0, 25));

        // El minimo que declara la ficha manda: con menos pasajeros el carrito cobra el
        // minimo y la comparacion no seria contra lo mismo (ver reservas-clasico.spec.ts).
        const texto = await bloqueDe(page, servicio).innerText();
        f.pax = Math.max(SERVICIO.paxMinimos, Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1));
        await adjuntarTexto('Pasajeros que se eligen en la ficha', String(f.pax));
      });

      await paso(page, 'La ficha ofrece el idioma del servicio y arranca en el idioma base', async () => {
        await expect(page.locator('#sdLangBar'),
          'La ficha de un servicio con idiomas tiene que mostrar el selector "Idioma del servicio"').toBeVisible();
        const opciones = await page.locator('#sdLangSelect option').evaluateAll(
          (os) => os.map((o) => `${(o as HTMLOptionElement).value}=${o.textContent?.trim()}`));
        await adjuntarTexto('Idiomas que ofrece la ficha', opciones.join(' | '));
        for (const id of [IDIOMAS.base, IDIOMAS.conRecargo]) {
          await expect(page.locator(`#sdLangSelect option[value='${id}']`),
            `El selector tiene que ofrecer el idioma ${id}. Ofrece: ${opciones.join(' | ')}`).toHaveCount(1);
        }
        f.nombreBase = await nombreDelIdioma(IDIOMAS.base);
        f.nombreRecargo = await nombreDelIdioma(IDIOMAS.conRecargo);
        await expect(page.locator('#sdLangSelect'), 'El idioma por defecto de la ficha tiene que ser el base')
          .toHaveValue(IDIOMAS.base);
      });

      await paso(page, 'Idioma base: elegir los pasajeros y leer el total de la ficha', async () => {
        f.precioBase = await precioDeLaTarjeta();
        f.totalBase = await elegirPax();
        await adjuntarTexto('Ficha en idioma base', `idioma ${f.nombreBase}, precio por persona ${f.precioBase}, total ${f.totalBase}`);
        valor(f.totalBase, 'Total de la ficha en idioma base');
      });

      await paso(page, 'Cambiar al idioma con recargo, elegir la misma cantidad y agregar al carrito', async () => {
        // Con pasajeros ya elegidos la ficha los reinicia al cambiar el idioma
        // (sdSetLanguage -> sdClearPax); se vuelve a elegir la misma cantidad y el total
        // tiene que recalcularse con el idioma nuevo.
        await elegirIdioma(IDIOMAS.conRecargo);
        await adjuntarTexto('Total justo despues de cambiar de idioma',
          `"${(await page.locator('#totals .sd-total-amount').textContent())?.trim() ?? ''}" (antes: ${f.totalBase})`);
        f.precioRecargo = await precioDeLaTarjeta();
        f.totalRecargo = await elegirPax();
        await adjuntarTexto('Ficha en idioma con recargo',
          `idioma ${f.nombreRecargo}, precio por persona ${f.precioRecargo}, total ${f.totalRecargo}`);

        const base = valor(f.totalBase, 'Total en idioma base');
        const conRecargo = valor(f.totalRecargo, 'Total en idioma con recargo');
        await conResaltado(page, page.locator('#totals'), 'total de la ficha con recargo', () => {
          expect(conRecargo, `El total de la ficha tiene que subir con el recargo de ${f.nombreRecargo}: ` +
            `${f.nombreBase} ${f.totalBase}, ${f.nombreRecargo} ${f.totalRecargo}`).toBeGreaterThan(base);
        });
        await conResaltado(page, bloqueDe(page, servicio), 'precio por persona de la tarjeta', () => {
          expect(f.precioRecargo, 'La tarjeta de la modalidad tiene que mostrar el precio por persona del idioma elegido')
            .toBeGreaterThan(f.precioBase);
          // La ficha redondea por pasajero y despues multiplica (API 4822e57).
          expect(conRecargo, 'El total de la ficha tiene que ser el precio por persona de la tarjeta por los pasajeros')
            .toBe(f.precioRecargo * f.pax);
        });
        await servicio.agregarAlCarrito();
      });

      await paso(page, 'Volver al idioma base, elegir la cantidad y agregar al carrito', async () => {
        await elegirIdioma(IDIOMAS.base);
        f.totalBaseOtraVez = await elegirPax();
        await adjuntarTexto('Ficha otra vez en idioma base', `total ${f.totalBaseOtraVez}`);
        await conResaltado(page, page.locator('#totals'), 'total de la ficha al volver al idioma base', () => {
          expect(valor(f.totalBaseOtraVez, 'Total al volver al idioma base'),
            'Al volver al idioma base, el total de la ficha tiene que volver al de antes del recargo')
            .toBe(valor(f.totalBase, 'Total en idioma base'));
        });
        await servicio.agregarAlCarrito();
      });

      await paso(page, 'El carrito trae los dos items, cada uno con su idioma y el total de su ficha', async () => {
        await carrito.irAlCarrito();
        await expect(page.locator(carrito.filas), 'El carrito tiene que tener los dos items').toHaveCount(2);

        const fila = (idioma: string) => page.locator(carrito.filas)
          .filter({ hasText: SERVICIO.termino })
          .filter({ has: page.locator('.ct-row__tags', { hasText: idioma }) });
        const filaBase = fila(f.nombreBase);
        const filaRecargo = fila(f.nombreRecargo);
        await adjuntarTexto('Idiomas que tienen que figurar en el carrito', `${f.nombreBase} | ${f.nombreRecargo}`);
        await adjuntarTexto('Etiquetas de cada item del carrito',
          (await page.locator(`${carrito.filas} .ct-row__tags`).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).join(' | '));
        await expect(filaBase, `El carrito tiene que mostrar un item con la etiqueta de idioma ${f.nombreBase}`).toHaveCount(1);
        await expect(filaRecargo, `El carrito tiene que mostrar un item con la etiqueta de idioma ${f.nombreRecargo}`).toHaveCount(1);

        const lineaBaseTxt = await filaBase.locator('.ct-row__total').innerText();
        const lineaRecargoTxt = await filaRecargo.locator('.ct-row__total').innerText();
        const totalTxt = await page.locator('.ct-total .ct-opt__total-val').first().innerText();
        const lineaBase = valor(lineaBaseTxt, `Linea ${f.nombreBase}`);
        const lineaRecargo = valor(lineaRecargoTxt, `Linea ${f.nombreRecargo}`);
        const total = valor(totalTxt, 'Total del carrito');
        await adjuntarTexto('Ficha contra carrito', [
          `${f.nombreBase}: ficha ${f.totalBase} -> carrito ${lineaBaseTxt.trim()}`,
          `${f.nombreRecargo}: ficha ${f.totalRecargo} -> carrito ${lineaRecargoTxt.trim()}`,
          `Total del carrito: ${totalTxt.trim()}`,
        ].join('\n'));

        await conResaltado(page, filaRecargo, `linea ${f.nombreRecargo}`, async () => {
          expect(lineaRecargo, `El carrito tiene que cobrar ${f.nombreRecargo} lo que mostro su ficha (${f.totalRecargo})`)
            .toBe(valor(f.totalRecargo, 'Ficha con recargo'));
          expect(moneda(lineaRecargoTxt), 'El carrito tiene que cobrar en la moneda de la ficha')
            .toBe(moneda(f.totalRecargo));
          expect(await filaRecargo.locator('.sc-qty').innerText(),
            'El carrito tiene que traer la cantidad de pasajeros elegida en la ficha').toMatch(new RegExp(`^\\s*${f.pax}\\b`));
        });
        await conResaltado(page, filaBase, `linea ${f.nombreBase}`, async () => {
          expect(lineaBase, `El carrito tiene que cobrar ${f.nombreBase} lo que mostro su ficha (${f.totalBase})`)
            .toBe(valor(f.totalBase, 'Ficha en idioma base'));
          expect(moneda(lineaBaseTxt), 'El carrito tiene que cobrar en la moneda de la ficha').toBe(moneda(f.totalBase));
          expect(await filaBase.locator('.sc-qty').innerText(),
            'El carrito tiene que traer la cantidad de pasajeros elegida en la ficha').toMatch(new RegExp(`^\\s*${f.pax}\\b`));
        });
        await conResaltado(page, filaRecargo, 'recargo en el carrito', () => {
          expect(lineaRecargo, `El item en ${f.nombreRecargo} tiene que costar mas que el de ${f.nombreBase} por el recargo`)
            .toBeGreaterThan(lineaBase);
        });
        await conResaltado(page, page.locator('.ct-total').first(), 'total del carrito', () => {
          expect(total, 'El total del carrito tiene que ser la suma de sus lineas').toBe(lineaBase + lineaRecargo);
        });
      });
    } finally {
      await new InicioPage(page).abrir().catch(() => {});
      await new CarritoPage(page).vaciar().catch(() => {});
      await esperarFinDeCarga(page).catch(() => {});
      await adjuntarTexto('Carrito vaciado', 'ok');
    }
  });
});
