# Reflexión sobre el uso de IA — Wilt, Juan Ignacio

**Herramienta utilizada:** Claude (Anthropic)

## ¿Para qué usé IA?

Fui el que más interactuó con Claude dentro del grupo, porque me tocó la parte de infraestructura y DevOps que es donde más decisiones de arquitectura hay que tomar. Lo usé para prácticamente todo el ciclo: desde la planificación del alcance hasta el debugging de contenedores en la Raspberry Pi, pasando por la generación de código del backend y las pantallas de React Native.

Un ejemplo concreto: toda la arquitectura del gals-registry (el Directorio de Entornos) la diseñamos en conversación con Claude — la decisión de usar SQLite en vez de Firestore, el modelo de roles por entorno en vez de un rol global en el JWT, el patrón fail-closed del Middleware. No es que Claude lo decidió solo; yo le planteaba las restricciones (tiene que ser self-hosted, no puede depender de un servicio cloud, tiene que funcionar con lo que ya tenemos en el Pi) y él proponía opciones con pros y contras.

## ¿Qué funcionó y qué tuve que corregir?

Lo que mejor funcionó fue el ida y vuelta de debugging en vivo. Durante la sesión de E2 hubo un momento donde todo se rompió porque el Middleware no podía hablar con el Registry — y la causa era que el túnel de Cloudflare no corría en Docker como asumíamos, sino como un servicio systemd del sistema operativo del Pi. Eso no estaba documentado en ningún lado del repo, era algo que yo había configurado hace meses y me había olvidado. Claude no podía saberlo, pero me fue haciendo las preguntas correctas (¿qué dice systemctl status cloudflared?) hasta que lo encontramos juntos.

Lo que tuve que corregir: a veces el código que generaba asumía cosas del entorno que no eran ciertas. Por ejemplo, el primer docker-compose del Registry no publicaba puertos al host porque asumía que el túnel iba a estar en la misma red de Docker — cosa que era cierta en el diseño teórico pero no en mi Pi real. Esos ajustes los hice yo después de probar y ver que fallaba.

## ¿Cómo cambió mi forma de trabajar?

En otros proyectos de la carrera, cuando había que tomar una decisión técnica importante (qué base de datos usar, cómo manejar la autenticación, dónde poner cada servicio), la respuesta era googlear un rato, leer tres posts de Medium que se contradecían entre sí, y elegir el que parecía más razonable. Con Claude puedo plantear MI caso concreto — con mis restricciones reales, mi hardware, mi stack — y recibir una respuesta que aplica directo a mi situación, no a un tutorial genérico. Eso me cambió el flujo de trabajo por completo.

La otra cosa que me cambió es la documentación. Antes era lo último que hacíamos, a las corridas, la noche de la entrega. Esta vez la fuimos armando en paralelo con el código, porque pedirle a Claude que documente lo que acabamos de implementar es trivial si ya tiene el contexto de la conversación.
