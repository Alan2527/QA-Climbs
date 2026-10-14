import { test, expect, Page } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, formatearFecha, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { reservarServicioYGenerarFile } from './cobranzas-comun';
import { armarFacturaAprobada, armarFacturaAlCliente } from './cobranzas-armado';

/**
 * BLOQUE C — Bloqueos del file.
 *
 * Un file que ya tiene comprobantes no se puede cancelar: si se pudiera, la factura
 * del proveedor y la carta de cobranza quedarian colgando de un file cancelado. Y el
 * vencimiento del file no puede caer despues del check-in ni en fin de semana.
 * Lo valida `btnSave_Click` (`ManageFile.aspx.cs:1515-1660`):
 * - vencimiento invalido: `alert()` con el motivo y recarga la pagina sin guardar;
 * - estado Cancelado (50) con documentos: aviso "Advertencia" con la lista de
 *   documentos, sin guardar.
 *
 * Sobre un file nuevo con factura de proveedor y carta de cobranza. Despues de cada
 * intento se recarga el file y se exige que no haya cambiado nada. Todos los intentos
 * se rechazan, asi que no escribe nada propio (salvo que el BO deje pasar uno: en ese
 * caso el cambio queda en el file de la corrida, que no usa nadie mas).
 *
 * No se prueba el cambio de cliente: es la misma regla que la cancelacion y se elige
 * con un buscador con autocompletado.
 */
test.describe('Cobranzas — bloqueos del file', () => {
  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  const baseBO = () => process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';
  const ESTADO_CANCELADO = '50';

  const desdeBO = (texto: string) => {
    const [d, m, a] = texto.split('/').map(Number);
    return new Date(a, m - 1, d);
  };
  const diaHabilAntesDe = (d: Date) => {
    const x = new Date(d);
    do { x.setDate(x.getDate() - 1); } while (x.getDay() === 0 || x.getDay() === 6);
    return x;
  };
  const sabadoAntesDe = (d: Date) => {
    const x = new Date(d);
    do { x.setDate(x.getDate() - 1); } while (x.getDay() !== 6);
    return x;
  };

  async function abrirFile(page: Page, fileId: string) {
    await page.goto(`${baseBO()}/booking/files/managefile/${fileId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await esperarFinDeCarga(page);
    await expect(page.locator('#btnSave'), 'El file tiene que abrir con el boton Guardar').toBeVisible({ timeout: 60_000 });
  }

  async function estadoDelFile(page: Page) {
    return {
      estado: await page.locator('#ddFileStatus').inputValue(),
      estadoTexto: (await page.locator('#ddFileStatus option:checked').innerText()).trim(),
      vencimiento: await page.locator('#txtExpirationDateFile').inputValue(),
      checkin: await page.locator('#txtInDate').inputValue(),
    };
  }

  /**
   * El Operador es obligatorio para el tipo de file que genera la reserva
   * (`file.js:168`, tipos 10/40/70) y el file recien generado lo trae vacio: sin el,
   * el formulario no se envia y nunca se llega a las validaciones del servidor. Se
   * elige el primero, como haria una persona.
   */
  async function completarOperador(page: Page) {
    const combo = page.locator('#ddOperatorUser');
    const actual = await combo.inputValue().catch(() => '');
    if (actual && actual !== '0' && actual !== '-1') return;
    const primero = await combo.locator('option').evaluateAll((os) =>
      (os as HTMLOptionElement[]).map((o) => o.value).find((v) => v && v !== '0' && v !== '-1'));
    expect(primero, 'El combo de Operador tiene que ofrecer al menos un operador').toBeTruthy();
    await combo.selectOption(primero!);
  }

  /**
   * Elige el vencimiento **en el calendario** del campo (bootstrap-datepicker): con
   * `fill` se ve en pantalla pero llega vacio al servidor, igual que la fecha del
   * recibo de la orden de pago (`OrdenDePagoPage.elegirFechaDelRecibo`).
   */
  async function elegirVencimiento(page: Page, fecha: string) {
    const [dia, mes, anio] = fecha.split('/').map(Number);
    const campo = page.locator('#txtExpirationDateFile');
    await campo.click();
    const calendario = page.locator('.datepicker').filter({ has: page.locator('.datepicker-days') }).filter({ visible: true }).last();
    await expect(calendario, 'El vencimiento tiene que abrir su calendario').toBeVisible({ timeout: 30_000 });
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
      'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    for (let i = 0; i < 24; i++) {
      const titulo = (await calendario.locator('.datepicker-days .datepicker-switch').first().innerText())
        .replace(/\s+/g, ' ').trim().toUpperCase();
      if (titulo === `${meses[mes - 1]} ${anio}`) break;
      const actual = meses.indexOf(titulo.split(' ')[0]) + 1;
      const anioActual = Number(titulo.split(' ')[1]);
      const adelante = anioActual < anio || (anioActual === anio && actual < mes);
      await calendario.locator(`.datepicker-days th.${adelante ? 'next' : 'prev'}`).first().click();
    }
    await calendario.locator('.datepicker-days td.day:not(.old):not(.new)')
      .filter({ hasText: new RegExp(`^${dia}$`) }).first().click();
    await expect(campo, 'El calendario tiene que dejar el vencimiento elegido').toHaveValue(fecha, { timeout: 30_000 });
    await page.keyboard.press('Escape').catch(() => {});
  }

  /**
   * Carga un vencimiento y guarda: el BO tiene que rechazarlo con un `alert()` que
   * diga `motivo` y recargar el file sin haberlo guardado.
   */
  async function vencimientoRechazado(page: Page, vencimiento: string, motivo: RegExp, original: string) {
    await elegirVencimiento(page, vencimiento);
    await completarOperador(page);
    // Despues del aviso el BO recarga el file solo (`messageRelatedDoc`, file.js:6935):
    // se espera esa recarga en vez de navegar encima de ella.
    let recarga: Promise<unknown> = Promise.resolve();
    const alerta = page.waitForEvent('dialog', { timeout: 120_000 }).then(async (d) => {
      const m = d.message();
      recarga = page.waitForEvent('framenavigated', { predicate: (f) => f === page.mainFrame(), timeout: 120_000 });
      await d.accept();
      return m;
    });
    await page.locator('#btnSave').click();
    const mensaje = await alerta;
    await adjuntarTexto(`Aviso para el vencimiento ${vencimiento}`, mensaje);
    expect(mensaje, `Un vencimiento ${vencimiento} tiene que rechazarse con el motivo`).toMatch(motivo);

    await recarga;
    await page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(page);
    await expect(page.locator('#btnSave'), 'El file tiene que volver a abrir').toBeVisible({ timeout: 120_000 });
    const despues = await estadoDelFile(page);
    await conResaltado(page, page.locator('#txtExpirationDateFile'), 'Vencimiento sin cambiar', () => {
      expect(despues.vencimiento, 'Rechazado, el file tiene que conservar su vencimiento').toBe(original);
    });
  }

  test('Bloqueos: el file con comprobantes no se cancela y el vencimiento invalido se rechaza', async ({ page }) => {
    test.setTimeout(1_800_000);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');

    // --- Un file nuevo con factura de proveedor y carta de cobranza ---
    const base = await reservarServicioYGenerarFile(page, sello);
    await armarFacturaAprobada(page, sello, ahora, base);
    await armarFacturaAlCliente(page, sello, base);

    let antes = { estado: '', estadoTexto: '', vencimiento: '', checkin: '' };

    await paso(page, `Abrir el file ${base.fileCode} y tomar su estado y vencimiento`, async () => {
      await abrirFile(page, base.fileId);
      antes = await estadoDelFile(page);
      await adjuntarTexto('File antes de los intentos', JSON.stringify(antes, null, 1));
      expect(antes.estado, 'El file de la corrida no puede arrancar cancelado').not.toBe(ESTADO_CANCELADO);
      expect(antes.checkin, 'El file tiene que tener check-in').toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    const checkin = () => desdeBO(antes.checkin);

    await paso(page, 'Un vencimiento posterior al check-in se rechaza', async () => {
      const despues = new Date(checkin()); despues.setDate(despues.getDate() + 3);
      while (despues.getDay() === 0 || despues.getDay() === 6) despues.setDate(despues.getDate() + 1);
      await vencimientoRechazado(page, formatearFecha(despues),
        /vencimiento ingresada, es mayor al checkin/i, antes.vencimiento);
    });

    await paso(page, 'Un vencimiento en sabado se rechaza', async () => {
      await vencimientoRechazado(page, formatearFecha(sabadoAntesDe(checkin())),
        /no puede ser S[aá]bado, ni Domingo/i, antes.vencimiento);
    });

    await paso(page, 'Con comprobantes cargados, el file no se puede cancelar', async () => {
      // Un vencimiento valido, por si el que trae el file no lo es: asi el rechazo que
      // se mira es el de la cancelacion y no el del vencimiento.
      await elegirVencimiento(page, formatearFecha(diaHabilAntesDe(checkin())));
      await page.locator('#ddFileStatus').selectOption(ESTADO_CANCELADO);
      await completarOperador(page);
      await page.locator('#btnSave').click();

      const aviso = page.locator('.sweet-alert').filter({ visible: true });
      await expect(aviso, 'Tiene que aparecer el aviso de documentos relacionados').toBeVisible({ timeout: 120_000 });
      const texto = (await aviso.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Aviso al cancelar', texto);
      await conResaltado(page, aviso, 'Aviso de documentos relacionados', () => {
        expect(texto, 'El aviso tiene que decir por que no se puede cancelar')
          .toMatch(/No es posible cancelar el File ni modificar el Cliente/i);
        expect(texto, 'El aviso tiene que listar la carta de cobranza').toMatch(/Carta de cobranza/i);
        expect(texto, 'El aviso tiene que listar la factura del proveedor').toMatch(/Factura de Proveedores/i);
      });
      await aviso.getByRole('button', { name: /Ok/i }).click();
    });

    await paso(page, 'Recargado, el file sigue sin cancelar y con su vencimiento', async () => {
      await abrirFile(page, base.fileId);
      const despues = await estadoDelFile(page);
      await adjuntarTexto('File despues de los intentos', JSON.stringify(despues, null, 1));
      await conResaltado(page, page.locator('#ddFileStatus'), 'Estado del file', () => {
        expect(despues.estado, 'El file no puede haber quedado cancelado').toBe(antes.estado);
        expect(despues.vencimiento, 'El file tiene que conservar su vencimiento').toBe(antes.vencimiento);
      });
    });
  });
});
