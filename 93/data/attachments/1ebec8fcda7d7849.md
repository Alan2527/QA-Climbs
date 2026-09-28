# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-b/reservas-series.spec.ts >> Reservas >> Serie: la reserva emitida conserva los datos en el BackOffice
- Location: tests/bloque-b/reservas-series.spec.ts:76:7

# Error details

```
Error: El historial tiene que mostrar el codigo de la reserva emitida

expect(received).toMatch(expected)

Expected pattern: /^BO\d{8}$/
Received string:  "BO00025387
28/09/2026 13:42
PasajeroUno RegresionBGECBH
AMV. TRAVEL
pablo1 · Buenos Aires, Argentina
Pendiente de Pago
03/10/2026
USD 5,500"
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - generic [ref=f5e4]:
      - generic [ref=f5e5]:
        - link " hello@amv.travel" [ref=f5e6] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
          - generic [ref=f5e7]: 
          - text: hello@amv.travel
        - link "Emergencia 24hs  +54 9 11 3256 2827" [ref=f5e8] [cursor=pointer]:
          - /url: https://api.whatsapp.com/send/?phone=5491132562827&text=Hola%20AMV%20Travel&type=phone_number&app_absent=0
          - generic [ref=f5e9]: 
          - text: Emergencia 24hs
          - generic [ref=f5e10]: 
          - strong [ref=f5e11]: +54 9 11 3256 2827
        - generic:
          - generic: 
          - text: Entorno de test
      - generic [ref=f5e13]:
        - combobox [ref=f5e14]:
          - option "Buscar agencia..." [selected]
        - generic [ref=f5e16]:
          - combobox "Buscar agencia..." [ref=f5e17]
          - generic "Volver a mi agencia" [ref=f5e18] [cursor=pointer]: ⨯
        - combobox [ref=f5e19]:
          - option "Usuario" [selected]
        - combobox [ref=f5e21] [cursor=pointer]:
          - text: 
          - generic [ref=f5e22]: Usuario
        - text:  
    - complementary:
      - generic [ref=f5e24]:
        - link [ref=f5e26] [cursor=pointer]:
          - /url: /online/Default.aspx
        - list [ref=f5e28]:
          - listitem [ref=f5e29]:
            - link "Inicio" [ref=f5e30] [cursor=pointer]:
              - /url: /online/Default.aspx
          - listitem [ref=f5e31]:
            - link "Multidestino" [ref=f5e32] [cursor=pointer]:
              - /url: /online/tourall.aspx?country=10&city=5000&tour=0&resident=false
          - listitem [ref=f5e33]:
            - link "Tarifario" [ref=f5e34] [cursor=pointer]:
              - /url: /online/defaulttariff.aspx?country=10&city=5000&from=28-09-2026&to=28-03-2028&resident=false&tab=tour&tourId=0
          - listitem [ref=f5e35]:
            - link "Series" [ref=f5e36] [cursor=pointer]:
              - /url: /online/serieAll.aspx
          - listitem [ref=f5e37]:
            - link "Reservas" [ref=f5e38] [cursor=pointer]:
              - /url: /online/bookinghistory.aspx
          - listitem [ref=f5e39]:
            - link "Cotizaciones" [ref=f5e40] [cursor=pointer]:
              - /url: /online/quotehistory.aspx
          - text: 
        - button "Novedades" [ref=f5e42] [cursor=pointer]
        - text:  
        - generic [ref=f5e46]:
          - list [ref=f5e47]:
            - listitem [ref=f5e48]:
              - link "1" [ref=f5e49] [cursor=pointer]:
                - /url: https://qa.amv.travel/online/ShoppingCartPage.aspx
          - list [ref=f5e56]:
            - listitem [ref=f5e57]:
              - link "M 0.50 " [ref=f5e58] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f5e59]:
                  - generic [ref=f5e60]: M 0.50
                  - generic [ref=f5e61]: 
          - list [ref=f5e62]:
            - listitem [ref=f5e63]:
              - link "Pablo " [ref=f5e64] [cursor=pointer]:
                - /url: "#"
                - text: Pablo
                - generic [ref=f5e65]: 
          - list [ref=f5e66]:
            - listitem [ref=f5e67]:
              - link "ES " [ref=f5e68] [cursor=pointer]:
                - /url: "#"
                - generic [ref=f5e69]: ES
                - generic [ref=f5e70]: 
    - complementary
    - generic [ref=f5e71]:
      - heading "Reservas realizadas" [level=1] [ref=f5e73]
      - list [ref=f5e74]:
        - listitem [ref=f5e75]:
          - link "Carrito de compras" [ref=f5e76] [cursor=pointer]:
            - /url: BookingHistory.aspx?tab=booking
        - listitem [ref=f5e77]:
          - link "Multidestino" [ref=f5e78]:
            - /url: BookingHistory.aspx?tab=customTour
      - generic [ref=f5e79]:
        - text: 
        - generic [ref=f5e80]:
          - generic [ref=f5e81]:
            - generic [ref=f5e82]:
              - generic [ref=f5e83]: Período
              - link "30 días" [ref=f5e84] [cursor=pointer]:
                - /url: BookingHistory.aspx?from=29-08-2026&to=28-09-2026&tab=customTour
              - link "90 días" [ref=f5e85] [cursor=pointer]:
                - /url: BookingHistory.aspx?from=30-06-2026&to=28-09-2026&tab=customTour
              - link "6 meses" [ref=f5e86] [cursor=pointer]:
                - /url: BookingHistory.aspx?from=01-04-2026&to=28-09-2026&tab=customTour
              - link "1 año" [ref=f5e87] [cursor=pointer]:
                - /url: BookingHistory.aspx?from=28-09-2025&to=28-09-2026&tab=customTour
            - generic [ref=f5e88]:
              - generic [ref=f5e89]: Usuario
              - combobox "Usuario" [disabled] [ref=f5e90]:
                - option "Pablo Ortiz" [selected]
            - generic [ref=f5e92] [cursor=pointer]:
              - checkbox "Mostrar costos" [ref=f5e93]
              - generic [ref=f5e94]: Mostrar costos
            - generic [ref=f5e95]:
              - generic [ref=f5e96]: Buscar
              - textbox "Referencia, pasajero o código" [ref=f5e97]
              - link [ref=f5e98] [cursor=pointer]:
                - /url: javascript:__doPostBack('ctl00$cphMain$btnSearch2','')
                - generic [ref=f5e99]: 
          - generic [ref=f5e100]:
            - link "Todas" [ref=f5e101] [cursor=pointer]:
              - /url: BookingHistory.aspx?tab=customTour
            - link "Pendiente de Pago" [ref=f5e103] [cursor=pointer]:
              - /url: BookingHistory.aspx?status=pending&tab=customTour
            - link "Procesando Pago" [ref=f5e105] [cursor=pointer]:
              - /url: BookingHistory.aspx?status=processing&tab=customTour
            - link "Paga" [ref=f5e107] [cursor=pointer]:
              - /url: BookingHistory.aspx?status=paid&tab=customTour
            - link "Reserva vencida" [ref=f5e109] [cursor=pointer]:
              - /url: BookingHistory.aspx?status=expired&tab=customTour
            - link "Reserva cancelada" [ref=f5e111] [cursor=pointer]:
              - /url: BookingHistory.aspx?status=canceled&tab=customTour
          - generic [ref=f5e113]:
            - generic [ref=f5e114]:
              - generic [ref=f5e115]: Código
              - generic [ref=f5e116]: Referencia · Pax
              - generic [ref=f5e117]: Agencia
              - generic [ref=f5e118]: Estado
              - generic [ref=f5e119]: Monto Total
            - link "BO00025387 28/09/2026 13:42 PasajeroUno RegresionBGECBH AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e120] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25387
              - generic [ref=f5e121]:
                - generic [ref=f5e122]: BO00025387
                - generic [ref=f5e123]: 28/09/2026 13:42
              - generic [ref=f5e124]: PasajeroUno RegresionBGECBH
              - generic "pablo@amv.travel" [ref=f5e126]:
                - generic [ref=f5e127]: AMV. TRAVEL
                - generic [ref=f5e128]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e129]:
                - generic [ref=f5e130]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e131]:
                  - generic [ref=f5e132]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e134]': USD 5,500
              - generic [ref=f5e135]: 
            - link "BO00025386 28/09/2026 13:37 PasajeroUno RegresionBGDHEI AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 2,500" [ref=f5e136] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25386
              - generic [ref=f5e137]:
                - generic [ref=f5e138]: BO00025386
                - generic [ref=f5e139]: 28/09/2026 13:37
              - generic [ref=f5e140]: PasajeroUno RegresionBGDHEI
              - generic "pablo@amv.travel" [ref=f5e142]:
                - generic [ref=f5e143]: AMV. TRAVEL
                - generic [ref=f5e144]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e145]:
                - generic [ref=f5e146]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e147]:
                  - generic [ref=f5e148]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e150]': USD 2,500
              - generic [ref=f5e151]: 
            - link "BO00025383 25/09/2026 17:03 Test Test Uno AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 30/09/2026 USD 13,989" [ref=f5e152] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25383
              - generic [ref=f5e153]:
                - generic [ref=f5e154]: BO00025383
                - generic [ref=f5e155]: 25/09/2026 17:03
              - generic [ref=f5e156]:
                - generic [ref=f5e157]: Test
                - generic [ref=f5e158]: Test Uno
              - generic "pablo@amv.travel" [ref=f5e159]:
                - generic [ref=f5e160]: AMV. TRAVEL
                - generic [ref=f5e161]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e162]:
                - generic [ref=f5e163]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e164]:
                  - generic [ref=f5e165]: 
                  - text: 30/09/2026
              - 'generic "Total sin descuento: USD 13,989" [ref=f5e167]': USD 13,989
              - generic [ref=f5e168]: 
            - link "BO00025381 25/09/2026 16:57 Test Test Test AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 30/09/2026 USD 15,157" [ref=f5e169] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25381
              - generic [ref=f5e170]:
                - generic [ref=f5e171]: BO00025381
                - generic [ref=f5e172]: 25/09/2026 16:57
              - generic [ref=f5e173]:
                - generic [ref=f5e174]: Test
                - generic [ref=f5e175]: Test Test
              - generic "pablo@amv.travel" [ref=f5e176]:
                - generic [ref=f5e177]: AMV. TRAVEL
                - generic [ref=f5e178]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e179]:
                - generic [ref=f5e180]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e181]:
                  - generic [ref=f5e182]: 
                  - text: 30/09/2026
              - 'generic "Total sin descuento: USD 15,157" [ref=f5e184]': USD 15,157
              - generic [ref=f5e185]: 
            - link "BO00025351 25/09/2026 14:34 PasajeroUno RegresionBHDECA AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e186] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25351
              - generic [ref=f5e187]:
                - generic [ref=f5e188]: BO00025351
                - generic [ref=f5e189]: 25/09/2026 14:34
              - generic [ref=f5e190]: PasajeroUno RegresionBHDECA
              - generic "pablo@amv.travel" [ref=f5e192]:
                - generic [ref=f5e193]: AMV. TRAVEL
                - generic [ref=f5e194]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e195]:
                - generic [ref=f5e196]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e197]:
                  - generic [ref=f5e198]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e200]': USD 5,500
              - generic [ref=f5e201]: 
            - link "BO00025347 25/09/2026 14:29 PasajeroUno RegresionBHCJEG AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e202] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25347
              - generic [ref=f5e203]:
                - generic [ref=f5e204]: BO00025347
                - generic [ref=f5e205]: 25/09/2026 14:29
              - generic [ref=f5e206]: PasajeroUno RegresionBHCJEG
              - generic "pablo@amv.travel" [ref=f5e208]:
                - generic [ref=f5e209]: AMV. TRAVEL
                - generic [ref=f5e210]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e211]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e214]': USD 2,500
              - generic [ref=f5e215]: 
            - link "BO00025316 25/09/2026 09:51 PasajeroUno RegresionBCFBDH AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e216] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25316
              - generic [ref=f5e217]:
                - generic [ref=f5e218]: BO00025316
                - generic [ref=f5e219]: 25/09/2026 09:51
              - generic [ref=f5e220]: PasajeroUno RegresionBCFBDH
              - generic "pablo@amv.travel" [ref=f5e222]:
                - generic [ref=f5e223]: AMV. TRAVEL
                - generic [ref=f5e224]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e225]:
                - generic [ref=f5e226]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e227]:
                  - generic [ref=f5e228]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e230]': USD 5,500
              - generic [ref=f5e231]: 
            - link "BO00025313 25/09/2026 09:46 PasajeroUno RegresionBCEGDC AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e232] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25313
              - generic [ref=f5e233]:
                - generic [ref=f5e234]: BO00025313
                - generic [ref=f5e235]: 25/09/2026 09:46
              - generic [ref=f5e236]: PasajeroUno RegresionBCEGDC
              - generic "pablo@amv.travel" [ref=f5e238]:
                - generic [ref=f5e239]: AMV. TRAVEL
                - generic [ref=f5e240]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e241]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e244]': USD 2,500
              - generic [ref=f5e245]: 
            - link "BO00025284 22/09/2026 15:41 PasajeroUno RegresionBIEBDE AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e246] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25284
              - generic [ref=f5e247]:
                - generic [ref=f5e248]: BO00025284
                - generic [ref=f5e249]: 22/09/2026 15:41
              - generic [ref=f5e250]: PasajeroUno RegresionBIEBDE
              - generic "pablo@amv.travel" [ref=f5e252]:
                - generic [ref=f5e253]: AMV. TRAVEL
                - generic [ref=f5e254]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e255]:
                - generic [ref=f5e256]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e257]:
                  - generic [ref=f5e258]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e260]': USD 5,500
              - generic [ref=f5e261]: 
            - link "BO00025281 22/09/2026 15:40 AUTO-QA 20260922184007 PasajeroUno RegresionBIEAAH AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,062" [ref=f5e262] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25281
              - generic [ref=f5e263]:
                - generic [ref=f5e264]: BO00025281
                - generic [ref=f5e265]: 22/09/2026 15:40
              - generic [ref=f5e266]:
                - generic [ref=f5e267]: AUTO-QA 20260922184007
                - generic [ref=f5e268]: PasajeroUno RegresionBIEAAH
              - generic "pablo@amv.travel" [ref=f5e269]:
                - generic [ref=f5e270]: AMV. TRAVEL
                - generic [ref=f5e271]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e272]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,062" [ref=f5e275]': USD 2,062
              - generic [ref=f5e276]: 
            - link "BO00025280 22/09/2026 15:39 AUTO-QA 20260922183927 PasajeroUno RegresionBIDJCH AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,438" [ref=f5e277] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25280
              - generic [ref=f5e278]:
                - generic [ref=f5e279]: BO00025280
                - generic [ref=f5e280]: 22/09/2026 15:39
              - generic [ref=f5e281]:
                - generic [ref=f5e282]: AUTO-QA 20260922183927
                - generic [ref=f5e283]: PasajeroUno RegresionBIDJCH
              - generic "pablo@amv.travel" [ref=f5e284]:
                - generic [ref=f5e285]: AMV. TRAVEL
                - generic [ref=f5e286]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e287]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,438" [ref=f5e290]': USD 2,438
              - generic [ref=f5e291]: 
            - link "BO00025279 22/09/2026 15:38 PasajeroUno RegresionBIDIBC AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e292] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25279
              - generic [ref=f5e293]:
                - generic [ref=f5e294]: BO00025279
                - generic [ref=f5e295]: 22/09/2026 15:38
              - generic [ref=f5e296]: PasajeroUno RegresionBIDIBC
              - generic "pablo@amv.travel" [ref=f5e298]:
                - generic [ref=f5e299]: AMV. TRAVEL
                - generic [ref=f5e300]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e301]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e304]': USD 2,500
              - generic [ref=f5e305]: 
            - link "BO00025278 22/09/2026 15:37 AUTO-QA 20260922183737 PasajeroUno RegresionBIDHDH AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,062" [ref=f5e306] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25278
              - generic [ref=f5e307]:
                - generic [ref=f5e308]: BO00025278
                - generic [ref=f5e309]: 22/09/2026 15:37
              - generic [ref=f5e310]:
                - generic [ref=f5e311]: AUTO-QA 20260922183737
                - generic [ref=f5e312]: PasajeroUno RegresionBIDHDH
              - generic "pablo@amv.travel" [ref=f5e313]:
                - generic [ref=f5e314]: AMV. TRAVEL
                - generic [ref=f5e315]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e316]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,062" [ref=f5e319]': USD 2,062
              - generic [ref=f5e320]: 
            - link "BO00025267 22/09/2026 12:17 PasajeroUno RegresionBFBHAB AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e321] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25267
              - generic [ref=f5e322]:
                - generic [ref=f5e323]: BO00025267
                - generic [ref=f5e324]: 22/09/2026 12:17
              - generic [ref=f5e325]: PasajeroUno RegresionBFBHAB
              - generic "pablo@amv.travel" [ref=f5e327]:
                - generic [ref=f5e328]: AMV. TRAVEL
                - generic [ref=f5e329]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e330]:
                - generic [ref=f5e331]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e332]:
                  - generic [ref=f5e333]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e335]': USD 5,500
              - generic [ref=f5e336]: 
            - link "BO00025264 22/09/2026 12:15 AUTO-QA 20260922151523 PasajeroUno RegresionBFBFCD AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,062" [ref=f5e337] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25264
              - generic [ref=f5e338]:
                - generic [ref=f5e339]: BO00025264
                - generic [ref=f5e340]: 22/09/2026 12:15
              - generic [ref=f5e341]:
                - generic [ref=f5e342]: AUTO-QA 20260922151523
                - generic [ref=f5e343]: PasajeroUno RegresionBFBFCD
              - generic "pablo@amv.travel" [ref=f5e344]:
                - generic [ref=f5e345]: AMV. TRAVEL
                - generic [ref=f5e346]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e347]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,062" [ref=f5e350]': USD 2,062
              - generic [ref=f5e351]: 
            - link "BO00025263 22/09/2026 12:14 AUTO-QA 20260922151442 PasajeroUno RegresionBFBEEC AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,438" [ref=f5e352] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25263
              - generic [ref=f5e353]:
                - generic [ref=f5e354]: BO00025263
                - generic [ref=f5e355]: 22/09/2026 12:14
              - generic [ref=f5e356]:
                - generic [ref=f5e357]: AUTO-QA 20260922151442
                - generic [ref=f5e358]: PasajeroUno RegresionBFBEEC
              - generic "pablo@amv.travel" [ref=f5e359]:
                - generic [ref=f5e360]: AMV. TRAVEL
                - generic [ref=f5e361]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e362]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,438" [ref=f5e365]': USD 2,438
              - generic [ref=f5e366]: 
            - link "BO00025262 22/09/2026 12:13 PasajeroUno RegresionBFBDAH AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e367] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25262
              - generic [ref=f5e368]:
                - generic [ref=f5e369]: BO00025262
                - generic [ref=f5e370]: 22/09/2026 12:13
              - generic [ref=f5e371]: PasajeroUno RegresionBFBDAH
              - generic "pablo@amv.travel" [ref=f5e373]:
                - generic [ref=f5e374]: AMV. TRAVEL
                - generic [ref=f5e375]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e376]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e379]': USD 2,500
              - generic [ref=f5e380]: 
            - link "BO00025261 22/09/2026 12:12 AUTO-QA 20260922151237 PasajeroUno RegresionBFBCDH AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,062" [ref=f5e381] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25261
              - generic [ref=f5e382]:
                - generic [ref=f5e383]: BO00025261
                - generic [ref=f5e384]: 22/09/2026 12:12
              - generic [ref=f5e385]:
                - generic [ref=f5e386]: AUTO-QA 20260922151237
                - generic [ref=f5e387]: PasajeroUno RegresionBFBCDH
              - generic "pablo@amv.travel" [ref=f5e388]:
                - generic [ref=f5e389]: AMV. TRAVEL
                - generic [ref=f5e390]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e391]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,062" [ref=f5e394]': USD 2,062
              - generic [ref=f5e395]: 
            - link "BO00025242 22/09/2026 09:44 PasajeroUno RegresionBCEDFD AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e396] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25242
              - generic [ref=f5e397]:
                - generic [ref=f5e398]: BO00025242
                - generic [ref=f5e399]: 22/09/2026 09:44
              - generic [ref=f5e400]: PasajeroUno RegresionBCEDFD
              - generic "pablo@amv.travel" [ref=f5e402]:
                - generic [ref=f5e403]: AMV. TRAVEL
                - generic [ref=f5e404]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e405]:
                - generic [ref=f5e406]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e407]:
                  - generic [ref=f5e408]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e410]': USD 5,500
              - generic [ref=f5e411]: 
            - link "BO00025239 22/09/2026 09:42 AUTO-QA 20260922124211 PasajeroUno RegresionBCECBB AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,062" [ref=f5e412] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25239
              - generic [ref=f5e413]:
                - generic [ref=f5e414]: BO00025239
                - generic [ref=f5e415]: 22/09/2026 09:42
              - generic [ref=f5e416]:
                - generic [ref=f5e417]: AUTO-QA 20260922124211
                - generic [ref=f5e418]: PasajeroUno RegresionBCECBB
              - generic "pablo@amv.travel" [ref=f5e419]:
                - generic [ref=f5e420]: AMV. TRAVEL
                - generic [ref=f5e421]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e422]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,062" [ref=f5e425]': USD 2,062
              - generic [ref=f5e426]: 
            - link "BO00025238 22/09/2026 09:41 AUTO-QA 20260922124122 PasajeroUno RegresionBCEBCC AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,438" [ref=f5e427] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25238
              - generic [ref=f5e428]:
                - generic [ref=f5e429]: BO00025238
                - generic [ref=f5e430]: 22/09/2026 09:41
              - generic [ref=f5e431]:
                - generic [ref=f5e432]: AUTO-QA 20260922124122
                - generic [ref=f5e433]: PasajeroUno RegresionBCEBCC
              - generic "pablo@amv.travel" [ref=f5e434]:
                - generic [ref=f5e435]: AMV. TRAVEL
                - generic [ref=f5e436]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e437]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,438" [ref=f5e440]': USD 2,438
              - generic [ref=f5e441]: 
            - link "BO00025237 22/09/2026 09:39 PasajeroUno RegresionBCDJEI AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e442] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25237
              - generic [ref=f5e443]:
                - generic [ref=f5e444]: BO00025237
                - generic [ref=f5e445]: 22/09/2026 09:39
              - generic [ref=f5e446]: PasajeroUno RegresionBCDJEI
              - generic "pablo@amv.travel" [ref=f5e448]:
                - generic [ref=f5e449]: AMV. TRAVEL
                - generic [ref=f5e450]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e451]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e454]': USD 2,500
              - generic [ref=f5e455]: 
            - link "BO00025236 22/09/2026 09:39 AUTO-QA 20260922123906 PasajeroUno RegresionBCDJAG AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,062" [ref=f5e456] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25236
              - generic [ref=f5e457]:
                - generic [ref=f5e458]: BO00025236
                - generic [ref=f5e459]: 22/09/2026 09:39
              - generic [ref=f5e460]:
                - generic [ref=f5e461]: AUTO-QA 20260922123906
                - generic [ref=f5e462]: PasajeroUno RegresionBCDJAG
              - generic "pablo@amv.travel" [ref=f5e463]:
                - generic [ref=f5e464]: AMV. TRAVEL
                - generic [ref=f5e465]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e466]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,062" [ref=f5e469]': USD 2,062
              - generic [ref=f5e470]: 
            - link "BO00025225 21/09/2026 10:11 PasajeroUno RegresionBDBBAF AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e471] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25225
              - generic [ref=f5e472]:
                - generic [ref=f5e473]: BO00025225
                - generic [ref=f5e474]: 21/09/2026 10:11
              - generic [ref=f5e475]: PasajeroUno RegresionBDBBAF
              - generic "pablo@amv.travel" [ref=f5e477]:
                - generic [ref=f5e478]: AMV. TRAVEL
                - generic [ref=f5e479]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e480]:
                - generic [ref=f5e481]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e482]:
                  - generic [ref=f5e483]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e485]': USD 5,500
              - generic [ref=f5e486]: 
            - link "BO00025222 21/09/2026 10:09 AUTO-QA 20260921130924 PasajeroUno RegresionBDAJCE AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 1,992" [ref=f5e487] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25222
              - generic [ref=f5e488]:
                - generic [ref=f5e489]: BO00025222
                - generic [ref=f5e490]: 21/09/2026 10:09
              - generic [ref=f5e491]:
                - generic [ref=f5e492]: AUTO-QA 20260921130924
                - generic [ref=f5e493]: PasajeroUno RegresionBDAJCE
              - generic "pablo@amv.travel" [ref=f5e494]:
                - generic [ref=f5e495]: AMV. TRAVEL
                - generic [ref=f5e496]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e497]: Reserva vencida
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e500]': USD 1,992
              - generic [ref=f5e501]: 
            - link "BO00025221 21/09/2026 10:08 AUTO-QA 20260921130846 PasajeroUno RegresionBDAIEG AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,368" [ref=f5e502] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25221
              - generic [ref=f5e503]:
                - generic [ref=f5e504]: BO00025221
                - generic [ref=f5e505]: 21/09/2026 10:08
              - generic [ref=f5e506]:
                - generic [ref=f5e507]: AUTO-QA 20260921130846
                - generic [ref=f5e508]: PasajeroUno RegresionBDAIEG
              - generic "pablo@amv.travel" [ref=f5e509]:
                - generic [ref=f5e510]: AMV. TRAVEL
                - generic [ref=f5e511]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e512]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,368" [ref=f5e515]': USD 2,368
              - generic [ref=f5e516]: 
            - link "BO00025220 21/09/2026 10:07 PasajeroUno RegresionBDAHAJ AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e517] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25220
              - generic [ref=f5e518]:
                - generic [ref=f5e519]: BO00025220
                - generic [ref=f5e520]: 21/09/2026 10:07
              - generic [ref=f5e521]: PasajeroUno RegresionBDAHAJ
              - generic "pablo@amv.travel" [ref=f5e523]:
                - generic [ref=f5e524]: AMV. TRAVEL
                - generic [ref=f5e525]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e526]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e529]': USD 2,500
              - generic [ref=f5e530]: 
            - link "BO00025219 21/09/2026 10:06 AUTO-QA 20260921130639 PasajeroUno RegresionBDAGDJ AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 1,992" [ref=f5e531] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25219
              - generic [ref=f5e532]:
                - generic [ref=f5e533]: BO00025219
                - generic [ref=f5e534]: 21/09/2026 10:06
              - generic [ref=f5e535]:
                - generic [ref=f5e536]: AUTO-QA 20260921130639
                - generic [ref=f5e537]: PasajeroUno RegresionBDAGDJ
              - generic "pablo@amv.travel" [ref=f5e538]:
                - generic [ref=f5e539]: AMV. TRAVEL
                - generic [ref=f5e540]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e541]: Reserva cancelada
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e544]': USD 1,992
              - generic [ref=f5e545]: 
            - link "BO00025211 20/09/2026 18:02 PasajeroUno RegresionCBACAE AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e546] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25211
              - generic [ref=f5e547]:
                - generic [ref=f5e548]: BO00025211
                - generic [ref=f5e549]: 20/09/2026 18:02
              - generic [ref=f5e550]: PasajeroUno RegresionCBACAE
              - generic "pablo@amv.travel" [ref=f5e552]:
                - generic [ref=f5e553]: AMV. TRAVEL
                - generic [ref=f5e554]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e555]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e558]': USD 2,500
              - generic [ref=f5e559]: 
            - link "BO00025210 20/09/2026 18:01 AUTO-QA 20260920210126 PasajeroUno RegresionCBABCG AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 1,992" [ref=f5e560] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25210
              - generic [ref=f5e561]:
                - generic [ref=f5e562]: BO00025210
                - generic [ref=f5e563]: 20/09/2026 18:01
              - generic [ref=f5e564]:
                - generic [ref=f5e565]: AUTO-QA 20260920210126
                - generic [ref=f5e566]: PasajeroUno RegresionCBABCG
              - generic "pablo@amv.travel" [ref=f5e567]:
                - generic [ref=f5e568]: AMV. TRAVEL
                - generic [ref=f5e569]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e570]: Reserva cancelada
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e573]': USD 1,992
              - generic [ref=f5e574]: 
            - link "BO00025199 20/09/2026 17:41 PasajeroUno RegresionCAEBDE AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e575] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25199
              - generic [ref=f5e576]:
                - generic [ref=f5e577]: BO00025199
                - generic [ref=f5e578]: 20/09/2026 17:41
              - generic [ref=f5e579]: PasajeroUno RegresionCAEBDE
              - generic "pablo@amv.travel" [ref=f5e581]:
                - generic [ref=f5e582]: AMV. TRAVEL
                - generic [ref=f5e583]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e584]:
                - generic [ref=f5e585]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e586]:
                  - generic [ref=f5e587]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e589]': USD 5,500
              - generic [ref=f5e590]: 
            - link "BO00025196 20/09/2026 17:39 AUTO-QA 20260920203858 PasajeroUno RegresionCADIFI AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 1,992" [ref=f5e591] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25196
              - generic [ref=f5e592]:
                - generic [ref=f5e593]: BO00025196
                - generic [ref=f5e594]: 20/09/2026 17:39
              - generic [ref=f5e595]:
                - generic [ref=f5e596]: AUTO-QA 20260920203858
                - generic [ref=f5e597]: PasajeroUno RegresionCADIFI
              - generic "pablo@amv.travel" [ref=f5e598]:
                - generic [ref=f5e599]: AMV. TRAVEL
                - generic [ref=f5e600]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e601]: Reserva vencida
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e604]': USD 1,992
              - generic [ref=f5e605]: 
            - link "BO00025195 20/09/2026 17:38 AUTO-QA 20260920203810 PasajeroUno RegresionCADIBA AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,368" [ref=f5e606] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25195
              - generic [ref=f5e607]:
                - generic [ref=f5e608]: BO00025195
                - generic [ref=f5e609]: 20/09/2026 17:38
              - generic [ref=f5e610]:
                - generic [ref=f5e611]: AUTO-QA 20260920203810
                - generic [ref=f5e612]: PasajeroUno RegresionCADIBA
              - generic "pablo@amv.travel" [ref=f5e613]:
                - generic [ref=f5e614]: AMV. TRAVEL
                - generic [ref=f5e615]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e616]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,368" [ref=f5e619]': USD 2,368
              - generic [ref=f5e620]: 
            - link "BO00025194 20/09/2026 17:35 PasajeroUno RegresionCADFFA AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e621] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25194
              - generic [ref=f5e622]:
                - generic [ref=f5e623]: BO00025194
                - generic [ref=f5e624]: 20/09/2026 17:35
              - generic [ref=f5e625]: PasajeroUno RegresionCADFFA
              - generic "pablo@amv.travel" [ref=f5e627]:
                - generic [ref=f5e628]: AMV. TRAVEL
                - generic [ref=f5e629]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e630]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e633]': USD 2,500
              - generic [ref=f5e634]: 
            - link "BO00025193 20/09/2026 17:35 AUTO-QA 20260920203512 PasajeroUno RegresionCADFBC AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 1,992" [ref=f5e635] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25193
              - generic [ref=f5e636]:
                - generic [ref=f5e637]: BO00025193
                - generic [ref=f5e638]: 20/09/2026 17:35
              - generic [ref=f5e639]:
                - generic [ref=f5e640]: AUTO-QA 20260920203512
                - generic [ref=f5e641]: PasajeroUno RegresionCADFBC
              - generic "pablo@amv.travel" [ref=f5e642]:
                - generic [ref=f5e643]: AMV. TRAVEL
                - generic [ref=f5e644]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e645]: Reserva cancelada
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e648]': USD 1,992
              - generic [ref=f5e649]: 
            - link "BO00025182 20/09/2026 17:19 PasajeroUno RegresionCABJBB AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e650] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25182
              - generic [ref=f5e651]:
                - generic [ref=f5e652]: BO00025182
                - generic [ref=f5e653]: 20/09/2026 17:19
              - generic [ref=f5e654]: PasajeroUno RegresionCABJBB
              - generic "pablo@amv.travel" [ref=f5e656]:
                - generic [ref=f5e657]: AMV. TRAVEL
                - generic [ref=f5e658]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e659]:
                - generic [ref=f5e660]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e661]:
                  - generic [ref=f5e662]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e664]': USD 5,500
              - generic [ref=f5e665]: 
            - link "BO00025179 20/09/2026 17:16 AUTO-QA 20260920201635 PasajeroUno RegresionCABGDF AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 1,992" [ref=f5e666] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25179
              - generic [ref=f5e667]:
                - generic [ref=f5e668]: BO00025179
                - generic [ref=f5e669]: 20/09/2026 17:16
              - generic [ref=f5e670]:
                - generic [ref=f5e671]: AUTO-QA 20260920201635
                - generic [ref=f5e672]: PasajeroUno RegresionCABGDF
              - generic "pablo@amv.travel" [ref=f5e673]:
                - generic [ref=f5e674]: AMV. TRAVEL
                - generic [ref=f5e675]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e676]: Reserva vencida
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e679]': USD 1,992
              - generic [ref=f5e680]: 
            - link "BO00025178 20/09/2026 17:15 AUTO-QA 20260920201542 PasajeroUno RegresionCABFEC AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,368" [ref=f5e681] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25178
              - generic [ref=f5e682]:
                - generic [ref=f5e683]: BO00025178
                - generic [ref=f5e684]: 20/09/2026 17:15
              - generic [ref=f5e685]:
                - generic [ref=f5e686]: AUTO-QA 20260920201542
                - generic [ref=f5e687]: PasajeroUno RegresionCABFEC
              - generic "pablo@amv.travel" [ref=f5e688]:
                - generic [ref=f5e689]: AMV. TRAVEL
                - generic [ref=f5e690]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e691]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,368" [ref=f5e694]': USD 2,368
              - generic [ref=f5e695]: 
            - link "BO00025177 20/09/2026 17:13 PasajeroUno RegresionCABDCE AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e696] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25177
              - generic [ref=f5e697]:
                - generic [ref=f5e698]: BO00025177
                - generic [ref=f5e699]: 20/09/2026 17:13
              - generic [ref=f5e700]: PasajeroUno RegresionCABDCE
              - generic "pablo@amv.travel" [ref=f5e702]:
                - generic [ref=f5e703]: AMV. TRAVEL
                - generic [ref=f5e704]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e705]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e708]': USD 2,500
              - generic [ref=f5e709]: 
            - link "BO00025176 20/09/2026 17:12 AUTO-QA 20260920201234 PasajeroUno RegresionCABCDE AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 1,992" [ref=f5e710] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25176
              - generic [ref=f5e711]:
                - generic [ref=f5e712]: BO00025176
                - generic [ref=f5e713]: 20/09/2026 17:12
              - generic [ref=f5e714]:
                - generic [ref=f5e715]: AUTO-QA 20260920201234
                - generic [ref=f5e716]: PasajeroUno RegresionCABCDE
              - generic "pablo@amv.travel" [ref=f5e717]:
                - generic [ref=f5e718]: AMV. TRAVEL
                - generic [ref=f5e719]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e720]: Reserva cancelada
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e723]': USD 1,992
              - generic [ref=f5e724]: 
            - link "BO00025169 18/09/2026 10:47 AUTO-QA 20260918134706 PasajeroUno RegresionBDEHAG AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,368" [ref=f5e725] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25169
              - generic [ref=f5e726]:
                - generic [ref=f5e727]: BO00025169
                - generic [ref=f5e728]: 18/09/2026 10:47
              - generic [ref=f5e729]:
                - generic [ref=f5e730]: AUTO-QA 20260918134706
                - generic [ref=f5e731]: PasajeroUno RegresionBDEHAG
              - generic "pablo@amv.travel" [ref=f5e732]:
                - generic [ref=f5e733]: AMV. TRAVEL
                - generic [ref=f5e734]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e735]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,368" [ref=f5e738]': USD 2,368
              - generic [ref=f5e739]: 
            - link "BO00025168 18/09/2026 10:45 AUTO-QA 20260918134453 PasajeroUno RegresionBDEEFD AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,368" [ref=f5e740] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25168
              - generic [ref=f5e741]:
                - generic [ref=f5e742]: BO00025168
                - generic [ref=f5e743]: 18/09/2026 10:45
              - generic [ref=f5e744]:
                - generic [ref=f5e745]: AUTO-QA 20260918134453
                - generic [ref=f5e746]: PasajeroUno RegresionBDEEFD
              - generic "pablo@amv.travel" [ref=f5e747]:
                - generic [ref=f5e748]: AMV. TRAVEL
                - generic [ref=f5e749]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e750]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,368" [ref=f5e753]': USD 2,368
              - generic [ref=f5e754]: 
            - link "BO00025167 18/09/2026 10:42 test test AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,368" [ref=f5e755] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25167
              - generic [ref=f5e756]:
                - generic [ref=f5e757]: BO00025167
                - generic [ref=f5e758]: 18/09/2026 10:42
              - generic [ref=f5e759]: test test
              - generic "pablo@amv.travel" [ref=f5e761]:
                - generic [ref=f5e762]: AMV. TRAVEL
                - generic [ref=f5e763]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e764]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,368" [ref=f5e767]': USD 2,368
              - generic [ref=f5e768]: 
            - link "BO00025166 18/09/2026 10:40 AUTO-QA 20260918134035 PasajeroUno RegresionBDEADF AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,368" [ref=f5e769] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25166
              - generic [ref=f5e770]:
                - generic [ref=f5e771]: BO00025166
                - generic [ref=f5e772]: 18/09/2026 10:40
              - generic [ref=f5e773]:
                - generic [ref=f5e774]: AUTO-QA 20260918134035
                - generic [ref=f5e775]: PasajeroUno RegresionBDEADF
              - generic "pablo@amv.travel" [ref=f5e776]:
                - generic [ref=f5e777]: AMV. TRAVEL
                - generic [ref=f5e778]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e779]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,368" [ref=f5e782]': USD 2,368
              - generic [ref=f5e783]: 
            - link "BO00025157 18/09/2026 09:47 PasajeroUno RegresionBCEHAE AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e784] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25157
              - generic [ref=f5e785]:
                - generic [ref=f5e786]: BO00025157
                - generic [ref=f5e787]: 18/09/2026 09:47
              - generic [ref=f5e788]: PasajeroUno RegresionBCEHAE
              - generic "pablo@amv.travel" [ref=f5e790]:
                - generic [ref=f5e791]: AMV. TRAVEL
                - generic [ref=f5e792]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e793]:
                - generic [ref=f5e794]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e795]:
                  - generic [ref=f5e796]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e798]': USD 5,500
              - generic [ref=f5e799]: 
            - link "BO00025155 18/09/2026 09:43 AUTO-QA 20260918124334 PasajeroUno RegresionBCEDDE AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 1,992" [ref=f5e800] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25155
              - generic [ref=f5e801]:
                - generic [ref=f5e802]: BO00025155
                - generic [ref=f5e803]: 18/09/2026 09:43
              - generic [ref=f5e804]:
                - generic [ref=f5e805]: AUTO-QA 20260918124334
                - generic [ref=f5e806]: PasajeroUno RegresionBCEDDE
              - generic "pablo@amv.travel" [ref=f5e807]:
                - generic [ref=f5e808]: AMV. TRAVEL
                - generic [ref=f5e809]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e810]: Reserva vencida
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e813]': USD 1,992
              - generic [ref=f5e814]: 
            - link "BO00025154 18/09/2026 09:42 AUTO-QA 20260918124213 PasajeroUno RegresionBCECBD AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva vencida USD 2,368" [ref=f5e815] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25154
              - generic [ref=f5e816]:
                - generic [ref=f5e817]: BO00025154
                - generic [ref=f5e818]: 18/09/2026 09:42
              - generic [ref=f5e819]:
                - generic [ref=f5e820]: AUTO-QA 20260918124213
                - generic [ref=f5e821]: PasajeroUno RegresionBCECBD
              - generic "pablo@amv.travel" [ref=f5e822]:
                - generic [ref=f5e823]: AMV. TRAVEL
                - generic [ref=f5e824]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e825]: Reserva vencida
              - 'generic "Total sin descuento: USD 2,368" [ref=f5e828]': USD 2,368
              - generic [ref=f5e829]: 
            - link "BO00025153 18/09/2026 09:40 PasajeroUno RegresionBCDJFJ AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 2,500" [ref=f5e830] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25153
              - generic [ref=f5e831]:
                - generic [ref=f5e832]: BO00025153
                - generic [ref=f5e833]: 18/09/2026 09:40
              - generic [ref=f5e834]: PasajeroUno RegresionBCDJFJ
              - generic "pablo@amv.travel" [ref=f5e836]:
                - generic [ref=f5e837]: AMV. TRAVEL
                - generic [ref=f5e838]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e839]: Reserva cancelada
              - 'generic "Total sin descuento: USD 2,500" [ref=f5e842]': USD 2,500
              - generic [ref=f5e843]: 
            - link "BO00025152 18/09/2026 09:39 AUTO-QA 20260918123909 PasajeroUno RegresionBCDJAJ AMV. TRAVEL pablo1 · Buenos Aires, Argentina Reserva cancelada USD 1,992" [ref=f5e844] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25152
              - generic [ref=f5e845]:
                - generic [ref=f5e846]: BO00025152
                - generic [ref=f5e847]: 18/09/2026 09:39
              - generic [ref=f5e848]:
                - generic [ref=f5e849]: AUTO-QA 20260918123909
                - generic [ref=f5e850]: PasajeroUno RegresionBCDJAJ
              - generic "pablo@amv.travel" [ref=f5e851]:
                - generic [ref=f5e852]: AMV. TRAVEL
                - generic [ref=f5e853]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e854]: Reserva cancelada
              - 'generic "Total sin descuento: USD 1,992" [ref=f5e857]': USD 1,992
              - generic [ref=f5e858]: 
            - link "BO00025142 17/09/2026 18:27 PasajeroUno RegresionCBCGFJ AMV. TRAVEL pablo1 · Buenos Aires, Argentina Pendiente de Pago 03/10/2026 USD 5,500" [ref=f5e859] [cursor=pointer]:
              - /url: BookingHistoryDetail.aspx?book=25142
              - generic [ref=f5e860]:
                - generic [ref=f5e861]: BO00025142
                - generic [ref=f5e862]: 17/09/2026 18:27
              - generic [ref=f5e863]: PasajeroUno RegresionCBCGFJ
              - generic "pablo@amv.travel" [ref=f5e865]:
                - generic [ref=f5e866]: AMV. TRAVEL
                - generic [ref=f5e867]: pablo1 · Buenos Aires, Argentina
              - generic [ref=f5e868]:
                - generic [ref=f5e869]: Pendiente de Pago
                - generic "Fecha de vencimiento" [ref=f5e870]:
                  - generic [ref=f5e871]: 
                  - text: 03/10/2026
              - 'generic "Total sin descuento: USD 5,500" [ref=f5e873]': USD 5,500
              - generic [ref=f5e874]: 
          - generic [ref=f5e875]:
            - generic [ref=f5e876]: 147 reservas
            - generic [ref=f5e877]:
              - generic: 
              - generic: 
              - generic [ref=f5e878]: 1 / 3
              - link "" [ref=f5e879] [cursor=pointer]:
                - /url: BookingHistory.aspx?pt=2&tab=customTour
              - link "" [ref=f5e881] [cursor=pointer]:
                - /url: BookingHistory.aspx?pt=3&tab=customTour
    - generic [ref=f5e886]:
      - generic [ref=f5e887]: AMV. TRAVEL
      - generic [ref=f5e888]:
        - generic [ref=f5e889]:
          - generic [ref=f5e890]: 
          - text: Avenida Córdoba 673 1°B
        - link " 54 11 50313060" [ref=f5e891] [cursor=pointer]:
          - /url: tel:54 11 50313060
          - generic [ref=f5e892]: 
          - text: 54 11 50313060
        - link "hello@amv.travel" [ref=f5e893] [cursor=pointer]:
          - /url: mailto:hello@amv.travel
    - text:      
  - dialog [ref=f5e897]:
    - generic [ref=f5e898]:
      - heading [level=2] [ref=f5e899]: Tu carrito
      - generic [ref=f5e900]: 1 ítem
      - button [ref=f5e901] [cursor=pointer]:
        - generic [ref=f5e902]: 
    - generic [ref=f5e904]:
      - generic [ref=f5e905]: 
      - generic [ref=f5e907]:
        - heading [level=6] [ref=f5e908]: AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau
        - generic [ref=f5e909]:
          - generic [ref=f5e910]:
            - generic [ref=f5e911]: 
            - text: Buenos Aires
          - generic [ref=f5e912]:
            - generic [ref=f5e913]: 
            - text: 05/10/2026 – 06/10/2026
        - generic [ref=f5e914]:
          - generic [ref=f5e915]: 1 x Doble
          - generic [ref=f5e916]: King Deluxe - Edificio Posadas ..
      - generic [ref=f5e917]:
        - generic [ref=f5e918]: USD 1,000.00
        - link [ref=f5e919] [cursor=pointer]:
          - /url: javascript:void(0);
          - generic [ref=f5e920]: 
    - generic [ref=f5e921]:
      - generic [ref=f5e922]:
        - generic [ref=f5e923]: Total
        - generic [ref=f5e924]: USD 1,000.00
      - generic [ref=f5e925]:
        - link [ref=f5e926] [cursor=pointer]:
          - /url: javascript:void(0);
          - generic [ref=f5e927]: 
          - text: Vaciar
        - link [ref=f5e928] [cursor=pointer]:
          - /url: https://qa.amv.travel/online/ShoppingCartPage.aspx
          - text: Ir al carrito
```

# Test source

```ts
  320 |         await serie.ocupantesDeLaHabitacion(1),
  321 |       ];
  322 |       await adjuntarTexto('Bloques de pasajeros',
  323 |         `${titulos.join(' | ')}${SALTO}` +
  324 |         ocupantesPorHabitacion.map((o, i) => `Habitacion ${i + 1}: ${o.join(' | ')}`).join(SALTO));
  325 | 
  326 |       await conResaltado(page, page.locator(serie.bloqueDePasajeros).first(), 'Formularios de pasajeros', () => {
  327 |         expect(titulos.length, 'Tiene que haber un bloque por habitacion agregada')
  328 |           .toBe(reserva.habitaciones);
  329 |         expect(ocupantesPorHabitacion[0].length,
  330 |           'La primera habitacion tiene que pedir los datos de sus dos adultos').toBe(2);
  331 |         expect(ocupantesPorHabitacion[1].length,
  332 |           'La segunda habitacion tiene que pedir los datos de sus dos adultos y el menor').toBe(3);
  333 |         // El menor va **despues** de los adultos y la pantalla lo distingue: si se
  334 |         // mezclara el orden, la validacion de la edad compararia contra otro pasajero.
  335 |         expect(ocupantesPorHabitacion[1].at(-1)!.toUpperCase(),
  336 |           'El ultimo ocupante de la segunda habitacion tiene que ser el menor')
  337 |           .toContain('MENOR');
  338 |       });
  339 | 
  340 |       /**
  341 |        * La fecha de nacimiento del menor se calcula **contra la fecha de salida**,
  342 |        * que es lo que hace el asistente al validar. Poner un anio fijo dejaria el
  343 |        * test dependiendo del dia en que se corre.
  344 |        */
  345 |       const [dd, mm, anio] = reserva.fecha.split('/').map(Number);
  346 |       const nacimientoDelMenor = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/` +
  347 |         `${anio - reserva.edadDelMenor}`;
  348 | 
  349 |       reserva.pasajeros = Array.from({ length: reserva.cantidadPax }, (_, i) => ({
  350 |         nombre: `Pasajero${['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho'][i] ?? 'Extra'}`,
  351 |         apellido: `Regresion${selloEnLetras(sello.slice(-6))}`,
  352 |         pasaporte: `QA${sello.slice(-8)}${i + 1}`,
  353 |         nacimiento: i === reserva.cantidadPax - 1 ? nacimientoDelMenor : `0${i + 1}/03/1990`,
  354 |         nacionalidad: 'Argentina',
  355 |       }));
  356 | 
  357 |       // Los pasajeros se reparten por habitacion en el mismo orden en que se
  358 |       // cargaron las habitaciones: dos en la primera y tres en la segunda.
  359 |       const porHabitacion = [reserva.pasajeros.slice(0, 2), reserva.pasajeros.slice(2)];
  360 |       for (const [h, lista] of porHabitacion.entries()) {
  361 |         for (const [i, pax] of lista.entries()) await serie.completarPasajero(h, i, pax);
  362 |       }
  363 |       await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
  364 |     });
  365 | 
  366 |     await paso(page, 'Avanzar al resumen y verificar lo que se va a confirmar', async () => {
  367 |       await serie.siguiente();
  368 |       await conResaltado(page, page.locator('.wizard-steps'), 'Paso de resumen', async () => {
  369 |         expect(await serie.errorDelPasoActual(),
  370 |           'Con los pasajeros completos el asistente no tiene que rechazar el paso').toBe('');
  371 |         expect(await serie.pasoActual(), 'El asistente tiene que avanzar al resumen').toBe('Resumen');
  372 |       });
  373 | 
  374 |       const resumenFinal = await serie.textoDelResumenFinal();
  375 |       await adjuntarTexto('Resumen de confirmacion', resumenFinal);
  376 | 
  377 |       await conResaltado(page, page.locator('.step4-section').first(), 'Resumen de confirmacion', () => {
  378 |         expect(resumenFinal, 'El resumen tiene que nombrar el circuito reservado')
  379 |           .toContain(SERIE.circuito);
  380 |         expect(resumenFinal, 'El resumen tiene que mostrar la fecha de salida elegida')
  381 |           .toContain(reserva.fecha);
  382 |         expect(resumenFinal, 'El resumen tiene que mostrar la categoria elegida')
  383 |           .toContain(SERIE.categoria);
  384 |         for (const pax of reserva.pasajeros) {
  385 |           expect(resumenFinal, `El resumen tiene que mostrar al pasajero ${pax.nombre}`)
  386 |             .toContain(`${pax.nombre} ${pax.apellido}`);
  387 |           expect(resumenFinal, `El resumen tiene que mostrar el pasaporte de ${pax.nombre}`)
  388 |             .toContain(pax.pasaporte);
  389 |           expect(resumenFinal, `El resumen tiene que mostrar la fecha de nacimiento de ${pax.nombre}`)
  390 |             .toContain(pax.nacimiento);
  391 |         }
  392 |       });
  393 | 
  394 |       // El total no puede cambiar entre el paso 1 y la confirmacion: es el
  395 |       // numero con el que la persona decide.
  396 |       const resumen = await serie.resumen();
  397 |       capturar('resumen final (total)', `USD ${resumen.total}`);
  398 |       await conResaltado(page, page.locator('#summaryCard'), 'Total en el resumen final', () => {
  399 |         expect(importes['resumen final (total)'].valor,
  400 |           'El total del resumen tiene que ser el mismo que mostro el paso de disponibilidad')
  401 |           .toBe(importes['asistente (total)'].valor);
  402 |       });
  403 |     });
  404 | 
  405 |     let codigo = '';
  406 |     await paso(page, 'Aceptar los terminos, confirmar y tomar el codigo del historial', async () => {
  407 |       // Sin tildar los terminos el boton de finalizar esta deshabilitado: es la
  408 |       // unica barrera antes de emitir.
  409 |       await conResaltado(page, page.locator('.terms-panel'), 'Finalizar deshabilitado sin terminos', async () => {
  410 |         await expect(
  411 |           page.locator(serie.botonSiguiente).first(),
  412 |           'Sin aceptar los terminos, el boton de finalizar tiene que estar deshabilitado',
  413 |         ).toBeDisabled();
  414 |       });
  415 | 
  416 |       await serie.aceptarTerminos();
  417 |       codigo = await serie.confirmarReserva();
  418 |       await adjuntarTexto('Codigo de la reserva emitida', codigo);
  419 |       expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
> 420 |         .toMatch(/^BO\d{8}$/);
      |          ^ Error: El historial tiene que mostrar el codigo de la reserva emitida
  421 | 
  422 |       const filaHistorial = page.locator('#tabCustomTour tr').filter({ hasText: codigo }).first();
  423 |       const deLaFila = ((await filaHistorial.innerText()).match(/[A-Z]{3}\s*\d[\d.,]*/g) ?? []);
  424 |       capturarDelPortal('historial (total)', deLaFila.at(-1) ?? '');
  425 |       await adjuntarTexto('Importes de la fila del historial', deLaFila.join(' | '));
  426 |     });
  427 | 
  428 | 
  429 |     await paso(page, 'Verificar que la reserva consumio el cupo de la salida', async () => {
  430 |       // `SerieQuotaManager.UseQuota` resta una unidad por habitacion. El asistente
  431 |       // publica el cupo disponible por fecha en `liveCupos`, asi que se comprueba
  432 |       // desde la misma pantalla, sin mirar la base. El cupo es por categoria, asi
  433 |       // que hay que volver a elegir la misma.
  434 |       await page.goto(reserva.urlDelAsistente);
  435 |       await esperarFinDeCarga(page);
  436 |       await page.waitForTimeout(2_000);
  437 |       await serie.elegirCategoria(SERIE.categoria);
  438 | 
  439 |       const { cupos } = await serie.datosDelCalendario();
  440 |       const clave = reserva.fecha.split('/').reverse().join('-');
  441 |       const cupoDespues = cupos[clave] ?? 0;
  442 |       await adjuntarTexto('Cupo de la salida despues de reservar',
  443 |         `${clave}: antes ${reserva.cupoAntes} -> despues ${cupoDespues}`);
  444 | 
  445 |       await conResaltado(page, page.locator('.scal-card'), 'Consumo de cupo', () => {
  446 |         expect(cupoDespues,
  447 |           `La reserva de ${reserva.habitaciones} habitaciones tiene que descontar ` +
  448 |           `${reserva.habitaciones} unidades del cupo de la salida`)
  449 |           .toBe(reserva.cupoAntes - reserva.habitaciones);
  450 |       });
  451 | 
  452 |       // El tramo del BackOffice arranca desde el historial: hay que volver ahi.
  453 |       await serie.abrirHistorialDeCircuitos();
  454 |     });
  455 | 
  456 |     await verificarEnElBackOffice({
  457 |       page, bo, codigo, contexto, importes, capturar,
  458 |       claveDeReferencia: 'asistente (total)',
  459 |       modalidadEnElFile: 'DOBLE',
  460 |       itemUnico: false,
  461 |       sinReferenciaNiComentario: true,
  462 |       itemsEsperados: SERIE.items,
  463 |       reserva: {
  464 |         item: SERIE.circuito,
  465 |         textoEnElBO: 'Park Hyatt',
  466 |         modalidad: 'DBL',
  467 |         fecha: reserva.fecha,
  468 |         fechaDeSalida: reserva.fechaDeSalida,
  469 |         referencia: '',
  470 |         observaciones: '',
  471 |         detalleDelItem: '',
  472 |         cantidadPax: reserva.cantidadPax,
  473 |         pasajeros: reserva.pasajeros,
  474 |       },
  475 |     });
  476 |   });
  477 | 
  478 | 
  479 |   /**
  480 |    * Rechazos del asistente de series.
  481 |    *
  482 |    * Es el companiero negativo del test de arriba, con el mismo criterio que
  483 |    * `validaciones.spec.ts` tiene para el checkout: **no emite ninguna reserva**,
  484 |    * asi que no deja nada vivo en QA ni consume cupo de la serie.
  485 |    *
  486 |    * Va en dos arranques porque el asistente no tiene marcha atras para todo: el
  487 |    * primero cubre los rechazos del paso de disponibilidad y el segundo los del
  488 |    * paso de pasajeros, entrando de nuevo al circuito.
  489 |    */
  490 |   test('Serie: el asistente no deja avanzar con datos incompletos', async ({ page }) => {
  491 |     test.setTimeout(900_000);
  492 | 
  493 |     const serie = new SeriePage(page);
  494 | 
  495 |     const errores = {
  496 |       sinFecha: 'Debés seleccionar una fecha de salida en el calendario.',
  497 |       sinHabitaciones: 'Debés agregar al menos una habitación.',
  498 |       pasajeros: 'Completá el nombre, apellido y fecha de nacimiento de todos los pasajeros.',
  499 |       edadDelMenor: 'la fecha de nacimiento ingresada corresponde a',
  500 |     };
  501 | 
  502 |     await paso(page, 'Abrir el asistente del circuito de regresion', async () => {
  503 |       await serie.abrirListado();
  504 |       await serie.abrirSerie(SERIE.nombre);
  505 |       await serie.abrirCircuito(SERIE.circuito);
  506 |       expect(await serie.pasoActual(), 'El asistente tiene que abrir en el paso de disponibilidad')
  507 |         .toBe('Disponibilidad');
  508 |     });
  509 | 
  510 |     await paso(page, 'Intentar avanzar sin elegir una fecha de salida', async () => {
  511 |       await serie.siguiente();
  512 |       const error = await serie.errorDelPasoActual();
  513 |       await adjuntarTexto('Error sin fecha', error);
  514 | 
  515 |       await conResaltado(page, page.locator('.wizard-nav'), 'Rechazo sin fecha', async () => {
  516 |         expect(error, 'Sin fecha de salida el asistente tiene que rechazar el paso')
  517 |           .toContain(errores.sinFecha);
  518 |         expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
  519 |           .toBe('Disponibilidad');
  520 |       });
```