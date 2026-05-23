# Guía de Contribución - GALs Security

¡Gracias por interesarte en contribuir a GALs Security! Para mantener la calidad del código y organizar el flujo de trabajo colaborativo de la cátedra, te pedimos que sigas estas normativas.

## Flujo de Trabajo (Git Flow Simplificado)
1. **Nunca trabajes directamente sobre `main` ni `entrega-1`.**
2. Asegurate de tener tu rama local actualizada: `git pull origin entrega-1`
3. Creá una rama descriptiva para tu tarea: `git checkout -b feature/nombre-de-tu-tarea` o `bugfix/nombre-del-error`.
4. Hacé tus cambios, commiteá y subí tu rama: `git push origin feature/nombre-de-tu-tarea`.
5. Abrí un **Pull Request (PR)** apuntando a la rama de integración (`entrega-1`).

## Convenciones de Commits (Conventional Commits)
Este repositorio sigue estrictamente el estándar de [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/). Cada mensaje debe tener la siguiente estructura:

`tipo(alcance): descripción breve`

**Tipos permitidos:**
*   `feat`: Una nueva característica (ej. pantalla nueva, nuevo endpoint).
*   `fix`: Solución a un error (bug).
*   `docs`: Cambios exclusivos en la documentación (README, diagramas).
*   `chore`: Tareas de mantenimiento, actualización de dependencias, configuración de linters o repositorios.
*   `refactor`: Cambios en el código que no corrigen errores ni añaden funciones (optimización).

**Ejemplos válidos:**
*   `feat(auth): agrega validación de token JWT en el cliente`
*   `fix(dashboard): corrige renderizado doble en la lista de servidores`
*   `chore(middleware): actualiza versión de FastAPI en requirements.txt`

## Reglas para Pull Requests (PRs)
*   Todo PR debe ser revisado y aprobado por al menos **1 integrante distinto** al autor del código antes de hacer *Merge*.
*   El código de React Native no debe contener advertencias (`warnings`) críticas ni `console.log()` huérfanos.
*   Si agregás un nuevo endpoint al Middleware de Python, asegurate de que requiera el header de autorización (`Bearer`).

## Entorno de Desarrollo Local
*   **Mobile:** Utilizar Node.js v18+ y React Native CLI. Verificar que el emulador Android tenga acceso a la red de Cloudflare.
*   **Middleware:** Utilizar Python 3.8+ con un entorno virtual (`venv`).
