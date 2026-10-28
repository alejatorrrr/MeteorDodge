# AdMob: integración y puesta en marcha

## Implementado

Google Mobile Ads 25.5.0 y UMP 4.0.0, Android 7/API 24 o posterior. Anuncios nativos recompensados; el juego local sigue funcionando sin Internet. Sin banners ni intersticiales obligatorios.

- Game Over: anuncio voluntario para revivir una vez por partida con 50 % de vida y 3 s de invulnerabilidad. Se retiran amenazas; el jefe retrocede, conservando su vida. La partida permanece en pausa hasta pulsar Continuar.
- Sectores: anuncio voluntario para elegir una ventaja adicional después de la gratuita, una vez por ciclo de seis sectores. La segunda elección excluye la primera ventaja. Nunca se sustituye la elección gratuita.
- La recompensa solo se concede tras el callback de recompensa del SDK y el cierre del anuncio. Cancelaciones, fallos y anuncios no disponibles no conceden ni consumen la recompensa. Solicitudes/callbacks duplicados se ignoran.
- Consentimiento UMP antes de cargar publicidad real; botón Privacidad de anuncios. Las campañas y mensajes de consentimiento se configuran en AdMob.

## Estado de esta entrega

`app-debug.apk` usa SIEMPRE los identificadores de prueba oficiales de Google, incluso si se pasan propiedades reales. No genera ingresos. En debug los anuncios de prueba se pueden cargar aunque la aplicación de muestra no tenga mensajes UMP configurados. En release la autorización se comprueba con `canRequestAds()`.

Las pruebas de navegador simulan respuestas del puente nativo para comprobar cancelaciones, recompensas únicas y continuidad. La compilación y Android Lint comprueban la integración Java. La entrega real de anuncios y los formularios UMP deben comprobarse en un dispositivo Android con conexión antes de publicar.

## Configurar desde el móvil

1. Entrar en https://admob.google.com/ y completar la cuenta y los datos solicitados por Google.
2. Añadir aplicación Android: Meteor Dodge, paquete `com.alejatorrrr.meteordodge`. Indicar su estado real de publicación.
3. Copiar el ID de aplicación (`ca-app-pub-…~…`).
4. Crear dos bloques **Recompensados**: Revivir y Ventaja extra. Copiar sus IDs (`ca-app-pub-…/…`). Son identificadores públicos, no contraseñas.
5. Configurar Privacidad y mensajes para la aplicación, con la política de privacidad publicada y el público correcto. Revisar elegibilidad/estado de la aplicación y los pasos de verificación que muestre AdMob.
6. Facilitar los tres identificadores para configurar una compilación release firmada. Usar dispositivos de prueba mientras se valida la versión de producción; no probar haciendo clic en anuncios reales propios.

## Compilación de producción

Propiedades Gradle: `ADMOB_APP_ID`, `ADMOB_REVIVE_ID`, `ADMOB_EXTRA_ID`. `preReleaseBuild` rechaza identificadores vacíos, de muestra o con formato incorrecto. La firma de lanzamiento se configura aparte; no se guardan claves privadas en GitHub. El workflow actual distribuye exclusivamente debug con publicidad de prueba.

Faltan los IDs reales, la configuración de la cuenta/mensajes/política de privacidad y la firma de distribución para activar la monetización de una versión publicada. La integración por sí sola no garantiza ingresos ni disponibilidad de anuncios.

## Documentación oficial

- https://developers.google.com/admob/android/quick-start
- https://developers.google.com/admob/android/rewarded
- https://developers.google.com/admob/android/privacy
