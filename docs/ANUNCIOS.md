# Propuesta de anuncios — pendiente de integración

Esta versión no incluye SDK ni anuncios. Se mantiene el juego sin conexión.

## Ubicaciones recomendadas

- Game Over: «Ver anuncio y revivir», voluntario, una vez por partida. Conservar puntuación, sector y mejoras; recuperar el 50 % de vida, retirar amenazas próximas y dar 3 s de invulnerabilidad. Si el jefe causó el impacto, retrasarlo lo suficiente para permitir una segunda oportunidad, sin reiniciar su vida. Mantener siempre Reintentar y Menú principal disponibles.
- Selección de ventaja al completar un sector: después de la elección gratuita, ofrecer una segunda elección distinta a cambio de un anuncio. Como máximo una recompensa de este tipo por ciclo de seis sectores. Nunca reemplazar la mejora gratuita.
- Taller: reparación adicional o recarga de escudo voluntaria, alternativa futura. No hace falta incorporarla a la vez que las otras dos.
- Intersticiales: posponerlos al lanzamiento inicial. Si se incorporan, únicamente al volver al menú tras varias partidas terminadas, con al menos 3 minutos entre anuncios, sin mostrarlos después de un anuncio recompensado ni al abandonar voluntariamente.

## Reglas de implementación

Dar la recompensa únicamente cuando el SDK confirme la finalización del anuncio; impedir recompensas duplicadas por callbacks repetidos. Pausar juego y audio durante el anuncio. Si no hay conexión, inventario o falla el anuncio, mantener disponible la continuación normal y no prometer la recompensa. No obligar a usar publicidad para desbloquear naves o progresar.

Antes de integrar: elegir proveedor (por ejemplo AdMob), obtener identificadores de aplicación y bloques, usar anuncios de prueba durante desarrollo y preparar consentimiento y política de privacidad según el público y los mercados elegidos. La instalación del SDK y sus permisos de red cambian respecto a esta versión offline.

## Antes de publicar

Probar en móviles reales, revisar el equilibrio de jefes y desbloqueos, preparar firma estable de lanzamiento, política de privacidad, ficha y capturas de tienda. El APK debug sirve para pruebas; no equivale a una versión de publicación.
