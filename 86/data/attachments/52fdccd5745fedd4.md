# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-b/reservas-circuitos.spec.ts >> Reservas >> Oferta: la reserva emitida conserva los datos en el BackOffice
- Location: tests/bloque-b/reservas-circuitos.spec.ts:30:7

# Error details

```
Error: El armado tiene que quedar con la fecha de inicio elegida

expect(locator).toHaveValue(expected) failed

Locator:  locator('[id$=\'txtAllCheckin\']')
Expected: "02/10/2026"
Received: "02/09/2026"
Timeout:  30000ms

Call log:
  - El armado tiene que quedar con la fecha de inicio elegida with timeout 30000ms
  - waiting for locator('[id$=\'txtAllCheckin\']')
    62 × locator resolved to <input type="text" value="25/09/2026" data-date-format="dd/mm/yyyy" id="ctl00_cphMain_txtAllCheckin" name="ctl00$cphMain$txtAllCheckin" class="form-control date-picker backColor img-dpicker-init coustomtour-form-date"/>
       - unexpected value "02/09/2026"

```

```yaml
- textbox: 02/09/2026
```

# Test source

```ts
  539 |       for (const donde of claves) {
  540 |         const i = importes[donde];
  541 |         await conResaltado(page, page.locator('body'), `Importe en ${donde}`, () => {
  542 |           expect(i?.valor, `El importe en ${donde} tiene que ser ${porque}`).toBe(esperado);
  543 |         });
  544 |       }
  545 |     };
  546 | 
  547 |     if (itemUnico) {
  548 |       // Con un solo item reservado la cadena se parte en dos, porque el
  549 |       // sistema maneja dos numeros distintos y los dos tienen que conservarse.
  550 |       //
  551 |       // A) El total de venta que vio la persona.
  552 |       await exigir(['carrito (total del item)', 'detalle (V. Markup del item)'],
  553 |         referencia.valor, 'el total que mostro el portal');
  554 | 
  555 |       // B) El historial, la bandeja y el file no llevan ese total sino el
  556 |       //    costo neto. No es una transformacion: son dos campos distintos de
  557 |       //    la reserva. WholesalerBookItem.TotalRate es el precio de venta (19)
  558 |       //    y NetTotalCost el neto (9,50 -> 10). Para las reservas posteriores
  559 |       //    al 20/10/2025 LoadWholesalerData se queda con NetTotalCost — el
  560 |       //    codigo lo firma como "HU 2839" — y ese llega al BO_FileItem.
  561 |       //    Se exige que coincidan con la columna Venta del detalle, que es ese
  562 |       //    mismo neto: asi se detecta una regresion sin dar por buena una
  563 |       //    regla de negocio que no esta escrita en ninguna historia.
  564 |       const neto = importes['detalle (Venta del item)'];
  565 |       await exigir(['historial (total)', 'bandeja (columna V)',
  566 |                     'file (Venta del item)', 'file (Venta en Totales)'],
  567 |         neto?.valor, 'el neto que muestra el detalle');
  568 | 
  569 |       await adjuntarTexto('Nota sobre el neto y el total de venta',
  570 |         [`Total de venta que vio la persona: ${referencia.moneda} ${referencia.valor}`,
  571 |          '  (WholesalerBookItem.TotalRate, y la columna V. Markup del detalle)',
  572 |          `Neto que llevan el historial, la bandeja y el file: ${neto?.moneda} ${neto?.valor}`,
  573 |          '  (WholesalerBookItem.NetTotalCost redondeado hacia arriba)',
  574 |          '',
  575 |          'El precio de venta no queda guardado en el file: se calcula al vuelo solo',
  576 |          'para mostrarlo en el detalle. Y el file toma su markup del Market de la',
  577 |          'agencia, no de la reserva, asi que tampoco se puede recomponer desde ahi.',
  578 |          'Queda como consulta para producto: es una decision de negocio.'].join(SALTO));
  579 |     } else {
  580 |       // Con varios items reservados —una oferta o un multidestino— la
  581 |       // comparacion por item no significa nada: la columna Venta de una fila
  582 |       // es la de ese producto, no la del viaje. Lo que tiene que conservarse
  583 |       // es el total, y ahi la cadena es una sola: el numero que mostro el
  584 |       // itinerario llega igual al historial, a la bandeja y a los totales del
  585 |       // file. Los importes por item se adjuntan al reporte igual.
  586 |       await exigir(['historial (total)', 'bandeja (columna V)', 'file (Venta en Totales)'],
  587 |         referencia.valor, 'el total que mostro el itinerario');
  588 | 
  589 |       await conResaltado(page, page.locator('body'), 'Suma de los items del file', () => {
  590 |         expect(sumaDeLosItems,
  591 |           'La suma de las ventas de los items tiene que dar el total del file')
  592 |           .toBe(importes['file (Venta en Totales)']?.valor);
  593 |       });
  594 |     }
  595 |   });
  596 | }
  597 | 
  598 | /**
  599 |  * Recorrido del portal por el riel de CustomTours, del buscador a la emision.
  600 |  *
  601 |  * Lo comparten la oferta y el multidestino: cambia la solapa de INICIO, la
  602 |  * ciudad y el combo donde se elige el viaje, no lo que hay que hacer despues.
  603 |  * Devuelve el codigo BOxxxxxxxx de la reserva emitida.
  604 |  */
  605 | export async function armarCircuitoYEmitir(opciones: {
  606 |   page: Page; inicio: InicioPage; ct: CustomToursPage; carrito: CarritoCustomToursPage;
  607 |   viaje: { solapa: 'ofertas' | 'multidestino'; ciudad: string; id: string; combo: string };
  608 |   reserva: {
  609 |     cantidadPax: number; dobles: number; fecha: string; fechaDeSalida: string;
  610 |     referencia: string; observaciones: string; detalleDelItem: string;
  611 |     items: string[]; importePorItem: Record<string, string>; pasajeros: Pasajero[];
  612 |   };
  613 |   fecha: Date;
  614 |   sello: string;
  615 |   importes: Record<string, { moneda: string; valor: number | null }>;
  616 |   capturarDelPortal: (donde: string, texto: string) => { moneda: string; valor: number | null };
  617 | }): Promise<string> {
  618 |   const { page, inicio, ct, carrito, viaje, reserva, fecha, sello, importes, capturarDelPortal } = opciones;
  619 |   let codigo = '';
  620 |   await paso(page, `Abrir la solapa ${viaje.solapa.toUpperCase()} de INICIO y elegir el viaje`, async () => {
  621 |     const panel = await inicio.abrirSolapa(viaje.solapa);
  622 |     await expect(panel).toBeVisible();
  623 |     await ct.buscarViaje(panel, {
  624 |       pais: 'Argentina', ciudad: viaje.ciudad, id: viaje.id, combo: viaje.combo,
  625 |     });
  626 |     // Eligiendo una oferta concreta se entra directo al armado; con "Todos"
  627 |     // se iria al listado.
  628 |     await expect(page).toHaveURL(new RegExp(`tour=${viaje.id}`));
  629 |   });
  630 | 
  631 |   await paso(page, 'Cargar la fecha de inicio, los pax y las habitaciones', async () => {
  632 |     await ct.configurarViaje(fecha, reserva.cantidadPax, reserva.dobles);
  633 | 
  634 |     // El calendario de esta pantalla es otro widget que el de los demas
  635 |     // flujos: si no tomo la fecha, el viaje se arma para otro dia.
  636 |     await expect(
  637 |       page.locator(ct.campoFecha),
  638 |       'El armado tiene que quedar con la fecha de inicio elegida',
> 639 |     ).toHaveValue(reserva.fecha);
      |       ^ Error: El armado tiene que quedar con la fecha de inicio elegida
  640 |     await expect(page.locator(ct.comboPax)).toHaveValue(String(reserva.cantidadPax));
  641 | 
  642 |     // La salida del primer destino sale de las noches que define la oferta, no
  643 |     // de un numero fijo en el test.
  644 |     const noches = await ct.nochesDelDestino(0);
  645 |     const salida = new Date(fecha);
  646 |     salida.setDate(salida.getDate() + noches);
  647 |     reserva.fechaDeSalida = formatearFecha(salida);
  648 |     await adjuntarTexto('Noches del primer destino y fecha de salida',
  649 |       noches + ' noches -> ' + reserva.fechaDeSalida);
  650 |   });
  651 | 
  652 |   await paso(page, 'Revisar el itinerario y tomar su total', async () => {
  653 |     await ct.irAlItinerario();
  654 | 
  655 |     const celdas = await ct.filaDeTotales();
  656 |     await adjuntarTexto('Fila de totales del itinerario',
  657 |       `Hotel | SGL | DBL | TPL | Servicios | Total => ${celdas.join(' | ')}`);
  658 | 
  659 |     const fila = ct.tablaDeTotales();
  660 |     await conResaltado(page, fila, 'Hotel del paquete en el itinerario', () => {
  661 |       expect(celdas.join(' | '), 'El itinerario tiene que armarse con el hotel del paquete')
  662 |         .toContain('Park Hyatt');
  663 |     });
  664 | 
  665 |     // El total es la ultima celda con importe. Se verifica ademas que sea la
  666 |     // suma de la habitacion mas los servicios, que es lo que la propia fila
  667 |     // muestra: asi no se reimplementa ningun calculo, se comprueba el de ella.
  668 |     const conImporte = celdas.filter((c) => /[A-Z]{3}\s*\d[\d.,]*/.test(c));
  669 |     capturarDelPortal('itinerario (total)', conImporte.at(-1) ?? '');
  670 |     const habitacion = importeDelPortal(conImporte.at(-3) ?? '').valor;
  671 |     const servicios = importeDelPortal(conImporte.at(-2) ?? '').valor;
  672 | 
  673 |     await conResaltado(page, fila, 'Total del itinerario', () => {
  674 |       expect(importes['itinerario (total)'].valor,
  675 |         'El total del itinerario tiene que ser la habitacion mas los servicios')
  676 |         .toBe((habitacion ?? 0) + (servicios ?? 0));
  677 |     });
  678 |   });
  679 | 
  680 |   await paso(page, 'Continuar al carrito y revisar que conserve el total', async () => {
  681 |     await ct.continuarAlCarrito();
  682 | 
  683 |     const delCarrito = await carrito.importes();
  684 |     await adjuntarTexto('Importes del carrito de circuitos', delCarrito.join(' | '));
  685 | 
  686 |     // Importe de cada item, para exigirselo despues al BO uno por uno.
  687 |     reserva.importePorItem = await carrito.importePorItem(reserva.items);
  688 |     await adjuntarTexto('Importe de cada item en el carrito',
  689 |       Object.entries(reserva.importePorItem).map(([k, v]) => k + ": " + v).join(SALTO));
  690 |     for (const [item, valor] of Object.entries(reserva.importePorItem)) {
  691 |       expect(valor, "El carrito tiene que mostrar el importe del item " + item).not.toBe("");
  692 |     }
  693 |     // Del resumen de la reserva, no del ultimo importe de la pantalla: ver
  694 |     // `CarritoCustomToursPage.total()`.
  695 |     capturarDelPortal('carrito (total del item)', await carrito.total());
  696 | 
  697 |     await conResaltado(page, page.locator('body'), 'Total del carrito', () => {
  698 |       expect(importes['carrito (total del item)'].valor,
  699 |         'El carrito tiene que conservar el total que mostro el itinerario')
  700 |         .toBe(importes['itinerario (total)'].valor);
  701 |     });
  702 | 
  703 |     reserva.pasajeros = Array.from({ length: reserva.cantidadPax }, (_, i) => ({
  704 |       nombre: `Pasajero${['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho'][i] ?? 'Extra'}`,
  705 |       apellido: `Regresion${selloEnLetras(sello.slice(-6))}`,
  706 |       pasaporte: `QA${sello.slice(-8)}${i + 1}`,
  707 |       nacimiento: `0${i + 1}/03/1990`,
  708 |       nacionalidad: 'Argentina',
  709 |     }));
  710 |     await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
  711 |   });
  712 | 
  713 |   await paso(page, 'Cargar los pasajeros y emitir la reserva', async () => {
  714 |     await carrito.asegurarPasajeros(reserva.cantidadPax);
  715 |     for (const [i, pax] of reserva.pasajeros.entries()) await carrito.completarPasajero(i, pax);
  716 |     await carrito.completarComentarioDelItem(reserva.detalleDelItem);
  717 |     await carrito.completarDatosDeLaReserva(reserva.referencia, reserva.observaciones);
  718 |     await carrito.aceptarTerminos();
  719 | 
  720 |     codigo = await carrito.confirmarReserva();
  721 |     await adjuntarTexto('Codigo de la reserva emitida', codigo);
  722 |     expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
  723 |       .toMatch(/^BO\d{8}$/);
  724 | 
  725 |     const filaHistorial = page.locator('tr').filter({ hasText: codigo }).first();
  726 |     const deLaFila = ((await filaHistorial.innerText()).match(/[A-Z]{3}\s*\d[\d.,]*/g) ?? []);
  727 |     capturarDelPortal('historial (total)', deLaFila.at(-1) ?? '');
  728 |     await adjuntarTexto('Importes de la fila del historial', deLaFila.join(' | '));
  729 |   });
  730 |   return codigo;
  731 | }
  732 | 
```