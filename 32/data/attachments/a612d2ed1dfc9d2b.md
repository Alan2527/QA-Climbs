# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-b/anulacion.spec.ts >> Reservas — anulacion >> Hotel: una reserva emitida se puede cancelar y el portal lo refleja
- Location: tests/bloque-b/anulacion.spec.ts:283:7

# Error details

```
Error: El calendario tiene que quedar con las fechas elegidas

expect(locator).toHaveValue(expected) failed

Locator:  locator('#txtCalendar')
Expected: "07/10/2026 - 08/10/2026"
Received: "07/09/2026 - 08/09/2026"
Timeout:  30000ms

Call log:
  - El calendario tiene que quedar con las fechas elegidas with timeout 30000ms
  - waiting for locator('#txtCalendar')
    64 × locator resolved to <input type="text" id="txtCalendar"/>
       - unexpected value "07/09/2026 - 08/09/2026"

```

```yaml
- textbox: 07/09/2026 - 08/09/2026
```

# Test source

```ts
  220 | 
  221 |   test('Servicio: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
  222 |     test.setTimeout(600_000);
  223 | 
  224 |     const inicio = new InicioPage(page);
  225 |     const servicio = new ServicioPage(page);
  226 |     const carrito = new CarritoPage(page);
  227 | 
  228 |     const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  229 |     const fecha = fechaDeBusqueda(30);
  230 |     const referencia = `AUTO-QA ${sello}`;
  231 |     const datos = {
  232 |       servicio: 'AUTO-QA NO TOCAR - Tigre y Delta',
  233 |       terminoDeBusqueda: 'Tigre y Delta',
  234 |       modalidad: 'Regular',
  235 |       fecha: formatearFecha(fecha),
  236 |       observaciones: `Anulacion de regresion automatica ${sello}. No operar.`,
  237 |       cantidadPax: 0,
  238 |     };
  239 | 
  240 |     let codigo = '';
  241 |     await paso(page, 'Reservar un servicio y emitirlo', async () => {
  242 |       await carrito.vaciar();
  243 |       await inicio.abrir();
  244 |       const panel = await inicio.abrirSolapa('servicios');
  245 |       await servicio.buscar({
  246 |         panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha,
  247 |       });
  248 |       await servicio.buscarPorNombre(datos.terminoDeBusqueda, datos.servicio);
  249 |       await servicio.abrirFicha(datos.servicio.slice(0, 24));
  250 | 
  251 |       const fila = page.locator('tr')
  252 |         .filter({ has: page.locator("select[id*='ddPax']") })
  253 |         .filter({ hasText: datos.modalidad }).first();
  254 |       await expect(
  255 |         fila,
  256 |         `La ficha tiene que ofrecer la modalidad ${datos.modalidad} para el ${datos.fecha}`,
  257 |       ).toBeVisible({ timeout: 30_000 });
  258 | 
  259 |       const texto = (await fila.innerText()).replace(/\s+/g, ' ');
  260 |       datos.cantidadPax = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
  261 |       await fila.locator("select[id*='ddPax']").selectOption(String(datos.cantidadPax));
  262 |       await esperarFinDeCarga(page);
  263 |       await page.locator("[id$='lnkBookService']").first().click();
  264 |       await esperarFinDeCarga(page);
  265 | 
  266 |       await carrito.irAlCarrito();
  267 |       await carrito.crearReserva(referencia, datos.observaciones);
  268 |       await carrito.asegurarPasajeros(datos.cantidadPax);
  269 |       const pasajeros = pasajerosDe(datos.cantidadPax, sello);
  270 |       for (const [i, pax] of pasajeros.entries()) await carrito.completarPasajero(i, pax);
  271 |       await carrito.completarDatosDeLaReserva(datos.cantidadPax, referencia, datos.observaciones);
  272 |       await carrito.aceptarTerminos();
  273 | 
  274 |       codigo = await carrito.confirmarReserva();
  275 |       expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
  276 |         .toMatch(/^BO\d{8}$/);
  277 |       await adjuntarTexto('Reserva emitida para anular', codigo);
  278 |     });
  279 | 
  280 |     await cancelarYVerificar(page, { codigo, solapa: '#tabBooking', referencia });
  281 |   });
  282 | 
  283 |   test('Hotel: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
  284 |     test.setTimeout(600_000);
  285 | 
  286 |     const inicio = new InicioPage(page);
  287 |     const hotel = new HotelPage(page);
  288 |     const carrito = new CarritoPage(page);
  289 | 
  290 |     const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  291 |     // A 30 dias, por lo mismo que el servicio: el riel clasico pone el limite de
  292 |     // cancelacion en la fecha del servicio menos 15 dias.
  293 |     const entrada = fechaDeBusqueda(30);
  294 |     const salida = new Date(entrada);
  295 |     salida.setDate(salida.getDate() + 1);
  296 | 
  297 |     const referencia = `AUTO-QA ${sello}`;
  298 |     const datos = {
  299 |       hotelId: 5003,
  300 |       habitacion: 9193,
  301 |       habitaciones: 1,
  302 |       adultos: 2,
  303 |       observaciones: `Anulacion de regresion automatica ${sello}. No operar.`,
  304 |     };
  305 | 
  306 |     let codigo = '';
  307 |     await paso(page, 'Reservar una habitacion y emitirla', async () => {
  308 |       await carrito.vaciar();
  309 |       await inicio.abrir();
  310 |       const panel = await inicio.abrirSolapa('hoteles');
  311 |       await expect(panel).toBeVisible();
  312 | 
  313 |       await hotel.verificarResidente();
  314 |       await hotel.elegirHotel(datos.hotelId, 'Park Hyatt');
  315 |       await hotel.cargarViajeros(datos.habitaciones, datos.adultos);
  316 |       await hotel.elegirFechas(entrada, salida);
  317 |       await expect(
  318 |         page.locator(hotel.campoFechas),
  319 |         'El calendario tiene que quedar con las fechas elegidas',
> 320 |       ).toHaveValue(`${formatearFecha(entrada)} - ${formatearFecha(salida)}`);
      |         ^ Error: El calendario tiene que quedar con las fechas elegidas
  321 |       await hotel.buscar();
  322 | 
  323 |       await hotel.abrirFicha(datos.hotelId);
  324 |       await hotel.reservarHabitacion(datos.habitacion, datos.habitaciones);
  325 |       await expect
  326 |         .poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
  327 |         .toBe(datos.habitaciones);
  328 | 
  329 |       await carrito.irAlCarrito();
  330 |       await carrito.crearReserva(referencia, datos.observaciones);
  331 |       await carrito.asegurarPasajeros(datos.adultos);
  332 |       const pasajeros = pasajerosDe(datos.adultos, sello);
  333 |       for (const [i, pax] of pasajeros.entries()) await carrito.completarPasajero(i, pax);
  334 |       await carrito.completarDatosDeLaReserva(datos.adultos, referencia, datos.observaciones);
  335 |       await carrito.aceptarTerminos();
  336 | 
  337 |       codigo = await carrito.confirmarReserva();
  338 |       expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
  339 |         .toMatch(/^BO\d{8}$/);
  340 |       await adjuntarTexto('Reserva emitida para anular', codigo);
  341 |     });
  342 | 
  343 |     await cancelarYVerificar(page, { codigo, solapa: '#tabBooking', referencia });
  344 |   });
  345 | 
  346 |   test('Multidestino: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
  347 |     test.setTimeout(600_000);
  348 | 
  349 |     const inicio = new InicioPage(page);
  350 |     const ct = new CustomToursPage(page);
  351 |     const carrito = new CarritoCustomToursPage(page);
  352 | 
  353 |     const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  354 |     // A 7 dias alcanza: el riel de circuitos pone el limite en InDate - 48hs.
  355 |     const fecha = fechaDeBusqueda();
  356 |     const referencia = `AUTO-QA ${sello}`;
  357 | 
  358 |     const reserva = {
  359 |       cantidadPax: 2,
  360 |       dobles: 1,
  361 |       fecha: formatearFecha(fecha),
  362 |       fechaDeSalida: '',
  363 |       referencia,
  364 |       observaciones: `Anulacion de regresion automatica ${sello}. No operar.`,
  365 |       detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
  366 |       items: ['Park Hyatt', 'Tigre y Delta', 'Angelitos', 'Arakur'],
  367 |       importePorItem: {} as Record<string, string>,
  368 |       pasajeros: [] as Pasajero[],
  369 |     };
  370 | 
  371 |     // El armado del circuito ya esta escrito y probado en `reservas-comun.ts`: se
  372 |     // reusa entero. Los importes no se concilian aca —eso es asunto del test que
  373 |     // verifica el BackOffice—, pero el armador los va anotando igual.
  374 |     const importes: Record<string, { moneda: string; valor: number | null }> = {};
  375 |     const capturarDelPortal = (donde: string, texto: string) => {
  376 |       importes[donde] = importeDelPortal(texto);
  377 |       return importes[donde];
  378 |     };
  379 | 
  380 |     const codigo = await armarCircuitoYEmitir({
  381 |       page, inicio, ct, carrito, reserva, fecha, sello, importes, capturarDelPortal,
  382 |       viaje: {
  383 |         solapa: 'multidestino', ciudad: 'Buenos Aires', id: '5059', combo: 'ddSelectedTour',
  384 |       },
  385 |     });
  386 | 
  387 |     await cancelarYVerificar(page, { codigo, solapa: '#tabCustomTour', referencia });
  388 |   });
  389 | 
  390 |   test('Serie: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
  391 |     test.setTimeout(600_000);
  392 | 
  393 |     const serie = new SeriePage(page);
  394 |     const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  395 | 
  396 |     const SERIE = {
  397 |       nombre: 'AUTO-QA NO TOCAR - Serie de regresion',
  398 |       circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)',
  399 |       categoria: 'Primera',
  400 |     };
  401 | 
  402 |     let codigo = '';
  403 |     let clave = '';
  404 |     let cupoAntes = 0;
  405 | 
  406 |     await paso(page, 'Reservar una salida de la serie y emitirla', async () => {
  407 |       await serie.abrirListado();
  408 |       await serie.abrirSerie(SERIE.nombre);
  409 |       await serie.abrirCircuito(SERIE.circuito);
  410 |       await serie.elegirCategoria(SERIE.categoria);
  411 | 
  412 |       const elegida = await serie.elegirPrimeraSalida();
  413 |       clave = elegida.clave;
  414 |       cupoAntes = (await serie.datosDelCalendario()).cupos[clave] ?? 0;
  415 |       await adjuntarTexto('Salida elegida y cupo antes de reservar',
  416 |         `${elegida.fecha} (${clave}), cupo ${cupoAntes}`);
  417 | 
  418 |       await serie.configurarOcupacion({ adultos: 2 });
  419 |       await serie.agregarHabitacion();
  420 |       await serie.siguiente();
```