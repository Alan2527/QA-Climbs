import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { LiquidacionPage } from '../../pages/liquidacion.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { SALTO, reservarServicioYGenerarFile } from './cobranzas-comun';

/**
 * BLOQUE C — Liquidacion del file.
 *
 * No viene de una historia: es parte de lo que el PM no pidio y conviene sumar,
 * para cerrar el recorrido de un file. Lo que se exige sale del propio file que
 * arma la precondicion, no de ningun texto inventado.
 *
 * La regla que vale la pena probar es que **una vez guardada, la liquidacion deja
 * de armarse desde el file** y muestra lo guardado, hasta que alguien la regenera
 * (`Tmpl/FileLiq.aspx.cs:88`).
 *
 * Se entra siempre por el boton "Liquidacion" del file, nunca por URL: ver el
 * comentario de `LiquidacionPage`.
 *
 * No deja rastro: el ultimo Regenerar borra lo guardado, y cambiar el idioma no
 * guarda nada.
 */
test.describe('Cobranzas — liquidacion', () => {

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  test('Liquidacion: se arma desde el file, guarda lo editado y se regenera', async ({ page }) => {
    test.setTimeout(900_000);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const marca = `AUTO-QA MARCA ${sello}`;

    const pre = await reservarServicioYGenerarFile(page, sello);

    /** Lo que el documento tiene que traer del file recien generado. */
    const delFile = [
      pre.fileCode,
      pre.apellidoDelPax.toUpperCase(),
      pre.servicio,
      'PRECIO TOTAL NETO',
    ];

    const exigirArmadoDesdeElFile = async (liq: LiquidacionPage, momento: string) => {
      const texto = await liq.texto();
      await adjuntarTexto(`Documento ${momento}`, texto.slice(0, 3000));
      await conResaltado(liq.pagina, liq.pagina.locator(liq.documento), `Documento ${momento}`, () => {
        for (const dato of delFile) {
          expect(texto.toUpperCase(), `${momento}, la liquidacion tiene que traer "${dato}" del file`)
            .toContain(dato.toUpperCase());
        }
        expect(texto, `${momento}, el total neto tiene que ser la venta del item del file`)
          .toMatch(new RegExp(`PRECIO TOTAL NETO\\s+[A-Z]{3}\\s*${pre.ventaDelItem.valor}(?![\\d])`));
      });
    };

    let liquidacion!: LiquidacionPage;

    await paso(page, 'Abrir la liquidacion con el boton del file', async () => {
      liquidacion = await LiquidacionPage.abrirDesdeElFile(page);
      await exigirArmadoDesdeElFile(liquidacion, 'al abrirla por primera vez');
    });

    await paso(page, 'Agregar una marca al documento y guardarlo', async () => {
      const editor = liquidacion.pagina.locator(liquidacion.documento);
      await editor.click();
      await liquidacion.pagina.keyboard.press('Control+End');
      await liquidacion.pagina.keyboard.type(` ${marca}`);
      await liquidacion.guardar();
      await liquidacion.pagina.close();
    });

    await paso(page, 'Volver a abrirla desde el file: muestra lo guardado, no lo vuelve a armar', async () => {
      liquidacion = await LiquidacionPage.abrirDesdeElFile(page);
      const texto = await liquidacion.texto();
      await adjuntarTexto('Documento al reabrirla', texto.slice(0, 3000));
      await conResaltado(liquidacion.pagina, liquidacion.pagina.locator(liquidacion.documento), 'Marca guardada', () => {
        expect(texto, 'Guardada la liquidacion, al reabrirla tiene que mostrar lo que se guardo')
          .toContain(marca);
      });
    });

    await paso(page, 'Regenerar: el documento se vuelve a armar desde el file y pierde la marca', async () => {
      await liquidacion.regenerar();
      const texto = await liquidacion.texto();
      await conResaltado(liquidacion.pagina, liquidacion.pagina.locator(liquidacion.documento), 'Sin la marca', () => {
        expect(texto, 'Regenerada, la liquidacion no puede conservar lo editado').not.toContain(marca);
      });
      await exigirArmadoDesdeElFile(liquidacion, 'despues de regenerar');
    });

    await paso(page, 'Recorrer los idiomas del documento', async () => {
      // Se adjunta el documento de cada idioma y se exige que se siga armando
      // desde el file. No se exige ninguna traduccion: ninguna historia la define.
      const idiomas = await liquidacion.idiomas();
      await adjuntarTexto('Idiomas que ofrece la liquidacion', idiomas.join(SALTO));
      expect(idiomas.length, 'La liquidacion tiene que ofrecer mas de un idioma').toBeGreaterThan(1);

      for (const idioma of [...idiomas.slice(1), idiomas[0]]) {
        await liquidacion.elegirIdioma(idioma);
        const texto = await liquidacion.texto();
        await adjuntarTexto(`Documento en ${idioma}`, texto.slice(0, 3000));
        expect(texto, `En ${idioma} la liquidacion tiene que seguir trayendo el file`).toContain(pre.fileCode);
      }
    });
  });

});
