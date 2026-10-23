# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: webadmin/tipo-de-cambio.spec.ts >> WebAdmin — tipo de cambio manual por agencia >> Una cotizacion manual cambia el precio de lo que esta en pesos y al desactivarla vuelve a la del pais
- Location: tests/webadmin/tipo-de-cambio.spec.ts:80:7

# Error details

```
Error: excursion: tarifas fuera de lo esperado
01/07/2026 - 31/12/2031 Recargo por idioma 10% | Regular | Mínimo 2 pasajeros | columna 4
01/07/2026 - 31/12/2031 | Privado | 1 | columna 4
01/07/2026 - 31/12/2031 | Privado | 2 | columna 4
01/07/2026 - 31/12/2031 | Privado | 3 | columna 4
01/07/2026 - 31/12/2031 | Privado | 4 - 6 | columna 4
01/07/2026 - 31/12/2031 | Privado | 7 - 9 | columna 4

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "01/07/2026 - 31/12/2031 Recargo por idioma 10% | Regular | Mínimo 2 pasajeros | columna 4",
+   "01/07/2026 - 31/12/2031 | Privado | 1 | columna 4",
+   "01/07/2026 - 31/12/2031 | Privado | 2 | columna 4",
+   "01/07/2026 - 31/12/2031 | Privado | 3 | columna 4",
+   "01/07/2026 - 31/12/2031 | Privado | 4 - 6 | columna 4",
+   "01/07/2026 - 31/12/2031 | Privado | 7 - 9 | columna 4",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f17e1]:
  - generic [ref=f17e2]:
    - generic [ref=f17e5]:
      - link " facundo@amv.travel" [ref=f17e6] [cursor=pointer]:
        - /url: mailto:facundo@amv.travel
        - generic [ref=f17e7]: 
        - text: facundo@amv.travel
      - link "Emergencia 24hs  +54 9 11 3256 2827" [ref=f17e8] [cursor=pointer]:
        - /url: https://api.whatsapp.com/send/?phone=5491132562827&text=Hola%20AMV%20Travel&type=phone_number&app_absent=0
        - generic [ref=f17e9]: 
        - text: Emergencia 24hs
        - generic [ref=f17e10]: 
        - strong [ref=f17e11]: +54 9 11 3256 2827
      - generic:
        - generic: 
        - text: Entorno de test
    - complementary [ref=f17e12]:
      - generic [ref=f17e14]:
        - link [ref=f17e16] [cursor=pointer]:
          - /url: /online/Default.aspx
        - list [ref=f17e18]:
          - listitem [ref=f17e19]:
            - link "Inicio" [ref=f17e20] [cursor=pointer]:
              - /url: /online/Default.aspx
          - listitem [ref=f17e21]:
            - link "Multidestino" [ref=f17e22] [cursor=pointer]:
              - /url: /online/tourall.aspx?country=10&city=5000&tour=0&resident=false
          - listitem [ref=f17e23]:
            - link "Tarifario" [ref=f17e24] [cursor=pointer]:
              - /url: /online/defaulttariff.aspx?country=10&city=5000&from=23-10-2026&to=23-04-2028&resident=false&tab=tour&tourId=0
          - listitem [ref=f17e25]:
            - link "Cruceros" [ref=f17e26] [cursor=pointer]:
              - /url: /online/cruiseall.aspx
          - listitem [ref=f17e27]:
            - link "Series" [ref=f17e28] [cursor=pointer]:
              - /url: /online/serieAll.aspx
          - listitem [ref=f17e29]:
            - link "Reservas" [ref=f17e30] [cursor=pointer]:
              - /url: /online/bookinghistory.aspx
          - listitem [ref=f17e31]:
            - link "Cotizaciones" [ref=f17e32] [cursor=pointer]:
              - /url: /online/quotehistory.aspx
          - text: 
        - button "Novedades" [ref=f17e34] [cursor=pointer]
        - text:  
        - generic [ref=f17e38]:
          - list [ref=f17e39]:
            - listitem [ref=f17e40]:
              - link [ref=f17e41] [cursor=pointer]:
                - /url: https://qa.amv.travel/online/ShoppingCartPage.aspx
          - list [ref=f17e47]:
            - listitem [ref=f17e48]:
              - link "AUTO-QA " [ref=f17e49] [cursor=pointer]:
                - /url: "#"
                - text: AUTO-QA
                - generic [ref=f17e50]: 
          - list [ref=f17e51]:
            - listitem [ref=f17e52]:
              - link "ES " [ref=f17e53] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f17e54]: ES
                - generic [ref=f17e55]: 
      - generic [ref=f17e58]:
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - generic: 
                  - text: TARIFARIOS
                - heading "Todas las tarifas, en un solo lugar" [level=1]
                - paragraph: Elegí país y destino, recorré cada sección y cotizá en un clic.
      - generic "Scroll To Top" [ref=f17e66] [cursor=pointer]:
        - img [ref=f17e67]: 
      - generic [ref=f17e74]:
        - generic [ref=f17e76]:
          - list [ref=f17e78]:
            - listitem [ref=f17e79]:
              - link "PAQUETES" [ref=f17e80] [cursor=pointer]:
                - /url: "#tour"
            - listitem [ref=f17e81]:
              - link "EXCURSIONES" [ref=f17e82]:
                - /url: "#excursion"
            - listitem [ref=f17e83]:
              - link "HOTELES" [ref=f17e84] [cursor=pointer]:
                - /url: "#hotel"
            - listitem [ref=f17e85]:
              - link "TRASLADOS" [ref=f17e86] [cursor=pointer]:
                - /url: "#transfer"
            - listitem [ref=f17e87]:
              - link "CENA SHOW" [ref=f17e88] [cursor=pointer]:
                - /url: "#show"
            - listitem [ref=f17e89]:
              - link "CRUCEROS" [ref=f17e90] [cursor=pointer]:
                - /url: "#cruise"
            - listitem [ref=f17e91]:
              - link "OFERTAS" [ref=f17e92] [cursor=pointer]:
                - /url: "#opportunity"
          - generic [ref=f17e95]:
            - generic [ref=f17e96]:
              - paragraph [ref=f17e97]:
                - generic [ref=f17e98]: 
                - strong [ref=f17e99]: País
              - combobox [ref=f17e100]:
                - option "Todos"
                - option "Argentina"
                - option "Bolivia"
                - option "Brasil"
                - option "Chile"
                - option "Mexico"
                - option "Paraguay"
                - option "Perú"
                - option "Uruguay"
                - option
                - option "Todos" [selected]
              - combobox [ref=f17e102] [cursor=pointer]:
                - text: 
                - generic [ref=f17e103]: Todos
            - generic [ref=f17e104]:
              - paragraph [ref=f17e105]:
                - generic [ref=f17e106]: 
                - strong [ref=f17e107]: Destino
              - combobox [ref=f17e108]:
                - option "Arequipa"
                - option "Asuncion"
                - option "Bahía Bustamante"
                - option "Bariloche"
                - option "Brasilia"
                - option "Buenos Aires"
                - option "Buzios"
                - option "Cachi"
                - option "Cafayate"
                - option "Cajamarca"
                - option "Caviahue"
                - option "Chiclayo"
                - option "Chiloe"
                - option "Ciudad del Este"
                - option "Colca"
                - option "Colonia del Sacramento"
                - option "Córdoba"
                - option "Cusco"
                - option "El Calafate"
                - option "El Chaltén"
                - option "Esquel"
                - option "Esteros del Iberá"
                - option "Foz Do Iguazu"
                - option "Ica"
                - option "Iguazú"
                - option "Iquitos"
                - option "Iruya"
                - option "Isla de Pascua"
                - option "Jujuy"
                - option "Junín de los Andes"
                - option "La Paz"
                - option "La Plata"
                - option "La Rioja"
                - option "Lima"
                - option "Los Antiguos"
                - option "Machu Picchu"
                - option "Máncora"
                - option "Mar del Plata"
                - option "Matiena"
                - option "Mendoza"
                - option "Montevideo"
                - option "Moscu"
                - option "Neuquén"
                - option "Paracas"
                - option "Peulla"
                - option "Piura"
                - option "Potosi"
                - option "Pucón"
                - option "Puebla"
                - option "Puerto Madryn"
                - option "Puerto Maldonado"
                - option "Puerto Montt"
                - option "Puerto Natales"
                - option "Puerto Varas"
                - option "Puno"
                - option "Punta Arenas"
                - option "Punta del Este"
                - option "Purmamarca"
                - option "Riga"
                - option "Rio de Janeiro"
                - option "Rosario"
                - option "Salta"
                - option "Salvador de Bahía"
                - option "San Juan"
                - option "San Martín de los Andes"
                - option "San Pablo"
                - option "San Pedro de Atacama"
                - option "San Rafael"
                - option "Santa Cruz de la Sierra"
                - option "Santiago de Chile"
                - option "Sucre"
                - option "Test 4318"
                - option "Test sin IATA"
                - option "Tilcara"
                - option "Torres del Paine"
                - option "Trelew"
                - option "Trujillo"
                - option "Tucumán"
                - option "Tumbes"
                - option "Ushuaia"
                - option "Uyuni"
                - option "Valle Sagrado"
                - option "Valparaiso"
                - option "Villa La Angostura"
                - option "Viña del Mar"
                - option
                - option "Buenos Aires" [selected]
              - generic [ref=f17e110] [cursor=pointer]:
                - text: 
                - generic [ref=f17e111]: Buenos Aires
                - combobox [ref=f17e112]
            - link "Buscar" [ref=f17e114] [cursor=pointer]:
              - /url: javascript:__doPostBack('ctl00$cphMainSlider$ctrlTariffFilterControl$lnkView','')
        - generic [ref=f17e115]:
          - complementary "Filtrar resultados" [ref=f17e116]:
            - generic [ref=f17e117]:
              - generic [ref=f17e118]: 
              - generic [ref=f17e119]: Filtrar resultados
            - generic [ref=f17e120]:
              - generic [ref=f17e121]: Tipo
              - combobox [ref=f17e122]:
                - option "Hoteles"
                - option "Traslados"
                - option "Cena show"
                - option "Cruceros"
                - option "Ofertas"
                - option "Paquetes"
                - option
                - option "Excursiones" [selected]
              - combobox "Tipo" [ref=f17e124] [cursor=pointer]:
                - text: 
                - generic [ref=f17e125]: Excursiones
            - generic [ref=f17e126]:
              - generic [ref=f17e128]:
                - generic: 
                - combobox [ref=f17e129]:
                  - option
                  - option "AUTO-QA NO TOCAR - Tigre y Delta" [selected]
                - generic [ref=f17e130]:
                  - generic [ref=f17e131] [cursor=pointer]:
                    - generic [ref=f17e132]:
                      - text: AUTO-QA NO TOCAR - Tigre y Delta
                      - generic [ref=f17e133]: AUTO-QA Gastronomía
                      - generic [ref=f17e134]: AUTO-QA Nocturno
                    - combobox "Buscar excursiones por nombre" [ref=f17e135]
                  - text: 
                - button "Limpiar" [ref=f17e136] [cursor=pointer]:
                  - generic [ref=f17e137]: 
              - generic [ref=f17e138]:
                - button "AUTO-QA Gastronomía" [ref=f17e139] [cursor=pointer]
                - button "AUTO-QA Nocturno" [ref=f17e140] [cursor=pointer]
                - button "QA4735 Gastronomía" [ref=f17e141] [cursor=pointer]
                - button "QA4735 Nieve" [ref=f17e142] [cursor=pointer]
                - button "Tag Test2" [ref=f17e143] [cursor=pointer]
          - generic [ref=f17e146]:
            - strong [ref=f17e147]: 1 excursión
            - text: en Buenos Aires
          - generic [ref=f17e149]:
            - generic [ref=f17e158]:
              - generic [ref=f17e160]:
                - generic [ref=f17e162]:
                  - img "AUTO-QA NO TOCAR - Tigre y Delta" [ref=f17e166]
                  - img "Tigre & Delta" [ref=f17e170]
                  - img "Tigre & Delta" [ref=f17e174]
                - text:  
                - generic [ref=f17e175]:
                  - generic [ref=f17e176] [cursor=pointer]
                  - generic [ref=f17e177] [cursor=pointer]
                  - generic [ref=f17e178] [cursor=pointer]
              - generic [ref=f17e179]:
                - generic [ref=f17e180]:
                  - heading "AUTO-QA NO TOCAR - Tigre y Delta Medio día" [level=2] [ref=f17e181]:
                    - text: AUTO-QA NO TOCAR - Tigre y Delta
                    - generic [ref=f17e182]: Medio día
                  - tabpanel [ref=f17e184]:
                    - generic [ref=f17e185]: "SALIDAS: Diarias HORARIO: 8.45/ 9 a 14hs aproximadamente DURACIÓN: 5hs OPERATIVIDAD: Todo el año. Excepto el 1 de Mayo, el 25 de diciembre y el 01 de enero MENORES: Consultar…"
                - generic [ref=f17e187]:
                  - generic [ref=f17e188]: AUTO-QA Gastronomía
                  - generic [ref=f17e189]: AUTO-QA Nocturno
                - generic [ref=f17e190]:
                  - generic [ref=f17e191]:
                    - generic [ref=f17e192]: 
                    - generic [ref=f17e193]: Sujeto a modificaciones según condiciones del río
                  - generic [ref=f17e194]:
                    - generic [ref=f17e195]: 
                    - generic [ref=f17e196]: Traer ropa cómoda y calzado antideslizante
                - generic [ref=f17e197]:
                  - generic [ref=f17e198]:
                    - generic [ref=f17e199]: 
                    - text: 02:00
                  - generic [ref=f17e201]:
                    - generic [ref=f17e202]: 
                    - text: ES, EN, PT
                  - generic [ref=f17e204]:
                    - generic [ref=f17e205]: 
                    - generic [ref=f17e206]:
                      - text: Todos los dias
                      - generic [ref=f17e207]: Ene–May, Ago–Dic
                  - generic [ref=f17e209]:
                    - 'generic "Incluye: Bebidas" [ref=f17e210]':
                      - generic [ref=f17e211]: 
                      - text: 
                    - 'generic "No incluye: Almuerzo" [ref=f17e212]':
                      - generic [ref=f17e213]: 
                      - text: 
                - generic [ref=f17e214]:
                  - text: 
                  - generic [ref=f17e215]:
                    - link "Ver Detalle" [ref=f17e216] [cursor=pointer]:
                      - /url: javascript:void(0);
                      - generic [ref=f17e217]: 
                      - text: Ver Detalle
                    - link "Ver Tarifario" [ref=f17e218] [cursor=pointer]:
                      - /url: javascript:void(0);
                      - generic [ref=f17e219]: 
                      - text: Ver Tarifario
            - text:                                                                                                  
      - text:        
    - complementary
    - generic [ref=f17e223]:
      - generic [ref=f17e224]: AUTO-QA NO TOCAR - Markups
      - generic [ref=f17e225]:
        - generic [ref=f17e226]:
          - generic [ref=f17e227]: 
          - text: Avenida Córdoba 673 1°B
        - link " 54 11 50313060" [ref=f17e228] [cursor=pointer]:
          - /url: tel:54 11 50313060
          - generic [ref=f17e229]: 
          - text: 54 11 50313060
        - link [ref=f17e230] [cursor=pointer]:
          - /url: "mailto:"
    - text:         
  - dialog [ref=f17e234]:
    - generic [ref=f17e235]:
      - heading [level=2] [ref=f17e236]: Tu carrito
      - button [ref=f17e237] [cursor=pointer]:
        - generic [ref=f17e238]: 
    - generic [ref=f17e240]:
      - generic [ref=f17e241]: 
      - generic [ref=f17e242]: Tu carrito está vacío
      - generic [ref=f17e243]: Buscá hoteles, excursiones o traslados y los vas a ver acá.
    - text: 
  - text:                 
```

# Test source

```ts
  1   | import { test, expect, Page, BrowserContext } from '@playwright/test';
  2   | import { WebAdminMarkupsPage } from '../../pages/webadmin-markups.page';
  3   | import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
  4   | import { abrirSesionDeMarkups, tarifasDe, porTarifa, compararPrecios, ItemDelTarifario } from '../../utils/markups';
  5   | import candidatos from '../../data/candidatos.json';
  6   | 
  7   | const T = candidatos.tarifario;
  8   | const M = candidatos.markups;
  9   | const SALTO = String.fromCharCode(10);
  10  | // La excursion tiene tarifa en pesos y el hotel en dolares: el tipo de cambio solo
  11  | // tiene que mover el precio de la excursion.
  12  | const EN_PESOS = T.excursiones as ItemDelTarifario;
  13  | const EN_DOLARES = T.hoteles as ItemDelTarifario;
  14  | 
  15  | /**
  16  |  * WebAdmin — tipo de cambio manual por agencia.
  17  |  *
  18  |  * El portal muestra todo en dolares: lo que tiene tarifa en pesos se convierte con
  19  |  * la cotizacion de la agencia y, si no tiene una propia, con la de su pais. Es lo
  20  |  * que define cuanto se cobra: una cotizacion equivocada cambia el precio de todo lo
  21  |  * que esta en moneda local.
  22  |  *
  23  |  * Con el usuario propio de markups (agencia 6334, pais 10, cotizacion del pais
  24  |  * 1.000): se le carga una cotizacion manual de 2.000 y la excursion en pesos tiene
  25  |  * que costar la mitad en dolares; el hotel en dolares no cambia. Al desactivarla
  26  |  * tiene que volver a la del pais.
  27  |  *
  28  |  * Desactivarla no borra la fila de la agencia: la marca como borrada. Si el portal no
  29  |  * respetara esa marca, la excursion seguiria a 2.000: es lo que mira el ultimo paso.
  30  |  *
  31  |  * Al terminar deja la cotizacion manual en 1.000 y desactivada: aunque el portal la
  32  |  * siguiera usando, el precio queda igual que con la del pais.
  33  |  *
  34  |  * ROJO CONOCIDO (22/10/2026): el ultimo paso falla y es BUG de producto, no del test.
  35  |  * Verificado con un experimento que descarta cache/timing (a los 90s de desactivar sigue
  36  |  * sin revertir). Al desactivar la cotizacion manual el WebAdmin la deja en manual=false
  37  |  * y lo persiste (guardarTipoDeCambio re-navega y lo verifica), pero el portal sigue
  38  |  * aplicando el valor manual a la excursion: queda en 40/331/174 (la mitad) en vez de
  39  |  * volver a 79/661/347 (la del pais). Sospechoso: la US 4739 (recargo por idioma) recien
  40  |  * desplegada, que sumo las filas "Recargo por idioma 10%". Ya esta reportado: US 4910
  41  |  * "Hotfix Tipo de cambio manual que se sigue aplicando al desactivarlo" (Analisis Done).
  42  |  * Se deja en rojo hasta que esa US se corrija.
  43  |  */
  44  | test.describe('WebAdmin — tipo de cambio manual por agencia', () => {
  45  |   test.describe.configure({ mode: 'serial' });
  46  | 
  47  |   let contexto: BrowserContext;
  48  |   let portal: Page;
  49  |   const DEL_PAIS = 1000;
  50  |   const MANUAL = 2000;
  51  | 
  52  |   test.beforeAll(async ({ browser, baseURL }) => {
  53  |     const sesion = await abrirSesionDeMarkups(browser, baseURL);
  54  |     contexto = sesion.contexto;
  55  |     portal = sesion.pagina;
  56  |   });
  57  | 
  58  |   test.afterAll(async () => {
  59  |     await contexto?.close();
  60  |   });
  61  | 
  62  |   test.beforeEach(() => {
  63  |     reiniciarNumeracionDePasos();
  64  |   });
  65  | 
  66  |   async function leer(item: ItemDelTarifario, titulo: string): Promise<Map<string, number>> {
  67  |     const filas = await tarifasDe(portal, item);
  68  |     const precios = porTarifa(filas);
  69  |     await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
  70  |     expect(precios.size, `${M.usuario.userName} tiene que ver tarifas con importe`).toBeGreaterThan(0);
  71  |     return precios;
  72  |   }
  73  | 
  74  |   async function exigir(antes: Map<string, number>, despues: Map<string, number>, cotAntes: number, cotDespues: number, que: string) {
  75  |     const { lineas, fuera } = compararPrecios(antes, despues, cotAntes, cotDespues);
  76  |     await adjuntarTexto(`Comparacion: ${que}`, `cotizacion ${cotAntes} -> ${cotDespues}` + SALTO + SALTO + lineas.join(SALTO));
> 77  |     expect(fuera, `${que}: tarifas fuera de lo esperado` + SALTO + fuera.join(SALTO)).toEqual([]);
      |                                                                                       ^ Error: excursion: tarifas fuera de lo esperado
  78  |   }
  79  | 
  80  |   test('Una cotizacion manual cambia el precio de lo que esta en pesos y al desactivarla vuelve a la del pais', async ({ page }) => {
  81  |     const admin = new WebAdminMarkupsPage(page);
  82  |     let pesosAntes = new Map<string, number>();
  83  |     let dolaresAntes = new Map<string, number>();
  84  | 
  85  |     await paso(page, `Verificar que la agencia ${M.agencia.id} usa la cotizacion del pais`, async () => {
  86  |       await admin.abrirAgencia(M.agencia.id);
  87  |       const cambio = await admin.tipoDeCambioDeLaAgencia();
  88  |       await adjuntarTexto('Tipo de cambio de la agencia', JSON.stringify(cambio));
  89  |       expect(cambio.manual, 'La agencia tiene que arrancar sin tipo de cambio manual').toBe(false);
  90  |       expect(cambio.general, `La cotizacion del pais tiene que ser ${DEL_PAIS}`).toBe(DEL_PAIS);
  91  |     });
  92  | 
  93  |     await paso(portal, 'Leer en el portal la excursion (pesos) y el hotel (dolares)', async () => {
  94  |       pesosAntes = await leer(EN_PESOS, 'Excursion antes');
  95  |       dolaresAntes = await leer(EN_DOLARES, 'Hotel antes');
  96  |     });
  97  | 
  98  |     try {
  99  |       await paso(page, `WebAdmin: cargar a la agencia ${M.agencia.id} una cotizacion manual de ${MANUAL}`, async () => {
  100 |         await admin.guardarTipoDeCambio(M.agencia.id, true, MANUAL);
  101 |       });
  102 | 
  103 |       await paso(portal, `Portal: la excursion en pesos se convierte a ${MANUAL}`, async () => {
  104 |         await exigir(pesosAntes, await leer(EN_PESOS, 'Excursion con cotizacion manual'), DEL_PAIS, MANUAL, 'excursion');
  105 |       });
  106 | 
  107 |       await paso(portal, 'Portal: el hotel en dolares no cambia', async () => {
  108 |         await exigir(dolaresAntes, await leer(EN_DOLARES, 'Hotel con cotizacion manual'), 1, 1, 'hotel');
  109 |       });
  110 | 
  111 |       await paso(page, 'WebAdmin: desactivar la cotizacion manual', async () => {
  112 |         await admin.guardarTipoDeCambio(M.agencia.id, false);
  113 |       });
  114 | 
  115 |       await paso(portal, `Portal: la excursion vuelve a la cotizacion del pais (${DEL_PAIS})`, async () => {
  116 |         await exigir(pesosAntes, await leer(EN_PESOS, 'Excursion sin cotizacion manual'), DEL_PAIS, DEL_PAIS, 'excursion');
  117 |       });
  118 |     } finally {
  119 |       await paso(page, `Restaurar: cotizacion manual en ${DEL_PAIS} y desactivada`, async () => {
  120 |         await admin.guardarTipoDeCambio(M.agencia.id, true, DEL_PAIS);
  121 |         await admin.guardarTipoDeCambio(M.agencia.id, false);
  122 |       });
  123 |     }
  124 |   });
  125 | });
  126 | 
```