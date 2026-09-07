# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-a/tarifario.spec.ts >> Tarifario >> Ofertas: trae tarifas y muestra la oferta esperada
- Location: tests/bloque-a/tarifario.spec.ts:976:7

# Error details

```
Error: La fila 19 de la solapa "sin-solapas" tiene que coincidir con la linea base.
esperado: 01/03/2028 - 05/03/2028 | USD 5,170 | USD 2,728 | USD 2,196
en pantalla: 01/03/2028 - 07/03/2028 | USD 5,170 | USD 2,728 | USD 2,196

expect(received).toBe(expected) // Object.is equality

Expected: "01/03/2028 - 05/03/2028 | USD 5,170 | USD 2,728 | USD 2,196"
Received: "01/03/2028 - 07/03/2028 | USD 5,170 | USD 2,728 | USD 2,196"
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
              - link "CENA SHOW" [ref=f2e127] [cursor=pointer]:
                - /url: "#show"
            - listitem [ref=f2e128]:
              - link "CRUCEROS" [ref=f2e129] [cursor=pointer]:
                - /url: "#cruise"
            - listitem [ref=f2e130]:
              - link "OFERTAS" [ref=f2e131]:
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
                - option "Ushuaia" [selected]
              - combobox [ref=f2e147] [cursor=pointer]:
                - text: 
                - generic [ref=f2e148]: Ushuaia
            - link "Buscar" [ref=f2e150] [cursor=pointer]:
              - /url: javascript:__doPostBack('ctl00$cphMainSlider$ctrlTariffFilterControl$lnkView','')
          - generic [ref=f2e153]:
            - generic: 
            - combobox [ref=f2e154]:
              - option
              - option "AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)" [selected]
            - generic [ref=f2e155]:
              - generic [ref=f2e156] [cursor=pointer]:
                - generic [ref=f2e157]: AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)
                - combobox "Buscar ofertas por nombre o palabra"
              - text: 
            - button " Limpiar" [ref=f2e158] [cursor=pointer]:
              - generic [ref=f2e159]: 
              - text: Limpiar
          - generic [ref=f2e160]:
            - text:  
            - generic [ref=f2e162]:
              - strong [ref=f2e163]: "1"
              - text: oferta en Ushuaia
        - generic [ref=f2e164]:
          - text:                                                                               
          - generic [ref=f2e170]:
            - generic [ref=f2e171]:
              - generic [ref=f2e172]:
                - generic [ref=f2e174]:
                  - img "AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)" [ref=f2e180]
                  - text:  
                - generic [ref=f2e181]:
                  - generic [ref=f2e182]:
                    - heading "AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)" [level=2] [ref=f2e183]
                    - tabpanel [ref=f2e185]:
                      - paragraph [ref=f2e187]:
                        - strong [ref=f2e188]: Buenos Aires » Ushuaia
                        - text: Oferta de datos fijos para pruebas automatizadas. No modificar.
                        - link "Ver detalle »" [ref=f2e189] [cursor=pointer]:
                          - /url: javascript:void(0);
                  - link "Cotizar y reservar" [ref=f2e191] [cursor=pointer]:
                    - /url: https://qa.amv.travel/online/customtours/main.aspx?tour=5060&resident=false
                - button "" [ref=f2e193] [cursor=pointer]
              - text: 
              - generic:
                - paragraph [ref=f2e196]:
                  - link "Cerrar Tarifario " [ref=f2e197] [cursor=pointer]:
                    - /url: "#"
                    - text: Cerrar Tarifario
                    - generic [ref=f2e198]: 
                - generic [ref=f2e199]:
                  - paragraph [ref=f2e201]:
                    - link "test" [active] [ref=f2e202] [cursor=pointer]:
                      - /url: "#"
                  - generic [ref=f2e203]:
                    - paragraph [ref=f2e204]:
                      - strong [ref=f2e205]: AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau » AUTO-QA NO TOCAR - Arakur Resort & Spa
                    - table [ref=f2e206]:
                      - rowgroup [ref=f2e207]:
                        - row [ref=f2e208]:
                          - columnheader "Vigencia" [ref=f2e209]
                          - columnheader "Precio por persona" [ref=f2e210]
                        - row [ref=f2e211]:
                          - columnheader "SGL" [ref=f2e212]
                          - columnheader "DBL" [ref=f2e213]
                          - columnheader "TPL" [ref=f2e214]
                      - rowgroup [ref=f2e215]:
                        - row [ref=f2e216]:
                          - cell [ref=f2e217]:
                            - paragraph [ref=f2e218]: 07/09/2026 - 19/09/2026
                          - cell [ref=f2e219]:
                            - paragraph [ref=f2e220]: USD 4,910
                            - paragraph
                          - cell [ref=f2e221]:
                            - paragraph [ref=f2e222]: USD 2,582
                            - paragraph
                          - cell [ref=f2e223]:
                            - paragraph [ref=f2e224]: USD 2,084
                            - paragraph
                        - row [ref=f2e225]:
                          - cell [ref=f2e226]:
                            - paragraph [ref=f2e227]: 20/09/2026 - 30/09/2026
                          - cell [ref=f2e228]:
                            - paragraph [ref=f2e229]: USD 4,450
                            - paragraph
                          - cell [ref=f2e230]:
                            - paragraph [ref=f2e231]: USD 2,368
                            - paragraph
                          - cell [ref=f2e232]:
                            - paragraph [ref=f2e233]: USD 1,940
                            - paragraph
                        - row [ref=f2e234]:
                          - cell [ref=f2e235]:
                            - paragraph [ref=f2e236]: 01/10/2026 - 31/10/2026
                          - cell [ref=f2e237]:
                            - paragraph [ref=f2e238]: USD 4,870
                            - paragraph
                          - cell [ref=f2e239]:
                            - paragraph [ref=f2e240]: USD 2,578
                            - paragraph
                          - cell [ref=f2e241]:
                            - paragraph [ref=f2e242]: USD 2,080
                            - paragraph
                        - row [ref=f2e243]:
                          - cell [ref=f2e244]:
                            - paragraph [ref=f2e245]: 01/11/2026 - 23/12/2026
                          - cell [ref=f2e246]:
                            - paragraph [ref=f2e247]: USD 5,098
                            - paragraph
                          - cell [ref=f2e248]:
                            - paragraph [ref=f2e249]: USD 2,670
                            - paragraph
                          - cell [ref=f2e250]:
                            - paragraph [ref=f2e251]: USD 2,142
                            - paragraph
                        - row [ref=f2e252]:
                          - cell [ref=f2e253]:
                            - paragraph [ref=f2e254]: 24/12/2026 - 27/12/2026
                          - cell [ref=f2e255]:
                            - paragraph [ref=f2e256]: USD 5,330
                            - paragraph
                          - cell [ref=f2e257]:
                            - paragraph [ref=f2e258]: USD 2,792
                            - paragraph
                          - cell [ref=f2e259]:
                            - paragraph [ref=f2e260]: USD 2,224
                            - paragraph
                        - row [ref=f2e261]:
                          - cell [ref=f2e262]:
                            - paragraph [ref=f2e263]: 03/01/2027 - 03/01/2027
                          - cell [ref=f2e264]:
                            - paragraph [ref=f2e265]: USD 5,330
                            - paragraph
                          - cell [ref=f2e266]:
                            - paragraph [ref=f2e267]: USD 2,792
                            - paragraph
                          - cell [ref=f2e268]:
                            - paragraph [ref=f2e269]: USD 2,224
                            - paragraph
                        - row [ref=f2e270]:
                          - cell [ref=f2e271]:
                            - paragraph [ref=f2e272]: 04/01/2027 - 28/02/2027
                          - cell [ref=f2e273]:
                            - paragraph [ref=f2e274]: USD 5,098
                            - paragraph
                          - cell [ref=f2e275]:
                            - paragraph [ref=f2e276]: USD 2,670
                            - paragraph
                          - cell [ref=f2e277]:
                            - paragraph [ref=f2e278]: USD 2,142
                            - paragraph
                        - row [ref=f2e279]:
                          - cell [ref=f2e280]:
                            - paragraph [ref=f2e281]: 01/03/2027 - 31/03/2027
                          - cell [ref=f2e282]:
                            - paragraph [ref=f2e283]: USD 4,870
                            - paragraph
                          - cell [ref=f2e284]:
                            - paragraph [ref=f2e285]: USD 2,578
                            - paragraph
                          - cell [ref=f2e286]:
                            - paragraph [ref=f2e287]: USD 2,080
                            - paragraph
                        - row [ref=f2e288]:
                          - cell [ref=f2e289]:
                            - paragraph [ref=f2e290]: 01/04/2027 - 30/06/2027
                          - cell [ref=f2e291]:
                            - paragraph [ref=f2e292]: USD 4,286
                            - paragraph
                          - cell [ref=f2e293]:
                            - paragraph [ref=f2e294]: USD 2,276
                            - paragraph
                          - cell [ref=f2e295]:
                            - paragraph [ref=f2e296]: USD 1,880
                            - paragraph
                        - row [ref=f2e297]:
                          - cell [ref=f2e298]:
                            - paragraph [ref=f2e299]: 01/07/2027 - 08/07/2027
                          - cell [ref=f2e300]:
                            - paragraph [ref=f2e301]: USD 4,936
                            - paragraph
                          - cell [ref=f2e302]:
                            - paragraph [ref=f2e303]: USD 2,590
                            - paragraph
                          - cell [ref=f2e304]:
                            - paragraph [ref=f2e305]: USD 2,104
                            - paragraph
                        - row [ref=f2e306]:
                          - cell [ref=f2e307]:
                            - paragraph [ref=f2e308]: 09/07/2027 - 19/09/2027
                          - cell [ref=f2e309]:
                            - paragraph [ref=f2e310]: USD 5,168
                            - paragraph
                          - cell [ref=f2e311]:
                            - paragraph [ref=f2e312]: USD 2,712
                            - paragraph
                          - cell [ref=f2e313]:
                            - paragraph [ref=f2e314]: USD 2,186
                            - paragraph
                        - row [ref=f2e315]:
                          - cell [ref=f2e316]:
                            - paragraph [ref=f2e317]: 20/09/2027 - 30/09/2027
                          - cell [ref=f2e318]:
                            - paragraph [ref=f2e319]: USD 4,708
                            - paragraph
                          - cell [ref=f2e320]:
                            - paragraph [ref=f2e321]: USD 2,498
                            - paragraph
                          - cell [ref=f2e322]:
                            - paragraph [ref=f2e323]: USD 2,042
                            - paragraph
                        - row [ref=f2e324]:
                          - cell [ref=f2e325]:
                            - paragraph [ref=f2e326]: 01/10/2027 - 31/10/2027
                          - cell [ref=f2e327]:
                            - paragraph [ref=f2e328]: USD 5,170
                            - paragraph
                          - cell [ref=f2e329]:
                            - paragraph [ref=f2e330]: USD 2,728
                            - paragraph
                          - cell [ref=f2e331]:
                            - paragraph [ref=f2e332]: USD 2,196
                            - paragraph
                        - row [ref=f2e333]:
                          - cell [ref=f2e334]:
                            - paragraph [ref=f2e335]: 01/11/2027 - 23/12/2027
                          - cell [ref=f2e336]:
                            - paragraph [ref=f2e337]: USD 5,398
                            - paragraph
                          - cell [ref=f2e338]:
                            - paragraph [ref=f2e339]: USD 2,820
                            - paragraph
                          - cell [ref=f2e340]:
                            - paragraph [ref=f2e341]: USD 2,258
                            - paragraph
                        - row [ref=f2e342]:
                          - cell [ref=f2e343]:
                            - paragraph [ref=f2e344]: 24/12/2027 - 27/12/2027
                          - cell [ref=f2e345]:
                            - paragraph [ref=f2e346]: USD 5,630
                            - paragraph
                          - cell [ref=f2e347]:
                            - paragraph [ref=f2e348]: USD 2,942
                            - paragraph
                          - cell [ref=f2e349]:
                            - paragraph [ref=f2e350]: USD 2,340
                            - paragraph
                        - row [ref=f2e351]:
                          - cell [ref=f2e352]:
                            - paragraph [ref=f2e353]: 03/01/2028 - 03/01/2028
                          - cell [ref=f2e354]:
                            - paragraph [ref=f2e355]: USD 5,630
                            - paragraph
                          - cell [ref=f2e356]:
                            - paragraph [ref=f2e357]: USD 2,942
                            - paragraph
                          - cell [ref=f2e358]:
                            - paragraph [ref=f2e359]: USD 2,340
                            - paragraph
                        - row [ref=f2e360]:
                          - cell [ref=f2e361]:
                            - paragraph [ref=f2e362]: 04/01/2028 - 28/02/2028
                          - cell [ref=f2e363]:
                            - paragraph [ref=f2e364]: USD 5,398
                            - paragraph
                          - cell [ref=f2e365]:
                            - paragraph [ref=f2e366]: USD 2,820
                            - paragraph
                          - cell [ref=f2e367]:
                            - paragraph [ref=f2e368]: USD 2,258
                            - paragraph
                        - row [ref=f2e369]:
                          - cell [ref=f2e370]:
                            - paragraph [ref=f2e371]: 01/03/2028 - 07/03/2028
                          - cell [ref=f2e372]:
                            - paragraph [ref=f2e373]: USD 5,170
                            - paragraph
                          - cell [ref=f2e374]:
                            - paragraph [ref=f2e375]: USD 2,728
                            - paragraph
                          - cell [ref=f2e376]:
                            - paragraph [ref=f2e377]: USD 2,196
                            - paragraph
            - text: 
    - complementary
    - generic [ref=f2e381]:
      - generic [ref=f2e382]: AMV. TRAVEL
      - generic [ref=f2e383]:
        - generic [ref=f2e384]:
          - generic [ref=f2e385]: 
          - text: Avenida Córdoba 673 1°B
        - link " 54 11 50313060" [ref=f2e386] [cursor=pointer]:
          - /url: tel:54 11 50313060
          - generic [ref=f2e387]: 
          - text: 54 11 50313060
        - link "hello@amv.travel" [ref=f2e388] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
    - text:       
  - dialog [ref=f2e392]:
    - generic [ref=f2e393]:
      - heading [level=2] [ref=f2e394]: Tu carrito
      - button [ref=f2e395] [cursor=pointer]:
        - generic [ref=f2e396]: 
    - generic [ref=f2e398]:
      - generic [ref=f2e399]: 
      - generic [ref=f2e400]: Tu carrito está vacío
      - generic [ref=f2e401]: Buscá hoteles, excursiones o traslados y los vas a ver acá.
    - text: 
  - text:                  
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
      |               ^ Error: La fila 19 de la solapa "sin-solapas" tiene que coincidir con la linea base.
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