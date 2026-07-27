# Reflexión sobre el uso de IA — Marini, Álvaro

**Herramienta utilizada:** Claude (Anthropic)

## ¿Para qué usamos IA durante el proyecto?

Principalmente la usé para dos cosas: entender código que no había escrito yo y redactar documentación. Al principio del proyecto me costaba seguir el ritmo de las decisiones de arquitectura porque no tenía experiencia previa con FastAPI ni con la lógica de Cloudflare Tunnels. Le pedí a Claude que me explicara cómo funcionaba el flujo de autenticación (por qué el JWT viaja del celular al Middleware y de ahí a Google, en vez de validarse localmente) y eso me ayudó bastante a no perderme en las reuniones del grupo cuando discutíamos cambios.

También lo usé para armar borradores de secciones del alcance y la documentación técnica — no copiaba textual lo que me devolvía, pero me servía como punto de partida para no arrancar de una hoja en blanco, que es lo que más me traba.

## ¿Qué funcionó bien? ¿Qué hubo que corregir?

Las explicaciones conceptuales funcionaron muy bien. Cuando le preguntaba "por qué hacemos X en vez de Y", las respuestas eran claras y me daban argumentos que después podía usar en la documentación o en las discusiones del equipo.

Lo que no me funcionó tanto fue pedirle que me genere texto "listo para entregar" de la documentación. El tono quedaba demasiado formal, medio robótico, y tuve que reescribir bastante para que sonara como algo que escribiría un estudiante y no un paper académico. Aprendí que es mejor pedirle ideas o estructura y después redactar yo.

## ¿Cómo cambió mi forma de trabajar?

En proyectos anteriores de la carrera, cuando no entendía algo del código de un compañero directamente le preguntaba o googleaba. El tema es que googlear "cómo funciona verify_id_token de firebase-admin en el contexto de una app React Native con Cloudflare Tunnels" no te da resultados útiles porque es muy específico. La IA sí puede responder esas preguntas de nicho, y eso me ahorró mucho tiempo y me hizo sentir menos perdido. Creo que la clave es usarla como un compañero de estudio que te explica las cosas, no como algo que te hace el trabajo.
