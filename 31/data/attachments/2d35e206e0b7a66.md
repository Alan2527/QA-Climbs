# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-a/tarifario.spec.ts >> Tarifario >> Hoteles: trae tarifas y muestra el hotel esperado
- Location: tests/bloque-a/tarifario.spec.ts:875:7

# Error details

```
Error: La fila 2 de la solapa "sin-solapas" tiene que coincidir con la linea base.
esperado: 01/04/2026 - 30/09/2026 | USD 860 | USD 430 | USD 340
en pantalla: 01/04/2026 - 30/09/2026 Todos los días | USD 860 | USD 430 | USD 340

expect(received).toBe(expected) // Object.is equality

Expected: "01/04/2026 - 30/09/2026 | USD 860 | USD 430 | USD 340"
Received: "01/04/2026 - 30/09/2026 Todos los días | USD 860 | USD 430 | USD 340"
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
              - link "HOTELES" [ref=f2e123]:
                - /url: "#hotel"
            - listitem [ref=f2e124]:
              - link "TRASLADOS" [ref=f2e125] [cursor=pointer]:
                - /url: "#transfer"
            - listitem [ref=f2e126]:
              - link "CENA SHOW" [ref=f2e127] [cursor=pointer]:
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
          - generic [ref=f2e151]:
            - generic [ref=f2e153]:
              - generic: 
              - combobox [ref=f2e154]:
                - option
                - option "AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau" [selected]
              - generic [ref=f2e155]:
                - generic [ref=f2e156] [cursor=pointer]:
                  - generic [ref=f2e157]:
                    - text: AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau
                    - generic [ref=f2e158]: Lujo
                  - combobox "Buscar hoteles por nombre o palabra"
                - text: 
              - button " Limpiar" [ref=f2e159] [cursor=pointer]:
                - generic [ref=f2e160]: 
                - text: Limpiar
            - generic [ref=f2e161]:
              - button "Lujo" [ref=f2e162] [cursor=pointer]
              - button "5*" [ref=f2e163] [cursor=pointer]
              - button "4* Superior" [ref=f2e164] [cursor=pointer]
              - button "4*" [ref=f2e165] [cursor=pointer]
              - button "3* Superior" [ref=f2e166] [cursor=pointer]
              - button "3*" [ref=f2e167] [cursor=pointer]
              - button "Boutique" [ref=f2e168] [cursor=pointer]
              - button "Apart Hotel" [ref=f2e169] [cursor=pointer]
          - generic [ref=f2e170]:
            - text:  
            - generic [ref=f2e172]:
              - strong [ref=f2e173]: "1"
              - text: hotel en Buenos Aires
        - generic [ref=f2e174]:
          - generic [ref=f2e180]:
            - generic [ref=f2e181]:
              - generic [ref=f2e182]:
                - generic [ref=f2e183]:
                  - generic [ref=f2e184]: 
                  - text: Recomendado
                - generic [ref=f2e186]:
                  - generic [ref=f2e188]:
                    - img "AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau" [ref=f2e192]
                    - generic [ref=f2e193]: 
                    - generic [ref=f2e199]: 
                  - text:  
                  - generic [ref=f2e205]:
                    - generic [ref=f2e206] [cursor=pointer]
                    - generic [ref=f2e207] [cursor=pointer]
                    - generic [ref=f2e208] [cursor=pointer]
                - generic [ref=f2e210]:
                  - heading "AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau Lujo" [level=2] [ref=f2e211]:
                    - text: AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau
                    - generic [ref=f2e212]: Lujo
                  - tabpanel [ref=f2e214]:
                    - paragraph [ref=f2e216]:
                      - text: "Ubicación:"
                      - strong [ref=f2e217]: Recoleta
                      - text: "Desayuno:"
                      - strong [ref=f2e218]: Buffet americano
                      - text: Ubicado en el barrio selecto de Recoleta, área de rico patrimonio francés, nuestro hotel de lujo en Buenos Aires, Palacio Duhau - Park Hyatt Buenos Aires se encuentra en Avenida Alvear, cerca de MALBA (Museo de Arte Latinoamericano de Buenos Aires), MNBA (Museo Nacional de Bellas Artes) y Teatro Colón. Ambientado en un edificio que une el resplandor del antiguo palacio francés del 1934 con decoraciones modernas del artista Celedonio Lohidoy, este hotel de 5 estrellas de Buenos Aires respira aun la elegancia del periodo belle-époque. Rodeado por residencias distintas y tiendas lujosas, Palacio ..
                      - link "Ver detalle »" [ref=f2e219] [cursor=pointer]:
                        - /url: javascript:void(0);
                - button "" [ref=f2e221] [cursor=pointer]
              - text: 
              - generic:
                - paragraph [ref=f2e224]:
                  - link "Cerrar Tarifario " [ref=f2e225] [cursor=pointer]:
                    - /url: "#"
                    - text: Cerrar Tarifario
                    - generic [ref=f2e226]: 
                - generic [ref=f2e227]:
                  - paragraph [ref=f2e229]:
                    - link "King Deluxe - Edificio Posadas .." [ref=f2e230] [cursor=pointer]:
                      - /url: "#"
                  - generic [ref=f2e231]:
                    - tablist [ref=f2e232]:
                      - tab "Por rango de fechas" [selected] [ref=f2e233] [cursor=pointer]
                      - tab "Calendario" [ref=f2e234] [cursor=pointer]
                    - table [ref=f2e236]:
                      - rowgroup [ref=f2e237]:
                        - row [ref=f2e238]:
                          - columnheader "Fechas" [ref=f2e239]
                          - columnheader "Precio por noche por persona" [ref=f2e240]
                        - row [ref=f2e241]:
                          - columnheader "SGL" [ref=f2e242]
                          - columnheader "DBL" [ref=f2e243]
                          - columnheader "TPL" [ref=f2e244]
                      - rowgroup [ref=f2e245]:
                        - row [ref=f2e246]:
                          - cell "01/04/2026 - 30/09/2026 Todos los días" [ref=f2e247]:
                            - paragraph [ref=f2e248]: 01/04/2026 - 30/09/2026
                            - generic [ref=f2e249]: Todos los días
                          - cell [ref=f2e250]:
                            - paragraph [ref=f2e251]: USD 860
                          - cell [ref=f2e252]:
                            - paragraph [ref=f2e253]: USD 430
                          - cell [ref=f2e254]:
                            - paragraph [ref=f2e255]: USD 340
                        - row [ref=f2e256]:
                          - cell "01/10/2026 - 27/12/2026 Todos los días" [ref=f2e257]:
                            - paragraph [ref=f2e258]: 01/10/2026 - 27/12/2026
                            - generic [ref=f2e259]: Todos los días
                          - cell [ref=f2e260]:
                            - paragraph [ref=f2e261]: USD 1,000
                          - cell [ref=f2e262]:
                            - paragraph [ref=f2e263]: USD 500
                          - cell [ref=f2e264]:
                            - paragraph [ref=f2e265]: USD 387
                        - row [ref=f2e266]:
                          - cell "03/01/2027 - 31/03/2027 Todos los días" [ref=f2e267]:
                            - paragraph [ref=f2e268]: 03/01/2027 - 31/03/2027
                            - generic [ref=f2e269]: Todos los días
                          - cell [ref=f2e270]:
                            - paragraph [ref=f2e271]: USD 1,000
                          - cell [ref=f2e272]:
                            - paragraph [ref=f2e273]: USD 500
                          - cell [ref=f2e274]:
                            - paragraph [ref=f2e275]: USD 387
                        - row [ref=f2e276]:
                          - cell "01/04/2027 - 30/06/2027 Todos los días" [ref=f2e277]:
                            - paragraph [ref=f2e278]: 01/04/2027 - 30/06/2027
                            - generic [ref=f2e279]: Todos los días
                          - cell [ref=f2e280]:
                            - paragraph [ref=f2e281]: USD 860
                          - cell [ref=f2e282]:
                            - paragraph [ref=f2e283]: USD 430
                          - cell [ref=f2e284]:
                            - paragraph [ref=f2e285]: USD 340
                        - row [ref=f2e286]:
                          - cell "01/07/2027 - 30/09/2027 Todos los días" [ref=f2e287]:
                            - paragraph [ref=f2e288]: 01/07/2027 - 30/09/2027
                            - generic [ref=f2e289]: Todos los días
                          - cell "USD 946 TARIFA EXTENDIDA" [ref=f2e290]:
                            - paragraph [ref=f2e291]: USD 946
                            - generic [ref=f2e292] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 473 TARIFA EXTENDIDA" [ref=f2e294]:
                            - paragraph [ref=f2e295]: USD 473
                            - generic [ref=f2e296] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 374 TARIFA EXTENDIDA" [ref=f2e298]:
                            - paragraph [ref=f2e299]: USD 374
                            - generic [ref=f2e300] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e302]:
                          - cell "01/10/2027 - 27/12/2027 Todos los días" [ref=f2e303]:
                            - paragraph [ref=f2e304]: 01/10/2027 - 27/12/2027
                            - generic [ref=f2e305]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e306]:
                            - paragraph [ref=f2e307]: USD 1,100
                            - generic [ref=f2e308] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e310]:
                            - paragraph [ref=f2e311]: USD 550
                            - generic [ref=f2e312] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e314]:
                            - paragraph [ref=f2e315]: USD 426
                            - generic [ref=f2e316] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e318]:
                          - cell "03/01/2028 - 28/02/2028 Todos los días" [ref=f2e319]:
                            - paragraph [ref=f2e320]: 03/01/2028 - 28/02/2028
                            - generic [ref=f2e321]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e322]:
                            - paragraph [ref=f2e323]: USD 1,100
                            - generic [ref=f2e324] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e326]:
                            - paragraph [ref=f2e327]: USD 550
                            - generic [ref=f2e328] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e330]:
                            - paragraph [ref=f2e331]: USD 426
                            - generic [ref=f2e332] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e334]:
                          - cell "01/03/2028 - 31/03/2028 Todos los días" [ref=f2e335]:
                            - paragraph [ref=f2e336]: 01/03/2028 - 31/03/2028
                            - generic [ref=f2e337]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e338]:
                            - paragraph [ref=f2e339]: USD 1,100
                            - generic [ref=f2e340] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e342]:
                            - paragraph [ref=f2e343]: USD 550
                            - generic [ref=f2e344] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e346]:
                            - paragraph [ref=f2e347]: USD 426
                            - generic [ref=f2e348] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e350]:
                          - cell "01/04/2028 - 30/09/2028 Todos los días" [ref=f2e351]:
                            - paragraph [ref=f2e352]: 01/04/2028 - 30/09/2028
                            - generic [ref=f2e353]: Todos los días
                          - cell "USD 946 TARIFA EXTENDIDA" [ref=f2e354]:
                            - paragraph [ref=f2e355]: USD 946
                            - generic [ref=f2e356] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 473 TARIFA EXTENDIDA" [ref=f2e358]:
                            - paragraph [ref=f2e359]: USD 473
                            - generic [ref=f2e360] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 374 TARIFA EXTENDIDA" [ref=f2e362]:
                            - paragraph [ref=f2e363]: USD 374
                            - generic [ref=f2e364] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e366]:
                          - cell "01/10/2028 - 27/12/2028 Todos los días" [ref=f2e367]:
                            - paragraph [ref=f2e368]: 01/10/2028 - 27/12/2028
                            - generic [ref=f2e369]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e370]:
                            - paragraph [ref=f2e371]: USD 1,100
                            - generic [ref=f2e372] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e374]:
                            - paragraph [ref=f2e375]: USD 550
                            - generic [ref=f2e376] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e378]:
                            - paragraph [ref=f2e379]: USD 426
                            - generic [ref=f2e380] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e382]:
                          - cell "03/01/2029 - 31/03/2029 Todos los días" [ref=f2e383]:
                            - paragraph [ref=f2e384]: 03/01/2029 - 31/03/2029
                            - generic [ref=f2e385]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e386]:
                            - paragraph [ref=f2e387]: USD 1,100
                            - generic [ref=f2e388] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e390]:
                            - paragraph [ref=f2e391]: USD 550
                            - generic [ref=f2e392] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e394]:
                            - paragraph [ref=f2e395]: USD 426
                            - generic [ref=f2e396] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e398]:
                          - cell "01/04/2029 - 30/09/2029 Todos los días" [ref=f2e399]:
                            - paragraph [ref=f2e400]: 01/04/2029 - 30/09/2029
                            - generic [ref=f2e401]: Todos los días
                          - cell "USD 946 TARIFA EXTENDIDA" [ref=f2e402]:
                            - paragraph [ref=f2e403]: USD 946
                            - generic [ref=f2e404] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 473 TARIFA EXTENDIDA" [ref=f2e406]:
                            - paragraph [ref=f2e407]: USD 473
                            - generic [ref=f2e408] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 374 TARIFA EXTENDIDA" [ref=f2e410]:
                            - paragraph [ref=f2e411]: USD 374
                            - generic [ref=f2e412] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e414]:
                          - cell "01/10/2029 - 27/12/2029 Todos los días" [ref=f2e415]:
                            - paragraph [ref=f2e416]: 01/10/2029 - 27/12/2029
                            - generic [ref=f2e417]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e418]:
                            - paragraph [ref=f2e419]: USD 1,100
                            - generic [ref=f2e420] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e422]:
                            - paragraph [ref=f2e423]: USD 550
                            - generic [ref=f2e424] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e426]:
                            - paragraph [ref=f2e427]: USD 426
                            - generic [ref=f2e428] [cursor=pointer]: TARIFA EXTENDIDA
                  - paragraph [ref=f2e431]:
                    - link "Twin Deluxe - Edificio Posadas" [ref=f2e432] [cursor=pointer]:
                      - /url: "#"
                  - generic [ref=f2e433]:
                    - tablist [ref=f2e434]:
                      - tab "Por rango de fechas" [selected] [ref=f2e435] [cursor=pointer]
                      - tab "Calendario" [ref=f2e436] [cursor=pointer]
                    - table [ref=f2e438]:
                      - rowgroup [ref=f2e439]:
                        - row [ref=f2e440]:
                          - columnheader "Fechas" [ref=f2e441]
                          - columnheader "Precio por noche por persona" [ref=f2e442]
                        - row [ref=f2e443]:
                          - columnheader "SGL" [ref=f2e444]
                          - columnheader "DBL" [ref=f2e445]
                          - columnheader "TPL" [ref=f2e446]
                      - rowgroup [ref=f2e447]:
                        - row [ref=f2e448]:
                          - cell "01/04/2026 - 30/09/2026 Todos los días" [ref=f2e449]:
                            - paragraph [ref=f2e450]: 01/04/2026 - 30/09/2026
                            - generic [ref=f2e451]: Todos los días
                          - cell [ref=f2e452]:
                            - paragraph [ref=f2e453]: USD 860
                          - cell [ref=f2e454]:
                            - paragraph [ref=f2e455]: USD 430
                          - cell [ref=f2e456]:
                            - paragraph [ref=f2e457]: USD 340
                        - row [ref=f2e458]:
                          - cell "01/10/2026 - 27/12/2026 Todos los días" [ref=f2e459]:
                            - paragraph [ref=f2e460]: 01/10/2026 - 27/12/2026
                            - generic [ref=f2e461]: Todos los días
                          - cell [ref=f2e462]:
                            - paragraph [ref=f2e463]: USD 1,000
                          - cell [ref=f2e464]:
                            - paragraph [ref=f2e465]: USD 500
                          - cell [ref=f2e466]:
                            - paragraph [ref=f2e467]: USD 387
                        - row [ref=f2e468]:
                          - cell "03/01/2027 - 31/03/2027 Todos los días" [ref=f2e469]:
                            - paragraph [ref=f2e470]: 03/01/2027 - 31/03/2027
                            - generic [ref=f2e471]: Todos los días
                          - cell [ref=f2e472]:
                            - paragraph [ref=f2e473]: USD 1,000
                          - cell [ref=f2e474]:
                            - paragraph [ref=f2e475]: USD 500
                          - cell [ref=f2e476]:
                            - paragraph [ref=f2e477]: USD 387
                        - row [ref=f2e478]:
                          - cell "01/04/2027 - 30/06/2027 Todos los días" [ref=f2e479]:
                            - paragraph [ref=f2e480]: 01/04/2027 - 30/06/2027
                            - generic [ref=f2e481]: Todos los días
                          - cell [ref=f2e482]:
                            - paragraph [ref=f2e483]: USD 860
                          - cell [ref=f2e484]:
                            - paragraph [ref=f2e485]: USD 430
                          - cell [ref=f2e486]:
                            - paragraph [ref=f2e487]: USD 340
                        - row [ref=f2e488]:
                          - cell "01/07/2027 - 30/09/2027 Todos los días" [ref=f2e489]:
                            - paragraph [ref=f2e490]: 01/07/2027 - 30/09/2027
                            - generic [ref=f2e491]: Todos los días
                          - cell "USD 946 TARIFA EXTENDIDA" [ref=f2e492]:
                            - paragraph [ref=f2e493]: USD 946
                            - generic [ref=f2e494] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 473 TARIFA EXTENDIDA" [ref=f2e496]:
                            - paragraph [ref=f2e497]: USD 473
                            - generic [ref=f2e498] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 374 TARIFA EXTENDIDA" [ref=f2e500]:
                            - paragraph [ref=f2e501]: USD 374
                            - generic [ref=f2e502] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e504]:
                          - cell "01/10/2027 - 27/12/2027 Todos los días" [ref=f2e505]:
                            - paragraph [ref=f2e506]: 01/10/2027 - 27/12/2027
                            - generic [ref=f2e507]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e508]:
                            - paragraph [ref=f2e509]: USD 1,100
                            - generic [ref=f2e510] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e512]:
                            - paragraph [ref=f2e513]: USD 550
                            - generic [ref=f2e514] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e516]:
                            - paragraph [ref=f2e517]: USD 426
                            - generic [ref=f2e518] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e520]:
                          - cell "03/01/2028 - 28/02/2028 Todos los días" [ref=f2e521]:
                            - paragraph [ref=f2e522]: 03/01/2028 - 28/02/2028
                            - generic [ref=f2e523]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e524]:
                            - paragraph [ref=f2e525]: USD 1,100
                            - generic [ref=f2e526] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e528]:
                            - paragraph [ref=f2e529]: USD 550
                            - generic [ref=f2e530] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e532]:
                            - paragraph [ref=f2e533]: USD 426
                            - generic [ref=f2e534] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e536]:
                          - cell "01/03/2028 - 31/03/2028 Todos los días" [ref=f2e537]:
                            - paragraph [ref=f2e538]: 01/03/2028 - 31/03/2028
                            - generic [ref=f2e539]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e540]:
                            - paragraph [ref=f2e541]: USD 1,100
                            - generic [ref=f2e542] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e544]:
                            - paragraph [ref=f2e545]: USD 550
                            - generic [ref=f2e546] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e548]:
                            - paragraph [ref=f2e549]: USD 426
                            - generic [ref=f2e550] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e552]:
                          - cell "01/04/2028 - 30/09/2028 Todos los días" [ref=f2e553]:
                            - paragraph [ref=f2e554]: 01/04/2028 - 30/09/2028
                            - generic [ref=f2e555]: Todos los días
                          - cell "USD 946 TARIFA EXTENDIDA" [ref=f2e556]:
                            - paragraph [ref=f2e557]: USD 946
                            - generic [ref=f2e558] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 473 TARIFA EXTENDIDA" [ref=f2e560]:
                            - paragraph [ref=f2e561]: USD 473
                            - generic [ref=f2e562] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 374 TARIFA EXTENDIDA" [ref=f2e564]:
                            - paragraph [ref=f2e565]: USD 374
                            - generic [ref=f2e566] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e568]:
                          - cell "01/10/2028 - 27/12/2028 Todos los días" [ref=f2e569]:
                            - paragraph [ref=f2e570]: 01/10/2028 - 27/12/2028
                            - generic [ref=f2e571]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e572]:
                            - paragraph [ref=f2e573]: USD 1,100
                            - generic [ref=f2e574] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e576]:
                            - paragraph [ref=f2e577]: USD 550
                            - generic [ref=f2e578] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e580]:
                            - paragraph [ref=f2e581]: USD 426
                            - generic [ref=f2e582] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e584]:
                          - cell "03/01/2029 - 31/03/2029 Todos los días" [ref=f2e585]:
                            - paragraph [ref=f2e586]: 03/01/2029 - 31/03/2029
                            - generic [ref=f2e587]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e588]:
                            - paragraph [ref=f2e589]: USD 1,100
                            - generic [ref=f2e590] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e592]:
                            - paragraph [ref=f2e593]: USD 550
                            - generic [ref=f2e594] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e596]:
                            - paragraph [ref=f2e597]: USD 426
                            - generic [ref=f2e598] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e600]:
                          - cell "01/04/2029 - 30/09/2029 Todos los días" [ref=f2e601]:
                            - paragraph [ref=f2e602]: 01/04/2029 - 30/09/2029
                            - generic [ref=f2e603]: Todos los días
                          - cell "USD 946 TARIFA EXTENDIDA" [ref=f2e604]:
                            - paragraph [ref=f2e605]: USD 946
                            - generic [ref=f2e606] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 473 TARIFA EXTENDIDA" [ref=f2e608]:
                            - paragraph [ref=f2e609]: USD 473
                            - generic [ref=f2e610] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 374 TARIFA EXTENDIDA" [ref=f2e612]:
                            - paragraph [ref=f2e613]: USD 374
                            - generic [ref=f2e614] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e616]:
                          - cell "01/10/2029 - 27/12/2029 Todos los días" [ref=f2e617]:
                            - paragraph [ref=f2e618]: 01/10/2029 - 27/12/2029
                            - generic [ref=f2e619]: Todos los días
                          - cell "USD 1,100 TARIFA EXTENDIDA" [ref=f2e620]:
                            - paragraph [ref=f2e621]: USD 1,100
                            - generic [ref=f2e622] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 550 TARIFA EXTENDIDA" [ref=f2e624]:
                            - paragraph [ref=f2e625]: USD 550
                            - generic [ref=f2e626] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 426 TARIFA EXTENDIDA" [ref=f2e628]:
                            - paragraph [ref=f2e629]: USD 426
                            - generic [ref=f2e630] [cursor=pointer]: TARIFA EXTENDIDA
                  - paragraph [ref=f2e633]:
                    - link "King Garden View - Edificio Posadas -" [ref=f2e634] [cursor=pointer]:
                      - /url: "#"
                  - generic [ref=f2e635]:
                    - tablist [ref=f2e636]:
                      - tab "Por rango de fechas" [selected] [ref=f2e637] [cursor=pointer]
                      - tab "Calendario" [ref=f2e638] [cursor=pointer]
                    - table [ref=f2e640]:
                      - rowgroup [ref=f2e641]:
                        - row [ref=f2e642]:
                          - columnheader "Fechas" [ref=f2e643]
                          - columnheader "Precio por noche por persona" [ref=f2e644]
                        - row [ref=f2e645]:
                          - columnheader "SGL" [ref=f2e646]
                          - columnheader "DBL" [ref=f2e647]
                          - columnheader "TPL" [ref=f2e648]
                      - rowgroup [ref=f2e649]:
                        - row [ref=f2e650]:
                          - cell "01/04/2026 - 30/09/2026 Todos los días" [ref=f2e651]:
                            - paragraph [ref=f2e652]: 01/04/2026 - 30/09/2026
                            - generic [ref=f2e653]: Todos los días
                          - cell [ref=f2e654]:
                            - paragraph [ref=f2e655]: USD 920
                          - cell [ref=f2e656]:
                            - paragraph [ref=f2e657]: USD 460
                          - cell [ref=f2e658]:
                            - paragraph [ref=f2e659]: USD 360
                        - row [ref=f2e660]:
                          - cell "01/10/2026 - 27/12/2026 Todos los días" [ref=f2e661]:
                            - paragraph [ref=f2e662]: 01/10/2026 - 27/12/2026
                            - generic [ref=f2e663]: Todos los días
                          - cell [ref=f2e664]:
                            - paragraph [ref=f2e665]: USD 1,060
                          - cell [ref=f2e666]:
                            - paragraph [ref=f2e667]: USD 530
                          - cell [ref=f2e668]:
                            - paragraph [ref=f2e669]: USD 407
                        - row [ref=f2e670]:
                          - cell "03/01/2027 - 31/03/2027 Todos los días" [ref=f2e671]:
                            - paragraph [ref=f2e672]: 03/01/2027 - 31/03/2027
                            - generic [ref=f2e673]: Todos los días
                          - cell [ref=f2e674]:
                            - paragraph [ref=f2e675]: USD 1,060
                          - cell [ref=f2e676]:
                            - paragraph [ref=f2e677]: USD 530
                          - cell [ref=f2e678]:
                            - paragraph [ref=f2e679]: USD 407
                        - row [ref=f2e680]:
                          - cell "01/04/2027 - 30/06/2027 Todos los días" [ref=f2e681]:
                            - paragraph [ref=f2e682]: 01/04/2027 - 30/06/2027
                            - generic [ref=f2e683]: Todos los días
                          - cell [ref=f2e684]:
                            - paragraph [ref=f2e685]: USD 920
                          - cell [ref=f2e686]:
                            - paragraph [ref=f2e687]: USD 460
                          - cell [ref=f2e688]:
                            - paragraph [ref=f2e689]: USD 360
                        - row [ref=f2e690]:
                          - cell "01/07/2027 - 30/09/2027 Todos los días" [ref=f2e691]:
                            - paragraph [ref=f2e692]: 01/07/2027 - 30/09/2027
                            - generic [ref=f2e693]: Todos los días
                          - cell "USD 1,012 TARIFA EXTENDIDA" [ref=f2e694]:
                            - paragraph [ref=f2e695]: USD 1,012
                            - generic [ref=f2e696] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 506 TARIFA EXTENDIDA" [ref=f2e698]:
                            - paragraph [ref=f2e699]: USD 506
                            - generic [ref=f2e700] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 396 TARIFA EXTENDIDA" [ref=f2e702]:
                            - paragraph [ref=f2e703]: USD 396
                            - generic [ref=f2e704] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e706]:
                          - cell "01/10/2027 - 27/12/2027 Todos los días" [ref=f2e707]:
                            - paragraph [ref=f2e708]: 01/10/2027 - 27/12/2027
                            - generic [ref=f2e709]: Todos los días
                          - cell "USD 1,166 TARIFA EXTENDIDA" [ref=f2e710]:
                            - paragraph [ref=f2e711]: USD 1,166
                            - generic [ref=f2e712] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 583 TARIFA EXTENDIDA" [ref=f2e714]:
                            - paragraph [ref=f2e715]: USD 583
                            - generic [ref=f2e716] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 448 TARIFA EXTENDIDA" [ref=f2e718]:
                            - paragraph [ref=f2e719]: USD 448
                            - generic [ref=f2e720] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e722]:
                          - cell "03/01/2028 - 28/02/2028 Todos los días" [ref=f2e723]:
                            - paragraph [ref=f2e724]: 03/01/2028 - 28/02/2028
                            - generic [ref=f2e725]: Todos los días
                          - cell "USD 1,166 TARIFA EXTENDIDA" [ref=f2e726]:
                            - paragraph [ref=f2e727]: USD 1,166
                            - generic [ref=f2e728] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 583 TARIFA EXTENDIDA" [ref=f2e730]:
                            - paragraph [ref=f2e731]: USD 583
                            - generic [ref=f2e732] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 448 TARIFA EXTENDIDA" [ref=f2e734]:
                            - paragraph [ref=f2e735]: USD 448
                            - generic [ref=f2e736] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e738]:
                          - cell "01/03/2028 - 31/03/2028 Todos los días" [ref=f2e739]:
                            - paragraph [ref=f2e740]: 01/03/2028 - 31/03/2028
                            - generic [ref=f2e741]: Todos los días
                          - cell "USD 1,166 TARIFA EXTENDIDA" [ref=f2e742]:
                            - paragraph [ref=f2e743]: USD 1,166
                            - generic [ref=f2e744] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 583 TARIFA EXTENDIDA" [ref=f2e746]:
                            - paragraph [ref=f2e747]: USD 583
                            - generic [ref=f2e748] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 448 TARIFA EXTENDIDA" [ref=f2e750]:
                            - paragraph [ref=f2e751]: USD 448
                            - generic [ref=f2e752] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e754]:
                          - cell "01/04/2028 - 30/09/2028 Todos los días" [ref=f2e755]:
                            - paragraph [ref=f2e756]: 01/04/2028 - 30/09/2028
                            - generic [ref=f2e757]: Todos los días
                          - cell "USD 1,012 TARIFA EXTENDIDA" [ref=f2e758]:
                            - paragraph [ref=f2e759]: USD 1,012
                            - generic [ref=f2e760] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 506 TARIFA EXTENDIDA" [ref=f2e762]:
                            - paragraph [ref=f2e763]: USD 506
                            - generic [ref=f2e764] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 396 TARIFA EXTENDIDA" [ref=f2e766]:
                            - paragraph [ref=f2e767]: USD 396
                            - generic [ref=f2e768] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e770]:
                          - cell "01/10/2028 - 27/12/2028 Todos los días" [ref=f2e771]:
                            - paragraph [ref=f2e772]: 01/10/2028 - 27/12/2028
                            - generic [ref=f2e773]: Todos los días
                          - cell "USD 1,166 TARIFA EXTENDIDA" [ref=f2e774]:
                            - paragraph [ref=f2e775]: USD 1,166
                            - generic [ref=f2e776] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 583 TARIFA EXTENDIDA" [ref=f2e778]:
                            - paragraph [ref=f2e779]: USD 583
                            - generic [ref=f2e780] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 448 TARIFA EXTENDIDA" [ref=f2e782]:
                            - paragraph [ref=f2e783]: USD 448
                            - generic [ref=f2e784] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e786]:
                          - cell "03/01/2029 - 31/03/2029 Todos los días" [ref=f2e787]:
                            - paragraph [ref=f2e788]: 03/01/2029 - 31/03/2029
                            - generic [ref=f2e789]: Todos los días
                          - cell "USD 1,166 TARIFA EXTENDIDA" [ref=f2e790]:
                            - paragraph [ref=f2e791]: USD 1,166
                            - generic [ref=f2e792] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 583 TARIFA EXTENDIDA" [ref=f2e794]:
                            - paragraph [ref=f2e795]: USD 583
                            - generic [ref=f2e796] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 448 TARIFA EXTENDIDA" [ref=f2e798]:
                            - paragraph [ref=f2e799]: USD 448
                            - generic [ref=f2e800] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e802]:
                          - cell "01/04/2029 - 30/09/2029 Todos los días" [ref=f2e803]:
                            - paragraph [ref=f2e804]: 01/04/2029 - 30/09/2029
                            - generic [ref=f2e805]: Todos los días
                          - cell "USD 1,012 TARIFA EXTENDIDA" [ref=f2e806]:
                            - paragraph [ref=f2e807]: USD 1,012
                            - generic [ref=f2e808] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 506 TARIFA EXTENDIDA" [ref=f2e810]:
                            - paragraph [ref=f2e811]: USD 506
                            - generic [ref=f2e812] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 396 TARIFA EXTENDIDA" [ref=f2e814]:
                            - paragraph [ref=f2e815]: USD 396
                            - generic [ref=f2e816] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e818]:
                          - cell "01/10/2029 - 27/12/2029 Todos los días" [ref=f2e819]:
                            - paragraph [ref=f2e820]: 01/10/2029 - 27/12/2029
                            - generic [ref=f2e821]: Todos los días
                          - cell "USD 1,166 TARIFA EXTENDIDA" [ref=f2e822]:
                            - paragraph [ref=f2e823]: USD 1,166
                            - generic [ref=f2e824] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 583 TARIFA EXTENDIDA" [ref=f2e826]:
                            - paragraph [ref=f2e827]: USD 583
                            - generic [ref=f2e828] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 448 TARIFA EXTENDIDA" [ref=f2e830]:
                            - paragraph [ref=f2e831]: USD 448
                            - generic [ref=f2e832] [cursor=pointer]: TARIFA EXTENDIDA
                  - paragraph [ref=f2e835]:
                    - link "King Balcony Deluxe" [ref=f2e836] [cursor=pointer]:
                      - /url: "#"
                  - generic [ref=f2e837]:
                    - tablist [ref=f2e838]:
                      - tab "Por rango de fechas" [selected] [ref=f2e839] [cursor=pointer]
                      - tab "Calendario" [ref=f2e840] [cursor=pointer]
                    - table [ref=f2e842]:
                      - rowgroup [ref=f2e843]:
                        - row [ref=f2e844]:
                          - columnheader "Fechas" [ref=f2e845]
                          - columnheader "Precio por noche por persona" [ref=f2e846]
                        - row [ref=f2e847]:
                          - columnheader "SGL" [ref=f2e848]
                          - columnheader "DBL" [ref=f2e849]
                          - columnheader "TPL" [ref=f2e850]
                      - rowgroup [ref=f2e851]:
                        - row [ref=f2e852]:
                          - cell "01/04/2026 - 30/09/2026 Todos los días" [ref=f2e853]:
                            - paragraph [ref=f2e854]: 01/04/2026 - 30/09/2026
                            - generic [ref=f2e855]: Todos los días
                          - cell [ref=f2e856]:
                            - paragraph [ref=f2e857]: USD 940
                          - cell [ref=f2e858]:
                            - paragraph [ref=f2e859]: USD 470
                          - cell [ref=f2e860]:
                            - paragraph [ref=f2e861]: USD 367
                        - row [ref=f2e862]:
                          - cell "01/10/2026 - 27/12/2026 Todos los días" [ref=f2e863]:
                            - paragraph [ref=f2e864]: 01/10/2026 - 27/12/2026
                            - generic [ref=f2e865]: Todos los días
                          - cell [ref=f2e866]:
                            - paragraph [ref=f2e867]: USD 1,080
                          - cell [ref=f2e868]:
                            - paragraph [ref=f2e869]: USD 540
                          - cell [ref=f2e870]:
                            - paragraph [ref=f2e871]: USD 414
                        - row [ref=f2e872]:
                          - cell "03/01/2027 - 31/03/2027 Todos los días" [ref=f2e873]:
                            - paragraph [ref=f2e874]: 03/01/2027 - 31/03/2027
                            - generic [ref=f2e875]: Todos los días
                          - cell [ref=f2e876]:
                            - paragraph [ref=f2e877]: USD 1,080
                          - cell [ref=f2e878]:
                            - paragraph [ref=f2e879]: USD 540
                          - cell [ref=f2e880]:
                            - paragraph [ref=f2e881]: USD 414
                        - row [ref=f2e882]:
                          - cell "01/04/2027 - 30/06/2027 Todos los días" [ref=f2e883]:
                            - paragraph [ref=f2e884]: 01/04/2027 - 30/06/2027
                            - generic [ref=f2e885]: Todos los días
                          - cell [ref=f2e886]:
                            - paragraph [ref=f2e887]: USD 940
                          - cell [ref=f2e888]:
                            - paragraph [ref=f2e889]: USD 470
                          - cell [ref=f2e890]:
                            - paragraph [ref=f2e891]: USD 367
                        - row [ref=f2e892]:
                          - cell "01/07/2027 - 30/09/2027 Todos los días" [ref=f2e893]:
                            - paragraph [ref=f2e894]: 01/07/2027 - 30/09/2027
                            - generic [ref=f2e895]: Todos los días
                          - cell "USD 1,034 TARIFA EXTENDIDA" [ref=f2e896]:
                            - paragraph [ref=f2e897]: USD 1,034
                            - generic [ref=f2e898] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 517 TARIFA EXTENDIDA" [ref=f2e900]:
                            - paragraph [ref=f2e901]: USD 517
                            - generic [ref=f2e902] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 404 TARIFA EXTENDIDA" [ref=f2e904]:
                            - paragraph [ref=f2e905]: USD 404
                            - generic [ref=f2e906] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e908]:
                          - cell "01/10/2027 - 27/12/2027 Todos los días" [ref=f2e909]:
                            - paragraph [ref=f2e910]: 01/10/2027 - 27/12/2027
                            - generic [ref=f2e911]: Todos los días
                          - cell "USD 1,188 TARIFA EXTENDIDA" [ref=f2e912]:
                            - paragraph [ref=f2e913]: USD 1,188
                            - generic [ref=f2e914] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 594 TARIFA EXTENDIDA" [ref=f2e916]:
                            - paragraph [ref=f2e917]: USD 594
                            - generic [ref=f2e918] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 455 TARIFA EXTENDIDA" [ref=f2e920]:
                            - paragraph [ref=f2e921]: USD 455
                            - generic [ref=f2e922] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e924]:
                          - cell "03/01/2028 - 28/02/2028 Todos los días" [ref=f2e925]:
                            - paragraph [ref=f2e926]: 03/01/2028 - 28/02/2028
                            - generic [ref=f2e927]: Todos los días
                          - cell "USD 1,188 TARIFA EXTENDIDA" [ref=f2e928]:
                            - paragraph [ref=f2e929]: USD 1,188
                            - generic [ref=f2e930] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 594 TARIFA EXTENDIDA" [ref=f2e932]:
                            - paragraph [ref=f2e933]: USD 594
                            - generic [ref=f2e934] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 455 TARIFA EXTENDIDA" [ref=f2e936]:
                            - paragraph [ref=f2e937]: USD 455
                            - generic [ref=f2e938] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e940]:
                          - cell "01/03/2028 - 31/03/2028 Todos los días" [ref=f2e941]:
                            - paragraph [ref=f2e942]: 01/03/2028 - 31/03/2028
                            - generic [ref=f2e943]: Todos los días
                          - cell "USD 1,188 TARIFA EXTENDIDA" [ref=f2e944]:
                            - paragraph [ref=f2e945]: USD 1,188
                            - generic [ref=f2e946] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 594 TARIFA EXTENDIDA" [ref=f2e948]:
                            - paragraph [ref=f2e949]: USD 594
                            - generic [ref=f2e950] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 455 TARIFA EXTENDIDA" [ref=f2e952]:
                            - paragraph [ref=f2e953]: USD 455
                            - generic [ref=f2e954] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e956]:
                          - cell "01/04/2028 - 30/09/2028 Todos los días" [ref=f2e957]:
                            - paragraph [ref=f2e958]: 01/04/2028 - 30/09/2028
                            - generic [ref=f2e959]: Todos los días
                          - cell "USD 1,034 TARIFA EXTENDIDA" [ref=f2e960]:
                            - paragraph [ref=f2e961]: USD 1,034
                            - generic [ref=f2e962] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 517 TARIFA EXTENDIDA" [ref=f2e964]:
                            - paragraph [ref=f2e965]: USD 517
                            - generic [ref=f2e966] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 404 TARIFA EXTENDIDA" [ref=f2e968]:
                            - paragraph [ref=f2e969]: USD 404
                            - generic [ref=f2e970] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e972]:
                          - cell "01/10/2028 - 27/12/2028 Todos los días" [ref=f2e973]:
                            - paragraph [ref=f2e974]: 01/10/2028 - 27/12/2028
                            - generic [ref=f2e975]: Todos los días
                          - cell "USD 1,188 TARIFA EXTENDIDA" [ref=f2e976]:
                            - paragraph [ref=f2e977]: USD 1,188
                            - generic [ref=f2e978] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 594 TARIFA EXTENDIDA" [ref=f2e980]:
                            - paragraph [ref=f2e981]: USD 594
                            - generic [ref=f2e982] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 455 TARIFA EXTENDIDA" [ref=f2e984]:
                            - paragraph [ref=f2e985]: USD 455
                            - generic [ref=f2e986] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e988]:
                          - cell "03/01/2029 - 31/03/2029 Todos los días" [ref=f2e989]:
                            - paragraph [ref=f2e990]: 03/01/2029 - 31/03/2029
                            - generic [ref=f2e991]: Todos los días
                          - cell "USD 1,188 TARIFA EXTENDIDA" [ref=f2e992]:
                            - paragraph [ref=f2e993]: USD 1,188
                            - generic [ref=f2e994] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 594 TARIFA EXTENDIDA" [ref=f2e996]:
                            - paragraph [ref=f2e997]: USD 594
                            - generic [ref=f2e998] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 455 TARIFA EXTENDIDA" [ref=f2e1000]:
                            - paragraph [ref=f2e1001]: USD 455
                            - generic [ref=f2e1002] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1004]:
                          - cell "01/04/2029 - 30/09/2029 Todos los días" [ref=f2e1005]:
                            - paragraph [ref=f2e1006]: 01/04/2029 - 30/09/2029
                            - generic [ref=f2e1007]: Todos los días
                          - cell "USD 1,034 TARIFA EXTENDIDA" [ref=f2e1008]:
                            - paragraph [ref=f2e1009]: USD 1,034
                            - generic [ref=f2e1010] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 517 TARIFA EXTENDIDA" [ref=f2e1012]:
                            - paragraph [ref=f2e1013]: USD 517
                            - generic [ref=f2e1014] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 404 TARIFA EXTENDIDA" [ref=f2e1016]:
                            - paragraph [ref=f2e1017]: USD 404
                            - generic [ref=f2e1018] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1020]:
                          - cell "01/10/2029 - 27/12/2029 Todos los días" [ref=f2e1021]:
                            - paragraph [ref=f2e1022]: 01/10/2029 - 27/12/2029
                            - generic [ref=f2e1023]: Todos los días
                          - cell "USD 1,188 TARIFA EXTENDIDA" [ref=f2e1024]:
                            - paragraph [ref=f2e1025]: USD 1,188
                            - generic [ref=f2e1026] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 594 TARIFA EXTENDIDA" [ref=f2e1028]:
                            - paragraph [ref=f2e1029]: USD 594
                            - generic [ref=f2e1030] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 455 TARIFA EXTENDIDA" [ref=f2e1032]:
                            - paragraph [ref=f2e1033]: USD 455
                            - generic [ref=f2e1034] [cursor=pointer]: TARIFA EXTENDIDA
                  - paragraph [ref=f2e1037]:
                    - link "King Palace/ Twin Palace" [ref=f2e1038] [cursor=pointer]:
                      - /url: "#"
                  - generic [ref=f2e1039]:
                    - tablist [ref=f2e1040]:
                      - tab "Por rango de fechas" [selected] [ref=f2e1041] [cursor=pointer]
                      - tab "Calendario" [ref=f2e1042] [cursor=pointer]
                    - table [ref=f2e1044]:
                      - rowgroup [ref=f2e1045]:
                        - row [ref=f2e1046]:
                          - columnheader "Fechas" [ref=f2e1047]
                          - columnheader "Precio por noche por persona" [ref=f2e1048]
                        - row [ref=f2e1049]:
                          - columnheader "SGL" [ref=f2e1050]
                          - columnheader "DBL" [ref=f2e1051]
                          - columnheader "TPL" [ref=f2e1052]
                      - rowgroup [ref=f2e1053]:
                        - row [ref=f2e1054]:
                          - cell "01/04/2026 - 30/09/2026 Todos los días" [ref=f2e1055]:
                            - paragraph [ref=f2e1056]: 01/04/2026 - 30/09/2026
                            - generic [ref=f2e1057]: Todos los días
                          - cell [ref=f2e1058]:
                            - paragraph [ref=f2e1059]: USD 1,180
                          - cell [ref=f2e1060]:
                            - paragraph [ref=f2e1061]: USD 590
                          - cell [ref=f2e1062]:
                            - paragraph [ref=f2e1063]: USD 447
                        - row [ref=f2e1064]:
                          - cell "01/10/2026 - 27/12/2026 Todos los días" [ref=f2e1065]:
                            - paragraph [ref=f2e1066]: 01/10/2026 - 27/12/2026
                            - generic [ref=f2e1067]: Todos los días
                          - cell [ref=f2e1068]:
                            - paragraph [ref=f2e1069]: USD 1,320
                          - cell [ref=f2e1070]:
                            - paragraph [ref=f2e1071]: USD 660
                          - cell [ref=f2e1072]:
                            - paragraph [ref=f2e1073]: USD 494
                        - row [ref=f2e1074]:
                          - cell "03/01/2027 - 31/03/2027 Todos los días" [ref=f2e1075]:
                            - paragraph [ref=f2e1076]: 03/01/2027 - 31/03/2027
                            - generic [ref=f2e1077]: Todos los días
                          - cell [ref=f2e1078]:
                            - paragraph [ref=f2e1079]: USD 1,320
                          - cell [ref=f2e1080]:
                            - paragraph [ref=f2e1081]: USD 660
                          - cell [ref=f2e1082]:
                            - paragraph [ref=f2e1083]: USD 494
                        - row [ref=f2e1084]:
                          - cell "01/04/2027 - 30/06/2027 Todos los días" [ref=f2e1085]:
                            - paragraph [ref=f2e1086]: 01/04/2027 - 30/06/2027
                            - generic [ref=f2e1087]: Todos los días
                          - cell [ref=f2e1088]:
                            - paragraph [ref=f2e1089]: USD 1,180
                          - cell [ref=f2e1090]:
                            - paragraph [ref=f2e1091]: USD 590
                          - cell [ref=f2e1092]:
                            - paragraph [ref=f2e1093]: USD 447
                        - row [ref=f2e1094]:
                          - cell "01/07/2027 - 30/09/2027 Todos los días" [ref=f2e1095]:
                            - paragraph [ref=f2e1096]: 01/07/2027 - 30/09/2027
                            - generic [ref=f2e1097]: Todos los días
                          - cell "USD 1,298 TARIFA EXTENDIDA" [ref=f2e1098]:
                            - paragraph [ref=f2e1099]: USD 1,298
                            - generic [ref=f2e1100] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 649 TARIFA EXTENDIDA" [ref=f2e1102]:
                            - paragraph [ref=f2e1103]: USD 649
                            - generic [ref=f2e1104] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 492 TARIFA EXTENDIDA" [ref=f2e1106]:
                            - paragraph [ref=f2e1107]: USD 492
                            - generic [ref=f2e1108] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1110]:
                          - cell "01/10/2027 - 27/12/2027 Todos los días" [ref=f2e1111]:
                            - paragraph [ref=f2e1112]: 01/10/2027 - 27/12/2027
                            - generic [ref=f2e1113]: Todos los días
                          - cell "USD 1,452 TARIFA EXTENDIDA" [ref=f2e1114]:
                            - paragraph [ref=f2e1115]: USD 1,452
                            - generic [ref=f2e1116] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 726 TARIFA EXTENDIDA" [ref=f2e1118]:
                            - paragraph [ref=f2e1119]: USD 726
                            - generic [ref=f2e1120] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 543 TARIFA EXTENDIDA" [ref=f2e1122]:
                            - paragraph [ref=f2e1123]: USD 543
                            - generic [ref=f2e1124] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1126]:
                          - cell "03/01/2028 - 28/02/2028 Todos los días" [ref=f2e1127]:
                            - paragraph [ref=f2e1128]: 03/01/2028 - 28/02/2028
                            - generic [ref=f2e1129]: Todos los días
                          - cell "USD 1,452 TARIFA EXTENDIDA" [ref=f2e1130]:
                            - paragraph [ref=f2e1131]: USD 1,452
                            - generic [ref=f2e1132] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 726 TARIFA EXTENDIDA" [ref=f2e1134]:
                            - paragraph [ref=f2e1135]: USD 726
                            - generic [ref=f2e1136] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 543 TARIFA EXTENDIDA" [ref=f2e1138]:
                            - paragraph [ref=f2e1139]: USD 543
                            - generic [ref=f2e1140] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1142]:
                          - cell "01/03/2028 - 31/03/2028 Todos los días" [ref=f2e1143]:
                            - paragraph [ref=f2e1144]: 01/03/2028 - 31/03/2028
                            - generic [ref=f2e1145]: Todos los días
                          - cell "USD 1,452 TARIFA EXTENDIDA" [ref=f2e1146]:
                            - paragraph [ref=f2e1147]: USD 1,452
                            - generic [ref=f2e1148] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 726 TARIFA EXTENDIDA" [ref=f2e1150]:
                            - paragraph [ref=f2e1151]: USD 726
                            - generic [ref=f2e1152] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 543 TARIFA EXTENDIDA" [ref=f2e1154]:
                            - paragraph [ref=f2e1155]: USD 543
                            - generic [ref=f2e1156] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1158]:
                          - cell "01/04/2028 - 30/09/2028 Todos los días" [ref=f2e1159]:
                            - paragraph [ref=f2e1160]: 01/04/2028 - 30/09/2028
                            - generic [ref=f2e1161]: Todos los días
                          - cell "USD 1,298 TARIFA EXTENDIDA" [ref=f2e1162]:
                            - paragraph [ref=f2e1163]: USD 1,298
                            - generic [ref=f2e1164] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 649 TARIFA EXTENDIDA" [ref=f2e1166]:
                            - paragraph [ref=f2e1167]: USD 649
                            - generic [ref=f2e1168] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 492 TARIFA EXTENDIDA" [ref=f2e1170]:
                            - paragraph [ref=f2e1171]: USD 492
                            - generic [ref=f2e1172] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1174]:
                          - cell "01/10/2028 - 27/12/2028 Todos los días" [ref=f2e1175]:
                            - paragraph [ref=f2e1176]: 01/10/2028 - 27/12/2028
                            - generic [ref=f2e1177]: Todos los días
                          - cell "USD 1,452 TARIFA EXTENDIDA" [ref=f2e1178]:
                            - paragraph [ref=f2e1179]: USD 1,452
                            - generic [ref=f2e1180] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 726 TARIFA EXTENDIDA" [ref=f2e1182]:
                            - paragraph [ref=f2e1183]: USD 726
                            - generic [ref=f2e1184] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 543 TARIFA EXTENDIDA" [ref=f2e1186]:
                            - paragraph [ref=f2e1187]: USD 543
                            - generic [ref=f2e1188] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1190]:
                          - cell "03/01/2029 - 31/03/2029 Todos los días" [ref=f2e1191]:
                            - paragraph [ref=f2e1192]: 03/01/2029 - 31/03/2029
                            - generic [ref=f2e1193]: Todos los días
                          - cell "USD 1,452 TARIFA EXTENDIDA" [ref=f2e1194]:
                            - paragraph [ref=f2e1195]: USD 1,452
                            - generic [ref=f2e1196] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 726 TARIFA EXTENDIDA" [ref=f2e1198]:
                            - paragraph [ref=f2e1199]: USD 726
                            - generic [ref=f2e1200] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 543 TARIFA EXTENDIDA" [ref=f2e1202]:
                            - paragraph [ref=f2e1203]: USD 543
                            - generic [ref=f2e1204] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1206]:
                          - cell "01/04/2029 - 30/09/2029 Todos los días" [ref=f2e1207]:
                            - paragraph [ref=f2e1208]: 01/04/2029 - 30/09/2029
                            - generic [ref=f2e1209]: Todos los días
                          - cell "USD 1,298 TARIFA EXTENDIDA" [ref=f2e1210]:
                            - paragraph [ref=f2e1211]: USD 1,298
                            - generic [ref=f2e1212] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 649 TARIFA EXTENDIDA" [ref=f2e1214]:
                            - paragraph [ref=f2e1215]: USD 649
                            - generic [ref=f2e1216] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 492 TARIFA EXTENDIDA" [ref=f2e1218]:
                            - paragraph [ref=f2e1219]: USD 492
                            - generic [ref=f2e1220] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1222]:
                          - cell "01/10/2029 - 27/12/2029 Todos los días" [ref=f2e1223]:
                            - paragraph [ref=f2e1224]: 01/10/2029 - 27/12/2029
                            - generic [ref=f2e1225]: Todos los días
                          - cell "USD 1,452 TARIFA EXTENDIDA" [ref=f2e1226]:
                            - paragraph [ref=f2e1227]: USD 1,452
                            - generic [ref=f2e1228] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 726 TARIFA EXTENDIDA" [ref=f2e1230]:
                            - paragraph [ref=f2e1231]: USD 726
                            - generic [ref=f2e1232] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 543 TARIFA EXTENDIDA" [ref=f2e1234]:
                            - paragraph [ref=f2e1235]: USD 543
                            - generic [ref=f2e1236] [cursor=pointer]: TARIFA EXTENDIDA
                  - paragraph [ref=f2e1239]:
                    - link "Park Suite King - Edificio Posadas" [ref=f2e1240] [cursor=pointer]:
                      - /url: "#"
                  - generic [ref=f2e1241]:
                    - tablist [ref=f2e1242]:
                      - tab "Por rango de fechas" [selected] [ref=f2e1243] [cursor=pointer]
                      - tab "Calendario" [ref=f2e1244] [cursor=pointer]
                    - table [ref=f2e1246]:
                      - rowgroup [ref=f2e1247]:
                        - row [ref=f2e1248]:
                          - columnheader "Fechas" [ref=f2e1249]
                          - columnheader "Precio por noche por persona" [ref=f2e1250]
                        - row [ref=f2e1251]:
                          - columnheader "SGL" [ref=f2e1252]
                          - columnheader "DBL" [ref=f2e1253]
                          - columnheader "TPL" [ref=f2e1254]
                      - rowgroup [ref=f2e1255]:
                        - row [ref=f2e1256]:
                          - cell "01/04/2026 - 30/09/2026 Todos los días" [ref=f2e1257]:
                            - paragraph [ref=f2e1258]: 01/04/2026 - 30/09/2026
                            - generic [ref=f2e1259]: Todos los días
                          - cell [ref=f2e1260]:
                            - paragraph [ref=f2e1261]: USD 1,220
                          - cell [ref=f2e1262]:
                            - paragraph [ref=f2e1263]: USD 610
                          - cell [ref=f2e1264]:
                            - paragraph [ref=f2e1265]: USD 460
                        - row [ref=f2e1266]:
                          - cell "01/10/2026 - 27/12/2026 Todos los días" [ref=f2e1267]:
                            - paragraph [ref=f2e1268]: 01/10/2026 - 27/12/2026
                            - generic [ref=f2e1269]: Todos los días
                          - cell [ref=f2e1270]:
                            - paragraph [ref=f2e1271]: USD 1,360
                          - cell [ref=f2e1272]:
                            - paragraph [ref=f2e1273]: USD 680
                          - cell [ref=f2e1274]:
                            - paragraph [ref=f2e1275]: USD 507
                        - row [ref=f2e1276]:
                          - cell "03/01/2027 - 31/03/2027 Todos los días" [ref=f2e1277]:
                            - paragraph [ref=f2e1278]: 03/01/2027 - 31/03/2027
                            - generic [ref=f2e1279]: Todos los días
                          - cell [ref=f2e1280]:
                            - paragraph [ref=f2e1281]: USD 1,360
                          - cell [ref=f2e1282]:
                            - paragraph [ref=f2e1283]: USD 680
                          - cell [ref=f2e1284]:
                            - paragraph [ref=f2e1285]: USD 507
                        - row [ref=f2e1286]:
                          - cell "01/04/2027 - 30/06/2027 Todos los días" [ref=f2e1287]:
                            - paragraph [ref=f2e1288]: 01/04/2027 - 30/06/2027
                            - generic [ref=f2e1289]: Todos los días
                          - cell [ref=f2e1290]:
                            - paragraph [ref=f2e1291]: USD 1,220
                          - cell [ref=f2e1292]:
                            - paragraph [ref=f2e1293]: USD 610
                          - cell [ref=f2e1294]:
                            - paragraph [ref=f2e1295]: USD 460
                        - row [ref=f2e1296]:
                          - cell "01/07/2027 - 30/09/2027 Todos los días" [ref=f2e1297]:
                            - paragraph [ref=f2e1298]: 01/07/2027 - 30/09/2027
                            - generic [ref=f2e1299]: Todos los días
                          - cell "USD 1,342 TARIFA EXTENDIDA" [ref=f2e1300]:
                            - paragraph [ref=f2e1301]: USD 1,342
                            - generic [ref=f2e1302] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 671 TARIFA EXTENDIDA" [ref=f2e1304]:
                            - paragraph [ref=f2e1305]: USD 671
                            - generic [ref=f2e1306] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 506 TARIFA EXTENDIDA" [ref=f2e1308]:
                            - paragraph [ref=f2e1309]: USD 506
                            - generic [ref=f2e1310] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1312]:
                          - cell "01/10/2027 - 27/12/2027 Todos los días" [ref=f2e1313]:
                            - paragraph [ref=f2e1314]: 01/10/2027 - 27/12/2027
                            - generic [ref=f2e1315]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1316]:
                            - paragraph [ref=f2e1317]: USD 1,496
                            - generic [ref=f2e1318] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1320]:
                            - paragraph [ref=f2e1321]: USD 748
                            - generic [ref=f2e1322] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1324]:
                            - paragraph [ref=f2e1325]: USD 558
                            - generic [ref=f2e1326] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1328]:
                          - cell "03/01/2028 - 28/02/2028 Todos los días" [ref=f2e1329]:
                            - paragraph [ref=f2e1330]: 03/01/2028 - 28/02/2028
                            - generic [ref=f2e1331]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1332]:
                            - paragraph [ref=f2e1333]: USD 1,496
                            - generic [ref=f2e1334] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1336]:
                            - paragraph [ref=f2e1337]: USD 748
                            - generic [ref=f2e1338] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1340]:
                            - paragraph [ref=f2e1341]: USD 558
                            - generic [ref=f2e1342] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1344]:
                          - cell "01/03/2028 - 31/03/2028 Todos los días" [ref=f2e1345]:
                            - paragraph [ref=f2e1346]: 01/03/2028 - 31/03/2028
                            - generic [ref=f2e1347]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1348]:
                            - paragraph [ref=f2e1349]: USD 1,496
                            - generic [ref=f2e1350] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1352]:
                            - paragraph [ref=f2e1353]: USD 748
                            - generic [ref=f2e1354] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1356]:
                            - paragraph [ref=f2e1357]: USD 558
                            - generic [ref=f2e1358] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1360]:
                          - cell "01/04/2028 - 30/09/2028 Todos los días" [ref=f2e1361]:
                            - paragraph [ref=f2e1362]: 01/04/2028 - 30/09/2028
                            - generic [ref=f2e1363]: Todos los días
                          - cell "USD 1,342 TARIFA EXTENDIDA" [ref=f2e1364]:
                            - paragraph [ref=f2e1365]: USD 1,342
                            - generic [ref=f2e1366] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 671 TARIFA EXTENDIDA" [ref=f2e1368]:
                            - paragraph [ref=f2e1369]: USD 671
                            - generic [ref=f2e1370] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 506 TARIFA EXTENDIDA" [ref=f2e1372]:
                            - paragraph [ref=f2e1373]: USD 506
                            - generic [ref=f2e1374] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1376]:
                          - cell "01/10/2028 - 27/12/2028 Todos los días" [ref=f2e1377]:
                            - paragraph [ref=f2e1378]: 01/10/2028 - 27/12/2028
                            - generic [ref=f2e1379]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1380]:
                            - paragraph [ref=f2e1381]: USD 1,496
                            - generic [ref=f2e1382] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1384]:
                            - paragraph [ref=f2e1385]: USD 748
                            - generic [ref=f2e1386] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1388]:
                            - paragraph [ref=f2e1389]: USD 558
                            - generic [ref=f2e1390] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1392]:
                          - cell "03/01/2029 - 31/03/2029 Todos los días" [ref=f2e1393]:
                            - paragraph [ref=f2e1394]: 03/01/2029 - 31/03/2029
                            - generic [ref=f2e1395]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1396]:
                            - paragraph [ref=f2e1397]: USD 1,496
                            - generic [ref=f2e1398] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1400]:
                            - paragraph [ref=f2e1401]: USD 748
                            - generic [ref=f2e1402] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1404]:
                            - paragraph [ref=f2e1405]: USD 558
                            - generic [ref=f2e1406] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1408]:
                          - cell "01/04/2029 - 30/09/2029 Todos los días" [ref=f2e1409]:
                            - paragraph [ref=f2e1410]: 01/04/2029 - 30/09/2029
                            - generic [ref=f2e1411]: Todos los días
                          - cell "USD 1,342 TARIFA EXTENDIDA" [ref=f2e1412]:
                            - paragraph [ref=f2e1413]: USD 1,342
                            - generic [ref=f2e1414] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 671 TARIFA EXTENDIDA" [ref=f2e1416]:
                            - paragraph [ref=f2e1417]: USD 671
                            - generic [ref=f2e1418] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 506 TARIFA EXTENDIDA" [ref=f2e1420]:
                            - paragraph [ref=f2e1421]: USD 506
                            - generic [ref=f2e1422] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1424]:
                          - cell "01/10/2029 - 27/12/2029 Todos los días" [ref=f2e1425]:
                            - paragraph [ref=f2e1426]: 01/10/2029 - 27/12/2029
                            - generic [ref=f2e1427]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1428]:
                            - paragraph [ref=f2e1429]: USD 1,496
                            - generic [ref=f2e1430] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1432]:
                            - paragraph [ref=f2e1433]: USD 748
                            - generic [ref=f2e1434] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1436]:
                            - paragraph [ref=f2e1437]: USD 558
                            - generic [ref=f2e1438] [cursor=pointer]: TARIFA EXTENDIDA
                  - paragraph [ref=f2e1441]:
                    - link "Bedroom Suite Palace" [active] [ref=f2e1442] [cursor=pointer]:
                      - /url: "#"
                  - generic [ref=f2e1443]:
                    - tablist [ref=f2e1444]:
                      - tab "Por rango de fechas" [selected] [ref=f2e1445] [cursor=pointer]
                      - tab "Calendario" [ref=f2e1446] [cursor=pointer]
                    - table [ref=f2e1448]:
                      - rowgroup [ref=f2e1449]:
                        - row [ref=f2e1450]:
                          - columnheader "Fechas" [ref=f2e1451]
                          - columnheader "Precio por noche por persona" [ref=f2e1452]
                        - row [ref=f2e1453]:
                          - columnheader "SGL" [ref=f2e1454]
                          - columnheader "DBL" [ref=f2e1455]
                          - columnheader "TPL" [ref=f2e1456]
                      - rowgroup [ref=f2e1457]:
                        - row [ref=f2e1458]:
                          - cell "01/04/2026 - 30/09/2026 Todos los días" [ref=f2e1459]:
                            - paragraph [ref=f2e1460]: 01/04/2026 - 30/09/2026
                            - generic [ref=f2e1461]: Todos los días
                          - cell [ref=f2e1462]:
                            - paragraph [ref=f2e1463]: USD 1,360
                          - cell [ref=f2e1464]:
                            - paragraph [ref=f2e1465]: USD 680
                          - cell [ref=f2e1466]:
                            - paragraph [ref=f2e1467]: USD 507
                        - row [ref=f2e1468]:
                          - cell "01/10/2026 - 27/12/2026 Todos los días" [ref=f2e1469]:
                            - paragraph [ref=f2e1470]: 01/10/2026 - 27/12/2026
                            - generic [ref=f2e1471]: Todos los días
                          - cell [ref=f2e1472]:
                            - paragraph [ref=f2e1473]: USD 1,500
                          - cell [ref=f2e1474]:
                            - paragraph [ref=f2e1475]: USD 750
                          - cell [ref=f2e1476]:
                            - paragraph [ref=f2e1477]: USD 554
                        - row [ref=f2e1478]:
                          - cell "03/01/2027 - 31/03/2027 Todos los días" [ref=f2e1479]:
                            - paragraph [ref=f2e1480]: 03/01/2027 - 31/03/2027
                            - generic [ref=f2e1481]: Todos los días
                          - cell [ref=f2e1482]:
                            - paragraph [ref=f2e1483]: USD 1,500
                          - cell [ref=f2e1484]:
                            - paragraph [ref=f2e1485]: USD 750
                          - cell [ref=f2e1486]:
                            - paragraph [ref=f2e1487]: USD 554
                        - row [ref=f2e1488]:
                          - cell "01/04/2027 - 30/06/2027 Todos los días" [ref=f2e1489]:
                            - paragraph [ref=f2e1490]: 01/04/2027 - 30/06/2027
                            - generic [ref=f2e1491]: Todos los días
                          - cell [ref=f2e1492]:
                            - paragraph [ref=f2e1493]: USD 1,360
                          - cell [ref=f2e1494]:
                            - paragraph [ref=f2e1495]: USD 680
                          - cell [ref=f2e1496]:
                            - paragraph [ref=f2e1497]: USD 507
                        - row [ref=f2e1498]:
                          - cell "01/07/2027 - 30/09/2027 Todos los días" [ref=f2e1499]:
                            - paragraph [ref=f2e1500]: 01/07/2027 - 30/09/2027
                            - generic [ref=f2e1501]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1502]:
                            - paragraph [ref=f2e1503]: USD 1,496
                            - generic [ref=f2e1504] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1506]:
                            - paragraph [ref=f2e1507]: USD 748
                            - generic [ref=f2e1508] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1510]:
                            - paragraph [ref=f2e1511]: USD 558
                            - generic [ref=f2e1512] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1514]:
                          - cell "01/10/2027 - 27/12/2027 Todos los días" [ref=f2e1515]:
                            - paragraph [ref=f2e1516]: 01/10/2027 - 27/12/2027
                            - generic [ref=f2e1517]: Todos los días
                          - cell "USD 1,650 TARIFA EXTENDIDA" [ref=f2e1518]:
                            - paragraph [ref=f2e1519]: USD 1,650
                            - generic [ref=f2e1520] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 825 TARIFA EXTENDIDA" [ref=f2e1522]:
                            - paragraph [ref=f2e1523]: USD 825
                            - generic [ref=f2e1524] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 609 TARIFA EXTENDIDA" [ref=f2e1526]:
                            - paragraph [ref=f2e1527]: USD 609
                            - generic [ref=f2e1528] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1530]:
                          - cell "03/01/2028 - 28/02/2028 Todos los días" [ref=f2e1531]:
                            - paragraph [ref=f2e1532]: 03/01/2028 - 28/02/2028
                            - generic [ref=f2e1533]: Todos los días
                          - cell "USD 1,650 TARIFA EXTENDIDA" [ref=f2e1534]:
                            - paragraph [ref=f2e1535]: USD 1,650
                            - generic [ref=f2e1536] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 825 TARIFA EXTENDIDA" [ref=f2e1538]:
                            - paragraph [ref=f2e1539]: USD 825
                            - generic [ref=f2e1540] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 609 TARIFA EXTENDIDA" [ref=f2e1542]:
                            - paragraph [ref=f2e1543]: USD 609
                            - generic [ref=f2e1544] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1546]:
                          - cell "01/03/2028 - 31/03/2028 Todos los días" [ref=f2e1547]:
                            - paragraph [ref=f2e1548]: 01/03/2028 - 31/03/2028
                            - generic [ref=f2e1549]: Todos los días
                          - cell "USD 1,650 TARIFA EXTENDIDA" [ref=f2e1550]:
                            - paragraph [ref=f2e1551]: USD 1,650
                            - generic [ref=f2e1552] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 825 TARIFA EXTENDIDA" [ref=f2e1554]:
                            - paragraph [ref=f2e1555]: USD 825
                            - generic [ref=f2e1556] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 609 TARIFA EXTENDIDA" [ref=f2e1558]:
                            - paragraph [ref=f2e1559]: USD 609
                            - generic [ref=f2e1560] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1562]:
                          - cell "01/04/2028 - 30/09/2028 Todos los días" [ref=f2e1563]:
                            - paragraph [ref=f2e1564]: 01/04/2028 - 30/09/2028
                            - generic [ref=f2e1565]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1566]:
                            - paragraph [ref=f2e1567]: USD 1,496
                            - generic [ref=f2e1568] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1570]:
                            - paragraph [ref=f2e1571]: USD 748
                            - generic [ref=f2e1572] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1574]:
                            - paragraph [ref=f2e1575]: USD 558
                            - generic [ref=f2e1576] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1578]:
                          - cell "01/10/2028 - 27/12/2028 Todos los días" [ref=f2e1579]:
                            - paragraph [ref=f2e1580]: 01/10/2028 - 27/12/2028
                            - generic [ref=f2e1581]: Todos los días
                          - cell "USD 1,650 TARIFA EXTENDIDA" [ref=f2e1582]:
                            - paragraph [ref=f2e1583]: USD 1,650
                            - generic [ref=f2e1584] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 825 TARIFA EXTENDIDA" [ref=f2e1586]:
                            - paragraph [ref=f2e1587]: USD 825
                            - generic [ref=f2e1588] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 609 TARIFA EXTENDIDA" [ref=f2e1590]:
                            - paragraph [ref=f2e1591]: USD 609
                            - generic [ref=f2e1592] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1594]:
                          - cell "03/01/2029 - 31/03/2029 Todos los días" [ref=f2e1595]:
                            - paragraph [ref=f2e1596]: 03/01/2029 - 31/03/2029
                            - generic [ref=f2e1597]: Todos los días
                          - cell "USD 1,650 TARIFA EXTENDIDA" [ref=f2e1598]:
                            - paragraph [ref=f2e1599]: USD 1,650
                            - generic [ref=f2e1600] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 825 TARIFA EXTENDIDA" [ref=f2e1602]:
                            - paragraph [ref=f2e1603]: USD 825
                            - generic [ref=f2e1604] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 609 TARIFA EXTENDIDA" [ref=f2e1606]:
                            - paragraph [ref=f2e1607]: USD 609
                            - generic [ref=f2e1608] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1610]:
                          - cell "01/04/2029 - 30/09/2029 Todos los días" [ref=f2e1611]:
                            - paragraph [ref=f2e1612]: 01/04/2029 - 30/09/2029
                            - generic [ref=f2e1613]: Todos los días
                          - cell "USD 1,496 TARIFA EXTENDIDA" [ref=f2e1614]:
                            - paragraph [ref=f2e1615]: USD 1,496
                            - generic [ref=f2e1616] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 748 TARIFA EXTENDIDA" [ref=f2e1618]:
                            - paragraph [ref=f2e1619]: USD 748
                            - generic [ref=f2e1620] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 558 TARIFA EXTENDIDA" [ref=f2e1622]:
                            - paragraph [ref=f2e1623]: USD 558
                            - generic [ref=f2e1624] [cursor=pointer]: TARIFA EXTENDIDA
                        - row [ref=f2e1626]:
                          - cell "01/10/2029 - 27/12/2029 Todos los días" [ref=f2e1627]:
                            - paragraph [ref=f2e1628]: 01/10/2029 - 27/12/2029
                            - generic [ref=f2e1629]: Todos los días
                          - cell "USD 1,650 TARIFA EXTENDIDA" [ref=f2e1630]:
                            - paragraph [ref=f2e1631]: USD 1,650
                            - generic [ref=f2e1632] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 825 TARIFA EXTENDIDA" [ref=f2e1634]:
                            - paragraph [ref=f2e1635]: USD 825
                            - generic [ref=f2e1636] [cursor=pointer]: TARIFA EXTENDIDA
                          - cell "USD 609 TARIFA EXTENDIDA" [ref=f2e1638]:
                            - paragraph [ref=f2e1639]: USD 609
                            - generic [ref=f2e1640] [cursor=pointer]: TARIFA EXTENDIDA
            - text: 
          - text:                                                                           
    - complementary
    - generic [ref=f2e1645]:
      - generic [ref=f2e1646]: AMV. TRAVEL
      - generic [ref=f2e1647]:
        - generic [ref=f2e1648]:
          - generic [ref=f2e1649]: 
          - text: Avenida Córdoba 673 1°B
        - link " 54 11 50313060" [ref=f2e1650] [cursor=pointer]:
          - /url: tel:54 11 50313060
          - generic [ref=f2e1651]: 
          - text: 54 11 50313060
        - link "hello@amv.travel" [ref=f2e1652] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
    - text:       
  - dialog [ref=f2e1656]:
    - generic [ref=f2e1657]:
      - heading [level=2] [ref=f2e1658]: Tu carrito
      - button [ref=f2e1659] [cursor=pointer]:
        - generic [ref=f2e1660]: 
    - generic [ref=f2e1662]:
      - generic [ref=f2e1663]: 
      - generic [ref=f2e1664]: Tu carrito está vacío
      - generic [ref=f2e1665]: Buscá hoteles, excursiones o traslados y los vas a ver acá.
    - text: 
  - text:          
```

# Test source

```ts
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
  678 |         ).toBe(esperados[clave]);
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
> 742 |             ).toBe(esp);
      |               ^ Error: La fila 2 de la solapa "sin-solapas" tiene que coincidir con la linea base.
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
  779 |       const nombre = await tarifario.nombreDelItem(cfg.container);
  780 |       const texto = await tarifario.textoDe(cfg.container);
  781 |       await adjuntarTexto('Esperado', `ID: ${cfg.id}\nNombre: ${cfg.nombre}`);
  782 |       await adjuntarTexto('Obtenido en pantalla',
  783 |         'titulo de la card: ' + nombre + SALTO + SALTO + texto.slice(0, 3000));
  784 | 
  785 |       await conResaltado(page, tarifario.locatorTituloDeLaCard(cfg.container),
  786 |         'el nombre del item no coincide', () => {
  787 |           expect(norm(nombre), `El titulo de la card tiene que ser "${cfg.nombre}"`)
  788 |             .toBe(norm(cfg.nombre));
  789 |         });
  790 |     });
  791 | 
  792 |     await validarElementos(page, tarifario, cfg);
  793 |     await validarDescripcionDeLaCard(page, tarifario, cfg);
  794 | 
  795 |     // El estado del boton se guarda para validarlo en su propio paso.
  796 |     let botonesAntes: string[] = [];
  797 |     let botonesDespues: string[] = [];
  798 | 
  799 |     await paso(page, 'Desplegar el tarifario del item', async () => {
  800 |       // El boton tiene que alternar "Ver Tarifario" -> "Cerrar Tarifario".
  801 |       // Se guarda el texto antes y despues para validarlo en el paso siguiente.
  802 |       botonesAntes = await tarifario.textosBotonesTarifario(cfg.container);
  803 |       await tarifario.verTarifario(cfg.container);
  804 |       botonesDespues = await tarifario.textosBotonesTarifario(cfg.container);
  805 |       const filas = await tarifario.leerTablaTarifas(cfg.container);
  806 |       await adjuntarTexto(
  807 |         'Tarifas que muestra la pantalla',
  808 |         filas.map((f) => f.join(' | ')).join(SALTO),
  809 |       );
  810 |       expect(filas.length, 'El tarifario tiene que mostrar filas').toBeGreaterThan(1);
  811 | 
  812 |       const precios = await tarifario.preciosDelTarifario(cfg.container);
  813 |       expect(precios.length, 'El tarifario tiene que mostrar importes').toBeGreaterThan(0);
  814 |     });
  815 | 
  816 |     // El paso exige la misma transicion en todas las pestanias. Antes, en
  817 |     // Cruceros se invertia la validacion y se daba por bueno que el boton
  818 |     // siguiera diciendo "Ver Tarifario": el paso salia en verde con el defecto
  819 |     // a la vista en la captura. Lo que la aplicacion hace no define lo esperado.
  820 |     await paso(page, 'El boton pasa de "Ver Tarifario" a "Cerrar Tarifario"', async () => {
  821 |       const btn = cfg.botonTarifario;
  822 |       const hayCerrar = botonesDespues.some((t) => t.includes(btn.textoDesplegado));
  823 | 
  824 |       await adjuntarTexto('Transicion del boton',
  825 |         'antes de desplegar:   ' + botonesAntes.join(' | ') + SALTO +
  826 |         'despues de desplegar: ' + botonesDespues.join(' | ') + SALTO +
  827 |         'esperado antes:       ' + btn.textoInicial + SALTO +
  828 |         'esperado despues:     ' + btn.textoDesplegado +
  829 |         (btn._hallazgoConocido ? SALTO + SALTO + 'HALLAZGO CONOCIDO: ' + btn._hallazgoConocido : ''));
  830 | 
  831 |       // Igual que el tag: el boton trae el chevron adelante o atras del texto.
  832 |       const soloLetras = (x: string) => x.replace(/[^\p{L} ]/gu, '').trim();
  833 |       expect(botonesAntes.map(soloLetras),
  834 |         `Antes de desplegar, el boton tiene que decir exactamente "${btn.textoInicial}"`,
  835 |       ).toEqual(botonesAntes.map(() => btn.textoInicial));
  836 | 
  837 |       if (!hayCerrar) {
  838 |         await resaltarYCapturar(page, tarifario.locatorDeComponente(cfg.container, 'botonTarifario'),
  839 |           `FALLA: el boton sigue diciendo "${botonesDespues.join(' | ')}" y deberia decir "${btn.textoDesplegado}"`);
  840 |       }
  841 | 
  842 |       // Soft: el tarifario ya quedo desplegado y con filas (paso anterior), asi
```