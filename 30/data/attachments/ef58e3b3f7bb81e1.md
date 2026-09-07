# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-a/tarifario.spec.ts >> Tarifario >> Cena Show: trae tarifas y coinciden con las de la base
- Location: tests/bloque-a/tarifario.spec.ts:891:7

# Error details

```
Error: El componente "copiar" tiene que estar en la card

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=f2e1]:
  - generic [ref=f2e2]:
    - generic [ref=f2e4]:
      - generic [ref=f2e5]:
        - link " hello@amv.travel" [ref=f2e6] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
          - generic [ref=f2e7]: 
          - text: hello@amv.travel
        - link "Emergencia 24hs  +54 9 11 3256 2827" [ref=f2e8] [cursor=pointer]:
          - /url: https://api.whatsapp.com/send/?phone=5491132562827&text=Hola%20AMV%20Travel&type=phone_number&app_absent=0
          - generic [ref=f2e9]: 
          - text: Emergencia 24hs
          - generic [ref=f2e10]: 
          - strong [ref=f2e11]: +54 9 11 3256 2827
        - paragraph: TEST ENVIRONMENT
      - generic [ref=f2e13]:
        - combobox [ref=f2e14]:
          - option "Buscar agencia" [selected]
        - generic [ref=f2e16] [cursor=pointer]:
          - text: 
          - combobox "Buscar agencia..." [ref=f2e17]
          - generic "Volver a mi agencia" [ref=f2e18]: ⨯
        - combobox [ref=f2e19]:
          - option "Usuario" [selected]
        - combobox [ref=f2e21] [cursor=pointer]:
          - text: 
          - generic [ref=f2e22]: Usuario
        - text:  
    - complementary [ref=f2e23]:
      - generic [ref=f2e25]:
        - link [ref=f2e27] [cursor=pointer]:
          - /url: /online/Default.aspx
        - list [ref=f2e29]:
          - listitem [ref=f2e30]:
            - link "Inicio" [ref=f2e31] [cursor=pointer]:
              - /url: /online/Default.aspx
          - listitem [ref=f2e32]:
            - link "Multidestino" [ref=f2e33] [cursor=pointer]:
              - /url: /online/tourall.aspx?country=10&city=5000&tour=0&resident=false
          - listitem [ref=f2e34]:
            - link "Tarifario" [ref=f2e35] [cursor=pointer]:
              - /url: /online/defaulttariff.aspx?country=10&city=5000&from=07-09-2026&to=07-03-2028&resident=false&tab=tour&tourId=0
          - listitem [ref=f2e36]:
            - link "Series" [ref=f2e37] [cursor=pointer]:
              - /url: /online/serieAll.aspx
          - listitem [ref=f2e38]:
            - link "Reservas" [ref=f2e39] [cursor=pointer]:
              - /url: /online/bookinghistory.aspx
          - listitem [ref=f2e40]:
            - link "Cotizaciones" [ref=f2e41] [cursor=pointer]:
              - /url: /online/quotehistory.aspx
          - text: 
        - text:  
        - generic [ref=f2e43]:
          - list [ref=f2e44]:
            - listitem [ref=f2e45]:
              - link [ref=f2e46] [cursor=pointer]:
                - /url: https://qa.amv.travel/online/ShoppingCartPage.aspx
          - list [ref=f2e52]:
            - listitem [ref=f2e53]:
              - link "M 0.50 " [ref=f2e54] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f2e55]:
                  - generic [ref=f2e56]: M 0.50
                  - generic [ref=f2e57]: 
          - list [ref=f2e58]:
            - listitem [ref=f2e59]:
              - link "Pablo " [ref=f2e60] [cursor=pointer]:
                - /url: "#"
                - text: Pablo
                - generic [ref=f2e61]: 
          - list [ref=f2e62]:
            - listitem [ref=f2e63]:
              - link "ES " [ref=f2e64] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f2e65]: ES
                - generic [ref=f2e66]: 
      - generic [ref=f2e69]:
        - heading "TARIFARIOS" [level=1] [ref=f2e72]
        - heading "TARIFARIOS" [level=1] [ref=f2e75]
        - heading "TARIFARIOS" [level=1] [ref=f2e78]
        - heading "TARIFARIOS" [level=1] [ref=f2e81]
        - heading "TARIFARIOS" [level=1] [ref=f2e84]
        - heading "TARIFARIOS" [level=1] [ref=f2e87]
        - heading "TARIFARIOS" [level=1] [ref=f2e90]
        - button "❮" [ref=f2e91] [cursor=pointer]
        - button "❯" [ref=f2e92] [cursor=pointer]
      - list [ref=f2e93]:
        - listitem [ref=f2e94]:
          - link "" [ref=f2e95] [cursor=pointer]:
            - /url: https://api.whatsapp.com/send/?phone=5491132562827&text=Hola%20AMV%20Travel&type=phone_number&app_absent=0
        - listitem [ref=f2e97]:
          - link "" [ref=f2e98] [cursor=pointer]:
            - /url: https://www.messenger.com/t/amv.travel/
        - listitem [ref=f2e100]:
          - link "" [ref=f2e101] [cursor=pointer]:
            - /url: https://www.facebook.com/amv.travel/
        - listitem [ref=f2e103]:
          - link "" [ref=f2e104] [cursor=pointer]:
            - /url: https://www.instagram.com/amv.travel/
      - generic "Scroll To Top" [ref=f2e106] [cursor=pointer]:
        - img [ref=f2e107]: 
      - generic [ref=f2e114]:
        - generic [ref=f2e115]:
          - list [ref=f2e117]:
            - listitem [ref=f2e118]:
              - link "PAQUETES" [ref=f2e119] [cursor=pointer]:
                - /url: "#tour"
            - listitem [ref=f2e120]:
              - link "EXCURSIONES" [ref=f2e121] [cursor=pointer]:
                - /url: "#excursion"
            - listitem [ref=f2e122]:
              - link "HOTELES" [ref=f2e123] [cursor=pointer]:
                - /url: "#hotel"
            - listitem [ref=f2e124]:
              - link "TRASLADOS" [ref=f2e125] [cursor=pointer]:
                - /url: "#transfer"
            - listitem [ref=f2e126]:
              - link "CENA SHOW" [ref=f2e127]:
                - /url: "#show"
            - listitem [ref=f2e128]:
              - link "CRUCEROS" [ref=f2e129] [cursor=pointer]:
                - /url: "#cruise"
            - listitem [ref=f2e130]:
              - link "OFERTAS" [ref=f2e131] [cursor=pointer]:
                - /url: "#opportunity"
          - generic [ref=f2e134]:
            - generic [ref=f2e135]:
              - paragraph [ref=f2e136]:
                - strong [ref=f2e137]: País
              - combobox [ref=f2e138]:
                - option "Bolivia"
                - option "Brasil"
                - option "Chile"
                - option "Mexico"
                - option "Paraguay"
                - option "Perú"
                - option "Uruguay"
                - option "Argentina" [selected]
              - combobox [ref=f2e140] [cursor=pointer]:
                - text: 
                - generic [ref=f2e141]: Argentina
            - generic [ref=f2e142]:
              - paragraph [ref=f2e143]:
                - strong [ref=f2e144]: Ciudad
              - combobox [ref=f2e145]:
                - option "Buenos Aires"
                - option "Bariloche"
                - option "Bahía Bustamante"
                - option "Caviahue"
                - option "Cachi"
                - option "Cafayate"
                - option "La Rioja"
                - option "Los Antiguos"
                - option "Córdoba"
                - option "El Calafate"
                - option "El Chaltén"
                - option "Esquel"
                - option "Esteros del Iberá"
                - option "Junín de los Andes"
                - option "Jujuy"
                - option "La Plata"
                - option "Mar del Plata"
                - option "Mendoza"
                - option "Neuquén"
                - option "Iguazú"
                - option "Iruya"
                - option "Puerto Madryn"
                - option "Purmamarca"
                - option "Rosario"
                - option "Salta"
                - option "San Juan"
                - option "San Martín de los Andes"
                - option "San Rafael"
                - option "Tilcara"
                - option "Trelew"
                - option "Tucumán"
                - option "Ushuaia"
                - option "Villa La Angostura"
                - option "Test 4318"
                - option
                - option "Buenos Aires" [selected]
              - combobox [ref=f2e147] [cursor=pointer]:
                - text: 
                - generic [ref=f2e148]: Buenos Aires
            - link "Buscar" [ref=f2e150] [cursor=pointer]:
              - /url: javascript:__doPostBack('ctl00$cphMainSlider$ctrlTariffFilterControl$lnkView','')
          - generic [ref=f2e153]:
            - generic: 
            - combobox [ref=f2e154]:
              - option
              - option "AUTO-QA NO TOCAR - Café de los Angelitos" [selected]
            - generic [ref=f2e155]:
              - generic [ref=f2e156]:
                - generic [ref=f2e157]:
                  - text: AUTO-QA NO TOCAR - Café de los Angelitos
                  - generic [ref=f2e158]: Medio día
                - combobox [active] [ref=f2e159]
              - text: 
            - button " Limpiar" [ref=f2e160] [cursor=pointer]:
              - generic [ref=f2e161]: 
              - text: Limpiar
          - generic [ref=f2e162]:
            - button " Proveedor " [ref=f2e163] [cursor=pointer]:
              - generic [ref=f2e164]: 
              - generic [ref=f2e165]: Proveedor
              - generic [ref=f2e166]: 
            - generic [ref=f2e168]:
              - strong [ref=f2e169]: "1"
              - text: show en Buenos Aires
        - generic [ref=f2e170]:
          - generic [ref=f2e177]:
            - generic [ref=f2e179]:
              - generic [ref=f2e181]:
                - generic [ref=f2e183]:
                  - img "AUTO-QA NO TOCAR - Cafe de los Angelitos" [ref=f2e187]
                  - generic [ref=f2e188]: 
                  - generic [ref=f2e194]: 
                - text:  
                - generic [ref=f2e200]:
                  - generic [ref=f2e201] [cursor=pointer]
                  - generic [ref=f2e202] [cursor=pointer]
                  - generic [ref=f2e203] [cursor=pointer]
              - generic [ref=f2e204]:
                - generic [ref=f2e205]:
                  - heading "AUTO-QA NO TOCAR - Café de los Angelitos Medio día" [level=2] [ref=f2e206]:
                    - text: AUTO-QA NO TOCAR - Café de los Angelitos
                    - generic [ref=f2e207]: Medio día
                  - tabpanel [ref=f2e209]:
                    - paragraph [ref=f2e211]: "SALIDAS: Diarias./ No válidas para 24 y 31/12 HORARIO: 20 hs Cena / Solo show 21:15 horas. DURACIÓN: 4 horas (aproximadamente). POLÍTICA DE MENORES: de 3 a 11 años abonan tarifa de menores OBSERVACIONES: tarifas no aplican para cenas de Nav..."
                - generic [ref=f2e212]:
                  - generic [ref=f2e213]:
                    - generic [ref=f2e214]: 
                    - generic [ref=f2e215]: No aplica para cenas de Navidad y Año Nuevo
                  - generic [ref=f2e216]:
                    - generic [ref=f2e217]: 
                    - generic [ref=f2e218]: Consultar suplemento por hoteles en Palermo
                - generic [ref=f2e219]:
                  - generic [ref=f2e220]:
                    - generic [ref=f2e221]: 
                    - text: 02:00
                    - generic: Duración estimada del servicio
                  - generic [ref=f2e223]:
                    - generic [ref=f2e224]: 
                    - text: ES, EN, PT
                    - generic:
                      - strong: Idiomas
                      - list:
                        - listitem: Español
                        - listitem: English
                        - listitem: Portuguese
                  - generic [ref=f2e226]:
                    - generic [ref=f2e227]: 
                    - generic [ref=f2e228]:
                      - text: Todos los dias
                      - generic [ref=f2e229]: Ene–Mar, May–Jul, Oct–Dic
                    - generic:
                      - strong: Operatividad
                      - list:
                        - listitem: "• Días: Todos los dias"
                        - listitem: "• Temporada: enero a marzo, mayo a julio, octubre a diciembre"
                  - generic [ref=f2e231]:
                    - generic [ref=f2e232]: 
                    - generic:
                      - strong: Almuerzo
                      - list:
                        - listitem: Texto de prueba.
                  - generic [ref=f2e233]:
                    - generic:
                      - strong: Bebidas
                      - list:
                        - listitem: Copa de bienvenida y bebidas libres durante la cena
                  - link "Ver Detalle " [ref=f2e234] [cursor=pointer]:
                    - /url: javascript:void(0);
                    - text: Ver Detalle
                    - generic [ref=f2e235]: 
              - button "" [ref=f2e237] [cursor=pointer]
            - paragraph [ref=f2e240]:
              - link "Ver Tarifario " [ref=f2e241] [cursor=pointer]:
                - /url: javascript:void(0);
                - text: Ver Tarifario
                - generic [ref=f2e242]: 
          - text:                                                                           
    - complementary
    - generic [ref=f2e246]:
      - generic [ref=f2e247]: AMV. TRAVEL
      - generic [ref=f2e248]:
        - generic [ref=f2e249]:
          - generic [ref=f2e250]: 
          - text: Avenida Córdoba 673 1°B
        - link " 54 11 50313060" [ref=f2e251] [cursor=pointer]:
          - /url: tel:54 11 50313060
          - generic [ref=f2e252]: 
          - text: 54 11 50313060
        - link "hello@amv.travel" [ref=f2e253] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
    - text:       
  - dialog [ref=f2e257]:
    - generic [ref=f2e258]:
      - heading [level=2] [ref=f2e259]: Tu carrito
      - button [ref=f2e260] [cursor=pointer]:
        - generic [ref=f2e261]: 
    - generic [ref=f2e263]:
      - generic [ref=f2e264]: 
      - generic [ref=f2e265]: Tu carrito está vacío
      - generic [ref=f2e266]: Buscá hoteles, excursiones o traslados y los vas a ver acá.
    - text: 
  - text:          
```

# Test source

```ts
  578 |           const itemIdiomas = barra.find((x) => mismoConjunto(x.items, idiomas));
  579 |           expect(itemIdiomas,
  580 |             `El tooltip de idiomas tiene que listar exactamente ${idiomas.join(', ')}. ` +
  581 |             `Listas en pantalla: ${JSON.stringify(barra.map((x) => x.items))}`,
  582 |           ).toBeDefined();
  583 |         });
  584 | 
  585 |         // Los tooltips de amenities destacadas: nombre y observacion, exactos y
  586 |         // sin que sobre ninguno. Solo aparecen las de ServiceAmenity.IsPriority = 1.
  587 |         const destacadas: { nombre: string; descripcion: string }[] = card.tooltipsAmenities ?? [];
  588 |         if (destacadas.length) {
  589 |           const enPantalla = barra
  590 |             .filter((x) => !x.esCalendario && x.titulo && x.titulo !== 'Idiomas')
  591 |             .map((x) => `${x.titulo} -- ${x.items.join(' ')}`.trim());
  592 |           const deLaBase = destacadas.map((a) =>
  593 |             `${a.nombre} -- ${a.descripcion}`.trim());
  594 | 
  595 |           // Se resalta el primer tooltip de amenity que no este en la base, en vez
  596 |           // de la barra entera: con cinco tooltips marcados habia que mirarlos
  597 |           // todos para encontrar cual era el que no coincidia.
  598 |           const esperadosNorm = deLaBase.map(norm);
  599 |           const iMalo = barra.findIndex((x) =>
  600 |             !x.esCalendario && x.titulo && x.titulo !== 'Idiomas' &&
  601 |             !esperadosNorm.includes(norm(`${x.titulo} -- ${x.items.join(' ')}`.trim())));
  602 | 
  603 |           await conResaltado(page, zonaItem(iMalo), 'un tooltip de amenity no coincide', () => {
  604 |             expect(enPantalla.map(norm).sort(),
  605 |               'Los tooltips de amenities destacadas tienen que coincidir con la base',
  606 |             ).toEqual(esperadosNorm.sort());
  607 |           });
  608 |         }
  609 | 
  610 |         // El resumen de temporada no puede nombrar un mes que la base no opera.
  611 |         // No se compara la cadena entera porque el control la abrevia en rangos
  612 |         // ("Ene-Mar, May-Jul"), y reconstruir ese formato seria reimplementarlo.
  613 |         const calendario = barra.find((x) => x.esCalendario);
  614 |         const iCalendario = barra.findIndex((x) => x.esCalendario);
  615 |         await conResaltado(page, zonaItem(iCalendario), 'falta el item de operatividad', () => {
  616 |           expect(calendario, 'La card tiene que mostrar el item de operatividad').toBeDefined();
  617 |         });
  618 |         if (calendario && meses.length) {
  619 |           const ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  620 |                          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  621 |           const fuera = ABREV.filter((_, i) => !meses.includes(i + 1));
  622 |           await conResaltado(page, zonaItem(iCalendario), 'la temporada no coincide', () => {
  623 |             for (const mes of fuera) {
  624 |               expect(norm(calendario.meses),
  625 |                 `La temporada no tiene que nombrar "${mes}", que la base no opera`,
  626 |               ).not.toContain(norm(mes));
  627 |             }
  628 |           });
  629 |         }
  630 |       }
  631 | 
  632 |       if (card.tagRecomendado) {
  633 |         expect(tag, 'La card tiene que mostrar el tag RECOMENDADO').not.toBeNull();
  634 |         // Se sacan los caracteres que no son letras: el tag lleva el glifo de
  635 |         // una corona adelante, que innerText devuelve junto con el texto.
  636 |         const soloLetras = (x: string) => x.replace(/[^\p{L} ]/gu, '').trim().toUpperCase();
  637 |         await conResaltado(page, t.locatorTag(cfg.container), 'el tag no coincide', () => {
  638 |           expect(soloLetras(tag ?? ''), 'El tag tiene que decir exactamente RECOMENDADO')
  639 |             .toBe(card.tagRecomendado.toUpperCase());
  640 |         });
  641 |       }
  642 |     });
  643 |   }
  644 | 
  645 | 
  646 |   /**
  647 |    * Valida los componentes de la card contra la matriz tomada del markup de
  648 |    * cada *TariffControl.ascx (ver _elementos en candidatos.json):
  649 |    * imagen, texto, boton de tarifario, proveedores, descarga Word, tag y chips.
  650 |    *
  651 |    * "Cotizar y reservar" se verifica por presencia y NO se clickea: navega al
  652 |    * carrito y saca al test del tarifario.
  653 |    */
  654 |   async function validarElementos(page: Page, t: TarifarioPage, cfg: any) {
  655 |     await paso(page, 'La card muestra los componentes que corresponden', async () => {
  656 |       const esperados = cfg.elementos;
  657 |       const hay = (await t.elementosDeLaCard(cfg.container)) as Record<string, boolean>;
  658 |       const src = await t.srcImagen(cfg.container);
  659 | 
  660 |       await adjuntarTexto('Componentes de la card',
  661 |         Object.keys(esperados)
  662 |           .map((k) => `${k.padEnd(18)} esperado: ${String(esperados[k]).padEnd(6)} en pantalla: ${hay[k]}`)
  663 |           .join(SALTO) + SALTO + SALTO + 'src de la imagen: ' + src);
  664 | 
  665 |       for (const clave of Object.keys(esperados)) {
  666 |         if (hay[clave] !== esperados[clave]) {
  667 |           await resaltarYCapturar(
  668 |             page,
  669 |             t.locatorDeComponente(cfg.container, clave),
  670 |             `FALLA: componente "${clave}"`,
  671 |             t.locatorCard(cfg.container),
  672 |           );
  673 |         }
  674 |         expect(hay[clave],
  675 |           esperados[clave]
  676 |             ? `El componente "${clave}" tiene que estar en la card`
  677 |             : `El componente "${clave}" no tiene que estar en esta pestania`,
> 678 |         ).toBe(esperados[clave]);
      |           ^ Error: El componente "copiar" tiene que estar en la card
  679 |       }
  680 | 
  681 |       // La imagen tiene que ser la cargada en la base, no el placeholder.
  682 |       if (cfg.imagen) {
  683 |         expect(src, 'La card tiene que mostrar una imagen').not.toBeNull();
  684 |         // Anclado al final: el src es una ruta, asi que se exige que termine con
  685 |         // el archivo esperado y no que lo contenga en cualquier posicion.
  686 |         const archivo = (src ?? '').split('?')[0];
  687 |         expect(archivo.endsWith(cfg.imagen),
  688 |           `La imagen tiene que ser ${cfg.imagen} y el src es "${src}"`,
  689 |         ).toBe(true);
  690 |       }
  691 |     });
  692 |   }
  693 | 
  694 | 
  695 |   /**
  696 |    * Compara los importes con la linea base capturada: si un cambio del sistema
  697 |    * altera un precio, el recargo por idioma o la marca TARIFA EXTENDIDA, falla.
  698 |    * Se recorren todas las solapas de idioma, porque el precio cambia entre ellas.
  699 |    */
  700 |   async function validarImportes(page: Page, t: TarifarioPage, clave: string, cfg: any) {
  701 |     const esperado = (lineaBase.items as Record<string, any>)[clave];
  702 |     if (!esperado) return;
  703 | 
  704 |     await paso(page, 'Los importes coinciden con la linea base', async () => {
  705 |       const actual = await t.capturarTarifas(cfg.container);
  706 | 
  707 |       const resumen = (x: any) =>
  708 |         Object.entries(x.porIdioma)
  709 |           .map(([idioma, filas]: any) => `[${idioma}] ` + filas.map((f: string[]) => f.join(' | ')).join(SALTO))
  710 |           .join(SALTO);
  711 | 
  712 |       await adjuntarTexto('Importes esperados (linea base)', resumen(esperado).slice(0, 4000));
  713 |       await adjuntarTexto('Importes en pantalla', resumen(actual).slice(0, 4000));
  714 | 
  715 |       expect(actual.solapasIdioma,
  716 |         `Tiene que haber ${esperado.solapasIdioma} solapas de idioma`,
  717 |       ).toBe(esperado.solapasIdioma);
  718 | 
  719 |       expect(actual.tarifaExtendida,
  720 |         `Tiene que haber ${esperado.tarifaExtendida} marcas TARIFA EXTENDIDA`,
  721 |       ).toBe(esperado.tarifaExtendida);
  722 | 
  723 |       for (const [idioma, filasEsperadas] of Object.entries(esperado.porIdioma) as [string, string[][]][]) {
  724 |         const filasActuales = actual.porIdioma[idioma];
  725 |         expect(filasActuales, `Tiene que existir la solapa de idioma "${idioma}"`).toBeDefined();
  726 | 
  727 |         // Se compara fila por fila para poder senalar cual difiere, en vez de
  728 |         // decir "cambiaron los importes" sin precisar donde.
  729 |         const maximo = Math.max(filasEsperadas.length, filasActuales.length);
  730 |         for (let i = 0; i < maximo; i++) {
  731 |           const esp = filasEsperadas[i] ? filasEsperadas[i].join(' | ') : '(no existe)';
  732 |           const act = filasActuales[i] ? filasActuales[i].join(' | ') : '(no existe)';
  733 |           if (esp !== act) {
  734 |             // Al capturar se recorrieron todas las solapas: hay que volver a la
  735 |             // que fallo para que la captura muestre el dato correcto.
  736 |             await t.volverASolapaIdioma(idioma);
  737 |             await resaltarYCapturar(page, t.locatorFilaTarifa(cfg.container, i),
  738 |               `FALLA: fila ${i} de la solapa "${idioma}"`);
  739 |             expect(act,
  740 |               `La fila ${i} de la solapa "${idioma}" tiene que coincidir con la linea base.` + SALTO +
  741 |               `esperado: ${esp}` + SALTO + `en pantalla: ${act}`,
  742 |             ).toBe(esp);
  743 |           }
  744 |         }
  745 |         expect(filasActuales.length,
  746 |           `La cantidad de filas de la solapa "${idioma}" tiene que ser ${filasEsperadas.length}`,
  747 |         ).toBe(filasEsperadas.length);
  748 |       }
  749 |     });
  750 |   }
  751 | 
  752 |   async function validarItem(page: Page, cfg: Config, titulo: string) {
  753 |     const tarifario = new TarifarioPage(page);
  754 |     const ciudad = CIUDAD[cfg.tab] ?? 'Buenos Aires';
  755 | 
  756 |     await paso(page, `Filtrar por Argentina / ${ciudad} y buscar`, async () => {
  757 |       await tarifario.seleccionarPais('Argentina');
  758 |       await tarifario.seleccionarCiudad(ciudad);
  759 |       const filtros = await tarifario.filtrosActuales();
  760 |       await adjuntarTexto('Filtros aplicados',
  761 |         `Pais: ${filtros.pais}\nCiudad: ${filtros.ciudad}`);
  762 |       await tarifario.buscar();
  763 |     });
  764 | 
  765 |     await paso(page, `Abrir la pestania ${titulo} y esperar tarifas`, async () => {
  766 |       const disponible = await tarifario.pestaniaEstaDisponible(cfg.tab);
  767 |       expect(disponible, `La pestania ${titulo} tiene que estar visible`).toBe(true);
  768 |       await tarifario.abrirPestania(cfg.tab, cfg.container);
  769 |     });
  770 | 
  771 |     await paso(page, `Buscar "${cfg.terminoBusqueda}" en el buscador de la pantalla`, async () => {
  772 |       await tarifario.buscarPorNombre(cfg.terminoBusqueda, cfg.nombre);
  773 |     });
  774 | 
  775 |     await paso(page, 'El item aparece con su nombre exacto', async () => {
  776 |       // Contra el <h2> de la card y por IGUALDAD. Antes se buscaba el nombre
  777 |       // dentro del texto completo de la pestania: agregarle una palabra adelante
  778 |       // no se detectaba porque el nombre original seguia estando adentro.
```