import { test, expect, Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import { TarifarioNuevoPage, Tabla } from '../../../pages/climbs/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, alinearVigencias, sinSeparadorDeMiles, precioMostrado, importeANumero } from '../../../utils/pasos';
import candidatos from '../../../data/candidatos.json';
import lineaBase from '../../../data/importes-lineabase.json';

const T = candidatos.tarifario as Record<string, any>;
const SALTO = '\n';

/**
 * TARIFARIO — app nueva (ClimbsApp). Una solapa por test, con los mismos titulos que
 * tests/bloque-a/tarifario.spec.ts. Recorrido natural: menu Tarifario, Pais y Destino,
 * Buscar, la solapa y el buscador por nombre. Lo esperado sale de la base (data/candidatos.json)
 * y de la linea base de importes (data/importes-lineabase.json), igual que la suite actual.
 *
 * Las diferencias con el portal actual se marcan con expect.soft: el test sigue y queda en
 * rojo con todas las diferencias de la solapa a la vista.
 */
test.describe('Tarifario', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  /** Solapa del portal nuevo y destino de busqueda para cada candidato. */
  const SOLAPA: Record<string, { nombre: string; destino: string }> = {
    paquetes: { nombre: 'Paquetes', destino: 'Buenos Aires' },
    excursiones: { nombre: 'Excursiones', destino: 'Buenos Aires' },
    hoteles: { nombre: 'Hoteles', destino: 'Buenos Aires' },
    traslados: { nombre: 'Traslados', destino: 'Buenos Aires' },
    cenaShow: { nombre: 'Cena show', destino: 'Buenos Aires' },
    // Cruceros y ofertas se listan bajo Ushuaia, como en el portal actual.
    cruceros: { nombre: 'Cruceros', destino: 'Ushuaia' },
    ofertas: { nombre: 'Ofertas', destino: 'Ushuaia' },
  };

  const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();
  /** Una fila para comparar con la linea base: sin separador de miles, guion comun y en mayuscula. */
  // Sin las celdas vacias: la tabla nueva deja vacia la columna PAX donde la linea base no tiene celda.
  // La marca TARIFA EXTENDIDA se compara como "la fila la tiene": el portal actual la pone en
  // cada precio y el nuevo, en hoteles, una vez junto a la fecha (misma informacion).
  const fila = (f: string[]) => {
    const texto = sinSeparadorDeMiles(f.filter((c) => c.trim() !== '').join(' | ')).replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toUpperCase();
    const extendida = texto.includes('TARIFA EXTENDIDA');
    return texto.replace(/\s*TARIFA EXTENDIDA/g, '') + (extendida ? ' [TARIFA EXTENDIDA]' : '');
  };

  async function abrirItem(page: Page, clave: string): Promise<{ t: TarifarioNuevoPage; card: Locator }> {
    const cfg = T[clave];
    const solapa = SOLAPA[clave];
    const t = new TarifarioNuevoPage(page);
    await paso(page, `Filtrar por Argentina / ${solapa.destino} y buscar`, async () => {
      await t.irDesdeElMenu();
      await t.filtrar('Argentina', solapa.destino);
      const f = await t.filtrosActuales();
      await adjuntarTexto('Filtros aplicados', `Pais: ${f.pais}\nDestino: ${f.destino}`);
    });
    await paso(page, `Abrir la pestania ${solapa.nombre}`, async () => {
      await expect(t.solapa(solapa.nombre), `La pestania ${solapa.nombre} tiene que estar visible`).toBeVisible();
      await t.abrirSolapa(solapa.nombre);
    });
    let card!: Locator;
    await paso(page, `Buscar "${cfg.terminoBusqueda}" en el buscador de la pantalla`, async () => {
      await t.buscarPorNombre(cfg.terminoBusqueda, cfg.nombre);
      card = t.card(cfg.nombre);
    });
    await paso(page, 'El item aparece con su nombre exacto', async () => {
      const { nombre, pastillas } = await t.tituloDeLaCard(card);
      const esperado = cfg.nombreEnLaCard ?? cfg.nombre;
      await adjuntarTexto('Obtenido en pantalla', `titulo: ${nombre}\npastillas: ${JSON.stringify(pastillas)}\n\n${(await card.innerText()).slice(0, 2000)}`);
      // La card puede mostrar lo que va entre parentesis como pastilla ("... Ushuaia" + "6 dias / 5
      // noches"): es el mismo nombre con otra forma y se acepta.
      const conPastilla = pastillas.length ? `${nombre} (${pastillas.join(' ')})` : nombre;
      expect([norm(nombre), norm(conPastilla)], `El titulo de la card tiene que ser "${esperado}"`).toContain(norm(esperado));
      if (cfg.pastillaDelTitulo) expect(pastillas.map(norm), `El titulo de la card tiene que mostrar la pastilla "${cfg.pastillaDelTitulo}"`).toContain(norm(cfg.pastillaDelTitulo));
    });
    await paso(page, 'La card muestra los componentes que corresponden', async () => {
      // "copiar", "copiarSolapa" y "descargaPdf" viven en la ficha "Ver detalle": se verifican ahi.
      const esperados = Object.fromEntries(Object.entries(cfg.elementos as Record<string, boolean>).filter(([k]) => !['copiar', 'copiarSolapa', 'descargaPdf'].includes(k)));
      const hay = await t.componentes(card);
      const src = await t.srcImagen(card);
      await adjuntarTexto('Componentes de la card', Object.keys(esperados).map((k) => `${k.padEnd(18)} esperado: ${String(esperados[k]).padEnd(6)} en pantalla: ${hay[k]}`).join(SALTO) + `\n\nsrc de la imagen: ${src}`);
      for (const k of Object.keys(esperados)) {
        expect.soft(hay[k], esperados[k] ? `El componente "${k}" tiene que estar en la card` : `El componente "${k}" no tiene que estar en esta pestania`).toBe(esperados[k]);
      }
      if (cfg.imagen) expect.soft((src ?? '').split('?')[0].endsWith(cfg.imagen), `La imagen tiene que ser ${cfg.imagen} y el src es "${src}"`).toBe(true);
    });
    const esperadas: string[] | undefined = cfg.detalleEsperado?.Detail;
    if (esperadas?.length && clave !== 'cruceros') {
      await paso(page, 'La descripcion de la card coincide con la base', async () => {
        const enPantalla = await t.descripcionDeLaCard(card);
        const recortada = norm(enPantalla).replace(/[.…\s]+$/, '');
        const completa = norm(esperadas.join(' '));
        await adjuntarTexto('Descripcion de la card: base vs pantalla', `EN LA BASE:\n${esperadas.join(' ').slice(0, 1200)}\n\nEN LA CARD:\n${enPantalla.slice(0, 1200)}`);
        expect(enPantalla, 'La card tiene que mostrar una descripcion').not.toBe('');
        expect.soft(completa.startsWith(recortada), `La descripcion de la card tiene que ser el comienzo de la de la base.\nen la base: ${completa.slice(0, 160)}\nen la card: ${recortada.slice(0, 160)}`).toBe(true);
      });
    }
    return { t, card };
  }

  /** Lee las tarifas del explorador como la linea base: por idioma, por habitacion o una sola tabla. */
  async function capturarTarifas(t: TarifarioNuevoPage, clave: string): Promise<{ porIdioma: Record<string, Tabla>; solapasIdioma: number; tarifaExtendida: number }> {
    const porIdioma: Record<string, Tabla> = {};
    const idiomas = await t.idiomasDelExplorador();
    let extendidas = 0;
    const leer = async () => {
      const tabla = (await t.tablaDelExplorador()).map((f) => f.map((c) => c.replace(/[–—]/g, '-')));
      extendidas += tabla.filter((f) => /tarifa extendida/i.test(f.join(' '))).length;
      return tabla;
    };
    if (clave === 'hoteles') {
      for (const { nombre, boton } of await t.categoriasDelExplorador()) {
        await boton.click();
        // DIFERENCIA (26/10): el explorador solo muestra la primera habitacion; elegir otra no
        // cambia nada (el servidor manda todas con id 0). Se marca y se sigue con las demas.
        const titulo = t.dialogo.getByRole('heading', { level: 4 }).first();
        const cambio = await expect(titulo).toContainText(nombre.replace(/[\s.-]+$/, ''), { timeout: 10_000 }).then(() => true).catch(() => false);
        expect.soft(cambio, `Elegir la habitacion "${nombre}" tiene que mostrar sus tarifas (sigue mostrando "${await titulo.innerText()}")`).toBe(true);
        if (cambio) porIdioma[`${nombre} · sin-solapas`] = await leer();
      }
    } else if (idiomas.length) {
      for (const idioma of idiomas) {
        await t.elegirIdiomaDelExplorador(idioma);
        porIdioma[idioma] = await leer();
      }
    } else {
      porIdioma['sin-solapas'] = await leer();
    }
    return { porIdioma, solapasIdioma: idiomas.length, tarifaExtendida: extendidas };
  }

  /** Abre el tarifario del item y compara los importes con la linea base. */
  async function validarImportes(page: Page, t: TarifarioNuevoPage, card: Locator, clave: string) {
    const cfg = T[clave];
    await paso(page, 'Desplegar el tarifario del item', async () => {
      await t.verTarifario(card);
      const titulo = await t.tituloDelDialogo();
      // El nombre puede venir con lo del parentesis como pastilla (mismo texto, otra forma).
      const esperado = cfg.nombreEnLaCard ?? cfg.nombre;
      const sinParentesis = esperado.replace(/\s*\((.*)\)$/, ' $1');
      await adjuntarTexto('Titulo del explorador', titulo);
      expect([norm(esperado), norm(sinParentesis)].some((x) => norm(titulo).includes(x)), `El explorador tiene que abrirse con el nombre del item de la card ("${esperado}"); dice "${titulo}"`).toBe(true);
      if (cfg.pastillaDelTitulo) expect(norm(titulo), `Al lado del nombre tiene que ir la pastilla "${cfg.pastillaDelTitulo}", como en la card`).toContain(norm(cfg.pastillaDelTitulo));
    });
    const original = (lineaBase.items as Record<string, any>)[clave];
    if (!original) return;
    const esperado = structuredClone(original) as { porIdioma: Record<string, string[][]>; solapasIdioma: number; tarifaExtendida: number };

    await paso(page, 'Los importes coinciden con la linea base', async () => {
      const actual = await capturarTarifas(t, clave);
      const sinDesde = (x: { porIdioma: Record<string, string[][]> }) => {
        x.porIdioma = Object.fromEntries(Object.entries(x.porIdioma).map(([k, v]) => [k.replace(/\s+Desde\s+[A-Z]{3}\s*[\d.,]+[^·]*/, ' ').replace(/\s+/g, ' ').trim(), v]));
      };
      sinDesde(esperado);
      sinDesde(actual);
      if (cfg.alinearVigencias) {
        const captura = new Date(`${lineaBase._capturada}T00:00:00`);
        const hoy = new Date();
        const horizonte = new Date(captura);
        horizonte.setMonth(horizonte.getMonth() + 18);
        for (const k of Object.keys(esperado.porIdioma)) esperado.porIdioma[k] = alinearVigencias(esperado.porIdioma[k], captura, hoy, horizonte);
        for (const k of Object.keys(actual.porIdioma)) actual.porIdioma[k] = alinearVigencias(actual.porIdioma[k], hoy, hoy, horizonte);
      }
      const resumen = (x: { porIdioma: Record<string, string[][]> }) => Object.entries(x.porIdioma).map(([k, filas]) => `[${k}]\n` + filas.map((f) => f.join(' | ')).join(SALTO)).join(SALTO);
      await adjuntarTexto('Importes esperados (linea base)', resumen(esperado).slice(0, 5000));
      await adjuntarTexto('Importes en pantalla', resumen(actual).slice(0, 5000));

      expect.soft(actual.solapasIdioma, `Tiene que haber ${esperado.solapasIdioma} solapas de idioma`).toBe(esperado.solapasIdioma);
      expect.soft(actual.tarifaExtendida > 0, `La linea base tiene ${esperado.tarifaExtendida} marcas TARIFA EXTENDIDA: en pantalla tiene que haber marcas`).toBe(esperado.tarifaExtendida > 0);

      for (const [k, filasEsperadas] of Object.entries(esperado.porIdioma)) {
        // Sin solapas de idioma en pantalla, la unica tabla se compara con la primera de la base (Espanol).
        const filasActuales = actual.porIdioma[k] ?? (actual.porIdioma['sin-solapas'] && k === Object.keys(esperado.porIdioma)[0] ? actual.porIdioma['sin-solapas'] : undefined);
        // En hoteles, la habitacion que no se pudo elegir ya quedo marcada arriba.
        if (clave !== 'hoteles') expect.soft(filasActuales, `Tiene que existir la tabla "${k}"`).toBeDefined();
        if (!filasActuales) continue;
        const maximo = Math.max(filasEsperadas.length, filasActuales.length);
        for (let i = 0; i < maximo; i++) {
          const esp = filasEsperadas[i] ? fila(filasEsperadas[i]) : '(no existe)';
          const act = filasActuales[i] ? fila(filasActuales[i]) : '(no existe)';
          expect.soft(act, `La fila ${i} de "${k}" tiene que coincidir con la linea base`).toBe(esp);
        }
      }
    });
    await t.cerrarDialogo();
  }

  async function validarCard(page: Page, t: TarifarioNuevoPage, card: Locator, cfg: any) {
    const c = cfg.card;
    if (!c) return;
    await paso(page, 'La card muestra los datos destacados de la base', async () => {
      const obs = await t.observacionesDestacadas(card);
      const barra = await t.barraDeOperatividad(card);
      const amenities = await t.amenitiesDestacadas(card);
      const tags = await t.tagsDeServicio(card);
      await adjuntarTexto('Elementos de la card', `observaciones: ${JSON.stringify(obs)}\nbarra: ${JSON.stringify(barra)}\namenities: ${JSON.stringify(amenities)}\ntags: ${JSON.stringify(tags)}`);
      if (c.observacionesDestacadas) expect.soft(obs.map(norm), 'La card tiene que mostrar exactamente las observaciones destacadas de la base').toEqual(c.observacionesDestacadas.map(norm));
      if (c.duracionRegular) {
        expect.soft(barra.some((x) => x.texto === c.duracionRegular), `La barra de operatividad tiene que mostrar la duracion "${c.duracionRegular}"`).toBe(true);
        const idiomas: string[] = cfg.fichaDetalle?.idiomas ?? [];
        const mismo = (a: string[], b: string[]) => a.length === b.length && a.map(norm).sort().join('|') === b.map(norm).sort().join('|');
        expect.soft(barra.some((x) => mismo(x.items, idiomas)), `El tooltip de idiomas tiene que listar exactamente ${idiomas.join(', ')}`).toBe(true);
        const calendario = barra.find((x) => x.esCalendario);
        expect.soft(calendario, 'La card tiene que mostrar el item de operatividad').toBeDefined();
        const meses: number[] = cfg.fichaDetalle?.mesesConSalida ?? [];
        if (calendario && meses.length) {
          const ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          for (const mes of ABREV.filter((_, i) => !meses.includes(i + 1))) {
            expect.soft(norm(calendario.meses), `La temporada no tiene que nombrar "${mes}", que la base no opera`).not.toContain(norm(mes));
          }
        }
      }
      const destacadas: { nombre: string; descripcion: string }[] = c.tooltipsAmenities ?? [];
      if (destacadas.length) {
        expect.soft(amenities.map((a) => norm(`${a.nombre} -- ${a.nota}`)).sort(), 'Los tooltips de amenities destacadas tienen que coincidir con la base')
          .toEqual(destacadas.map((a) => norm(`${a.nombre} -- ${a.descripcion}`)).sort());
        const incluye = new Set((cfg.fichaDetalle?.incluye ?? []).map((a: any) => norm(a.nombre)));
        const noIncluye = new Set((cfg.fichaDetalle?.noIncluye ?? []).map((a: any) => norm(a.nombre)));
        for (const a of amenities) {
          const espera = incluye.has(norm(a.nombre)) ? true : noIncluye.has(norm(a.nombre)) ? false : null;
          if (espera !== null) expect.soft(!/^no\b/i.test(a.estado), `La amenity ${a.nombre} tiene que decir "${espera ? 'Incluye' : 'No incluye'}" y dice "${a.estado}"`).toBe(espera);
        }
      }
      if (c.tagRecomendado) {
        const texto = (await card.locator('.trf-badge').first().innerText().catch(() => '')).replace(/[^\p{L} ]/gu, '').trim();
        expect.soft(texto.toUpperCase(), 'El tag tiene que decir exactamente RECOMENDADO').toBe(c.tagRecomendado.toUpperCase());
      }
      if (c.tagsDeServicio) expect.soft(tags.map(norm).sort(), 'La card tiene que mostrar en el pie exactamente los tags asignados al servicio').toEqual((c.tagsDeServicio as string[]).map(norm).sort());
    });
  }

  async function validarProveedores(page: Page, t: TarifarioNuevoPage, card: Locator, cfg: any) {
    const esperado = cfg.proveedoresEsperados;
    if (!cfg.elementos?.proveedores || !esperado?.filas) return;
    await paso(page, 'El modal de Proveedores muestra los datos de la base', async () => {
      const filas = await t.abrirProveedores(card);
      const comoTexto = (f: unknown[]) => f.map((x) => String(x).trim()).join(' | ');
      const enPantalla = filas.map(comoTexto);
      const deLaBase = (esperado.filas as unknown[][]).map(comoTexto);
      await adjuntarTexto('Proveedores: base vs pantalla', `ESPERADO:\n${deLaBase.join(SALTO)}\n\nEN PANTALLA:\n${enPantalla.join(SALTO)}`);
      expect.soft(enPantalla, 'El modal tiene que mostrar los proveedores de la base, en orden').toEqual(deLaBase);
      await t.cerrarDialogo();
    });
  }

  /** La ficha "Ver detalle" de un servicio contra la base. */
  async function validarFichaDetalle(page: Page, t: TarifarioNuevoPage, card: Locator, cfg: any) {
    const ficha = cfg.fichaDetalle;
    await paso(page, 'Abrir el popup Ver Detalle', async () => {
      await t.abrirDetalle(card);
      const solapas = await t.solapasDelDetalle();
      await adjuntarTexto('Solapas de la ficha', `esperadas: ${ficha.solapas.join(', ')}\nen pantalla: ${solapas.join(', ')}`);
      expect.soft(solapas, 'La ficha tiene que mostrar exactamente las solapas de la base').toEqual(ficha.solapas);
      if (cfg.elementos?.copiar) await expect.soft(t.dialogo.getByRole('button', { name: 'Copiar', exact: true }), 'La ficha tiene que ofrecer Copiar').toHaveCount(1);
      if (cfg.elementos?.copiarSolapa) await expect.soft(t.dialogo.getByRole('button', { name: 'Copiar todo', exact: true }), 'La ficha tiene que ofrecer copiar todo').toHaveCount(1);
    });
    await paso(page, 'Incluye / No incluye coincide con la base', async () => {
      await t.abrirSolapaDelDetalle('Incluye / No incluye');
      const { incluye, noIncluye } = await t.amenitiesDelDetalle();
      const comoTexto = (a: { nombre: string; descripcion: string }) => norm(a.descripcion ? `${a.nombre} ${a.descripcion}` : a.nombre);
      await adjuntarTexto('Amenities: base vs pantalla', `INCLUYE esperado: ${ficha.incluye.map(comoTexto).join(' / ')}\nINCLUYE pantalla: ${incluye.join(' / ')}\nNO INCLUYE esperado: ${ficha.noIncluye.map(comoTexto).join(' / ')}\nNO INCLUYE pantalla: ${noIncluye.join(' / ')}`);
      expect.soft(incluye.map(norm), 'INCLUYE tiene que mostrar exactamente los items de la base, con su descripcion').toEqual(ficha.incluye.map(comoTexto));
      expect.soft(noIncluye.map(norm), 'NO INCLUYE tiene que mostrar exactamente los items de la base, con su descripcion').toEqual(ficha.noIncluye.map(comoTexto));
    });
    await paso(page, 'La descripcion coincide con la de la base', async () => {
      const esperadas: string[] | undefined = cfg.detalleEsperado?.Detail;
      if (!esperadas?.length) return;
      await t.abrirSolapaDelDetalle('Descripción');
      const enPantalla = await t.textoDelDetalle();
      await adjuntarTexto('Detalle: base vs pantalla', `ESPERADO:\n${esperadas.join(SALTO)}\n\nEN PANTALLA:\n${enPantalla.slice(0, 4000)}`);
      expect.soft(norm(enPantalla), 'La descripcion de la ficha tiene que coincidir con la base').toBe(norm(esperadas.join(' ')));
    });
    await paso(page, 'La ficha tecnica coincide con la base', async () => {
      await t.abrirSolapaDelDetalle('Ficha técnica');
      const { observaciones, campos } = await t.fichaTecnica();
      const valorDe = (e: string) => campos.find((c) => norm(c.etiqueta).includes(norm(e)))?.valor ?? '';
      await adjuntarTexto('Ficha tecnica: base vs pantalla', `OBSERVACIONES:\n${observaciones.map((o) => `${o.prioritaria ? '*' : '-'} ${o.texto}`).join(SALTO)}\n\nCAMPOS:\n${campos.map((c) => `${c.etiqueta}: ${c.valor}`).join(SALTO)}`);
      if (ficha.observaciones) expect.soft(observaciones.map((o) => `${o.prioritaria ? '*' : '-'} ${norm(o.texto)}`), 'Las observaciones tienen que coincidir con las de la base')
        .toEqual(ficha.observaciones.map((o: any) => `${o.prioritaria ? '*' : '-'} ${norm(o.texto)}`));
      if (ficha.idiomasEnFicha) expect.soft(norm(valorDe('Idiomas')), `El campo Idiomas tiene que ser exactamente "${ficha.idiomasEnFicha}"`).toBe(norm(ficha.idiomasEnFicha));
      if (ficha.puntoDeEncuentro) expect.soft(norm(valorDe('Punto de encuentro')), 'El punto de encuentro tiene que ser exactamente el de la base').toBe(norm(ficha.puntoDeEncuentro));
      if (ficha.dropOff) expect.soft(norm(valorDe('Drop')), 'El drop-off tiene que ser exactamente el de la base').toBe(norm(ficha.dropOff));
      if (ficha.duraciones) expect.soft(valorDe('Duraci').match(/\d{1,2}:\d{2}/g) ?? [], `La duracion tiene que mostrar exactamente ${ficha.duraciones.join(' y ')}`).toEqual(ficha.duraciones);
    });
    if (ficha.mesesConSalida) {
      await paso(page, 'La solapa Salidas coincide con la operatividad de la base', async () => {
        await t.abrirSolapaDelDetalle('Salidas');
        const { modalidades, meses } = await t.salidas();
        await adjuntarTexto('Salidas: base vs pantalla', `meses esperados: ${ficha.mesesConSalida.join(', ')}\nmeses en pantalla: ${meses.join(', ')}\nmodalidades: ${modalidades.join(' | ')}`);
        expect.soft(meses, 'Los meses con salida tienen que coincidir con la operatividad de la base').toEqual(ficha.mesesConSalida);
        const solapasEsperadas = ficha.modalidadesCalendario > 1 ? ficha.modalidadesCalendario : 0;
        expect.soft(modalidades.length > 1 ? modalidades.length : 0, `La base tiene ${ficha.modalidadesCalendario} modalidad(es) con calendario`).toBe(solapasEsperadas);
      });
    }
    if (ficha.politicas) {
      await paso(page, 'Las politicas coinciden con las de la base', async () => {
        await t.abrirSolapaDelDetalle('Políticas');
        const politicas = await t.textoDelDetalle();
        await adjuntarTexto('Politicas: base vs pantalla', `ESPERADO:\n${ficha.politicas}\n\nEN PANTALLA:\n${politicas}`);
        expect.soft(norm(politicas), 'La solapa Politicas tiene que mostrar exactamente el texto de la base').toBe(norm(ficha.politicas));
      });
    }
    if (cfg.elementos?.descargaPdf) {
      await paso(page, 'El boton Descargar PDF baja la ficha', async () => {
        // El portal nuevo abre la ficha para imprimir (Guardar como PDF), igual que las
        // cotizaciones; en el portal actual bajaba el archivo. Se exige que abra la de este servicio.
        const [ventana] = await Promise.all([
          page.context().waitForEvent('page', { timeout: 30_000 }),
          t.dialogo.getByRole('link', { name: 'Descargar PDF' }).click(),
        ]);
        await ventana.waitForLoadState('domcontentloaded');
        await expect(ventana, 'Descargar PDF tiene que abrir la ficha del servicio para imprimir').toHaveURL(new RegExp(`/tariff/services/${cfg.id}/print`));
        await expect(ventana.locator('body'), 'La ficha para imprimir tiene que ser la de este servicio').toContainText(cfg.nombre, { timeout: 60_000 });
        await adjuntarTexto('PDF', `Abre ${ventana.url()}`);
        await ventana.close();
      });
    }
    await t.cerrarDialogo();
  }

  /** "Ver detalle" de paquetes, hoteles y ofertas: titulo y cuerpo contra la base. */
  async function validarModalDetalle(page: Page, t: TarifarioNuevoPage, card: Locator, cfg: any) {
    await paso(page, 'Abrir el modal Ver detalle y validar su contenido', async () => {
      await t.abrirDetalle(card);
      const titulo = await t.tituloDelDialogo();
      await adjuntarTexto('Contenido del modal', (await t.dialogo.innerText()).replace(/\s+/g, ' ').slice(0, 2000));
      expect.soft(norm(titulo), `El titulo del modal tiene que ser "${cfg.modalDetalle.titulo}"`).toBe(norm(cfg.modalDetalle.titulo));
      const detalle: string[] | undefined = cfg.detalleEsperado?.Detail;
      if (detalle?.length) {
        if (await t.dialogo.getByRole('tab', { name: 'Descripción' }).count()) await t.abrirSolapaDelDetalle('Descripción');
        expect.soft(norm(await t.textoDelDetalle()), 'La descripcion del modal tiene que coincidir con la base').toBe(norm(detalle.join(' ')));
      }
      const ficha: string[] | undefined = cfg.detalleEsperado?.TechnicalSheet;
      if (ficha?.length) {
        await t.abrirSolapaDelDetalle('Ficha técnica');
        expect.soft(norm(await t.textoDelDetalle()), 'La ficha tecnica del modal tiene que coincidir con la base').toBe(norm(ficha.join(' ')));
      }
      await t.cerrarDialogo();
    });
  }

  async function validarDescargaWord(page: Page, t: TarifarioNuevoPage, card: Locator, cfg: any) {
    if (!cfg.elementos?.descargaWord) return;
    await paso(page, 'El boton de descarga Word baja el archivo', async () => {
      const descarga = await t.descargarWord(card);
      const ruta = await descarga.path();
      const bytes = ruta ? fs.statSync(ruta).size : 0;
      const firma = ruta ? fs.readFileSync(ruta).subarray(0, 2).toString('latin1') : '';
      await adjuntarTexto('Archivo descargado', `nombre: ${descarga.suggestedFilename()}\nbytes: ${bytes}\nfirma: ${JSON.stringify(firma)}`);
      expect(descarga.suggestedFilename(), 'El archivo descargado tiene que ser un .docx').toMatch(/\.docx$/i);
      expect(bytes, 'El archivo descargado tiene que tener contenido').toBeGreaterThan(0);
      expect(firma, 'El archivo descargado tiene que empezar con PK').toBe('PK');
    });
  }

  const ciudades = async (page: Page, card: Locator, cfg: any, que: string) => {
    await paso(page, `${que} muestra sus dos ciudades`, async () => {
      const texto = await card.innerText();
      for (const c of cfg.ciudades) expect.soft(texto, `Tiene que aparecer la ciudad ${c.nombre}`).toContain(c.nombre);
    });
  };

  test('Paquetes: trae tarifas y muestra el paquete esperado', async ({ page }) => {
    test.setTimeout(600_000);
    const { t, card } = await abrirItem(page, 'paquetes');
    await validarImportes(page, t, card, 'paquetes');
    await validarModalDetalle(page, t, card, T.paquetes);
    await validarDescargaWord(page, t, card, T.paquetes);
    await ciudades(page, card, T.paquetes, 'El paquete');
  });

  test('Excursiones: trae tarifas y muestra la excursion esperada', async ({ page }) => {
    test.setTimeout(600_000);
    const { t, card } = await abrirItem(page, 'excursiones');
    await validarImportes(page, t, card, 'excursiones');
    await validarCard(page, t, card, T.excursiones);
    await validarProveedores(page, t, card, T.excursiones);
    await validarFichaDetalle(page, t, card, T.excursiones);
  });

  test('Hoteles: trae tarifas y muestra el hotel esperado', async ({ page }) => {
    test.setTimeout(600_000);
    const { t, card } = await abrirItem(page, 'hoteles');
    await validarImportes(page, t, card, 'hoteles');
    await validarCard(page, t, card, T.hoteles);
    await validarProveedores(page, t, card, T.hoteles);
    await validarModalDetalle(page, t, card, T.hoteles);
  });

  test('Traslados: trae tarifas y muestra el traslado esperado', async ({ page }) => {
    test.setTimeout(600_000);
    const { t, card } = await abrirItem(page, 'traslados');
    await validarImportes(page, t, card, 'traslados');
    await validarCard(page, t, card, T.traslados);
    await validarProveedores(page, t, card, T.traslados);
    await validarFichaDetalle(page, t, card, T.traslados);
  });

  test('Cena Show: trae tarifas y coinciden con las de la base', async ({ page }) => {
    test.setTimeout(600_000);
    const cfg = T.cenaShow;
    const { t, card } = await abrirItem(page, 'cenaShow');
    await validarImportes(page, t, card, 'cenaShow');
    await paso(page, 'Las tarifas coinciden con las de la base de datos', async () => {
      const leido = await t.markupActivo();
      const markup = leido ?? candidatos._formulaPrecio.markupPorDefecto;
      await adjuntarTexto('Markup aplicado', leido !== null ? `leido de la pantalla: ${leido}` : `no se pudo leer; se usa el documentado: ${markup}`);
      // Precio mostrado = Math.ceil(TotalRate / markup), en la tabla en espanol.
      const esperados = (cfg.tarifasBase as { tipo: string; totalRate: number }[]).map((x) => ({ tipo: x.tipo, base: x.totalRate, esperado: precioMostrado(x.totalRate, markup) }));
      await t.verTarifario(card);
      if ((await t.idiomasDelExplorador()).length) await t.elegirIdiomaDelExplorador('Español');
      const filas = await t.tablaDelExplorador();
      const enPantalla = filas.slice(1).map((f) => ({ tipo: (f[1] ?? '').trim(), precio: importeANumero((f[f.length - 1] ?? '').replace(/[^0-9.,]/g, '')) }));
      await adjuntarTexto('Comparacion base vs pantalla', `markup: ${markup}\n\n${esperados.map((e) => `${e.tipo.padEnd(20)} base ${e.base} -> esperado ${e.esperado}`).join(SALTO)}\n\nen pantalla:\n${enPantalla.map((x) => `${x.tipo.padEnd(20)} ${x.precio}`).join(SALTO)}`);
      for (const e of esperados) {
        expect.soft(enPantalla.some((x) => x.tipo.toLowerCase() === e.tipo.toLowerCase() && x.precio === e.esperado),
          `Tiene que haber una fila "${e.tipo}" con precio ${e.esperado} (base ${e.base})`).toBe(true);
      }
      expect.soft(enPantalla.length, 'La pantalla tiene que mostrar las mismas tarifas que la base').toBe(esperados.length);
      await t.cerrarDialogo();
    });
    await validarCard(page, t, card, cfg);
    await validarProveedores(page, t, card, cfg);
    await validarFichaDetalle(page, t, card, cfg);
  });

  test('Cruceros: trae tarifas y muestra el crucero esperado', async ({ page }) => {
    test.setTimeout(600_000);
    const cfg = T.cruceros;
    const { t, card } = await abrirItem(page, 'cruceros');
    await paso(page, 'Cada cabina del crucero muestra su "Desde" y sus salidas con importes', async () => {
      await t.verTarifario(card);
      const cabinas = t.dialogo.getByRole('button', { name: /^Cabina .* desde USD/ });
      await expect(cabinas, `Tiene que mostrar las ${cfg.cabinas.length} cabinas del crucero`).toHaveCount(cfg.cabinas.length);
      const resumen: string[] = [];
      let salidasEsperadas = -1;
      for (let i = 0; i < cfg.cabinas.length; i++) {
        const boton = cabinas.nth(i);
        const desde = (await boton.innerText()).replace(/\s+/g, ' ').trim();
        expect.soft(desde, `La cabina ${i + 1} tiene que mostrar su precio "Desde" en USD`).toMatch(/desde USD\s*[\d.]+/i);
        await boton.click();
        await page.waitForTimeout(500);
        const filas = await t.tablaDelExplorador();
        const conImporte = filas.slice(1).filter((f) => f.some((c) => Number((c.match(/USD\s*([\d.]+)/)?.[1] ?? '0').replace(/\./g, '')) > 0)).length;
        expect.soft(conImporte, `La cabina ${i + 1} tiene que traer salidas con importes USD positivos`).toBeGreaterThan(0);
        if (salidasEsperadas === -1) salidasEsperadas = conImporte;
        else expect.soft(conImporte, 'Todas las cabinas tienen que tener la misma cantidad de salidas').toBe(salidasEsperadas);
        resumen.push(`${desde}: ${conImporte} salidas con importe`);
      }
      await adjuntarTexto('Precios por cabina del crucero', resumen.join(SALTO));
      await t.cerrarDialogo();
    });
    await paso(page, 'El modal "Ver detalle" del crucero abre con su nombre y descripcion', async () => {
      await t.abrirDetalle(card);
      const nombre = await t.tituloDelDialogo();
      const texto = norm(await t.textoDelDetalle());
      await adjuntarTexto('Detalle del crucero', `${nombre}\n${texto.slice(0, 800)}`);
      expect.soft(nombre, `El modal tiene que abrir con el nombre del crucero (contiene "${cfg.terminoBusqueda}")`).toContain(cfg.terminoBusqueda);
      expect.soft(texto.length, 'El detalle del crucero tiene que traer una descripcion').toBeGreaterThan(20);
      await t.cerrarDialogo();
    });
  });

  test('Ofertas: trae tarifas y muestra la oferta esperada', async ({ page }) => {
    test.setTimeout(600_000);
    const { t, card } = await abrirItem(page, 'ofertas');
    await validarImportes(page, t, card, 'ofertas');
    await validarModalDetalle(page, t, card, T.ofertas);
    await validarDescargaWord(page, t, card, T.ofertas);
    await ciudades(page, card, T.ofertas, 'La oferta');
  });
});
