# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: climbs/cobranzas/movimientos-entre-cajas.spec.ts >> Movimientos entre cajas >> Movimiento entre dos cajas de la misma sucursal: sale de una, entra en la otra y cuadra
- Location: tests/climbs/cobranzas/movimientos-entre-cajas.spec.ts:64:7

# Error details

```
Error: Sin monto el aviso tiene que decir que falta Monto & Cotizacion

expect(received).toMatch(expected)

Expected pattern: /Debe completar Monto & Cotizaci.n/
Received string:  "Bad Request"
```

# Page snapshot

```yaml
- generic [ref=f3e3]:
  - navigation "Áreas" [ref=f3e4]:
    - link "Ir al inicio" [ref=f3e5] [cursor=pointer]:
      - /url: /
      - text: A
    - button "Favoritos" [ref=f3e6] [cursor=pointer]
    - button "Cruceros" [ref=f3e10] [cursor=pointer]
    - button "Hotelería" [ref=f3e13] [cursor=pointer]
    - button "Servicios y paquetes" [ref=f3e16] [cursor=pointer]
    - button "Ventas" [ref=f3e19] [cursor=pointer]
    - button "Operaciones" [ref=f3e22] [cursor=pointer]
    - button "Clientes" [ref=f3e25] [cursor=pointer]
    - button "Proveedores" [ref=f3e28] [cursor=pointer]
    - button "Finanzas" [ref=f3e31] [cursor=pointer]
    - button "Ubicación" [ref=f3e34] [cursor=pointer]
    - button "Contenidos" [ref=f3e37] [cursor=pointer]
    - button "Reportes" [ref=f3e40] [cursor=pointer]
    - button "Widget" [ref=f3e43] [cursor=pointer]
    - button "Empresa" [ref=f3e46] [cursor=pointer]
    - button "Configuración" [ref=f3e49] [cursor=pointer]
    - button "Idioma" [ref=f3e53] [cursor=pointer]:
      - generic [ref=f3e56]: es
    - button "Modo oscuro" [ref=f3e57] [cursor=pointer]
  - complementary "Finanzas" [ref=f3e60]:
    - generic [ref=f3e61]:
      - generic [ref=f3e62]:
        - generic [ref=f3e63]: Área
        - text: Finanzas
      - generic [ref=f3e64]:
        - generic [ref=f3e65]:
          - generic [ref=f3e66]: Caja, pagos y cobros
          - generic [ref=f3e67]:
            - link "Caja diaria" [ref=f3e68] [cursor=pointer]:
              - /url: /finance/daily-cash
            - button "Agregar Caja diaria a favoritos" [ref=f3e69] [cursor=pointer]
          - generic [ref=f3e72]:
            - link "Órdenes de pago" [ref=f3e73] [cursor=pointer]:
              - /url: /finance/pay-orders
            - button "Agregar Órdenes de pago a favoritos" [ref=f3e74] [cursor=pointer]
          - generic [ref=f3e77]:
            - link "Órdenes de cobro" [ref=f3e78] [cursor=pointer]:
              - /url: /finance/charge-orders
            - button "Agregar Órdenes de cobro a favoritos" [ref=f3e79] [cursor=pointer]
          - generic [ref=f3e82]:
            - link "Fondeo y cash flow" [ref=f3e83] [cursor=pointer]:
              - /url: /finance/funding
            - button "Agregar Fondeo y cash flow a favoritos" [ref=f3e84] [cursor=pointer]
        - generic [ref=f3e87]:
          - generic [ref=f3e88]: Facturación
          - generic [ref=f3e89]:
            - link "Carta de cobranza" [ref=f3e90] [cursor=pointer]:
              - /url: /finance/invoicing/letters
            - button "Agregar Carta de cobranza a favoritos" [ref=f3e91] [cursor=pointer]
          - generic [ref=f3e94]:
            - link "Comprobantes comerciales" [ref=f3e95] [cursor=pointer]:
              - /url: /finance/invoicing
            - button "Agregar Comprobantes comerciales a favoritos" [ref=f3e96] [cursor=pointer]
          - generic [ref=f3e99]:
            - link "Comprobantes fiscales" [ref=f3e100] [cursor=pointer]:
              - /url: /finance/fiscal
            - button "Agregar Comprobantes fiscales a favoritos" [ref=f3e101] [cursor=pointer]
          - generic [ref=f3e104]:
            - link "Facturas de proveedores" [ref=f3e105] [cursor=pointer]:
              - /url: /finance/supplier-invoices
            - button "Agregar Facturas de proveedores a favoritos" [ref=f3e106] [cursor=pointer]
          - generic [ref=f3e109]:
            - link "Facturas internas" [ref=f3e110] [cursor=pointer]:
              - /url: /finance/internal-invoices
            - button "Agregar Facturas internas a favoritos" [ref=f3e111] [cursor=pointer]
          - generic [ref=f3e114]:
            - link "Facturas de proveedores sin asignar" [ref=f3e115] [cursor=pointer]:
              - /url: /finance/unassigned-invoices
            - button "Agregar Facturas de proveedores sin asignar a favoritos" [ref=f3e116] [cursor=pointer]
          - generic [ref=f3e119]:
            - link "Servicios sin asignar" [ref=f3e120] [cursor=pointer]:
              - /url: /finance/unassigned-items
            - button "Agregar Servicios sin asignar a favoritos" [ref=f3e121] [cursor=pointer]
          - generic [ref=f3e124]:
            - link "Órdenes de pago sin asignar" [ref=f3e125] [cursor=pointer]:
              - /url: /finance/unassigned-pay-orders
            - button "Agregar Órdenes de pago sin asignar a favoritos" [ref=f3e126] [cursor=pointer]
        - generic [ref=f3e129]:
          - generic [ref=f3e130]: Seguimiento y conciliación
          - generic [ref=f3e131]:
            - link "Agenda de pendientes de clientes" [ref=f3e132] [cursor=pointer]:
              - /url: /finance/customer-agenda
            - button "Agregar Agenda de pendientes de clientes a favoritos" [ref=f3e133] [cursor=pointer]
          - generic [ref=f3e136]:
            - link "Cuentas corrientes de clientes" [ref=f3e137] [cursor=pointer]:
              - /url: /finance/customer-accounts
            - button "Agregar Cuentas corrientes de clientes a favoritos" [ref=f3e138] [cursor=pointer]
          - generic [ref=f3e141]:
            - link "Cuentas corrientes de proveedores" [ref=f3e142] [cursor=pointer]:
              - /url: /finance/supplier-accounts
            - button "Agregar Cuentas corrientes de proveedores a favoritos" [ref=f3e143] [cursor=pointer]
          - generic [ref=f3e146]:
            - link "Planilla de prepagos" [ref=f3e147] [cursor=pointer]:
              - /url: /finance/prepaids
            - button "Agregar Planilla de prepagos a favoritos" [ref=f3e148] [cursor=pointer]
        - generic [ref=f3e151]:
          - generic [ref=f3e152]: Reportes
          - generic [ref=f3e153]:
            - link "Reporte para facturación" [ref=f3e154] [cursor=pointer]:
              - /url: /finance/fiscal/billing-report
            - button "Agregar Reporte para facturación a favoritos" [ref=f3e155] [cursor=pointer]
          - generic [ref=f3e158]:
            - link "Saldos por concepto" [ref=f3e159] [cursor=pointer]:
              - /url: /finance/cash-flow-report
            - button "Agregar Saldos por concepto a favoritos" [ref=f3e160] [cursor=pointer]
          - generic [ref=f3e163]:
            - link "Pagos y cobros por referencia" [ref=f3e164] [cursor=pointer]:
              - /url: /finance/payment-ref-report
            - button "Agregar Pagos y cobros por referencia a favoritos" [ref=f3e165] [cursor=pointer]
          - generic [ref=f3e168]:
            - link "Débito fiscal" [ref=f3e169] [cursor=pointer]:
              - /url: /finance/vat-sales
            - button "Agregar Débito fiscal a favoritos" [ref=f3e170] [cursor=pointer]
          - generic [ref=f3e173]:
            - link "Crédito fiscal" [ref=f3e174] [cursor=pointer]:
              - /url: /finance/vat-purchases
            - button "Agregar Crédito fiscal a favoritos" [ref=f3e175] [cursor=pointer]
        - group [ref=f3e178]:
          - generic "Configuración de Finanzas ⌄" [ref=f3e179] [cursor=pointer]
      - generic [ref=f3e180]: Lo marcado como pendiente sigue en el sistema viejo.
  - generic [ref=f3e181]:
    - banner [ref=f3e182]:
      - button "Ocultar panel" [ref=f3e183] [cursor=pointer]
      - generic "Finanzas › Caja, pagos y cobros › Caja diaria" [ref=f3e186]:
        - generic [ref=f3e187]: Finanzas
        - generic [ref=f3e190]: Caja, pagos y cobros
        - generic [ref=f3e193]: Caja diaria
      - button "Buscar o ir a una pantalla" [ref=f3e194] [cursor=pointer]:
        - generic [ref=f3e197]: Buscar o ir a…
        - generic [ref=f3e198]:
          - generic [ref=f3e199]: Ctrl
          - generic [ref=f3e200]: K
      - 'button "Sucursal de trabajo: Argentina" [ref=f3e202] [cursor=pointer]':
        - generic [ref=f3e205]: Argentina
      - button "Ayuda" [ref=f3e208] [cursor=pointer]
      - button "Soporte" [ref=f3e212] [cursor=pointer]
      - button "Mi cuenta" [ref=f3e216] [cursor=pointer]:
        - generic [ref=f3e217]: PO
    - main [ref=f3e218]:
      - generic [ref=f3e220]:
        - heading "Caja diaria · 27/10/2026" [level=1] [ref=f3e221]
        - paragraph [ref=f3e222]: Argentina · 20261026-0XIP
      - generic [ref=f3e223]:
        - generic [ref=f3e224]:
          - heading "Caja diaria" [level=2] [ref=f3e226]
          - generic [ref=f3e227]: Abierto
        - generic [ref=f3e230]:
          - generic [ref=f3e231]:
            - generic [ref=f3e232]: Sucursal
            - textbox "Sucursal" [disabled] [ref=f3e234]: Argentina
          - generic [ref=f3e235]:
            - generic [ref=f3e236]: Fecha
            - textbox "Fecha" [disabled] [ref=f3e238]: 27/10/2026
          - generic [ref=f3e239]:
            - generic [ref=f3e240]: Código
            - textbox "Código" [disabled] [ref=f3e242]: 20261026-0XIP
          - generic [ref=f3e243]:
            - generic [ref=f3e244]: Detalle
            - textbox "Detalle" [disabled] [ref=f3e246]: Caja de regresion automatica 20261027011707. No operar.
      - generic [ref=f3e247]:
        - heading [level=2] [ref=f3e250]:
          - text: Totales
          - 'button "Ayuda: Totales" [ref=f3e251]'
        - generic [ref=f3e254]:
          - button "Medio" [ref=f3e257] [cursor=pointer]: AUTO-QA NO TOCAR - CAJA ARS
          - table [ref=f3e259]:
            - rowgroup [ref=f3e260]:
              - row [ref=f3e261]:
                - columnheader "Moneda" [ref=f3e262]
                - columnheader "Saldo inicial" [ref=f3e263]
                - columnheader "Ingreso" [ref=f3e264]
                - columnheader "Salida" [ref=f3e265]
                - columnheader "Balance" [ref=f3e266]
                - columnheader "Saldo final" [ref=f3e267]
            - rowgroup [ref=f3e268]:
              - row [ref=f3e269]:
                - cell "ARS" [ref=f3e270]
                - cell "0,000" [ref=f3e271]
                - cell "0,000" [ref=f3e272]
                - cell "-567.600,000" [ref=f3e273]
                - cell "-567.600,000" [ref=f3e274]
                - cell "-567.600,000" [ref=f3e275]
      - generic [ref=f3e276]:
        - generic [ref=f3e277]:
          - heading "Movimientos" [level=2] [ref=f3e279]
          - generic [ref=f3e281]:
            - button "Copiar" [ref=f3e282] [cursor=pointer]
            - button "Plantilla" [ref=f3e285] [cursor=pointer]
            - button "Agregar" [ref=f3e288] [cursor=pointer]
        - table [ref=f3e292]:
          - rowgroup [ref=f3e293]:
            - row [ref=f3e294]:
              - columnheader [ref=f3e295]:
                - button "Código" [ref=f3e296] [cursor=pointer]
              - columnheader [ref=f3e297]:
                - button "Fecha" [ref=f3e298] [cursor=pointer]
              - columnheader [ref=f3e299]:
                - button "T" [ref=f3e300] [cursor=pointer]
              - columnheader [ref=f3e301]:
                - button "Moneda" [ref=f3e302] [cursor=pointer]
              - columnheader [ref=f3e303]:
                - button "Monto" [ref=f3e304] [cursor=pointer]
              - columnheader [ref=f3e305]:
                - button "Cotización" [ref=f3e306] [cursor=pointer]
              - columnheader [ref=f3e307]:
                - button "Medio" [ref=f3e308] [cursor=pointer]
              - columnheader [ref=f3e309]:
                - button "Referencia" [ref=f3e310] [cursor=pointer]
              - columnheader [ref=f3e311]:
                - button "Cliente / Prov." [ref=f3e312] [cursor=pointer]
              - columnheader [ref=f3e313]:
                - button "Comentario" [ref=f3e314] [cursor=pointer]
              - columnheader "Acciones" [ref=f3e315]
          - rowgroup [ref=f3e316]:
            - row [ref=f3e317] [cursor=pointer]:
              - cell "OP0000038321" [ref=f3e318]
              - cell "27/10/2026 10:00" [ref=f3e319]
              - cell "P" [ref=f3e320]
              - cell "ARS" [ref=f3e321]
              - cell "-94.600,000" [ref=f3e322]
              - cell "1.500,000" [ref=f3e323]
              - cell "AUTO-QA NO TOCAR - CAJA ARS" [ref=f3e324]
              - cell [ref=f3e325]
              - cell "GRUPO SUMMA SRL" [ref=f3e326]
              - cell "Orden de pago de regresio.." [ref=f3e327]
              - cell [ref=f3e328]
            - row [ref=f3e329] [cursor=pointer]:
              - cell "OP0000038320" [ref=f3e330]
              - cell "27/10/2026 09:58" [ref=f3e331]
              - cell "P" [ref=f3e332]
              - cell "ARS" [ref=f3e333]
              - cell "-94.600,000" [ref=f3e334]
              - cell "1.500,000" [ref=f3e335]
              - cell "AUTO-QA NO TOCAR - CAJA ARS" [ref=f3e336]
              - cell [ref=f3e337]
              - cell "GRUPO SUMMA SRL" [ref=f3e338]
              - cell "Orden de pago de regresio.." [ref=f3e339]
              - cell [ref=f3e340]
            - row [ref=f3e341] [cursor=pointer]:
              - cell "OP0000038319" [ref=f3e342]
              - cell "27/10/2026 09:53" [ref=f3e343]
              - cell "P" [ref=f3e344]
              - cell "ARS" [ref=f3e345]
              - cell "-94.600,000" [ref=f3e346]
              - cell "1.500,000" [ref=f3e347]
              - cell "AUTO-QA NO TOCAR - CAJA ARS" [ref=f3e348]
              - cell [ref=f3e349]
              - cell "GRUPO SUMMA SRL" [ref=f3e350]
              - cell "Orden de pago de regresio.." [ref=f3e351]
              - cell [ref=f3e352]
            - row [ref=f3e353] [cursor=pointer]:
              - cell "OP0000038318" [ref=f3e354]
              - cell "27/10/2026 09:52" [ref=f3e355]
              - cell "P" [ref=f3e356]
              - cell "ARS" [ref=f3e357]
              - cell "-94.600,000" [ref=f3e358]
              - cell "1.500,000" [ref=f3e359]
              - cell "AUTO-QA NO TOCAR - CAJA ARS" [ref=f3e360]
              - cell [ref=f3e361]
              - cell "GRUPO SUMMA SRL" [ref=f3e362]
              - cell "Orden de pago de regresio.." [ref=f3e363]
              - cell [ref=f3e364]
            - row [ref=f3e365] [cursor=pointer]:
              - cell "OP0000038317" [ref=f3e366]
              - cell "27/10/2026 09:51" [ref=f3e367]
              - cell "P" [ref=f3e368]
              - cell "ARS" [ref=f3e369]
              - cell "-94.600,000" [ref=f3e370]
              - cell "1.500,000" [ref=f3e371]
              - cell "AUTO-QA NO TOCAR - CAJA ARS" [ref=f3e372]
              - cell [ref=f3e373]
              - cell "GRUPO SUMMA SRL" [ref=f3e374]
              - cell "Orden de pago de regresio.." [ref=f3e375]
              - cell [ref=f3e376]
            - row [ref=f3e377] [cursor=pointer]:
              - cell "OP0000038314" [ref=f3e378]
              - cell "27/10/2026 09:49" [ref=f3e379]
              - cell "P" [ref=f3e380]
              - cell "ARS" [ref=f3e381]
              - cell "-94.600,000" [ref=f3e382]
              - cell "1.500,000" [ref=f3e383]
              - cell "AUTO-QA NO TOCAR - CAJA ARS" [ref=f3e384]
              - cell [ref=f3e385]
              - cell "GRUPO SUMMA SRL" [ref=f3e386]
              - cell "Orden de pago de regresio.." [ref=f3e387]
              - cell [ref=f3e388]
          - rowgroup [ref=f3e389]:
            - row [ref=f3e390]:
              - cell "Total" [ref=f3e391]
              - cell "-567.600,000" [ref=f3e392]
              - cell [ref=f3e393]
      - generic [ref=f3e395]:
        - button "Volver" [ref=f3e396] [cursor=pointer]
        - button "Pre-cierre" [ref=f3e399] [cursor=pointer]
        - button "Cierre definitivo" [ref=f3e402] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | import { CajaDiariaNuevaPage } from '../../../pages/climbs/caja-diaria.page';
  3   | import { MovimientosNuevaPage, absoluto } from '../../../pages/climbs/movimientos-entre-cajas.page';
  4   | import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos } from '../../../utils/pasos';
  5   | import { cajaDeRegresion } from '../comun/precondiciones';
  6   | 
  7   | /**
  8   |  * CAJA DIARIA — app nueva (ClimbsApp). Movimientos entre cajas.
  9   |  *
  10  |  * Los mismos dos tests que tests/bloque-c/movimientos-entre-cajas.spec.ts, con los mismos
  11  |  * titulos. **Mueve plata entre cajas**: solo usa las cajas AUTO-QA (USD y ARS) y la caja de
  12  |  * la otra sucursal configurada en AMV_MOV_*, y deja todo como estaba (el movimiento se borra
  13  |  * al final, y en el finally si el test corta). Los cuadres se miden como diferencia contra el
  14  |  * estado inicial, porque otros tests dejan ordenes en esas mismas cajas el mismo dia.
  15  |  * No cierra la caja del dia.
  16  |  */
  17  | const CAJA_USD = cajaDeRegresion('USD');
  18  | const CAJA_ARS = cajaDeRegresion('ARS');
  19  | const SUCURSAL = 'Argentina';
  20  | const ALTA = { origen: { texto: '10,00', valor: 10 }, destino: { texto: '15000,00', valor: 15000 } };
  21  | const EDICION = { origen: { texto: '11,00', valor: 11 }, destino: { texto: '16500,00', valor: 16500 } };
  22  | 
  23  | type Totales = { inicial: number; ingreso: number; salida: number; balance: number; final: number };
  24  | const n = (t: string) => Number((t || '0').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  25  | const r2 = (x: number) => Number(x.toFixed(2));
  26  | 
  27  | async function medir(caja: CajaDiariaNuevaPage, nombre: string, moneda: string): Promise<Totales> {
  28  |   await caja.filtrarPorCaja(nombre);
  29  |   const t = await caja.totales(moneda);
  30  |   expect(t, `La caja diaria tiene que mostrar los totales de ${nombre} en ${moneda}`).not.toBeNull();
  31  |   return { inicial: n(t!.inicial), ingreso: n(t!.ingreso), salida: n(t!.salida), balance: n(t!.balance), final: n(t!.final) };
  32  | }
  33  | 
  34  | /** Totales despues = antes + efecto. La salida puede venir con o sin signo: se compara su valor absoluto. */
  35  | async function cuadre(etiqueta: string, antes: Totales, despues: Totales, efecto: { entra?: number; sale?: number }) {
  36  |   const entra = efecto.entra ?? 0;
  37  |   const sale = efecto.sale ?? 0;
  38  |   await adjuntarTexto(`Cuadre de ${etiqueta}`, `antes: ${JSON.stringify(antes)}\ndespues: ${JSON.stringify(despues)}\nefecto: entra ${entra}, sale ${sale}`);
  39  |   expect(r2(despues.ingreso - antes.ingreso), `El ingreso de ${etiqueta} tiene que subir ${entra}`).toBe(r2(entra));
  40  |   expect(r2(Math.abs(despues.salida) - Math.abs(antes.salida)), `La salida de ${etiqueta} tiene que crecer ${sale}`).toBe(r2(sale));
  41  |   expect(r2(despues.inicial), 'El saldo inicial no tiene que moverse: la caja sigue abierta').toBe(r2(antes.inicial));
  42  |   expect(r2(despues.inicial + despues.balance), 'El saldo final tiene que ser el inicial mas el balance').toBe(r2(despues.final));
  43  | }
  44  | 
  45  | /** Limpieza de ultima instancia: si el test corto con el movimiento creado, lo borra desde la caja de origen. */
  46  | async function limpiar(page: Page, caja: CajaDiariaNuevaPage, mov: MovimientosNuevaPage, comentario: string, fecha: string, detalle: string) {
  47  |   try {
  48  |     await caja.abrirCajaDelDia(fecha, SUCURSAL, detalle);
  49  |     const fila = mov.filaEnLaCaja(comentario, CAJA_USD);
  50  |     if (await fila.count()) {
  51  |       await mov.borrar(fila);
  52  |       await adjuntarTexto('Limpieza', `Movimiento "${comentario}" borrado en el finally`);
  53  |     }
  54  |   } catch (error) {
  55  |     await adjuntarTexto('LIMPIEZA PENDIENTE', `No se pudo borrar el movimiento "${comentario}": ${(error as Error).message}. Borrarlo a mano desde la caja del dia de ${SUCURSAL}.`);
  56  |   }
  57  | }
  58  | 
  59  | test.describe('Movimientos entre cajas', () => {
  60  |   // Cada test borra su movimiento en el finally: reintentar no duplica datos.
  61  |   test.describe.configure({ retries: process.env.CI ? 2 : 0 });
  62  |   test.beforeEach(() => reiniciarNumeracionDePasos());
  63  | 
  64  |   test('Movimiento entre dos cajas de la misma sucursal: sale de una, entra en la otra y cuadra', async ({ page }) => {
  65  |     test.setTimeout(900_000);
  66  |     const caja = new CajaDiariaNuevaPage(page);
  67  |     const mov = new MovimientosNuevaPage(page);
  68  |     const ahora = new Date();
  69  |     const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
  70  |     const fechaDeHoy = formatearFecha(ahora);
  71  |     const detalle = `Caja de regresion automatica ${sello}. No operar.`;
  72  |     const comentario = `AUTO-QA ${sello}`;
  73  |     let creado = false;
  74  |     let borrado = false;
  75  |     let antesUSD!: Totales;
  76  |     let antesARS!: Totales;
  77  | 
  78  |     try {
  79  |       await paso(page, 'Abrir la caja del dia y medir las dos cajas AUTO-QA antes de mover nada', async () => {
  80  |         const { id, creada } = await caja.abrirCajaDelDia(fechaDeHoy, SUCURSAL, detalle);
  81  |         await adjuntarTexto('Caja del dia', `id ${id} — ${creada ? 'abierta por el test' : 'ya existia'} — ${fechaDeHoy}`);
  82  |         antesUSD = await medir(caja, CAJA_USD, 'USD');
  83  |         antesARS = await medir(caja, CAJA_ARS, 'ARS');
  84  |         await caja.quitarFiltroDeCaja();
  85  |       });
  86  | 
  87  |       await paso(page, 'Validaciones del formulario: sin monto y con el mismo origen y destino no se guarda nada', async () => {
  88  |         await mov.abrirNuevo();
  89  |         await mov.origen({ moneda: 'USD', caja: CAJA_USD });
  90  |         await mov.comentario(comentario);
  91  |         await mov.destino({ moneda: 'USD', caja: CAJA_USD });
  92  |         await mov.guardarSinEsperar();
  93  |         // En la app nueva (26/10/2026) el servidor rechaza el pedido sin montos con un 400 generico
  94  |         // y la pantalla muestra solo "Bad Request": no se guarda, pero el aviso no dice que falta.
  95  |         // Diferencia con el BO actual: se marca sin cortar.
  96  |         const aviso = page.getByText(/Debe completar Monto & Cotizaci.n|Bad Request/).first();
  97  |         await expect(aviso, 'Sin monto el guardado tiene que rechazarse con un aviso').toBeVisible({ timeout: 30_000 });
  98  |         const textoDelAviso = (await aviso.innerText()).trim();
  99  |         await adjuntarTexto('Aviso sin monto', textoDelAviso);
> 100 |         expect.soft(textoDelAviso, 'Sin monto el aviso tiene que decir que falta Monto & Cotizacion').toMatch(/Debe completar Monto & Cotizaci.n/);
      |                                                                                                       ^ Error: Sin monto el aviso tiene que decir que falta Monto & Cotizacion
  101 |         await mov.campo('amount').fill(ALTA.origen.texto);
  102 |         await mov.campo('damount').fill(ALTA.origen.texto);
  103 |         await mov.asegurarCotizacion();
  104 |         await mov.guardarSinEsperar();
  105 |         await expect(page.getByText('Origen & Destino no pueden ser los mismos').first(), 'Con la misma caja de origen y destino tiene que rechazar el movimiento').toBeVisible({ timeout: 30_000 });
  106 |         await expect(mov.formulario, 'Un rechazo no tiene que cerrar el formulario').toBeVisible();
  107 |         await expect(mov.filas(comentario), 'Un rechazo no tiene que dejar filas en la caja').toHaveCount(0);
  108 |       });
  109 | 
  110 |       await paso(page, 'Guardar el movimiento de USD a ARS entre las dos cajas AUTO-QA', async () => {
  111 |         await mov.destino({ moneda: 'ARS', caja: CAJA_ARS, monto: ALTA.destino.texto });
  112 |         await mov.campo('amount').fill(ALTA.origen.texto);
  113 |         await adjuntarTexto('Cotizacion', await mov.asegurarCotizacion());
  114 |         await mov.guardar();
  115 |         creado = true;
  116 |       });
  117 | 
  118 |       await paso(page, 'Verificar las dos filas del movimiento y lo que permite cada una', async () => {
  119 |         await page.reload();
  120 |         const filas = mov.filas(comentario);
  121 |         await expect(filas, 'Un movimiento entre cajas de la misma sucursal tiene que verse como dos filas').toHaveCount(2, { timeout: 30_000 });
  122 |         await adjuntarTexto('Filas del movimiento', (await filas.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join('\n'));
  123 |         const origen = mov.filaEnLaCaja(comentario, CAJA_USD);
  124 |         const destino = mov.filaEnLaCaja(comentario, CAJA_ARS);
  125 |         await expect(origen, `La salida tiene que estar en ${CAJA_USD}`).toBeVisible();
  126 |         await expect(destino, `La entrada tiene que estar en ${CAJA_ARS}`).toBeVisible();
  127 |         expect(await mov.celda(destino, 'Código'), 'Las dos filas tienen que llevar el mismo codigo').toBe(await mov.celda(origen, 'Código'));
  128 |         expect((await mov.celda(origen, 'T')).toUpperCase(), 'El tipo tiene que ser Movimiento ("M")').toBe('M');
  129 |         expect(await mov.celda(origen, 'Moneda'), 'La salida tiene que estar en USD').toContain('USD');
  130 |         expect(absoluto(await mov.celda(origen, 'Monto')), 'El monto de la salida tiene que ser el de origen').toBe(ALTA.origen.valor);
  131 |         expect(n(await mov.celda(origen, 'Cotización')), 'La cotizacion tiene que ser mayor que cero').toBeGreaterThan(0);
  132 |         expect(await mov.celda(origen, 'Fecha'), 'La fecha tiene que ser la de hoy').toContain(fechaDeHoy);
  133 |         expect((await mov.celda(destino, 'T')).toUpperCase(), 'El tipo de la entrada tiene que ser Movimiento ("M")').toBe('M');
  134 |         expect(await mov.celda(destino, 'Moneda'), 'La entrada tiene que estar en ARS').toContain('ARS');
  135 |         expect(absoluto(await mov.celda(destino, 'Monto')), 'El monto de la entrada tiene que ser el de destino').toBe(ALTA.destino.valor);
  136 |         const aO = await mov.acciones(origen);
  137 |         const aD = await mov.acciones(destino);
  138 |         await adjuntarTexto('Acciones por fila', `origen: ${JSON.stringify(aO)}\ndestino: ${JSON.stringify(aD)}`);
  139 |         expect(aO, 'La salida se puede copiar, editar y borrar').toMatchObject({ copiar: true, editar: true, borrar: true });
  140 |         expect(aD, 'La entrada no se edita ni se borra: se modifica desde el origen').toMatchObject({ copiar: false, editar: false, borrar: false });
  141 |       });
  142 | 
  143 |       await paso(page, 'Verificar el cuadre: la salida baja la caja USD y la entrada sube la caja ARS', async () => {
  144 |         await cuadre(CAJA_USD, antesUSD, await medir(caja, CAJA_USD, 'USD'), { sale: ALTA.origen.valor });
  145 |         await cuadre(CAJA_ARS, antesARS, await medir(caja, CAJA_ARS, 'ARS'), { entra: ALTA.destino.valor });
  146 |         await caja.quitarFiltroDeCaja();
  147 |       });
  148 | 
  149 |       await paso(page, 'Copiar: el movimiento de la misma sucursal se puede copiar y muestra origen y destino', async () => {
  150 |         await mov.abrirCopiar();
  151 |         const fila = mov.filaDeCopiar(comentario);
  152 |         await expect(fila, 'Copiar tiene que listar el movimiento de hoy').toBeVisible({ timeout: 30_000 });
  153 |         const texto = (await fila.innerText()).replace(/\s+/g, ' ').toUpperCase();
  154 |         await adjuntarTexto('Fila de Copiar', texto);
  155 |         await expect(fila.getByRole('checkbox'), 'Un movimiento dentro de la misma sucursal tiene que poder copiarse').toHaveCount(1);
  156 |         expect(texto, 'El Medio tiene que mostrar la caja de origen').toContain(CAJA_USD.toUpperCase());
  157 |         expect(texto, 'El Medio tiene que mostrar la caja de destino').toContain(CAJA_ARS.toUpperCase());
  158 |         // Solo se mira: copiar crearia otro movimiento.
  159 |         await mov.cerrarCopiar();
  160 |       });
  161 | 
  162 |       await paso(page, 'Editar el origen: el formulario trae los dos lados y al guardar se actualizan los dos', async () => {
  163 |         await mov.editar(mov.filaEnLaCaja(comentario, CAJA_USD));
  164 |         expect(await mov.elegido('cashflow'), 'El Medio de origen tiene que ser el guardado').toBe(CAJA_USD);
  165 |         expect(await mov.elegido('dcashflow'), 'El Medio de destino tiene que ser el guardado').toBe(CAJA_ARS);
  166 |         expect(n(await mov.campo('amount').inputValue()), 'Monto de origen').toBe(ALTA.origen.valor);
  167 |         expect(n(await mov.campo('damount').inputValue()), 'Monto de destino').toBe(ALTA.destino.valor);
  168 |         await expect(mov.campo('type'), 'El tipo no se cambia al editar').toBeDisabled();
  169 |         await mov.campo('amount').fill(EDICION.origen.texto);
  170 |         await mov.campo('damount').fill(EDICION.destino.texto);
  171 |         await mov.guardar();
  172 |         await page.reload();
  173 |         await expect(mov.filas(comentario), 'Editar no tiene que duplicar el movimiento').toHaveCount(2, { timeout: 30_000 });
  174 |         expect(absoluto(await mov.celda(mov.filaEnLaCaja(comentario, CAJA_USD), 'Monto')), 'La salida tiene que mostrar el monto nuevo').toBe(EDICION.origen.valor);
  175 |         expect(absoluto(await mov.celda(mov.filaEnLaCaja(comentario, CAJA_ARS), 'Monto')), 'La entrada tiene que mostrar el monto nuevo').toBe(EDICION.destino.valor);
  176 |         await cuadre(`${CAJA_USD} tras editar`, antesUSD, await medir(caja, CAJA_USD, 'USD'), { sale: EDICION.origen.valor });
  177 |         await cuadre(`${CAJA_ARS} tras editar`, antesARS, await medir(caja, CAJA_ARS, 'ARS'), { entra: EDICION.destino.valor });
  178 |         await caja.quitarFiltroDeCaja();
  179 |       });
  180 | 
  181 |       await paso(page, 'Borrar el movimiento desde el origen: desaparecen las dos filas y las cajas vuelven a su cuadre', async () => {
  182 |         await mov.borrar(mov.filaEnLaCaja(comentario, CAJA_USD));
  183 |         borrado = true;
  184 |         await page.reload();
  185 |         await expect(mov.filas(comentario), 'Borrar el origen tiene que borrar tambien la entrada').toHaveCount(0, { timeout: 30_000 });
  186 |         await cuadre(`${CAJA_USD} tras borrar`, antesUSD, await medir(caja, CAJA_USD, 'USD'), {});
  187 |         await cuadre(`${CAJA_ARS} tras borrar`, antesARS, await medir(caja, CAJA_ARS, 'ARS'), {});
  188 |       });
  189 |     } finally {
  190 |       if (creado && !borrado) await limpiar(page, caja, mov, comentario, fechaDeHoy, detalle);
  191 |     }
  192 |   });
  193 | 
  194 |   test('Movimiento entre sucursales: la entrada vive en la caja destino, se ve en solo lectura y no se copia', async ({ page }) => {
  195 |     test.setTimeout(900_000);
  196 |     const sucursalDestino = process.env.AMV_MOV_SUCURSAL_DESTINO ?? '';
  197 |     const cajaDestino = process.env.AMV_MOV_CAJA_DESTINO ?? '';
  198 |     const monedaDestino = process.env.AMV_MOV_MONEDA_DESTINO ?? '';
  199 |     test.skip(!sucursalDestino || !cajaDestino || !monedaDestino,
  200 |       'Faltan AMV_MOV_SUCURSAL_DESTINO, AMV_MOV_CAJA_DESTINO y AMV_MOV_MONEDA_DESTINO: sin una caja de otra sucursal no hay movimiento entre sucursales que probar.');
```