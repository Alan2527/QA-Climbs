import { test, expect, Page } from '@playwright/test';
import { BackofficeNuevoPage } from '../../../pages/climbs/backoffice.page';
import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { reservarServicioYGenerarFile, armarFacturaAprobada, armarFacturaAlCliente } from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp). Bloqueos del file.
 *
 * El mismo test que tests/bloque-c/bloqueos-del-file.spec.ts, con el mismo titulo: un file
 * con factura de proveedor y carta de cobranza no se puede cancelar, y el vencimiento de
 * pago no puede caer despues del check-in ni en fin de semana. Despues de cada intento se
 * recarga el file y se exige que no haya cambiado nada.
 *
 * Los avisos de la app nueva dicen lo mismo que los del BO actual con otras palabras: se
 * verifica el sentido del aviso, no la frase.
 */
const desdeFecha = (texto: string) => { const [d, m, a] = texto.split('/').map(Number); return new Date(a, m - 1, d); };
const diaHabilAntesDe = (d: Date) => { const x = new Date(d); do { x.setDate(x.getDate() - 1); } while (x.getDay() === 0 || x.getDay() === 6); return x; };
const sabadoAntesDe = (d: Date) => { const x = new Date(d); do { x.setDate(x.getDate() - 1); } while (x.getDay() !== 6); return x; };

test.describe('Cobranzas — bloqueos del file', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Bloqueos: el file con comprobantes no se cancela y el vencimiento invalido se rechaza', async ({ page }) => {
    test.setTimeout(1_800_000);
    const bo = new BackofficeNuevoPage(page);
    const ficha = () => bo.fichaDelFile;
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');

    const base = await reservarServicioYGenerarFile(page, sello);
    await armarFacturaAprobada(page, sello, ahora, base);
    await armarFacturaAlCliente(page, sello, base);

    const campoVencimiento = () => ficha().getByRole('textbox', { name: 'Vencimiento', exact: true });
    const leer = async () => ({
      estado: await bo.estadoDelFile(),
      vencimiento: await campoVencimiento().inputValue(),
      checkin: await ficha().getByRole('textbox', { name: 'In', exact: true }).inputValue(),
    });
    /**
     * El operador es obligatorio en un file de venta y el recien generado lo trae vacio: sin
     * el, el guardado se rechaza por eso y nunca se llega a lo que se quiere probar. Se elige
     * el primero, como haria una persona.
     */
    const completarOperador = async () => {
      const combo = ficha().getByRole('combobox', { name: 'Operador', exact: true });
      const elegido = await combo.evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.value ?? '');
      if (elegido && !['0', '-1', ''].includes(elegido)) return;
      const primero = await combo.locator('option').evaluateAll((os) => (os as HTMLOptionElement[]).find((o) => o.value && !['0', '-1'].includes(o.value) && !o.disabled)?.value);
      expect(primero, 'El combo de Operador tiene que ofrecer al menos un operador').toBeTruthy();
      await combo.selectOption(primero!);
    };
    const cargarVencimiento = async (fecha: string) => {
      await campoVencimiento().fill(fecha);
      await campoVencimiento().press('Tab');
      await expect(campoVencimiento(), 'El vencimiento tiene que quedar cargado').toHaveValue(fecha);
    };
    const guardar = () => ficha().getByRole('contentinfo').getByRole('button', { name: 'Guardar', exact: true }).click();
    /** Guarda y espera el aviso de rechazo; devuelve su texto. */
    const guardarYEsperarRechazo = async (aviso: RegExp, que: string): Promise<string> => {
      await guardar();
      const cartel = page.getByText(aviso).first();
      await expect(cartel, `${que}: el guardado tiene que rechazarse con aviso`).toBeVisible({ timeout: 60_000 });
      const texto = (await cartel.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto(`Aviso: ${que}`, texto);
      return texto;
    };

    let antes = { estado: '', vencimiento: '', checkin: '' };

    await paso(page, `Abrir el file ${base.fileCode} y tomar su estado y vencimiento`, async () => {
      await bo.abrirFicha(base.fileId);
      antes = await leer();
      await adjuntarTexto('File antes de los intentos', JSON.stringify(antes, null, 1));
      expect(antes.estado, 'El file de la corrida no puede arrancar cancelado').not.toBe('Cancelado');
      expect(antes.checkin, 'El file tiene que tener check-in').toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
    const checkin = () => desdeFecha(antes.checkin);

    const recargarYExigirSinCambios = async (que: string) => {
      await bo.abrirFicha(base.fileId);
      const despues = await leer();
      expect(despues.vencimiento, `${que}: rechazado, el file tiene que conservar su vencimiento`).toBe(antes.vencimiento);
      expect(despues.estado, `${que}: rechazado, el file tiene que conservar su estado`).toBe(antes.estado);
    };

    await paso(page, 'Un vencimiento posterior al check-in se rechaza', async () => {
      const despues = new Date(checkin()); despues.setDate(despues.getDate() + 3);
      while (despues.getDay() === 0 || despues.getDay() === 6) despues.setDate(despues.getDate() + 1);
      await cargarVencimiento(formatearFecha(despues));
      await completarOperador();
      await guardarYEsperarRechazo(/(vencimiento de pago es un d[ií]a h[aá]bil, no posterior al check-?in|mayor al check-?in)/i, `vencimiento ${formatearFecha(despues)}, posterior al check-in`);
      await recargarYExigirSinCambios('Vencimiento posterior al check-in');
    });

    await paso(page, 'Un vencimiento en sabado se rechaza', async () => {
      const sabado = formatearFecha(sabadoAntesDe(checkin()));
      await cargarVencimiento(sabado);
      await completarOperador();
      // Ojo: el campo ya muestra la ayuda fija "Dia habil, antes del check-in...": se exige el
      // aviso del rechazo, no esa ayuda.
      await guardarYEsperarRechazo(/(vencimiento de pago es un d[ií]a h[aá]bil|S[aá]bado, ni Domingo)/i, `vencimiento ${sabado}, sabado`);
      await recargarYExigirSinCambios('Vencimiento en sabado');
    });

    await paso(page, 'Con comprobantes cargados, el file no se puede cancelar', async () => {
      // Un vencimiento valido, por si el que trae el file no lo es: asi el rechazo que se
      // mira es el de la cancelacion y no el del vencimiento.
      await cargarVencimiento(formatearFecha(diaHabilAntesDe(checkin())));
      await bo.fichaDelFile.getByRole('combobox', { name: 'Estado', exact: true }).selectOption({ label: 'Cancelado' });
      await completarOperador();
      // La ficha ya avisa antes de guardar, debajo del Estado ("Tiene facturas o prepagos: no
      // se puede cancelar."): se deja constancia, pero lo que se verifica es el rechazo al guardar.
      const ayuda = ficha().getByText('Tiene facturas o prepagos: no se puede cancelar.');
      await adjuntarTexto('Ayuda debajo del Estado', (await ayuda.count()) ? await ayuda.first().innerText() : '(no la muestra)');
      const texto = await guardarYEsperarRechazo(/(documentos relacionados.*no se puede cancelar|No es posible cancelar)/i, 'cancelar el file con comprobantes');
      expect(texto, 'El aviso tiene que listar la carta de cobranza').toMatch(/Carta de cobranza/i);
      expect(texto, 'El aviso tiene que listar la factura del proveedor').toMatch(/Factura de Proveedores/i);
    });

    await paso(page, 'Recargado, el file sigue sin cancelar y con su vencimiento', async () => {
      await bo.abrirFicha(base.fileId);
      const despues = await leer();
      await adjuntarTexto('File despues de los intentos', JSON.stringify(despues, null, 1));
      expect(despues.estado, 'El file no puede haber quedado cancelado').toBe(antes.estado);
      expect(despues.vencimiento, 'El file tiene que conservar su vencimiento').toBe(antes.vencimiento);
    });
  });
});
