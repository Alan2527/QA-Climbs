# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-a/tarifario.spec.ts >> Tarifario >> Excursiones: trae tarifas y muestra la excursion esperada
- Location: tests/bloque-a/tarifario.spec.ts:960:7

# Error details

```
Error: La fila 1 de la solapa "Español" tiene que coincidir con la linea base.
esperado: 01/07/2026 - 31/12/2031 Recargo por idioma 10% | Regular | Mínimo 2 pasajeros | USD 10 TARIFA EXTENDIDA
en pantalla: 01/07/2026 - 31/12/2031 Recargo por idioma 10% | Regular | Mínimo 2 pasajeros | USD 95 TARIFA EXTENDIDA

expect(received).toBe(expected) // Object.is equality

Expected: "01/07/2026 - 31/12/2031 Recargo por idioma 10% | Regular | Mínimo 2 pasajeros | USD 10 TARIFA EXTENDIDA"
Received: "01/07/2026 - 31/12/2031 Recargo por idioma 10% | Regular | Mínimo 2 pasajeros | USD 95 TARIFA EXTENDIDA"
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
        - generic:
          - generic: 
          - text: Entorno de test
      - generic [ref=f2e13]:
        - combobox [ref=f2e14]:
          - option "Buscar agencia..." [selected]
        - generic [ref=f2e16]:
          - combobox "Buscar agencia..." [ref=f2e17]
          - generic "Volver a mi agencia" [ref=f2e18] [cursor=pointer]: ⨯
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
              - /url: /online/defaulttariff.aspx?country=10&city=5000&from=28-09-2026&to=28-03-2028&resident=false&tab=tour&tourId=0
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
        - button "Novedades" [ref=f2e43] [cursor=pointer]
        - text:  
        - generic [ref=f2e47]:
          - list [ref=f2e48]:
            - listitem [ref=f2e49]:
              - link [ref=f2e50] [cursor=pointer]:
                - /url: https://qa.amv.travel/online/ShoppingCartPage.aspx
          - list [ref=f2e56]:
            - listitem [ref=f2e57]:
              - link "M 0.50 " [ref=f2e58] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f2e59]:
                  - generic [ref=f2e60]: M 0.50
                  - generic [ref=f2e61]: 
          - list [ref=f2e62]:
            - listitem [ref=f2e63]:
              - link "Pablo " [ref=f2e64] [cursor=pointer]:
                - /url: "#"
                - text: Pablo
                - generic [ref=f2e65]: 
          - list [ref=f2e66]:
            - listitem [ref=f2e67]:
              - link "ES " [ref=f2e68] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f2e69]: ES
                - generic [ref=f2e70]: 
      - generic [ref=f2e73]:
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - generic: 
                  - text: TARIFARIOS
                - heading "Todas las tarifas, en un solo lugar" [level=1]
                - paragraph: Elegí país y destino, recorré cada sección y cotizá en un clic.
      - generic "Scroll To Top" [ref=f2e81] [cursor=pointer]:
        - img [ref=f2e82]: 
      - generic [ref=f2e89]:
        - generic [ref=f2e91]:
          - list [ref=f2e93]:
            - listitem [ref=f2e94]:
              - link "PAQUETES" [ref=f2e95] [cursor=pointer]:
                - /url: "#tour"
            - listitem [ref=f2e96]:
              - link "EXCURSIONES" [ref=f2e97]:
                - /url: "#excursion"
            - listitem [ref=f2e98]:
              - link "HOTELES" [ref=f2e99] [cursor=pointer]:
                - /url: "#hotel"
            - listitem [ref=f2e100]:
              - link "TRASLADOS" [ref=f2e101] [cursor=pointer]:
                - /url: "#transfer"
            - listitem [ref=f2e102]:
              - link "CENA SHOW" [ref=f2e103] [cursor=pointer]:
                - /url: "#show"
            - listitem [ref=f2e104]:
              - link "CRUCEROS" [ref=f2e105] [cursor=pointer]:
                - /url: "#cruise"
            - listitem [ref=f2e106]:
              - link "OFERTAS" [ref=f2e107] [cursor=pointer]:
                - /url: "#opportunity"
          - generic [ref=f2e110]:
            - generic [ref=f2e111]:
              - paragraph [ref=f2e112]:
                - generic [ref=f2e113]: 
                - strong [ref=f2e114]: País
              - combobox [ref=f2e115]:
                - option "Argentina"
                - option "Bolivia"
                - option "Brasil"
                - option "Chile"
                - option "Mexico"
                - option "Paraguay"
                - option "Perú"
                - option "Uruguay"
                - option "Todos" [selected]
              - combobox [ref=f2e117] [cursor=pointer]:
                - text: 
                - generic [ref=f2e118]: Todos
            - generic [ref=f2e119]:
              - paragraph [ref=f2e120]:
                - generic [ref=f2e121]: 
                - strong [ref=f2e122]: Destino
              - combobox [ref=f2e123]:
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
              - generic [ref=f2e125] [cursor=pointer]:
                - text: 
                - generic [ref=f2e126]: Buenos Aires
                - combobox [ref=f2e127]
            - link "Buscar" [ref=f2e129] [cursor=pointer]:
              - /url: javascript:__doPostBack('ctl00$cphMainSlider$ctrlTariffFilterControl$lnkView','')
        - generic [ref=f2e130]:
          - complementary "Filtrar resultados" [ref=f2e131]:
            - generic [ref=f2e132]:
              - generic [ref=f2e133]: 
              - generic [ref=f2e134]: Filtrar resultados
            - generic [ref=f2e135]:
              - generic [ref=f2e136]: Tipo
              - combobox [ref=f2e137]:
                - option "Hoteles"
                - option "Traslados"
                - option "Cena show"
                - option "Cruceros"
                - option "Ofertas"
                - option "Paquetes"
                - option
                - option "Excursiones" [selected]
              - combobox "Tipo" [ref=f2e139] [cursor=pointer]:
                - text: 
                - generic [ref=f2e140]: Excursiones
            - generic [ref=f2e141]:
              - generic [ref=f2e143]:
                - generic: 
                - combobox [ref=f2e144]:
                  - option
                  - option "AUTO-QA NO TOCAR - Tigre y Delta" [selected]
                - generic [ref=f2e145]:
                  - generic [ref=f2e146] [cursor=pointer]:
                    - generic [ref=f2e147]:
                      - text: AUTO-QA NO TOCAR - Tigre y Delta
                      - generic [ref=f2e148]: AUTO-QA Gastronomía
                      - generic [ref=f2e149]: AUTO-QA Nocturno
                    - combobox "Buscar excursiones por nombre" [ref=f2e150]
                  - text: 
                - button "Limpiar" [ref=f2e151] [cursor=pointer]:
                  - generic [ref=f2e152]: 
              - generic [ref=f2e153]:
                - button "AUTO-QA Gastronomía" [ref=f2e154] [cursor=pointer]
                - button "AUTO-QA Nocturno" [ref=f2e155] [cursor=pointer]
                - button "QA4735 Gastronomía" [ref=f2e156] [cursor=pointer]
                - button "QA4735 Nieve" [ref=f2e157] [cursor=pointer]
                - button "Tag Test2" [ref=f2e158] [cursor=pointer]
            - generic [ref=f2e159]:
              - generic [ref=f2e160]: Proveedor
              - textbox "Buscar proveedor…" [ref=f2e162]
          - generic [ref=f2e165]:
            - strong [ref=f2e166]: 1 excursión
            - text: en Buenos Aires
          - generic [ref=f2e168]:
            - generic [ref=f2e177]:
              - generic [ref=f2e179]:
                - generic [ref=f2e181]:
                  - img "AUTO-QA NO TOCAR - Tigre y Delta" [ref=f2e185]
                  - img "Tigre & Delta" [ref=f2e189]
                  - img "Tigre & Delta" [ref=f2e193]
                - text:  
                - generic [ref=f2e194]:
                  - generic [ref=f2e195] [cursor=pointer]
                  - generic [ref=f2e196] [cursor=pointer]
                  - generic [ref=f2e197] [cursor=pointer]
              - generic [ref=f2e198]:
                - generic [ref=f2e199]:
                  - heading "AUTO-QA NO TOCAR - Tigre y Delta Medio día" [level=2] [ref=f2e200]:
                    - text: AUTO-QA NO TOCAR - Tigre y Delta
                    - generic [ref=f2e201]: Medio día
                  - tabpanel [ref=f2e203]:
                    - generic [ref=f2e205]:
                      - text: "SALIDAS: Diarias HORARIO: 8.45/ 9 a 14hs aproximadamente DURACIÓN: 5hs OPERATIVIDAD: Todo el año. Excepto el 1 de Mayo, el 25 de diciembre y el 01 de enero MENORES: Consultar…"
                      - link "Ver Detalle" [ref=f2e206] [cursor=pointer]:
                        - /url: javascript:void(0);
                - generic [ref=f2e207]:
                  - generic [ref=f2e208]: AUTO-QA Gastronomía
                  - generic [ref=f2e209]: AUTO-QA Nocturno
                - generic [ref=f2e210]:
                  - generic [ref=f2e211]:
                    - generic [ref=f2e212]: 
                    - generic [ref=f2e213]: Sujeto a modificaciones según condiciones del río
                  - generic [ref=f2e214]:
                    - generic [ref=f2e215]: 
                    - generic [ref=f2e216]: Traer ropa cómoda y calzado antideslizante
                - generic [ref=f2e217]:
                  - generic [ref=f2e218]:
                    - generic [ref=f2e219]: 
                    - text: 02:00
                  - generic [ref=f2e221]:
                    - generic [ref=f2e222]: 
                    - text: ES, EN, PT
                  - generic [ref=f2e224]:
                    - generic [ref=f2e225]: 
                    - generic [ref=f2e226]:
                      - text: Todos los dias
                      - generic [ref=f2e227]: Ene–May, Ago–Dic
                  - generic [ref=f2e229]: 
                - generic [ref=f2e231]:
                  - button "" [ref=f2e232] [cursor=pointer]
                  - link "Ver Tarifario" [ref=f2e234] [cursor=pointer]:
                    - /url: javascript:void(0);
                    - generic [ref=f2e235]: 
                    - text: Ver Tarifario
            - text:                                                                                      
      - dialog [ref=f2e236]:
        - document [ref=f2e237]:
          - generic [ref=f2e238]:
            - generic [ref=f2e239]:
              - heading [level=3] [ref=f2e241]:
                - text: AUTO-QA NO TOCAR - Tigre y Delta
                - generic [ref=f2e242]: Medio día
              - button [ref=f2e243] [cursor=pointer]:
                - generic [ref=f2e244]: 
            - generic [ref=f2e245]:
              - generic [ref=f2e246]:
                - generic [ref=f2e247]: Vigencia
                - generic [ref=f2e248]:
                  - generic [ref=f2e249]:
                    - generic: 
                    - textbox [ref=f2e250] [cursor=pointer]:
                      - /placeholder: Desde
                  - generic [ref=f2e251]:
                    - generic: 
                    - textbox [ref=f2e252] [cursor=pointer]:
                      - /placeholder: Hasta
                  - button [ref=f2e253] [cursor=pointer]:
                    - generic [ref=f2e254]: 
                    - generic [ref=f2e255]: Buscar
              - generic [ref=f2e256]:
                - generic [ref=f2e257]: Pasajeros
                - generic [ref=f2e258]:
                  - button [ref=f2e259] [cursor=pointer]:
                    - generic [ref=f2e260]: 
                  - textbox [ref=f2e261]
                  - button [ref=f2e262] [cursor=pointer]:
                    - generic [ref=f2e263]: 
              - text: 
            - generic [ref=f2e264]:
              - navigation [ref=f2e265]:
                - generic [ref=f2e266]: Idioma
                - button [ref=f2e267] [cursor=pointer]:
                  - generic [ref=f2e268]: Español
                - button [ref=f2e269] [cursor=pointer]:
                  - generic [ref=f2e270]: Inglés
                - button [active] [ref=f2e271] [cursor=pointer]:
                  - generic [ref=f2e272]: Portugués
              - generic [ref=f2e273]:
                - text: 
                - table [ref=f2e275]:
                  - rowgroup [ref=f2e276]:
                    - row [ref=f2e277]:
                      - columnheader [ref=f2e278]: FECHAS
                      - columnheader [ref=f2e279]: TIPO DE SERVICIO
                      - columnheader [ref=f2e280]: PAX
                      - columnheader [ref=f2e281]: PRECIO POR PERSONA
                  - rowgroup [ref=f2e282]:
                    - row [ref=f2e283]:
                      - cell [ref=f2e284]:
                        - paragraph [ref=f2e285]: 01/07/2026 - 31/12/2031
                        - paragraph [ref=f2e287]: Recargo por idioma 10%
                      - cell [ref=f2e288]:
                        - paragraph [ref=f2e289]: Regular
                      - cell [ref=f2e290]:
                        - paragraph [ref=f2e291]: Mínimo 2 pasajeros
                      - cell [ref=f2e292]:
                        - paragraph [ref=f2e293]: USD 95
                        - generic [ref=f2e294] [cursor=pointer]: TARIFA EXTENDIDA
                    - row [ref=f2e296]:
                      - cell [ref=f2e297]:
                        - paragraph [ref=f2e298]: 01/07/2026 - 31/12/2031
                      - cell [ref=f2e299]:
                        - paragraph [ref=f2e300]: Privado
                      - cell [ref=f2e301]:
                        - paragraph [ref=f2e302]: "1"
                      - cell [ref=f2e303]:
                        - paragraph [ref=f2e304]: USD 793
                        - generic [ref=f2e305] [cursor=pointer]: TARIFA EXTENDIDA
                    - row [ref=f2e307]:
                      - cell [ref=f2e308]:
                        - paragraph [ref=f2e309]: 01/07/2026 - 31/12/2031
                      - cell [ref=f2e310]:
                        - paragraph [ref=f2e311]: Privado
                      - cell [ref=f2e312]:
                        - paragraph [ref=f2e313]: "2"
                      - cell [ref=f2e314]:
                        - paragraph [ref=f2e315]: USD 417
                        - generic [ref=f2e316] [cursor=pointer]: TARIFA EXTENDIDA
                    - row [ref=f2e318]:
                      - cell [ref=f2e319]:
                        - paragraph [ref=f2e320]: 01/07/2026 - 31/12/2031
                      - cell [ref=f2e321]:
                        - paragraph [ref=f2e322]: Privado
                      - cell [ref=f2e323]:
                        - paragraph [ref=f2e324]: "3"
                      - cell [ref=f2e325]:
                        - paragraph [ref=f2e326]: USD 328
                        - generic [ref=f2e327] [cursor=pointer]: TARIFA EXTENDIDA
                    - row [ref=f2e329]:
                      - cell [ref=f2e330]:
                        - paragraph [ref=f2e331]: 01/07/2026 - 31/12/2031
                      - cell [ref=f2e332]:
                        - paragraph [ref=f2e333]: Privado
                      - cell [ref=f2e334]:
                        - paragraph [ref=f2e335]: 4 - 6
                      - cell [ref=f2e336]:
                        - paragraph [ref=f2e337]: USD 256
                        - generic [ref=f2e338] [cursor=pointer]: TARIFA EXTENDIDA
                    - row [ref=f2e340]:
                      - cell [ref=f2e341]:
                        - paragraph [ref=f2e342]: 01/07/2026 - 31/12/2031
                      - cell [ref=f2e343]:
                        - paragraph [ref=f2e344]: Privado
                      - cell [ref=f2e345]:
                        - paragraph [ref=f2e346]: 7 - 9
                      - cell [ref=f2e347]:
                        - paragraph [ref=f2e348]: USD 164
                        - generic [ref=f2e349] [cursor=pointer]: TARIFA EXTENDIDA
    - complementary
    - generic [ref=f2e354]:
      - generic [ref=f2e355]: AMV. TRAVEL
      - generic [ref=f2e356]:
        - generic [ref=f2e357]:
          - generic [ref=f2e358]: 
          - text: Avenida Córdoba 673 1°B
        - link " 54 11 50313060" [ref=f2e359] [cursor=pointer]:
          - /url: tel:54 11 50313060
          - generic [ref=f2e360]: 
          - text: 54 11 50313060
        - link "hello@amv.travel" [ref=f2e361] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
    - text:         
  - dialog [ref=f2e365]:
    - generic [ref=f2e366]:
      - heading [level=2] [ref=f2e367]: Tu carrito
      - button [ref=f2e368] [cursor=pointer]:
        - generic [ref=f2e369]: 
    - generic [ref=f2e371]:
      - generic [ref=f2e372]: 
      - generic [ref=f2e373]: Tu carrito está vacío
      - generic [ref=f2e374]: Buscá hoteles, excursiones o traslados y los vas a ver acá.
    - text: 
  - text:          
```

# Test source

```ts
  689 |       for (const clave of Object.keys(esperados)) {
  690 |         if (hay[clave] !== esperados[clave]) {
  691 |           await resaltarYCapturar(
  692 |             page,
  693 |             t.locatorDeComponente(cfg.container, clave),
  694 |             `FALLA: componente "${clave}"`,
  695 |             t.locatorCard(cfg.container),
  696 |           );
  697 |         }
  698 |         expect(hay[clave],
  699 |           esperados[clave]
  700 |             ? `El componente "${clave}" tiene que estar en la card`
  701 |             : `El componente "${clave}" no tiene que estar en esta pestania`,
  702 |         ).toBe(esperados[clave]);
  703 |       }
  704 | 
  705 |       // La imagen tiene que ser la cargada en la base, no el placeholder.
  706 |       if (cfg.imagen) {
  707 |         expect(src, 'La card tiene que mostrar una imagen').not.toBeNull();
  708 |         // Anclado al final: el src es una ruta, asi que se exige que termine con
  709 |         // el archivo esperado y no que lo contenga en cualquier posicion.
  710 |         const archivo = (src ?? '').split('?')[0];
  711 |         expect(archivo.endsWith(cfg.imagen),
  712 |           `La imagen tiene que ser ${cfg.imagen} y el src es "${src}"`,
  713 |         ).toBe(true);
  714 |       }
  715 |     });
  716 |   }
  717 | 
  718 | 
  719 |   /**
  720 |    * Compara los importes con la linea base capturada: si un cambio del sistema
  721 |    * altera un precio, el recargo por idioma o la marca TARIFA EXTENDIDA, falla.
  722 |    * Se recorren todas las solapas de idioma, porque el precio cambia entre ellas.
  723 |    */
  724 |   async function validarImportes(page: Page, t: TarifarioPage, clave: string, cfg: any) {
  725 |     const original = (lineaBase.items as Record<string, any>)[clave];
  726 |     if (!original) return;
  727 |     // Copia: la alineacion de vigencias la modifica, y el JSON importado se comparte
  728 |     // entre tests y reintentos del mismo worker.
  729 |     const esperado = structuredClone(original);
  730 | 
  731 |     await paso(page, 'Los importes coinciden con la linea base', async () => {
  732 |       const actual = await t.capturarTarifas(cfg.container);
  733 | 
  734 |       // Tarifario por temporadas (la oferta): las dos tablas se llevan al tramo que
  735 |       // va de hoy al fin de lo que conocia la linea base, para que una ventana que
  736 |       // termina no haga fallar el test. Ver alinearVigencias en utils/pasos.
  737 |       if (cfg.alinearVigencias) {
  738 |         const captura = new Date(`${lineaBase._capturada}T00:00:00`);
  739 |         const hoy = new Date();
  740 |         const horizonte = new Date(captura);
  741 |         horizonte.setMonth(horizonte.getMonth() + 18);
  742 |         for (const idioma of Object.keys(esperado.porIdioma)) {
  743 |           esperado.porIdioma[idioma] = alinearVigencias(esperado.porIdioma[idioma], captura, hoy, horizonte);
  744 |           if (actual.porIdioma[idioma]) {
  745 |             actual.porIdioma[idioma] = alinearVigencias(actual.porIdioma[idioma], hoy, hoy, horizonte);
  746 |           }
  747 |           // Pasados los 18 meses de la captura no queda nada que comparar: hay que recapturar.
  748 |           expect(esperado.porIdioma[idioma].length,
  749 |             `La linea base de la solapa "${idioma}" ya no cubre ninguna vigencia vigente: recapturarla con npm run lineabase`,
  750 |           ).toBeGreaterThan(1);
  751 |         }
  752 |       }
  753 | 
  754 |       const resumen = (x: any) =>
  755 |         Object.entries(x.porIdioma)
  756 |           .map(([idioma, filas]: any) => `[${idioma}] ` + filas.map((f: string[]) => f.join(' | ')).join(SALTO))
  757 |           .join(SALTO);
  758 | 
  759 |       await adjuntarTexto('Importes esperados (linea base)', resumen(esperado).slice(0, 4000));
  760 |       await adjuntarTexto('Importes en pantalla', resumen(actual).slice(0, 4000));
  761 | 
  762 |       expect(actual.solapasIdioma,
  763 |         `Tiene que haber ${esperado.solapasIdioma} solapas de idioma`,
  764 |       ).toBe(esperado.solapasIdioma);
  765 | 
  766 |       expect(actual.tarifaExtendida,
  767 |         `Tiene que haber ${esperado.tarifaExtendida} marcas TARIFA EXTENDIDA`,
  768 |       ).toBe(esperado.tarifaExtendida);
  769 | 
  770 |       for (const [idioma, filasEsperadas] of Object.entries(esperado.porIdioma) as [string, string[][]][]) {
  771 |         const filasActuales = actual.porIdioma[idioma];
  772 |         expect(filasActuales, `Tiene que existir la solapa de idioma "${idioma}"`).toBeDefined();
  773 | 
  774 |         // Se compara fila por fila para poder senalar cual difiere, en vez de
  775 |         // decir "cambiaron los importes" sin precisar donde.
  776 |         const maximo = Math.max(filasEsperadas.length, filasActuales.length);
  777 |         for (let i = 0; i < maximo; i++) {
  778 |           const esp = filasEsperadas[i] ? filasEsperadas[i].join(' | ') : '(no existe)';
  779 |           const act = filasActuales[i] ? filasActuales[i].join(' | ') : '(no existe)';
  780 |           if (esp !== act) {
  781 |             // Al capturar se recorrieron todas las solapas: hay que volver a la
  782 |             // que fallo para que la captura muestre el dato correcto.
  783 |             await t.volverASolapaIdioma(idioma);
  784 |             await resaltarYCapturar(page, t.locatorFilaTarifa(cfg.container, i),
  785 |               `FALLA: fila ${i} de la solapa "${idioma}"`);
  786 |             expect(act,
  787 |               `La fila ${i} de la solapa "${idioma}" tiene que coincidir con la linea base.` + SALTO +
  788 |               `esperado: ${esp}` + SALTO + `en pantalla: ${act}`,
> 789 |             ).toBe(esp);
      |               ^ Error: La fila 1 de la solapa "Español" tiene que coincidir con la linea base.
  790 |           }
  791 |         }
  792 |         expect(filasActuales.length,
  793 |           `La cantidad de filas de la solapa "${idioma}" tiene que ser ${filasEsperadas.length}`,
  794 |         ).toBe(filasEsperadas.length);
  795 |       }
  796 |     });
  797 | 
  798 |     // Desde el rediseno `c9f4074b` el tarifario se abre en el explorador en casi
  799 |     // todas las pestanias, y el modal tapa la card: los pasos que siguen —el modal
  800 |     // de proveedores, "Ver detalle", las descargas— no llegan a hacer clic. Cerrarlo
  801 |     // aca vale para todas; en Cruceros, que no abre explorador, no hace nada.
  802 |     await t.cerrarExplorador();
  803 |   }
  804 | 
  805 |   async function validarItem(page: Page, cfg: Config, titulo: string) {
  806 |     const tarifario = new TarifarioPage(page);
  807 |     const ciudad = CIUDAD[cfg.tab] ?? 'Buenos Aires';
  808 | 
  809 |     await paso(page, `Filtrar por Argentina / ${ciudad} y buscar`, async () => {
  810 |       await tarifario.seleccionarPais('Argentina');
  811 |       await tarifario.seleccionarCiudad(ciudad);
  812 |       const filtros = await tarifario.filtrosActuales();
  813 |       await adjuntarTexto('Filtros aplicados',
  814 |         `Pais: ${filtros.pais}\nCiudad: ${filtros.ciudad}`);
  815 |       await tarifario.buscar();
  816 |     });
  817 | 
  818 |     await paso(page, `Abrir la pestania ${titulo} y esperar tarifas`, async () => {
  819 |       const disponible = await tarifario.pestaniaEstaDisponible(cfg.tab);
  820 |       expect(disponible, `La pestania ${titulo} tiene que estar visible`).toBe(true);
  821 |       await tarifario.abrirPestania(cfg.tab, cfg.container);
  822 |     });
  823 | 
  824 |     await paso(page, `Buscar "${cfg.terminoBusqueda}" en el buscador de la pantalla`, async () => {
  825 |       await tarifario.buscarPorNombre(cfg.terminoBusqueda, cfg.nombre);
  826 |     });
  827 | 
  828 |     await paso(page, 'El item aparece con su nombre exacto', async () => {
  829 |       // Contra el <h2> de la card y por IGUALDAD. Antes se buscaba el nombre
  830 |       // dentro del texto completo de la pestania: agregarle una palabra adelante
  831 |       // no se detectaba porque el nombre original seguia estando adentro.
  832 |       const nombre = await tarifario.nombreDelItem(cfg.container);
  833 |       const pastillas = await tarifario.pastillasDeLaCard(cfg.container);
  834 |       const texto = await tarifario.textoDe(cfg.container);
  835 | 
  836 |       // Desde el rediseno `c9f4074b` el titulo puede llevar pastillas al lado del
  837 |       // nombre —la categoria del hotel, la duracion del servicio, las noches del
  838 |       // paquete—, que se comparan aparte. En Paquetes el nombre ademas se corta en
  839 |       // el primer parentesis y la duracion pasa a la pastilla, asi que el esperado
  840 |       // de la card no es el nombre completo de la base: va en `nombreEnLaCard`.
  841 |       const esperado = cfg.nombreEnLaCard ?? cfg.nombre;
  842 |       await adjuntarTexto('Esperado', `ID: ${cfg.id}\nNombre: ${cfg.nombre}\nEn la card: ${esperado}`);
  843 |       await adjuntarTexto('Obtenido en pantalla',
  844 |         'titulo de la card: ' + nombre + SALTO +
  845 |         'pastillas: ' + JSON.stringify(pastillas) + SALTO + SALTO + texto.slice(0, 3000));
  846 | 
  847 |       await conResaltado(page, tarifario.locatorTituloDeLaCard(cfg.container),
  848 |         'el nombre del item no coincide', () => {
  849 |           expect(norm(nombre), `El titulo de la card tiene que ser "${esperado}"`)
  850 |             .toBe(norm(esperado));
  851 |         });
  852 | 
  853 |       const pastillaEsperada = cfg.pastillaDelTitulo;
  854 |       if (pastillaEsperada) {
  855 |         await conResaltado(page, tarifario.locatorTituloDeLaCard(cfg.container),
  856 |           'la pastilla del titulo no coincide', () => {
  857 |             expect(pastillas.map(norm),
  858 |               `El titulo de la card tiene que mostrar la pastilla "${pastillaEsperada}"`)
  859 |               .toContain(norm(pastillaEsperada));
  860 |           });
  861 |       }
  862 |     });
  863 | 
  864 |     await validarElementos(page, tarifario, cfg);
  865 |     await validarDescripcionDeLaCard(page, tarifario, cfg);
  866 | 
  867 |     // El estado del boton se guarda para validarlo en su propio paso.
  868 |     let botonesAntes: string[] = [];
  869 |     let botonesDespues: string[] = [];
  870 | 
  871 |     await paso(page, 'Desplegar el tarifario del item', async () => {
  872 |       // Se guarda el texto del boton antes y despues para validarlo en el paso
  873 |       // siguiente: en todas las pestanias tiene que alternar "Ver Tarifario" ->
  874 |       // "Cerrar Tarifario", salvo en Paquetes, donde abre el explorador modal.
  875 |       botonesAntes = await tarifario.textosBotonesTarifario(cfg.container);
  876 |       await tarifario.verTarifario(cfg.container);
  877 |       botonesDespues = await tarifario.textosBotonesTarifario(cfg.container);
  878 |       const filas = await tarifario.leerTablaTarifas(cfg.container);
  879 |       await adjuntarTexto(
  880 |         'Tarifas que muestra la pantalla',
  881 |         filas.map((f) => f.join(' | ')).join(SALTO),
  882 |       );
  883 |       expect(filas.length, 'El tarifario tiene que mostrar filas').toBeGreaterThan(1);
  884 | 
  885 |       const precios = await tarifario.preciosDelTarifario(cfg.container);
  886 |       expect(precios.length, 'El tarifario tiene que mostrar importes').toBeGreaterThan(0);
  887 |     });
  888 | 
  889 |     // El paso exige la misma transicion en todas las pestanias. Antes, en
```