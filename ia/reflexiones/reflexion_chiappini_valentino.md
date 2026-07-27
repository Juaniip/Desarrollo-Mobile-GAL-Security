# Reflexión sobre el uso de IA — Chiappini, Valentino

**Herramienta utilizada:** Claude (Anthropic)

## ¿Para qué usé IA en el proyecto?

Mi uso fue bastante puntual. No soy de los que le piden a la IA que les escriba todo — me genera desconfianza no entender lo que estoy entregando. Dicho esto, sí la usé en momentos específicos donde estaba trabado:

- Para entender por qué los estilos de React Native no se comportaban como CSS normal (sobre todo el tema de flexbox en el menú radial, que tiene posicionamiento absoluto por todos lados).
- Para que me sugiera cómo estructurar el componente del grafo de topología sin meter una librería pesada de gráficos. La idea de usar Views rotados con transformOrigin salió de ahí.
- Para debuggear errores de Gradle que eran incomprensibles — le pegaba el stacktrace y me decía dónde buscar.

## ¿Qué funcionó y qué no?

Lo mejor fue el debugging. Gradle en Windows es un infierno, y los mensajes de error son kilométricos y crípticos. Poder pegarle el log completo a Claude y que me diga "el problema está en la línea tal, es porque moviste la carpeta y quedó cacheada la ruta vieja" me ahorró horas literales. Sin exagerar, el error de la cache de transforms me hubiera llevado medio día resolverlo solo.

Lo que no me convenció es cuando le pedí que me genere un componente de React Native completo de cero. El código funcionaba, pero el estilo era genérico, los nombres de las variables no tenían nada que ver con nuestro proyecto, y tuve que reescribir más de la mitad. Al final es más rápido escribirlo yo y preguntarle dudas puntuales que pedirle el archivo entero.

## ¿Cambió mi forma de trabajar?

Sí, pero no de la forma que esperaba. No me hizo más rápido escribiendo código — me hizo más rápido resolviendo problemas que antes me bloqueaban por completo. Antes cuando algo no compilaba y no entendía el error, dejaba el proyecto tirado por un par de días hasta que alguien del grupo lo miraba. Ahora tengo un recurso inmediato para desbloquearme. Eso solo ya vale la pena.
