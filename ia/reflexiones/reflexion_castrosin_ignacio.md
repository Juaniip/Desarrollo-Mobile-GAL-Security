# Reflexión sobre el uso de IA — Castrosin, Ignacio

**Herramienta utilizada:** Claude (Anthropic), GitHub Copilot

## ¿Para qué usé IA?

Dentro del equipo me tocó más la parte de infraestructura Docker y la configuración del Registry. Usé Claude principalmente para dos cosas: entender el código del backend (FastAPI con SQLite) que no había escrito yo, y para armar los archivos de configuración de Docker (Dockerfile, docker-compose, .gitignore) sin tener que copiar templates de internet y adaptarlos a mano.

También usé GitHub Copilot en VS Code para el autocompletado mientras editaba archivos TypeScript de la app. No lo usé para generar funciones enteras, más bien para que me completara los tipos y los imports que son tediosos de escribir a mano en React Native.

## ¿Qué anduvo bien y qué no?

El Dockerfile y el docker-compose del Registry que generó Claude estuvieron bastante bien desde el primer intento. Lo que sí falló fue que el primer docker-compose incluía un servicio propio de cloudflared (un contenedor de túnel dedicado para el Registry), y después nos dimos cuenta de que no hacía falta porque en nuestro Pi ya había un túnel central corriendo como servicio del sistema, y solo había que agregarle una ruta más. Eso fue un ida y vuelta de varias horas hasta que entendimos cómo estaba realmente armada nuestra infraestructura — no era culpa de Claude, era que nosotros mismos no teníamos claro cómo habíamos configurado el Pi originalmente.

De Copilot: a veces sugiere código que compila pero que no tiene sentido en el contexto. Por ejemplo, me autocompletó un `await AsyncStorage.getItem('servers')` en un lugar donde ya no usábamos AsyncStorage como fuente principal. Hay que tener cuidado con aceptar sugerencias sin pensar.

## ¿Cambió algo en mi forma de trabajar?

Creo que lo más importante es que me animé a tocar cosas que antes me daban miedo. Configurar Docker, armar volúmenes persistentes, entender cómo se comunican dos contenedores por red interna — antes eso me parecía territorio de gente que sabe mucho más que yo. Tener una IA a la que le puedo preguntar "¿por qué este contenedor no puede llegar al otro?" y que me responda con la explicación concreta me sacó el miedo a experimentar. No es que ahora sea un experto en Docker, pero ya no me paralizo cuando algo no funciona.
