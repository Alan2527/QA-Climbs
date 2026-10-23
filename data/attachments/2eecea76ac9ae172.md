# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-b/idioma-del-servicio.spec.ts >> Idioma del servicio: de la ficha al carrito >> Cena Show: el idioma y el recargo de la ficha llegan iguales al carrito
- Location: tests/bloque-b/idioma-del-servicio.spec.ts:79:7

# Error details

```
Error: El carrito tiene que cobrar Inglés lo que mostro su ficha (USD 304)

expect(received).toBe(expected) // Object.is equality

Expected: 304
Received: 306

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

```
Error: El carrito tiene que cobrar Español lo que mostro su ficha (USD 274)

expect(received).toBe(expected) // Object.is equality

Expected: 274
Received: 276

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=f10e1]:
  - generic [ref=f10e2]:
    - generic [ref=f10e4]:
      - generic [ref=f10e5]:
        - link " hello@amv.travel" [ref=f10e6] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
          - generic [ref=f10e7]: 
          - text: hello@amv.travel
        - link "Emergencia 24hs  +54 9 11 3256 2827" [ref=f10e8] [cursor=pointer]:
          - /url: https://api.whatsapp.com/send/?phone=5491132562827&text=Hola%20AMV%20Travel&type=phone_number&app_absent=0
          - generic [ref=f10e9]: 
          - text: Emergencia 24hs
          - generic [ref=f10e10]: 
          - strong [ref=f10e11]: +54 9 11 3256 2827
        - generic:
          - generic: 
          - text: Entorno de test
      - generic [ref=f10e13]:
        - combobox [ref=f10e14]:
          - option "Buscar agencia..." [selected]
        - generic [ref=f10e16]:
          - combobox "Buscar agencia..." [ref=f10e17]
          - generic "Volver a mi agencia" [ref=f10e18] [cursor=pointer]: ⨯
        - combobox [ref=f10e19]:
          - option "Usuario" [selected]
        - combobox [ref=f10e21] [cursor=pointer]:
          - text: 
          - generic [ref=f10e22]: Usuario
        - text:  
    - complementary [ref=f10e23]:
      - generic [ref=f10e25]:
        - link [ref=f10e27] [cursor=pointer]:
          - /url: /online/Default.aspx
        - list [ref=f10e29]:
          - listitem [ref=f10e30]:
            - link "Inicio" [ref=f10e31] [cursor=pointer]:
              - /url: /online/Default.aspx
          - listitem [ref=f10e32]:
            - link "Multidestino" [ref=f10e33] [cursor=pointer]:
              - /url: /online/tourall.aspx?country=10&city=5000&tour=0&resident=false
          - listitem [ref=f10e34]:
            - link "Tarifario" [ref=f10e35] [cursor=pointer]:
              - /url: /online/defaulttariff.aspx?country=10&city=5000&from=23-10-2026&to=23-04-2028&resident=false&tab=tour&tourId=0
          - listitem [ref=f10e36]:
            - link "Cruceros" [ref=f10e37] [cursor=pointer]:
              - /url: /online/cruiseall.aspx
          - listitem [ref=f10e38]:
            - link "Series" [ref=f10e39] [cursor=pointer]:
              - /url: /online/serieAll.aspx
          - listitem [ref=f10e40]:
            - link "Reservas" [ref=f10e41] [cursor=pointer]:
              - /url: /online/bookinghistory.aspx
          - listitem [ref=f10e42]:
            - link "Cotizaciones" [ref=f10e43] [cursor=pointer]:
              - /url: /online/quotehistory.aspx
          - text: 
        - button "Novedades" [ref=f10e45] [cursor=pointer]
        - text:  
        - generic [ref=f10e49]:
          - list [ref=f10e50]:
            - listitem [ref=f10e51]:
              - link [ref=f10e52] [cursor=pointer]:
                - /url: https://qa.amv.travel/online/ShoppingCartPage.aspx
          - list [ref=f10e58]:
            - listitem [ref=f10e59]:
              - link "M 0,50 " [ref=f10e60] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f10e61]:
                  - generic [ref=f10e62]: M 0,50
                  - generic [ref=f10e63]: 
          - list [ref=f10e64]:
            - listitem [ref=f10e65]:
              - link "Pablo " [ref=f10e66] [cursor=pointer]:
                - /url: "#"
                - text: Pablo
                - generic [ref=f10e67]: 
          - list [ref=f10e68]:
            - listitem [ref=f10e69]:
              - link "ES " [ref=f10e70] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f10e71]: ES
                - generic [ref=f10e72]: 
      - generic [ref=f10e73]:
        - generic [ref=f10e74]:
          - generic [ref=f10e75]:
            - generic [ref=f10e76]: 
            - generic [ref=f10e77]: TU OPERACIÓN, EN UN SOLO LUGAR
          - heading "Diseña, cotiza y reserva desde un solo lugar" [level=1] [ref=f10e78]
          - paragraph [ref=f10e79]: Paquetes, hoteles y servicios, con tarifas del día y disponibilidad en línea.
        - generic [ref=f10e81]:
          - tablist [ref=f10e83]:
            - tab " MULTIDESTINO" [ref=f10e84] [cursor=pointer]:
              - text: 
              - generic [ref=f10e85]: MULTIDESTINO
            - tab " HOTELES" [ref=f10e86] [cursor=pointer]:
              - text: 
              - generic [ref=f10e87]: HOTELES
            - tab " SERVICIOS" [ref=f10e88]:
              - text: 
              - generic [ref=f10e89]: SERVICIOS
            - tab " OFERTAS" [ref=f10e90] [cursor=pointer]:
              - text: 
              - generic [ref=f10e91]: OFERTAS
          - generic [ref=f10e92]:
            - text:               
            - generic [ref=f10e93]:
              - generic [ref=f10e94]:
                - generic [ref=f10e97]:
                  - generic [ref=f10e98]:  País
                  - combobox [ref=f10e99]:
                    - option "Bolivia"
                    - option "Brasil"
                    - option "Chile"
                    - option "Chipre"
                    - option "Mexico"
                    - option "Paraguay"
                    - option "Perú"
                    - option "Uruguay"
                    - option "ZZ Pais QA 4738"
                    - option "Argentina" [selected]
                  - combobox [ref=f10e101] [cursor=pointer]:
                    - text: 
                    - generic [ref=f10e102]: Argentina
                - generic [ref=f10e105]:
                  - generic [ref=f10e106]:  Ciudad
                  - combobox [ref=f10e107]:
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
                    - option "La Plata"
                    - option "Jujuy"
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
                    - option "Buenos Aires" [selected]
                  - generic [ref=f10e109] [cursor=pointer]:
                    - text: 
                    - generic [ref=f10e110]: Buenos Aires
                    - combobox [ref=f10e111]
                - generic [ref=f10e114]:
                  - generic [ref=f10e115]:  Check-In
                  - paragraph [ref=f10e116]:
                    - textbox [ref=f10e117]: 13/01/2031
                    - text: 
              - generic [ref=f10e118]:
                - generic [ref=f10e121]:
                  - generic [ref=f10e122]:  Tipo
                  - combobox [ref=f10e123]:
                    - option "Excursión"
                    - option "Traslados"
                    - option "Cena Show" [selected]
                  - combobox [ref=f10e125] [cursor=pointer]:
                    - text: 
                    - generic [ref=f10e126]: Cena Show
                - text: 
                - button "Buscar" [ref=f10e129] [cursor=pointer]
            - text:         
    - complementary
    - generic [ref=f10e130]:
      - generic [ref=f10e132]:
        - generic [ref=f10e133]: Destacados
        - heading "Hotsale" [level=2] [ref=f10e134]
        - paragraph [ref=f10e135]: Promos imperdibles 80% off
      - generic [ref=f10e136]:
        - link "Excursión  City Tour Mendoza Medio día Desde USD36 por persona" [ref=f10e137] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/defaulttariff.aspx?country=10&city=5005&from=23-10-2026&to=23-04-2028&tab=excursion&service=1239
          - generic [ref=f10e138]:
            - generic [ref=f10e139]:
              - generic [ref=f10e140]: 
              - text: Excursión
            - generic [ref=f10e141]: 
          - generic [ref=f10e144]:
            - heading "City Tour" [level=3] [ref=f10e145]
            - paragraph [ref=f10e146]:
              - generic [ref=f10e147]: 
              - text: Mendoza
            - generic [ref=f10e148]: Medio día
            - generic [ref=f10e150]:
              - generic [ref=f10e151]:
                - generic [ref=f10e152]: Desde
                - generic [ref=f10e154]: USD36
                - generic [ref=f10e155]: por persona
              - generic [ref=f10e156]: 
        - link "Hotel  Sheraton Buenos Aires Buenos Aires 5* Desde A requerir USD414 por noche, 2 adultos" [ref=f10e158] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/hotellanding.aspx?hotel=5008
          - generic [ref=f10e159]:
            - generic [ref=f10e160]:
              - generic [ref=f10e161]: 
              - text: Hotel
            - generic [ref=f10e162]: 
          - generic [ref=f10e165]:
            - heading "Sheraton Buenos Aires" [level=3] [ref=f10e166]
            - paragraph [ref=f10e167]:
              - generic [ref=f10e168]: 
              - text: Buenos Aires
            - generic [ref=f10e169]: 5*
            - generic [ref=f10e171]:
              - generic [ref=f10e172]:
                - generic [ref=f10e173]:
                  - generic [ref=f10e174]: Desde
                  - generic [ref=f10e175]: A requerir
                - generic [ref=f10e176]: USD414
                - generic [ref=f10e177]: por noche, 2 adultos
              - generic [ref=f10e178]: 
        - link "Traslado  Aeropuerto / Hotel Cusco Desde USD25 por persona" [ref=f10e180] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/defaulttariff.aspx?country=165&city=5115&from=23-10-2026&to=23-04-2028&tab=transfer&service=2419
          - generic [ref=f10e181]:
            - generic [ref=f10e182]:
              - generic [ref=f10e183]: 
              - text: Traslado
            - generic [ref=f10e184]: 
          - generic [ref=f10e187]:
            - heading "Aeropuerto / Hotel" [level=3] [ref=f10e188]
            - paragraph [ref=f10e189]:
              - generic [ref=f10e190]: 
              - text: Cusco
            - generic [ref=f10e191]:
              - generic [ref=f10e192]:
                - generic [ref=f10e193]: Desde
                - generic [ref=f10e195]: USD25
                - generic [ref=f10e196]: por persona
              - generic [ref=f10e197]: 
    - generic [ref=f10e199]:
      - generic [ref=f10e201]:
        - generic [ref=f10e202]: Hasta el 01/11
        - heading "Lo mejor de Argentina" [level=2] [ref=f10e203]
        - paragraph [ref=f10e204]: Aprovecha estos precios hasta noviembre!
      - generic [ref=f10e205]:
        - link "Hotel  Sheraton Buenos Aires Buenos Aires 5* Desde A requerir USD414 por noche, 2 adultos" [ref=f10e206] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/hotellanding.aspx?hotel=5008
          - generic [ref=f10e207]:
            - generic [ref=f10e208]:
              - generic [ref=f10e209]: 
              - text: Hotel
            - generic [ref=f10e210]: 
          - generic [ref=f10e213]:
            - heading "Sheraton Buenos Aires" [level=3] [ref=f10e214]
            - paragraph [ref=f10e215]:
              - generic [ref=f10e216]: 
              - text: Buenos Aires
            - generic [ref=f10e217]: 5*
            - generic [ref=f10e219]:
              - generic [ref=f10e220]:
                - generic [ref=f10e221]:
                  - generic [ref=f10e222]: Desde
                  - generic [ref=f10e223]: A requerir
                - generic [ref=f10e224]: USD414
                - generic [ref=f10e225]: por noche, 2 adultos
              - generic [ref=f10e226]: 
        - link "Excursión  City Tour Montevideo Medio día Desde USD44 por persona" [ref=f10e228] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/defaulttariff.aspx?country=224&city=5007&from=23-10-2026&to=23-04-2028&tab=excursion&service=89
          - generic [ref=f10e229]:
            - generic [ref=f10e230]:
              - generic [ref=f10e231]: 
              - text: Excursión
            - generic [ref=f10e232]: 
          - generic [ref=f10e235]:
            - heading "City Tour" [level=3] [ref=f10e236]
            - paragraph [ref=f10e237]:
              - generic [ref=f10e238]: 
              - text: Montevideo
            - generic [ref=f10e239]: Medio día
            - generic [ref=f10e241]:
              - generic [ref=f10e242]:
                - generic [ref=f10e243]: Desde
                - generic [ref=f10e245]: USD44
                - generic [ref=f10e246]: por persona
              - generic [ref=f10e247]: 
    - generic [ref=f10e249]:
      - generic [ref=f10e251]:
        - generic [ref=f10e252]: Hasta el 31/10
        - heading "AUTO-QA 4754 A ES" [level=2] [ref=f10e253]
        - paragraph [ref=f10e254]: Subtítulo ES
      - generic [ref=f10e255]:
        - link "Excursión  City Tour Full Day Buenos Aires Día completo ES EN PT Desde USD374 por persona" [ref=f10e256] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/defaulttariff.aspx?country=10&city=5000&from=23-10-2026&to=23-04-2028&tab=excursion&service=147
          - generic [ref=f10e257]:
            - generic [ref=f10e258]:
              - generic [ref=f10e259]: 
              - text: Excursión
            - generic [ref=f10e260]: 
          - generic [ref=f10e263]:
            - heading "City Tour Full Day" [level=3] [ref=f10e264]
            - paragraph [ref=f10e265]:
              - generic [ref=f10e266]: 
              - text: Buenos Aires
            - generic [ref=f10e267]:
              - generic [ref=f10e268]: Día completo
              - generic [ref=f10e269]: ES
              - generic [ref=f10e270]: EN
              - generic [ref=f10e271]: PT
            - generic [ref=f10e272]:
              - generic [ref=f10e273]:
                - generic [ref=f10e274]: Desde
                - generic [ref=f10e276]: USD374
                - generic [ref=f10e277]: por persona
              - generic [ref=f10e278]: 
        - link "Hotel  Sheraton Buenos Aires Buenos Aires 5* Desde A requerir USD414 por noche, 2 adultos" [ref=f10e280] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/hotellanding.aspx?hotel=5008
          - generic [ref=f10e281]:
            - generic [ref=f10e282]:
              - generic [ref=f10e283]: 
              - text: Hotel
            - generic [ref=f10e284]: 
          - generic [ref=f10e287]:
            - heading "Sheraton Buenos Aires" [level=3] [ref=f10e288]
            - paragraph [ref=f10e289]:
              - generic [ref=f10e290]: 
              - text: Buenos Aires
            - generic [ref=f10e291]: 5*
            - generic [ref=f10e293]:
              - generic [ref=f10e294]:
                - generic [ref=f10e295]:
                  - generic [ref=f10e296]: Desde
                  - generic [ref=f10e297]: A requerir
                - generic [ref=f10e298]: USD414
                - generic [ref=f10e299]: por noche, 2 adultos
              - generic [ref=f10e300]: 
        - link "Excursión  Fiesta Gaucha Estancia Santa Susana Buenos Aires Día completo ES EN" [ref=f10e302] [cursor=pointer]:
          - /url: https://www.google.com
          - generic [ref=f10e303]:
            - generic [ref=f10e304]:
              - generic [ref=f10e305]: 
              - text: Excursión
            - generic [ref=f10e306]: 
          - generic [ref=f10e309]:
            - heading "Fiesta Gaucha Estancia Santa Susana" [level=3] [ref=f10e310]
            - paragraph [ref=f10e311]:
              - generic [ref=f10e312]: 
              - text: Buenos Aires
            - generic [ref=f10e313]:
              - generic [ref=f10e314]: Día completo
              - generic [ref=f10e315]: ES
              - generic [ref=f10e316]: EN
            - generic [ref=f10e317]: 
        - link "Excursión  Parque de la Costa Buenos Aires Día completo ES Desde USD157 por persona" [ref=f10e320] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/defaulttariff.aspx?country=10&city=5000&from=23-10-2026&to=23-04-2028&tab=excursion&service=149
          - generic [ref=f10e321]:
            - generic [ref=f10e322]:
              - generic [ref=f10e323]: 
              - text: Excursión
            - generic [ref=f10e324]: 
          - generic [ref=f10e327]:
            - heading "Parque de la Costa" [level=3] [ref=f10e328]
            - paragraph [ref=f10e329]:
              - generic [ref=f10e330]: 
              - text: Buenos Aires
            - generic [ref=f10e331]:
              - generic [ref=f10e332]: Día completo
              - generic [ref=f10e333]: ES
            - generic [ref=f10e334]:
              - generic [ref=f10e335]:
                - generic [ref=f10e336]: Desde
                - generic [ref=f10e338]: USD157
                - generic [ref=f10e339]: por persona
              - generic [ref=f10e340]: 
    - generic [ref=f10e342]:
      - generic [ref=f10e344]:
        - generic [ref=f10e345]: Hasta el 31/10
        - heading "AUTO-QA 4754 B" [level=2] [ref=f10e346]
      - link "Excursión  Parque de la Costa Buenos Aires Día completo ES Desde USD157 por persona" [ref=f10e348] [cursor=pointer]:
        - /url: https://qa.amv.travel/online/defaulttariff.aspx?country=10&city=5000&from=23-10-2026&to=23-04-2028&tab=excursion&service=149
        - generic [ref=f10e349]:
          - generic [ref=f10e350]:
            - generic [ref=f10e351]: 
            - text: Excursión
          - generic [ref=f10e352]: 
        - generic [ref=f10e355]:
          - heading "Parque de la Costa" [level=3] [ref=f10e356]
          - paragraph [ref=f10e357]:
            - generic [ref=f10e358]: 
            - text: Buenos Aires
          - generic [ref=f10e359]:
            - generic [ref=f10e360]: Día completo
            - generic [ref=f10e361]: ES
          - generic [ref=f10e362]:
            - generic [ref=f10e363]:
              - generic [ref=f10e364]: Desde
              - generic [ref=f10e366]: USD157
              - generic [ref=f10e367]: por persona
            - generic [ref=f10e368]: 
    - generic [ref=f10e370]:
      - generic [ref=f10e372]:
        - generic [ref=f10e373]: Destinos
        - heading "Dónde estamos operando" [level=2] [ref=f10e374]
        - paragraph [ref=f10e375]: Elegí un país y abrí su tarifario completo.
      - generic [ref=f10e376]:
        - link "Argentina Argentina 34 destinos" [ref=f10e377] [cursor=pointer]:
          - /url: /online/defaulttariff.aspx?country=10&city=0&from=23-10-2026&to=23-04-2028&tab=tour&tourId=0
          - img "Argentina" [ref=f10e378]
          - generic [ref=f10e379]:
            - heading "Argentina" [level=3] [ref=f10e380]
            - generic [ref=f10e381]:
              - generic [ref=f10e382]: 
              - generic [ref=f10e383]: 34 destinos
        - link "Perú Perú 17 destinos" [ref=f10e384] [cursor=pointer]:
          - /url: /online/defaulttariff.aspx?country=165&city=0&from=23-10-2026&to=23-04-2028&tab=tour&tourId=0
          - img "Perú" [ref=f10e385]
          - generic [ref=f10e386]:
            - heading "Perú" [level=3] [ref=f10e387]
            - generic [ref=f10e388]:
              - generic [ref=f10e389]: 
              - generic [ref=f10e390]: 17 destinos
        - link "Chile Chile 13 destinos" [ref=f10e391] [cursor=pointer]:
          - /url: /online/defaulttariff.aspx?country=43&city=0&from=23-10-2026&to=23-04-2028&tab=tour&tourId=0
          - img "Chile" [ref=f10e392]
          - generic [ref=f10e393]:
            - heading "Chile" [level=3] [ref=f10e394]
            - generic [ref=f10e395]:
              - generic [ref=f10e396]: 
              - generic [ref=f10e397]: 13 destinos
        - link "Brasil Brasil 6 destinos" [ref=f10e398] [cursor=pointer]:
          - /url: /online/defaulttariff.aspx?country=30&city=0&from=23-10-2026&to=23-04-2028&tab=tour&tourId=0
          - img "Brasil" [ref=f10e399]
          - generic [ref=f10e400]:
            - heading "Brasil" [level=3] [ref=f10e401]
            - generic [ref=f10e402]:
              - generic [ref=f10e403]: 
              - generic [ref=f10e404]: 6 destinos
        - link "Bolivia Bolivia 5 destinos" [ref=f10e405] [cursor=pointer]:
          - /url: /online/defaulttariff.aspx?country=26&city=0&from=23-10-2026&to=23-04-2028&tab=tour&tourId=0
          - img "Bolivia" [ref=f10e406]
          - generic [ref=f10e407]:
            - heading "Bolivia" [level=3] [ref=f10e408]
            - generic [ref=f10e409]:
              - generic [ref=f10e410]: 
              - generic [ref=f10e411]: 5 destinos
        - link "Uruguay Uruguay 3 destinos" [ref=f10e412] [cursor=pointer]:
          - /url: /online/defaulttariff.aspx?country=224&city=0&from=23-10-2026&to=23-04-2028&tab=tour&tourId=0
          - img "Uruguay" [ref=f10e413]
          - generic [ref=f10e414]:
            - heading "Uruguay" [level=3] [ref=f10e415]
            - generic [ref=f10e416]:
              - generic [ref=f10e417]: 
              - generic [ref=f10e418]: 3 destinos
        - link "Paraguay Paraguay 2 destinos" [ref=f10e419] [cursor=pointer]:
          - /url: /online/defaulttariff.aspx?country=164&city=0&from=23-10-2026&to=23-04-2028&tab=tour&tourId=0
          - img "Paraguay" [ref=f10e420]
          - generic [ref=f10e421]:
            - heading "Paraguay" [level=3] [ref=f10e422]
            - generic [ref=f10e423]:
              - generic [ref=f10e424]: 
              - generic [ref=f10e425]: 2 destinos
        - link "Buscar en todo el tarifario Paquetes, hoteles, excursiones, traslados y cruceros en una sola pantalla." [ref=f10e426] [cursor=pointer]:
          - /url: /online/defaulttariff.aspx?country=10&city=5000&from=23-10-2026&to=23-04-2028&tab=tour&tourId=0
          - generic [ref=f10e427]: 
          - generic [ref=f10e429]:
            - strong [ref=f10e430]: Buscar en todo el tarifario
            - generic [ref=f10e431]: Paquetes, hoteles, excursiones, traslados y cruceros en una sola pantalla.
          - generic [ref=f10e432]: 
    - generic [ref=f10e437]:
      - generic [ref=f10e438]: AMV. TRAVEL
      - generic [ref=f10e439]:
        - generic [ref=f10e440]:
          - generic [ref=f10e441]: 
          - text: Avenida Córdoba 673 1°B
        - link " 54 11 50313060" [ref=f10e442] [cursor=pointer]:
          - /url: tel:54 11 50313060
          - generic [ref=f10e443]: 
          - text: 54 11 50313060
        - link "hello@amv.travel" [ref=f10e444] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
    - text:      
  - dialog [ref=f10e448]:
    - generic [ref=f10e449]:
      - heading [level=2] [ref=f10e450]: Tu carrito
      - button [ref=f10e451] [cursor=pointer]:
        - generic [ref=f10e452]: 
    - generic [ref=f10e454]:
      - generic [ref=f10e455]: 
      - generic [ref=f10e456]: Tu carrito está vacío
      - generic [ref=f10e457]: Buscá hoteles, excursiones o traslados y los vas a ver acá.
    - text: 
```

# Test source

```ts
  283 |  *         AdvisorHelper.RoundUp(x, 0)              => Math.Ceiling(x)
  284 |  *
  285 |  * Con markup 0,50: 68,20 / 0,50 = 136,40 -> 137
  286 |  */
  287 | export function precioMostrado(totalRate: number, markup: number): number {
  288 |   const conMarkup = markup > 0 ? totalRate / markup : totalRate;
  289 |   // Se redondea a 2 antes de Ceiling para evitar arrastres binarios (136.39999...).
  290 |   return Math.ceil(Number(conMarkup.toFixed(2)));
  291 | }
  292 | 
  293 | /**
  294 |  * Marca un elemento con un recuadro rojo y adjunta la captura.
  295 |  *
  296 |  * Se usa cuando una validacion falla: el reporte muestra la pantalla con el
  297 |  * componente o el dato problematico senalado, en vez de una captura donde hay
  298 |  * que adivinar que esta mal.
  299 |  *
  300 |  * Si el elemento no existe (es lo que suele fallar), se resalta el contenedor
  301 |  * de respaldo para al menos ubicar la zona.
  302 |  */
  303 | export async function resaltarYCapturar(
  304 |   page: Page,
  305 |   locator: Locator,
  306 |   nombre: string,
  307 |   respaldo?: Locator,
  308 | ) {
  309 |   const marcar = async (loc: Locator) => {
  310 |     await loc.first().evaluate((el) => {
  311 |       const e = el as HTMLElement;
  312 |       // En una fila de tabla el outline se dibuja solo arriba y abajo: las celdas
  313 |       // no lo heredan. Por eso ahi se pinta cada td y se cierra el recuadro a mano.
  314 |       if (e.tagName === 'TR') {
  315 |         const celdas = Array.from(e.querySelectorAll('td, th')) as HTMLElement[];
  316 |         celdas.forEach((c, i) => {
  317 |           c.style.backgroundColor = 'rgba(225, 29, 72, 0.12)';
  318 |           c.style.borderTop = '3px solid #e11d48';
  319 |           c.style.borderBottom = '3px solid #e11d48';
  320 |           if (i === 0) c.style.borderLeft = '3px solid #e11d48';
  321 |           if (i === celdas.length - 1) c.style.borderRight = '3px solid #e11d48';
  322 |         });
  323 |       } else {
  324 |         e.style.outline = '4px solid #e11d48';
  325 |         e.style.outlineOffset = '2px';
  326 |         e.style.boxShadow = '0 0 0 6px rgba(225, 29, 72, 0.25)';
  327 |       }
  328 | 
  329 |       // Los tooltips solo se ven al pasar el mouse, asi que en una captura no
  330 |       // salen nunca: si el elemento resaltado tiene uno adentro, se fuerza a
  331 |       // mostrarlo. Sin esto, el reporte marcaba en rojo un icono y no se veia el
  332 |       // texto que estaba mal.
  333 |       e.querySelectorAll('.tariff-op-tooltip').forEach((t) => {
  334 |         const tip = t as HTMLElement;
  335 |         tip.style.display = 'block';
  336 |         tip.style.visibility = 'visible';
  337 |         tip.style.opacity = '1';
  338 |         tip.style.position = 'static';
  339 |         tip.style.background = '#111827';
  340 |         tip.style.color = '#f9fafb';
  341 |         tip.style.padding = '6px 10px';
  342 |         tip.style.borderRadius = '6px';
  343 |         tip.style.marginTop = '6px';
  344 |       });
  345 | 
  346 |       e.scrollIntoView({ block: 'center', inline: 'center' });
  347 |     });
  348 |   };
  349 | 
  350 |   try {
  351 |     if (await locator.count()) await marcar(locator);
  352 |     else if (respaldo && (await respaldo.count())) await marcar(respaldo);
  353 |   } catch {
  354 |     // Un elemento que desaparece entre el conteo y el marcado no debe tapar
  355 |     // el error real: se adjunta la captura igual.
  356 |   }
  357 |   await adjuntarCaptura(page, nombre, true);
  358 |   hayCapturaDeFalla = true;
  359 | }
  360 | 
  361 | /**
  362 |  * Corre una comparacion y, si falla, marca en rojo la zona que la origino, la
  363 |  * adjunta al reporte y la registra como **fallo blando**.
  364 |  *
  365 |  * Blando y no duro a proposito: una diferencia de contenido no impide seguir
  366 |  * mirando el resto de la pantalla. Antes, el primer texto que no coincidia
  367 |  * dejaba sin ejecutar todos los pasos siguientes y habia que corregir y volver a
  368 |  * correr para ver el resto. El test igual termina en rojo: Playwright acumula
  369 |  * los `expect.soft` y falla al cerrar.
  370 |  *
  371 |  * Vivio duplicado en los ocho archivos de test hasta el 2026-09-05. Se dejo asi
  372 |  * mientras los bloques se iban terminando de a uno, para no tocar lo que ya
  373 |  * estaba en verde; una vez cerrados los tres, no habia razon para mantener ocho
  374 |  * copias de las mismas diez lineas.
  375 |  */
  376 | export async function conResaltado(
  377 |   page: Page, locator: Locator, etiqueta: string, fn: () => void | Promise<void>,
  378 | ) {
  379 |   try {
  380 |     await fn();
  381 |   } catch (error) {
  382 |     await resaltarYCapturar(page, locator, `FALLA: ${etiqueta}`);
> 383 |     expect.soft(false, (error as Error).message).toBe(true);
      |                                                  ^ Error: El carrito tiene que cobrar Español lo que mostro su ficha (USD 274)
  384 |   }
  385 | }
  386 | 
  387 | /**
  388 |  * Convierte el sello de la corrida a letras, para poder usarlo en un nombre.
  389 |  *
  390 |  * **Desde el rediseño del 2026-09-05 el checkout de CustomTours rechaza nombres y
  391 |  * apellidos con digitos**: `TourPassangerControl.ascx.cs:199` valida
  392 |  * `!valor.Any(char.IsDigit)`. Y la unica senial es que el campo se pinta con
  393 |  * `border-danger` — no hay ningun mensaje. La reserva simplemente no se guarda: el
  394 |  * postback vuelve 200, la pantalla se redibuja igual y no queda nada en el log.
  395 |  *
  396 |  * La suite necesita que el apellido siga siendo unico por corrida, porque es como
  397 |  * se ubican despues las reservas que deja —sobre todo la de series, que viaja sin
  398 |  * referencia—. Se mapea cada digito a una letra (0 -> A, 1 -> B, ... 9 -> J), asi
  399 |  * el marcador sigue siendo unico y se puede volver al sello leyendolo al reves.
  400 |  */
  401 | export function selloEnLetras(sello: string): string {
  402 |   return sello.replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)]);
  403 | }
  404 | 
  405 | /**
  406 |  * Codigo de una reserva tal como lo muestra el portal.
  407 |  *
  408 |  * Desde el rediseno del historial (deploy del 2026-09-26) el enlace de cada
  409 |  * reserva envuelve la fila entera: su texto trae el codigo y, debajo, la fecha,
  410 |  * el pasajero, la agencia, el estado y el importe. El codigo es la primera
  411 |  * linea. Desde el 2026-09-30 el prefijo sale de la sucursal del file
  412 |  * (`BO_Branch.FilePrefix`), asi que no se fija "BO": se exige un prefijo de
  413 |  * letras y el numero.
  414 |  */
  415 | export function codigoDeReserva(texto: string): string {
  416 |   const primera = (texto || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
  417 |   expect(primera, 'El codigo de la reserva tiene que ser un prefijo de letras y un numero')
  418 |     .toMatch(/^[A-Z]+\d+$/);
  419 |   return primera;
  420 | }
  421 | 
  422 | /**
  423 |  * Numero de un importe del portal, venga con coma o con punto de miles.
  424 |  *
  425 |  * Hasta el 2026-09-28 el portal escribia "USD 2,578" y "M 0.50"; el 2026-10-10
  426 |  * escribe "USD 2.578" y "M 0,50". No se ato a ninguno de los dos:
  427 |  *   - con punto y coma a la vez, el que va ultimo es el decimal;
  428 |  *   - con uno solo, si cada grupo que separa tiene exactamente 3 cifras es de
  429 |  *     miles ("2.578", "10.139", "2,578"); si no, es decimal ("0,50", "0.50").
  430 |  * Un importe de tres cifras exactas despues del separador se lee como miles: el
  431 |  * portal no muestra tres decimales.
  432 |  */
  433 | export function numeroDelPortal(texto: string): number | null {
  434 |   const limpio = (texto || '').replace(/[^\d.,-]/g, '');
  435 |   if (!/\d/.test(limpio)) return null;
  436 |   let entero = limpio;
  437 |   let decimales = '';
  438 |   const ultimoPunto = limpio.lastIndexOf('.');
  439 |   const ultimaComa = limpio.lastIndexOf(',');
  440 |   if (ultimoPunto >= 0 && ultimaComa >= 0) {
  441 |     const corte = Math.max(ultimoPunto, ultimaComa);
  442 |     entero = limpio.slice(0, corte);
  443 |     decimales = limpio.slice(corte + 1);
  444 |   } else if (ultimoPunto >= 0 || ultimaComa >= 0) {
  445 |     const sep = ultimoPunto >= 0 ? '.' : ',';
  446 |     const partes = limpio.split(sep);
  447 |     const sonMiles = partes.slice(1).every((p) => p.length === 3);
  448 |     if (!sonMiles) {
  449 |       entero = partes.slice(0, -1).join('');
  450 |       decimales = partes[partes.length - 1];
  451 |     }
  452 |   }
  453 |   const valor = Number(entero.replace(/[.,]/g, '') + (decimales ? '.' + decimales : ''));
  454 |   return Number.isFinite(valor) ? valor : null;
  455 | }
  456 | 
  457 | /**
  458 |  * Saca los separadores de miles de los importes de un texto, para comparar una
  459 |  * fila de pantalla contra la linea base sin depender del formato del dia:
  460 |  * "USD 4,870" y "USD 4.870" quedan los dos "USD 4870". Solo toca grupos de
  461 |  * exactamente 3 cifras pegados a otra cifra, asi que las fechas (01/10/2026) y
  462 |  * los decimales ("0,50") no cambian.
  463 |  */
  464 | export function sinSeparadorDeMiles(texto: string): string {
  465 |   let previo: string;
  466 |   let actual = texto;
  467 |   do {
  468 |     previo = actual;
  469 |     actual = actual.replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2');
  470 |   } while (actual !== previo);
  471 |   return actual;
  472 | }
  473 | 
  474 | /**
  475 |  * Nacionalidad de un pasajero, en el checkout o en el carrito del multidestino.
  476 |  *
  477 |  * Desde el deploy del 2026-09-26 la nacionalidad del checkout es un desplegable
  478 |  * (`ddNationality`, CheckOut.aspx:251) y no un campo de texto. Lo dibuja TomSelect
  479 |  * (`initializeTomSelect`, js/main.js), que esconde el `<select>` y pone su control
  480 |  * al lado; con mas de 15 paises trae buscador. Se elige como una persona: se abre,
  481 |  * se escribe el pais y se hace clic en la opcion. El carrito del multidestino
  482 |  * (TourPassangerControl.ascx) usa el mismo control.
  483 |  */
```