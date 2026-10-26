import { test, expect } from '@playwright/test';
import { LiquidacionNuevaPage } from '../../../pages/climbs/liquidacion.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { reservarServicioYGenerarFile, SERVICIO_DE_REGRESION } from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp).
 *
 * El mismo flujo que tests/bloque-c/liquidacion.spec.ts, con el mismo titulo: la
 * liquidacion se arma desde el file, una vez guardada se muestra tal cual hasta que se
 * regenera, y se puede ver en cada idioma. Igual que el test actual, no tilda nada: se
 * abre y se genera como viene. No deja rastro: el ultimo Regenerar borra lo guardado.
 */
test.describe('Cobranzas — liquidacion', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Liquidacion: se arma desde el file, guarda lo editado y se regenera', async ({ page }) => {
    test.setTimeout(900_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));
    const liquidacion = new LiquidacionNuevaPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const marca = `AUTO-QA MARCA ${sello}`;
    const pre = await reservarServicioYGenerarFile(page, sello);

    /** Lo que el documento tiene que traer del file recien generado. */
    const delFile = [pre.fileCode, pre.apellidoDelPax.toUpperCase(), SERVICIO_DE_REGRESION.nombre, 'PRECIO TOTAL NETO'];
    const exigirArmadoDesdeElFile = async (momento: string) => {
      const texto = await liquidacion.texto();
      await adjuntarTexto(`Documento ${momento}`, texto.slice(0, 3000));
      for (const dato of delFile) {
        expect(texto.toUpperCase(), `${momento}, la liquidacion tiene que traer "${dato}" del file`).toContain(dato.toUpperCase());
      }
      expect(texto, `${momento}, el total neto tiene que ser la venta del item del file`)
        .toMatch(new RegExp(`PRECIO TOTAL NETO\\s+[A-Z]{3}\\s*${pre.ventaDelItem.valor}(?![\\d])`));
    };

    await paso(page, 'Abrir la liquidacion con el boton del file', async () => {
      await liquidacion.abrirDesdeElFile(pre.fileId);
      await liquidacion.generarSiHaceFalta();
      await exigirArmadoDesdeElFile('al abrirla por primera vez');
    });

    await paso(page, 'Agregar una marca al documento y guardarlo', async () => {
      await liquidacion.agregarAlFinal(marca);
      await liquidacion.guardar();
      await liquidacion.cerrar();
    });

    await paso(page, 'Volver a abrirla desde el file: muestra lo guardado, no lo vuelve a armar', async () => {
      await liquidacion.abrirDesdeElFile(pre.fileId);
      await liquidacion.generarSiHaceFalta();
      const texto = await liquidacion.texto();
      await adjuntarTexto('Documento al reabrirla', texto.slice(0, 3000));
      expect(texto, 'Guardada la liquidacion, al reabrirla tiene que mostrar lo que se guardo').toContain(marca);
    });

    await paso(page, 'Regenerar: el documento se vuelve a armar desde el file y pierde la marca', async () => {
      await liquidacion.regenerar();
      expect(await liquidacion.texto(), 'Regenerada, la liquidacion no puede conservar lo editado').not.toContain(marca);
      await exigirArmadoDesdeElFile('despues de regenerar');
    });

    await paso(page, 'Recorrer los idiomas del documento', async () => {
      // No se exige ninguna traduccion: ninguna historia la define. Solo que se siga armando desde el file.
      const idiomas = await liquidacion.idiomas();
      await adjuntarTexto('Idiomas que ofrece la liquidacion', idiomas.join('\n'));
      expect(idiomas.length, 'La liquidacion tiene que ofrecer mas de un idioma').toBeGreaterThan(1);
      for (const idioma of [...idiomas.slice(1), idiomas[0]]) {
        await liquidacion.elegirIdioma(idioma);
        const texto = await liquidacion.texto();
        await adjuntarTexto(`Documento en ${idioma}`, texto.slice(0, 3000));
        expect(texto, `En ${idioma} la liquidacion tiene que seguir trayendo el file`).toContain(pre.fileCode);
      }
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });
});
