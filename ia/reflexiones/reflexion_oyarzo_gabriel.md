# Reflexión sobre el uso de IA — Oyarzo, Gabriel Francisco

**Herramienta utilizada:** Claude (Anthropic), ChatGPT (OpenAI)

## ¿Para qué usé IA?

Soy bastante honesto con esto: al principio del proyecto no usaba IA para nada. Me parecía que era trampa, o que si la usaba no iba a aprender nada. Cambié de opinión durante la Entrega 2, cuando me tocó entender el código del Middleware para poder explicarlo en el video de demo. El main.py tenía como 200 líneas de Python que yo no había escrito, y tenía que hablar de "fail-closed" y "verificación de pertenencia al entorno" en cámara como si supiera de qué hablaba. Le pedí a Claude que me lo explique función por función y ahí entendí realmente cómo funcionaba todo.

Después lo seguí usando para cosas más prácticas:
- Para que me ayude a armar mi parte del guion del video (el cierre con las alertas y la topología).
- Para entender errores de la terminal que me aparecían en Windows y que no tenía idea de cómo resolver.
- Le hice algunas consultas a ChatGPT también, más que nada para comparar explicaciones cuando algo no me quedaba claro con una sola fuente.

## ¿Qué funcionó y qué no?

Lo que mejor funcionó: las explicaciones de código ajeno. Poder pegarle una función y preguntarle "¿qué hace esto, línea por línea?" es algo que antes hubiera tenido que pedirle a un compañero, interrumpiéndolo en lo que estuviera haciendo.

Lo que no me sirvió: intenté pedirle a ChatGPT que me genere tests unitarios para el Middleware. Me generó unos tests que parecían prolijos pero que no testeaban nada real — por ejemplo, mockeaba toda la conexión a Docker y después verificaba que el mock devolviera lo que él mismo había puesto. No aprendí nada y no sumaban valor al proyecto, así que los descarté.

## ¿Cómo cambió mi forma de trabajar?

La verdad es que me bajó la barrera de entrada a muchas cosas. Antes de este proyecto, si veía un archivo de Python de 200 líneas que no era mío, mi primera reacción era "esto no lo toco porque lo rompo". Ahora sé que puedo pedirle a una IA que me lo explique, entenderlo, y recién después decidir si lo modifico o no. No reemplaza saber programar — pero sí hace que el conocimiento de los demás sea más accesible para el resto del equipo. Eso para un proyecto grupal es bastante importante.
