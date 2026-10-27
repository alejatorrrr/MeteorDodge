# Meteor Dodge

Arcade vertical para Android, hecho con HTML5 Canvas y JavaScript dentro de un WebView nativo. Todo el juego está incluido en el APK y funciona sin Internet. No solicita permisos de red ni instala servicios externos.

## Cómo jugar

- Pulsa **DESPEGAR** y arrastra el dedo por la pantalla: la nave sigue el desplazamiento sin saltar debajo del dedo.
- Esquiva los meteoritos. Ganas 10 puntos por segundo y 10 por meteorito superado.
- Cada 12 segundos aumenta el sector y sube la dificultad.
- Una colisión termina la partida. Puedes volver a jugar desde **GAME OVER**.
- El récord se guarda localmente con `localStorage`. Borrar los datos o desinstalar la aplicación elimina el récord.
- El botón de pausa, el botón Atrás y salir de la aplicación pausan la partida; pulsa **CONTINUAR** para retomarla.
- En un navegador de escritorio también puedes usar flechas o WASD y la barra espaciadora para pausar.

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
- `tests/`: pruebas de colisiones, límites, puntuación, estados y dificultad.
- `.github/workflows/android.yml`: pruebas, compilación, Android Lint y publicación del APK como artefacto.

El workflow necesita que GitHub Actions esté habilitado. Para subirlo mediante una integración o token de GitHub se necesitan permisos de escritura en **Contents** y **Workflows** para este repositorio. Nunca incluyas tokens en archivos del proyecto.
