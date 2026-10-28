# Meteor Dodge

Arcade vertical para Android, hecho con HTML5 Canvas y JavaScript dentro de un WebView nativo. Todo el juego está incluido en el APK y funciona sin Internet. No solicita permisos de red ni instala servicios externos.

## Cómo jugar

- Pulsa **DESPEGAR** y arrastra el dedo. La nave dispara automáticamente cada 0,38 segundos.
- Rocas pequeñas, medianas y grandes: 3, 6 y 10 puntos de resistencia. Los impactos abren grietas; al destruirse explotan en fragmentos pixelados.
- Cada roca destruida suelta XP morada (1, 2 o 3 puntos). La XP se acerca sola a la nave tras una breve animación.
- Al subir de nivel, la partida se pausa para elegir **cadencia**, **daño (+1)** o **vida máxima (+25 y recupera 25)**. Las mejoras duran esa partida.
- Vida inicial: 100. Escudo: 30 de 60. Un 22% de las rocas destruidas con disparos sueltan un objeto que recupera 20 de escudo al recogerlo.
- Los impactos quitan 18, 28 o 40 puntos según el tamaño: primero escudo, después vida. Tras un golpe hay 1,15 segundos de invulnerabilidad.
- Los sectores aumentan la dificultad cada 40 destrucciones; son independientes del nivel de experiencia.
- Puntuación: 10 por segundo, 10 por roca esquivada y 30 por roca destruida con disparos.
- El récord se guarda en este dispositivo. Borrar los datos o desinstalar la app elimina el récord.
- Pausa con el botón de pantalla, Atrás o al salir de la app. En escritorio: flechas o WASD y espacio para pausar.

Los sprites se dibujan localmente con píxeles originales inspirados en las referencias: nave blanca y roja con cabina azul y meteoritos con cráteres, variaciones y grietas progresivas. No se descarga ningún recurso durante el juego.

## Versión 1.2: sectores y jefes

- La XP se reduce a 1 / 2 / 3 por roca y el primer nivel básico requiere 80 XP; cada siguiente exige 30 más. La mejora de cadencia también progresa más despacio.
- Ya no aumenta la dificultad por tiempo. Cada sector exige **40 rocas destruidas** con armas o escudo demoledor. Esquivar o chocar no cuenta.
- Las rocas empiezan con 3 / 6 / 10 de resistencia y ganan un 28% de su resistencia base por sector. Cambian de paleta, minerales y cráteres; el fondo rota entre hierro, brasas, glaciar, esporas, nebulosa y arenas solares.
- Al completar cada sector eliges una de **tres ventajas especiales aleatorias y distintas**. Duran esa partida y pueden acumular rangos: diagonal, láser pulsante, disparo trasero, escudo demoledor, drones escolta, reactor de escudo y sobrecarga cada cinco disparos. La descripción de cada tarjeta explica su efecto.
- En los sectores **8, 16, 24…**, después de las 40 rocas aparece un jefe y la ventaja se obtiene al vencerlo. Se detiene la aparición de rocas normales.
- El jefe cubre todo el ancho: dispara mientras retrocedes y destrúyelo antes de que el borde rojo alcance tu nave. El contacto mata incluso con escudo o invulnerabilidad; el escudo demoledor no destruye jefes. Su vida se ajusta a la potencia de fuego frontal disponible y avanza lentamente para dejar margen de combate.
- Código de versión Android: 3. La firma debug puede variar entre compilaciones; si Android no permite actualizar, desinstalar la anterior borra el récord.

## Versión 1.3: identidad arcade

- El icono Android usa la imagen de meteorito aportada por el usuario, también con variante adaptativa para Android 8 o superior.
- El menú muestra el título de la referencia original; una fuente pixelada propia, Meteor Arcade, adapta el resto de la interfaz a ese estilo. Incluye acentos y signos españoles.
- Botones con marco de neón cian, cifras con relieve, barras segmentadas por color, estrellas en cruz, planeta pixelado y meteoritos iluminados por el borde.
- Imágenes y fuente se incluyen localmente y funcionan sin conexión. `tools/build_font.py` permite regenerar la fuente con fonttools; la compilación usa el TTF ya incluido.
- El workflow comprueba la fuente, las imágenes, los controles y tres tamaños de pantalla y guarda capturas en **MeteorDodge-preview**.
- Código de versión Android: 4.

## Obtener el APK desde un móvil

1. Abre [GitHub Actions](https://github.com/alejatorrrr/MeteorDodge/actions/workflows/android.yml) con tu sesión de GitHub iniciada.
2. El workflow **Build Android APK** se inicia al subir código a `main`. También puedes tocar **Run workflow** y elegir `main`.
3. Abre la ejecución más reciente correspondiente a tu commit. Espera a que termine con una marca verde y estado **Success**.
4. En **Artifacts**, al final de la página, descarga **MeteorDodge-debug**. Si la vista móvil oculta opciones, activa «Sitio de escritorio» en el navegador.
5. Extrae el ZIP descargado: dentro está **app-debug.apk**.
6. Abre el APK desde Archivos/Descargas y permite a esa aplicación «Instalar aplicaciones desconocidas» si Android lo solicita. Después pulsa **Instalar**.

El artefacto se conserva 30 días. Si caduca, ejecuta de nuevo el workflow. Este es un APK debug firmado automáticamente para pruebas, no requiere Google Play ni claves de publicación. Compilaciones de distintos entornos pueden usar firmas debug distintas: si Android rechaza una actualización por firma incompatible, desinstala la versión anterior (esto borra su récord) e instala la nueva.

**Estado:** incluir el workflow no acredita una compilación exitosa. La prueba de que existe un APK es una ejecución finalizada correctamente y el artefacto descargable de ese mismo commit.

## Compilación

Requisitos: JDK 17, Gradle 8.13, SDK de Android con `platforms;android-35` y `build-tools;35.0.0`. El workflow instala y fija estas versiones. El proyecto no incluye un Gradle Wrapper: en local se usa una instalación de Gradle 8.13 y en CI `gradle/actions/setup-gradle`.

Configura `ANDROID_HOME` o crea `local.properties` con `sdk.dir=/ruta/al/sdk` y ejecuta:

```sh
gradle --no-daemon :app:assembleDebug :app:lintDebug
```

Salida: `app/build/outputs/apk/debug/app-debug.apk`. Compatible con Android 6.0 (API 23) o superior y Android System WebView actualizado.

## Pruebas y vista previa

Sin dependencias npm, con Node 22 o posterior:

```sh
node --test tests/*.test.cjs
node --check app/src/main/assets/engine.js
node --check app/src/main/assets/game.js
```

Vista previa de los recursos del juego en un navegador:

```sh
python3 -m http.server 8000 --directory app/src/main/assets
```

Abre `http://localhost:8000`. La vista previa no sustituye la prueba del APK en un teléfono.

## Estructura

- `app/src/main/assets/`: interfaz, Canvas, simulación y controles.
- `app/src/main/java/`: actividad Android y carga local segura de recursos mediante origen HTTPS interceptado. Las solicitudes no locales se bloquean.
- `tests/`: 30 pruebas de combate y progresión y una prueba de interfaz móvil con Playwright ejecutada en CI.
- `.github/workflows/android.yml`: pruebas, compilación, Android Lint y publicación del APK como artefacto.

El workflow necesita que GitHub Actions esté habilitado. Para subirlo mediante una integración o token de GitHub se necesitan permisos de escritura en **Contents** y **Workflows** para este repositorio. Nunca incluyas tokens en archivos del proyecto.
