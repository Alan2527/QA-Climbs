# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-a/tarifario.spec.ts >> Tarifario >> Paquetes: trae tarifas y muestra el paquete esperado
- Location: tests/bloque-a/tarifario.spec.ts:945:7

# Error details

```
Error: El explorador tiene que abrirse con el nombre del paquete de la card

expect(received).toContain(expected) // indexOf

Expected substring: "AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)"
Received string:    "AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia6 días / 5 noches"
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
              - link "PAQUETES" [ref=f2e95]:
                - /url: "#tour"
            - listitem [ref=f2e96]:
              - link "EXCURSIONES" [ref=f2e97] [cursor=pointer]:
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
                - option "Excursiones"
                - option "Hoteles"
                - option "Traslados"
                - option "Cena show"
                - option "Cruceros"
                - option "Ofertas"
                - option "Paquetes" [selected]
              - combobox "Tipo" [ref=f2e139] [cursor=pointer]:
                - text: 
                - generic [ref=f2e140]: Paquetes
            - generic [ref=f2e143]:
              - generic: 
              - combobox [ref=f2e144]:
                - option
                - option "AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)" [selected]
              - generic [ref=f2e145]:
                - generic [ref=f2e146] [cursor=pointer]:
                  - generic [ref=f2e147]: AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)
                  - combobox "Buscar paquetes por nombre" [ref=f2e148]
                - text: 
              - button "Limpiar" [ref=f2e149] [cursor=pointer]:
                - generic [ref=f2e150]: 
            - generic [ref=f2e151]:
              - generic [ref=f2e152]:
                - generic [ref=f2e153]: Noches
                - generic [ref=f2e154]: Todas
              - generic [ref=f2e155]:
                - slider "Mín": "0"
                - slider "Máx": "30"
              - generic [ref=f2e158]:
                - generic [ref=f2e159]: "0"
                - generic [ref=f2e160]: 30+
          - generic [ref=f2e163]:
            - strong [ref=f2e164]: 1 paquete
            - text: en Buenos Aires
          - generic [ref=f2e173]:
            - generic [ref=f2e175]:
              - generic [ref=f2e177]:
                - img "AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)" [ref=f2e183]
                - text:  
                - generic [ref=f2e190]:
                  - generic [ref=f2e191] [cursor=pointer]
                  - generic [ref=f2e192] [cursor=pointer]
                  - generic [ref=f2e193] [cursor=pointer]
              - generic [ref=f2e194]:
                - generic [ref=f2e195]:
                  - generic [ref=f2e196]:
                    - generic [ref=f2e197]: 
                    - text: Buenos Aires » Ushuaia
                  - heading "AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia 6 días / 5 noches" [level=2] [ref=f2e198]:
                    - text: AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia
                    - generic [ref=f2e199]: 6 días / 5 noches
                  - tabpanel [ref=f2e201]:
                    - generic [ref=f2e203]:
                      - text: Paquete de datos fijos para pruebas automatizadas. No modificar.
                      - link "Ver detalle" [ref=f2e204] [cursor=pointer]:
                        - /url: javascript:void(0);
                - generic [ref=f2e205]:
                  - button "Descargar en formato Word" [ref=f2e206] [cursor=pointer]:
                    - generic [ref=f2e207]: 
                  - link "Ver Tarifario" [ref=f2e208] [cursor=pointer]:
                    - /url: javascript:void(0);
                    - generic [ref=f2e209]: 
                    - text: Ver Tarifario
                  - link "Cotizar y reservar" [ref=f2e210] [cursor=pointer]:
                    - /url: https://qa.amv.travel/online/customtours/main.aspx?tour=5059&resident=false
            - text: 
      - dialog [active] [ref=f2e211]:
        - document [ref=f2e212]:
          - generic [ref=f2e213]:
            - generic [ref=f2e214]:
              - heading [level=3] [ref=f2e216]:
                - text: AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia
                - generic [ref=f2e217]: 6 días / 5 noches
              - button [ref=f2e218] [cursor=pointer]:
                - generic [ref=f2e219]: 
            - generic [ref=f2e220]:
              - generic [ref=f2e221]:
                - generic [ref=f2e222]: Vigencia
                - generic [ref=f2e223]:
                  - generic [ref=f2e224]:
                    - generic: 
                    - textbox [ref=f2e225] [cursor=pointer]:
                      - /placeholder: Desde
                  - generic [ref=f2e226]:
                    - generic: 
                    - textbox [ref=f2e227] [cursor=pointer]:
                      - /placeholder: Hasta
                  - button [ref=f2e228] [cursor=pointer]:
                    - generic [ref=f2e229]: 
                    - generic [ref=f2e230]: Buscar
              - text:   
            - generic [ref=f2e231]:
              - navigation [ref=f2e232]:
                - generic [ref=f2e233]: 1 categoría disponible
                - button [ref=f2e234] [cursor=pointer]:
                  - generic [ref=f2e235]: test
                  - generic [ref=f2e236]: 2 destinos
                  - generic [ref=f2e238]: Desde USD 2,276 por persona(base doble)
              - generic [ref=f2e239]:
                - text: 
                - generic [ref=f2e240]:
                  - generic [ref=f2e241]:
                    - generic [ref=f2e242]: Idioma del paquete
                    - generic [ref=f2e243]:
                      - button [ref=f2e244] [cursor=pointer]: Español
                      - button [ref=f2e245] [cursor=pointer]: Inglés
                      - button [ref=f2e246] [cursor=pointer]: Portugués
                  - paragraph [ref=f2e248]:
                    - link:
                      - /url: "#"
                      - generic: test
                      - generic:
                        - generic:
                          - generic: 
                          - text: 2 destinos
                      - text: 
                      - paragraph:
                        - generic: 
                        - text: Precio por persona
                  - generic [ref=f2e250]:
                    - generic [ref=f2e251]:
                      - paragraph [ref=f2e252]:
                        - generic [ref=f2e253]: 
                        - text: Hoteles incluidos en esta categoría
                        - generic [ref=f2e254]: 5 noches
                      - list [ref=f2e255]:
                        - listitem [ref=f2e256]:
                          - generic [ref=f2e257]: Buenos Aires
                          - generic [ref=f2e258]:
                            - generic [ref=f2e259]: AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau
                            - generic [ref=f2e260]: Lujo
                          - generic [ref=f2e261]: 3 noches
                        - listitem [ref=f2e262]:
                          - generic [ref=f2e263]: Ushuaia
                          - generic [ref=f2e264]:
                            - generic [ref=f2e265]: AUTO-QA NO TOCAR - Arakur Resort & Spa
                            - generic [ref=f2e266]: Lujo
                          - generic [ref=f2e267]: 2 noches
                    - table [ref=f2e268]:
                      - rowgroup [ref=f2e269]:
                        - row [ref=f2e270]:
                          - columnheader [ref=f2e271]: Vigencia
                          - columnheader [ref=f2e272]: SGL
                          - columnheader [ref=f2e273]: DBL
                          - columnheader [ref=f2e274]: TPL
                      - rowgroup [ref=f2e275]:
                        - row [ref=f2e276]:
                          - cell [ref=f2e277]:
                            - paragraph [ref=f2e278]: 28/09/2026 - 30/09/2026
                          - cell [ref=f2e279]:
                            - paragraph [ref=f2e280]: USD 4,450
                          - cell [ref=f2e281]:
                            - paragraph [ref=f2e282]: USD 2,368
                          - cell [ref=f2e283]:
                            - paragraph [ref=f2e284]: USD 1,940
                        - row [ref=f2e285]:
                          - cell [ref=f2e286]:
                            - paragraph [ref=f2e287]: 01/10/2026 - 31/10/2026
                          - cell [ref=f2e288]:
                            - paragraph [ref=f2e289]: USD 4,870
                          - cell [ref=f2e290]:
                            - paragraph [ref=f2e291]: USD 2,578
                          - cell [ref=f2e292]:
                            - paragraph [ref=f2e293]: USD 2,080
                        - row [ref=f2e294]:
                          - cell [ref=f2e295]:
                            - paragraph [ref=f2e296]: 01/11/2026 - 23/12/2026
                          - cell [ref=f2e297]:
                            - paragraph [ref=f2e298]: USD 5,098
                          - cell [ref=f2e299]:
                            - paragraph [ref=f2e300]: USD 2,670
                          - cell [ref=f2e301]:
                            - paragraph [ref=f2e302]: USD 2,142
                        - row [ref=f2e303]:
                          - cell [ref=f2e304]:
                            - paragraph [ref=f2e305]: 24/12/2026 - 27/12/2026
                          - cell [ref=f2e306]:
                            - paragraph [ref=f2e307]: USD 5,330
                          - cell [ref=f2e308]:
                            - paragraph [ref=f2e309]: USD 2,792
                          - cell [ref=f2e310]:
                            - paragraph [ref=f2e311]: USD 2,224
                        - row [ref=f2e312]:
                          - cell [ref=f2e313]:
                            - paragraph [ref=f2e314]: 03/01/2027 - 03/01/2027
                          - cell [ref=f2e315]:
                            - paragraph [ref=f2e316]: USD 5,330
                          - cell [ref=f2e317]:
                            - paragraph [ref=f2e318]: USD 2,792
                          - cell [ref=f2e319]:
                            - paragraph [ref=f2e320]: USD 2,224
                        - row [ref=f2e321]:
                          - cell [ref=f2e322]:
                            - paragraph [ref=f2e323]: 04/01/2027 - 28/02/2027
                          - cell [ref=f2e324]:
                            - paragraph [ref=f2e325]: USD 5,098
                          - cell [ref=f2e326]:
                            - paragraph [ref=f2e327]: USD 2,670
                          - cell [ref=f2e328]:
                            - paragraph [ref=f2e329]: USD 2,142
                        - row [ref=f2e330]:
                          - cell [ref=f2e331]:
                            - paragraph [ref=f2e332]: 01/03/2027 - 31/03/2027
                          - cell [ref=f2e333]:
                            - paragraph [ref=f2e334]: USD 4,870
                          - cell [ref=f2e335]:
                            - paragraph [ref=f2e336]: USD 2,578
                          - cell [ref=f2e337]:
                            - paragraph [ref=f2e338]: USD 2,080
                        - row [ref=f2e339]:
                          - cell [ref=f2e340]:
                            - paragraph [ref=f2e341]: 01/04/2027 - 30/06/2027
                          - cell [ref=f2e342]:
                            - paragraph [ref=f2e343]: USD 4,286
                          - cell [ref=f2e344]:
                            - paragraph [ref=f2e345]: USD 2,276
                          - cell [ref=f2e346]:
                            - paragraph [ref=f2e347]: USD 1,880
                        - row [ref=f2e348]:
                          - cell [ref=f2e349]:
                            - paragraph [ref=f2e350]: 01/07/2027 - 08/07/2027
                          - cell [ref=f2e351]:
                            - paragraph [ref=f2e352]: USD 4,936
                          - cell [ref=f2e353]:
                            - paragraph [ref=f2e354]: USD 2,590
                          - cell [ref=f2e355]:
                            - paragraph [ref=f2e356]: USD 2,104
                        - row [ref=f2e357]:
                          - cell [ref=f2e358]:
                            - paragraph [ref=f2e359]: 09/07/2027 - 19/09/2027
                          - cell [ref=f2e360]:
                            - paragraph [ref=f2e361]: USD 5,168
                          - cell [ref=f2e362]:
                            - paragraph [ref=f2e363]: USD 2,712
                          - cell [ref=f2e364]:
                            - paragraph [ref=f2e365]: USD 2,186
                        - row [ref=f2e366]:
                          - cell [ref=f2e367]:
                            - paragraph [ref=f2e368]: 20/09/2027 - 30/09/2027
                          - cell [ref=f2e369]:
                            - paragraph [ref=f2e370]: USD 4,708
                          - cell [ref=f2e371]:
                            - paragraph [ref=f2e372]: USD 2,498
                          - cell [ref=f2e373]:
                            - paragraph [ref=f2e374]: USD 2,042
                        - row [ref=f2e375]:
                          - cell [ref=f2e376]:
                            - paragraph [ref=f2e377]: 01/10/2027 - 31/10/2027
                          - cell [ref=f2e378]:
                            - paragraph [ref=f2e379]: USD 5,170
                          - cell [ref=f2e380]:
                            - paragraph [ref=f2e381]: USD 2,728
                          - cell [ref=f2e382]:
                            - paragraph [ref=f2e383]: USD 2,196
                        - row [ref=f2e384]:
                          - cell [ref=f2e385]:
                            - paragraph [ref=f2e386]: 01/11/2027 - 23/12/2027
                          - cell [ref=f2e387]:
                            - paragraph [ref=f2e388]: USD 5,398
                          - cell [ref=f2e389]:
                            - paragraph [ref=f2e390]: USD 2,820
                          - cell [ref=f2e391]:
                            - paragraph [ref=f2e392]: USD 2,258
                        - row [ref=f2e393]:
                          - cell [ref=f2e394]:
                            - paragraph [ref=f2e395]: 24/12/2027 - 27/12/2027
                          - cell [ref=f2e396]:
                            - paragraph [ref=f2e397]: USD 5,630
                          - cell [ref=f2e398]:
                            - paragraph [ref=f2e399]: USD 2,942
                          - cell [ref=f2e400]:
                            - paragraph [ref=f2e401]: USD 2,340
                        - row [ref=f2e402]:
                          - cell [ref=f2e403]:
                            - paragraph [ref=f2e404]: 03/01/2028 - 03/01/2028
                          - cell [ref=f2e405]:
                            - paragraph [ref=f2e406]: USD 5,630
                          - cell [ref=f2e407]:
                            - paragraph [ref=f2e408]: USD 2,942
                          - cell [ref=f2e409]:
                            - paragraph [ref=f2e410]: USD 2,340
                        - row [ref=f2e411]:
                          - cell [ref=f2e412]:
                            - paragraph [ref=f2e413]: 04/01/2028 - 28/02/2028
                          - cell [ref=f2e414]:
                            - paragraph [ref=f2e415]: USD 5,398
                          - cell [ref=f2e416]:
                            - paragraph [ref=f2e417]: USD 2,820
                          - cell [ref=f2e418]:
                            - paragraph [ref=f2e419]: USD 2,258
                        - row [ref=f2e420]:
                          - cell [ref=f2e421]:
                            - paragraph [ref=f2e422]: 01/03/2028 - 28/03/2028
                          - cell [ref=f2e423]:
                            - paragraph [ref=f2e424]: USD 5,170
                          - cell [ref=f2e425]:
                            - paragraph [ref=f2e426]: USD 2,728
                          - cell [ref=f2e427]:
                            - paragraph [ref=f2e428]: USD 2,196
    - complementary
    - generic [ref=f2e432]:
      - generic [ref=f2e433]: AMV. TRAVEL
      - generic [ref=f2e434]:
        - generic [ref=f2e435]:
          - generic [ref=f2e436]: 
          - text: Avenida Córdoba 673 1°B
        - link " 54 11 50313060" [ref=f2e437] [cursor=pointer]:
          - /url: tel:54 11 50313060
          - generic [ref=f2e438]: 
          - text: 54 11 50313060
        - link "hello@amv.travel" [ref=f2e439] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
    - text:         
  - dialog [ref=f2e443]:
    - generic [ref=f2e444]:
      - heading [level=2] [ref=f2e445]: Tu carrito
      - button [ref=f2e446] [cursor=pointer]:
        - generic [ref=f2e447]: 
    - generic [ref=f2e449]:
      - generic [ref=f2e450]: 
      - generic [ref=f2e451]: Tu carrito está vacío
      - generic [ref=f2e452]: Buscá hoteles, excursiones o traslados y los vas a ver acá.
    - text: 
  - text:            
```

# Test source

```ts
  806  |     const tarifario = new TarifarioPage(page);
  807  |     const ciudad = CIUDAD[cfg.tab] ?? 'Buenos Aires';
  808  | 
  809  |     await paso(page, `Filtrar por Argentina / ${ciudad} y buscar`, async () => {
  810  |       await tarifario.seleccionarPais('Argentina');
  811  |       await tarifario.seleccionarCiudad(ciudad);
  812  |       const filtros = await tarifario.filtrosActuales();
  813  |       await adjuntarTexto('Filtros aplicados',
  814  |         `Pais: ${filtros.pais}\nCiudad: ${filtros.ciudad}`);
  815  |       await tarifario.buscar();
  816  |     });
  817  | 
  818  |     await paso(page, `Abrir la pestania ${titulo} y esperar tarifas`, async () => {
  819  |       const disponible = await tarifario.pestaniaEstaDisponible(cfg.tab);
  820  |       expect(disponible, `La pestania ${titulo} tiene que estar visible`).toBe(true);
  821  |       await tarifario.abrirPestania(cfg.tab, cfg.container);
  822  |     });
  823  | 
  824  |     await paso(page, `Buscar "${cfg.terminoBusqueda}" en el buscador de la pantalla`, async () => {
  825  |       await tarifario.buscarPorNombre(cfg.terminoBusqueda, cfg.nombre);
  826  |     });
  827  | 
  828  |     await paso(page, 'El item aparece con su nombre exacto', async () => {
  829  |       // Contra el <h2> de la card y por IGUALDAD. Antes se buscaba el nombre
  830  |       // dentro del texto completo de la pestania: agregarle una palabra adelante
  831  |       // no se detectaba porque el nombre original seguia estando adentro.
  832  |       const nombre = await tarifario.nombreDelItem(cfg.container);
  833  |       const pastillas = await tarifario.pastillasDeLaCard(cfg.container);
  834  |       const texto = await tarifario.textoDe(cfg.container);
  835  | 
  836  |       // Desde el rediseno `c9f4074b` el titulo puede llevar pastillas al lado del
  837  |       // nombre —la categoria del hotel, la duracion del servicio, las noches del
  838  |       // paquete—, que se comparan aparte. En Paquetes el nombre ademas se corta en
  839  |       // el primer parentesis y la duracion pasa a la pastilla, asi que el esperado
  840  |       // de la card no es el nombre completo de la base: va en `nombreEnLaCard`.
  841  |       const esperado = cfg.nombreEnLaCard ?? cfg.nombre;
  842  |       await adjuntarTexto('Esperado', `ID: ${cfg.id}\nNombre: ${cfg.nombre}\nEn la card: ${esperado}`);
  843  |       await adjuntarTexto('Obtenido en pantalla',
  844  |         'titulo de la card: ' + nombre + SALTO +
  845  |         'pastillas: ' + JSON.stringify(pastillas) + SALTO + SALTO + texto.slice(0, 3000));
  846  | 
  847  |       await conResaltado(page, tarifario.locatorTituloDeLaCard(cfg.container),
  848  |         'el nombre del item no coincide', () => {
  849  |           expect(norm(nombre), `El titulo de la card tiene que ser "${esperado}"`)
  850  |             .toBe(norm(esperado));
  851  |         });
  852  | 
  853  |       const pastillaEsperada = cfg.pastillaDelTitulo;
  854  |       if (pastillaEsperada) {
  855  |         await conResaltado(page, tarifario.locatorTituloDeLaCard(cfg.container),
  856  |           'la pastilla del titulo no coincide', () => {
  857  |             expect(pastillas.map(norm),
  858  |               `El titulo de la card tiene que mostrar la pastilla "${pastillaEsperada}"`)
  859  |               .toContain(norm(pastillaEsperada));
  860  |           });
  861  |       }
  862  |     });
  863  | 
  864  |     await validarElementos(page, tarifario, cfg);
  865  |     await validarDescripcionDeLaCard(page, tarifario, cfg);
  866  | 
  867  |     // El estado del boton se guarda para validarlo en su propio paso.
  868  |     let botonesAntes: string[] = [];
  869  |     let botonesDespues: string[] = [];
  870  | 
  871  |     await paso(page, 'Desplegar el tarifario del item', async () => {
  872  |       // Se guarda el texto del boton antes y despues para validarlo en el paso
  873  |       // siguiente: en todas las pestanias tiene que alternar "Ver Tarifario" ->
  874  |       // "Cerrar Tarifario", salvo en Paquetes, donde abre el explorador modal.
  875  |       botonesAntes = await tarifario.textosBotonesTarifario(cfg.container);
  876  |       await tarifario.verTarifario(cfg.container);
  877  |       botonesDespues = await tarifario.textosBotonesTarifario(cfg.container);
  878  |       const filas = await tarifario.leerTablaTarifas(cfg.container);
  879  |       await adjuntarTexto(
  880  |         'Tarifas que muestra la pantalla',
  881  |         filas.map((f) => f.join(' | ')).join(SALTO),
  882  |       );
  883  |       expect(filas.length, 'El tarifario tiene que mostrar filas').toBeGreaterThan(1);
  884  | 
  885  |       const precios = await tarifario.preciosDelTarifario(cfg.container);
  886  |       expect(precios.length, 'El tarifario tiene que mostrar importes').toBeGreaterThan(0);
  887  |     });
  888  | 
  889  |     // El paso exige la misma transicion en todas las pestanias. Antes, en
  890  |     // Cruceros se invertia la validacion y se daba por bueno que el boton
  891  |     // siguiera diciendo "Ver Tarifario": el paso salia en verde con el defecto
  892  |     // a la vista en la captura. Lo que la aplicacion hace no define lo esperado.
  893  |     // Paquetes: desde el rediseno del 09/09 el boton no alterna su texto, abre el
  894  |     // explorador modal. Se exige que abra y que lo haga con el paquete de la card.
  895  |     if ((cfg as any).botonTarifario?.abreModal) {
  896  |       await paso(page, 'El boton "Ver Tarifario" abre el explorador de tarifas', async () => {
  897  |         const soloLetras = (x: string) => x.replace(/[^\p{L} ]/gu, '').trim();
  898  |         expect(botonesAntes.map(soloLetras),
  899  |           `Antes de abrir, la card tiene que ofrecer "${cfg.botonTarifario.textoInicial}"`,
  900  |         ).toContain(cfg.botonTarifario.textoInicial);
  901  |         await expect(page.locator('#tariffExplorerModal'), 'El explorador de tarifas tiene que estar abierto')
  902  |           .toBeVisible();
  903  |         const titulo = (await page.locator('#tariffExplorerTitle').innerText()).replace(/\s+/g, ' ').trim();
  904  |         await adjuntarTexto('Titulo del explorador', titulo);
  905  |         expect(titulo, 'El explorador tiene que abrirse con el nombre del paquete de la card')
> 906  |           .toContain(cfg.nombre);
       |            ^ Error: El explorador tiene que abrirse con el nombre del paquete de la card
  907  |       });
  908  |       return tarifario;
  909  |     }
  910  | 
  911  |     await paso(page, 'El boton pasa de "Ver Tarifario" a "Cerrar Tarifario"', async () => {
  912  |       const btn = cfg.botonTarifario;
  913  |       const hayCerrar = botonesDespues.some((t) => t.includes(btn.textoDesplegado ?? ''));
  914  | 
  915  |       await adjuntarTexto('Transicion del boton',
  916  |         'antes de desplegar:   ' + botonesAntes.join(' | ') + SALTO +
  917  |         'despues de desplegar: ' + botonesDespues.join(' | ') + SALTO +
  918  |         'esperado antes:       ' + btn.textoInicial + SALTO +
  919  |         'esperado despues:     ' + btn.textoDesplegado +
  920  |         (btn._hallazgoConocido ? SALTO + SALTO + 'HALLAZGO CONOCIDO: ' + btn._hallazgoConocido : ''));
  921  | 
  922  |       // Igual que el tag: el boton trae el chevron adelante o atras del texto.
  923  |       const soloLetras = (x: string) => x.replace(/[^\p{L} ]/gu, '').trim();
  924  |       expect(botonesAntes.map(soloLetras),
  925  |         `Antes de desplegar, el boton tiene que decir exactamente "${btn.textoInicial}"`,
  926  |       ).toEqual(botonesAntes.map(() => btn.textoInicial));
  927  | 
  928  |       if (!hayCerrar) {
  929  |         await resaltarYCapturar(page, tarifario.locatorDeComponente(cfg.container, 'botonTarifario'),
  930  |           `FALLA: el boton sigue diciendo "${botonesDespues.join(' | ')}" y deberia decir "${btn.textoDesplegado}"`);
  931  |       }
  932  | 
  933  |       // Soft: el tarifario ya quedo desplegado y con filas (paso anterior), asi
  934  |       // que las validaciones que siguen tienen sentido igual. Con un expect duro
  935  |       // el test cortaba aca y tapaba el resto de los hallazgos de la pestania.
  936  |       expect.soft(hayCerrar,
  937  |         `Al desplegar, el boton deberia pasar a "${btn.textoDesplegado}". ` +
  938  |         `En pantalla dice: ${botonesDespues.join(' | ')}`,
  939  |       ).toBe(true);
  940  |     });
  941  | 
  942  |     return tarifario;
  943  |   }
  944  | 
  945  |   test('Paquetes: trae tarifas y muestra el paquete esperado', async ({ page }) => {
  946  |     const t = await validarItem(page, T.paquetes as Config, 'Paquetes');
  947  |     await validarImportes(page, t, 'paquetes', T.paquetes);
  948  |     // El explorador tapa la card: se cierra antes de seguir con Ver detalle y Word.
  949  |     await t.cerrarExplorador();
  950  |     await validarModalDetalle(page, t, T.paquetes);
  951  |     await validarDescargaWord(page, t, T.paquetes);
  952  |     await paso(page, 'El paquete muestra sus dos ciudades', async () => {
  953  |       const texto = await t.textoDe(T.paquetes.container);
  954  |       for (const c of T.paquetes.ciudades) {
  955  |         expect(texto, `Tiene que aparecer la ciudad ${c.nombre}`).toContain(c.nombre);
  956  |       }
  957  |     });
  958  |   });
  959  | 
  960  |   test('Excursiones: trae tarifas y muestra la excursion esperada', async ({ page }) => {
  961  |     const t = await validarItem(page, T.excursiones as Config, 'Excursiones');
  962  |     await validarImportes(page, t, 'excursiones', T.excursiones);
  963  |     await validarCard(page, t, T.excursiones);
  964  |     await validarProveedores(page, t, T.excursiones);
  965  |     await validarFichaDetalle(page, t, T.excursiones);
  966  |   });
  967  | 
  968  |   test('Hoteles: trae tarifas y muestra el hotel esperado', async ({ page }) => {
  969  |     const thoteles = await validarItem(page, T.hoteles as Config, 'Hoteles');
  970  |     await validarImportes(page, thoteles, 'hoteles', T.hoteles);
  971  |     await validarCard(page, thoteles, T.hoteles);
  972  |     await validarProveedores(page, thoteles, T.hoteles);
  973  |     await validarModalDetalle(page, thoteles, T.hoteles);
  974  |   });
  975  | 
  976  |   test('Traslados: trae tarifas y muestra el traslado esperado', async ({ page }) => {
  977  |     const t = await validarItem(page, T.traslados as Config, 'Traslados');
  978  |     await validarImportes(page, t, 'traslados', T.traslados);
  979  |     await validarCard(page, t, T.traslados);
  980  |     await validarProveedores(page, t, T.traslados);
  981  |     await validarFichaDetalle(page, t, T.traslados);
  982  |   });
  983  | 
  984  |   test('Cena Show: trae tarifas y coinciden con las de la base', async ({ page }) => {
  985  |     const cfg = T.cenaShow;
  986  |     const t = await validarItem(page, cfg as Config, 'Cena Show');
  987  |     await validarImportes(page, t, 'cenaShow', cfg);
  988  | 
  989  |     await paso(page, 'Las tarifas coinciden con las de la base de datos', async () => {
  990  |       // Se lee de la pantalla para no dar falso positivo si alguien lo cambia;
  991  |       // si no se puede leer, se cae al valor documentado en candidatos.json.
  992  |       const leido = await t.markupActivo();
  993  |       const markup = leido ?? candidatos._formulaPrecio.markupPorDefecto;
  994  |       await adjuntarTexto(
  995  |         'Markup aplicado',
  996  |         leido !== null ? `leido de la pantalla: ${leido}` : `no se pudo leer; se usa el documentado: ${markup}`,
  997  |       );
  998  |       expect(markup, 'Tiene que haber un markup con el que calcular').toBeGreaterThan(0);
  999  | 
  1000 |       // Precio mostrado = Math.ceil(TotalRate / markup)  -- ver utils/pasos.ts
  1001 |       const esperados = cfg.tarifasBase.map((x) => ({
  1002 |         tipo: x.tipo,
  1003 |         base: x.totalRate,
  1004 |         esperado: precioMostrado(x.totalRate, markup),
  1005 |       }));
  1006 | 
```