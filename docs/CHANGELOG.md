# Changelog — GALs Security

Historial de cambios del proyecto GALs Security (Guardian Application Layer Security), organizado por entrega.

---

## [Entrega 3] — Producto Final Escalado (Julio 2026)

### Agregado
- **Organizaciones en el llavero (RF-13):** agrupación jerárquica de entornos en carpetas colapsables. CRUD completo de organizaciones (crear, renombrar, eliminar) y asignación/desasignación de entornos desde un modal dedicado. Los entornos sin organización aparecen en una sección separada.
- **Edición de variables de entorno (RF-14):** nueva pantalla `EnvVarsScreen` para visualizar y modificar las variables de entorno de cualquier contenedor. Al guardar, el contenedor se detiene, se elimina y se recrea con la nueva configuración, preservando imagen, puertos, volúmenes y red. Requiere confirmación explícita del usuario. Solo accesible para Administradores.
- **Historial de telemetría (RF-15):** gráfico de línea de CPU y RAM en el Dashboard, acumulando hasta 20 muestras por sesión. Dibujado con Views posicionados y rotados (sin dependencias nativas nuevas). Indicador de "acumulando datos" cuando hay menos de 2 muestras.
- Endpoint `GET /containers/{id}/env` en el Middleware (lectura de variables de entorno).
- Endpoint `PUT /containers/{id}/env` en el Middleware (actualización con recreación del contenedor).
- Endpoints de organizaciones en el Registry: `POST /organizations`, `GET /organizations/mine`, `PUT /organizations/{id}`, `DELETE /organizations/{id}`, `PUT /environments/{id}/organization`.
- Tabla `organizations` en SQLite del Registry con migración no-destructiva (`ALTER TABLE` + `try/except`).
- Botón "ENV" (violeta) en cada card de contenedor del Dashboard, visible solo para Administradores.
- Botón "📁" en cada card del llavero para asignar un entorno a una organización.
- Documentación final consolidada: `alcance_final.md` (RF E1+E2+E3 con estado + Feature Map + US completas), `doc_tecnica_final.md` (API completa, seguridad, performance, deuda técnica actualizada).
- `IA Skills Final.md` acumulado E1+E2+E3 con 37 temas indexados.

### Cambiado
- `ServerListScreen` refactorizado: migró de `FlatList` a `ScrollView` para soportar la estructura jerárquica de organizaciones + entornos sin agrupar.
- `DashboardScreen` refactorizado: `FlatList` con `ListHeaderComponent` para incluir métricas actuales + gráfico de historial + banner de rol antes de la lista de contenedores.
- `App.tsx` actualizado: `EnvVarsScreen` registrada en el stack de navegación con parámetros `containerId` y `containerName`.
- `gals-registry/main.py` v2: columna `organization_id` agregada a la tabla `environments`, devuelta en `GET /environments/mine`.
- `Middleware/main.py` v2: modelo Pydantic `EnvVarsBody` para validar el cuerpo del `PUT /env`.

---

## [Entrega 2] — Escalado Funcional (Junio 2026)

### Agregado
- **RBAC por entorno (RF-07):** dos roles (Administrador y Operador) resueltos por consulta al Directorio de Entornos, no como claim global del JWT. El Administrador controla; el Operador solo visualiza.
- **Compartir entornos (RF-10):** un Administrador puede invitar a otro usuario por email de Google, otorgándole rol de Operador. Revocación de acceso inmediata (independiente de la expiración del JWT). Auto-abandono disponible para Operadores.
- **Alertas in-app (RF-08):** umbrales de CPU (>85%), RAM (>85%) y temperatura (>75°C). Detección de contenedores caídos por error (`exit_code != 0`, distinguido de contenedores detenidos a propósito). Deduplicación de alertas con `useRef` para no repetir el mismo aviso en cada refresh.
- **Monitorización concurrente (RF-11):** `ServerListScreen` consulta `/metrics` y `/containers` de todos los entornos en paralelo con `Promise.allSettled`. Un nodo caído queda marcado "Sin conexión" sin afectar a los demás. Pull-to-refresh.
- **Grafo de Dependencias de Red (RF-12):** endpoint `/topology` en el Middleware + `NetworkGraphScreen` con layout bipartito (redes a la izquierda, contenedores a la derecha). Redes y conexiones bridge/host pintadas en rojo, resto en verde/azul. Sin dependencias nuevas (Views nativos con `transformOrigin`).
- Microservicio `gals-registry` (FastAPI + SQLite): tablas `environments` y `collaborators`, endpoints de gestión de entornos y colaboradores, endpoint interno `/role` autenticado con `X-Service-Key`.
- `require_role()` en el Middleware: fábrica de dependencias FastAPI que verifica el rol contra el Directorio antes de ejecutar cualquier acción. Fail-closed con timeout de 2s.
- Badge de rol ("Admin" / "Operador") en `ServerListScreen` y `DashboardScreen`.
- Banner de "modo solo lectura" en el Dashboard para Operadores.
- Opción "Topología" en el Menú Radial.
- Botón de compartir (🔗) y de eliminar/abandonar en las cards del llavero.
- `config.ts` con URL fija del Directorio de Entornos.

### Cambiado
- `ServerListScreen` migrado de llavero local (`AsyncStorage` como fuente de verdad) a llavero remoto (`gals-registry` como fuente de verdad, `AsyncStorage` como caché de fallback con banner "datos posiblemente desactualizados").
- `DashboardScreen`: botones Start/Stop/Restart no se renderizan para Operadores (no solo deshabilitados — directamente ausentes del DOM).
- `RadialMenuScreen`: logout ahora llama `GoogleSignin.signOut()` antes de `auth().signOut()` para limpiar la caché nativa de Google y permitir cambio de cuenta.
- `Middleware/main.py`: todos los endpoints sensibles migrados de `Depends(verify_token)` a `Depends(require_role(...))`.
- `Middleware/docker-compose.yml`: eliminado el servicio `gals-tunnel` (quick tunnel propio, redundante con el cloudflared systemd central del host). Agregadas variables de entorno `REGISTRY_URL`, `SERVICE_KEY`, `ENVIRONMENT_ID`. Puerto 8085 publicado al host.
- `Middleware/requirements.txt`: agregada dependencia `requests` (para la consulta al Directorio).
- `/containers` ahora devuelve `exit_code` por contenedor (necesario para las alertas de caída).
- RF-02 modificado: un entorno puede tener un Administrador y N Operadores (antes era 1:1 usuario:entorno).
- RF-04 modificado: acciones de control condicionadas al rol Administrador.

### Corregido
- Hallazgo de seguridad de E1: `verify_token()` solo validaba autenticidad del JWT, no pertenencia al entorno. Cualquier usuario autenticado podía operar cualquier nodo cuya URL conociera. Corregido con `require_role()`.
- Bug de Google Sign-In: al cerrar sesión e iniciar de nuevo, la app reingresaba automáticamente con la misma cuenta sin mostrar el selector. Corregido con `GoogleSignin.signOut()`.

---

## [Entrega 1] — MVP Básico (Mayo 2026)

### Agregado
- **Autenticación delegada (RF-01):** Google Sign-In vía Firebase Auth con OAuth2.
- **Gestión de entornos (RF-02):** registro, visualización y eliminación de nodos en llavero local (`AsyncStorage`), con URL de Cloudflare Tunnel como punto de conexión.
- **Telemetría en tiempo real (RF-03):** CPU%, RAM (usado/total en GB), temperatura del procesador vía `psutil`.
- **Control de contenedores (RF-04):** start, stop y restart de contenedores Docker remotos vía `docker-py`.
- **Logs de contenedores (RF-05):** lectura de las últimas 50 líneas de stdout/stderr.
- **Auditoría de seguridad (RF-06):** Risk Score sobre 100 con penalizaciones por ejecución como root (-15), red bridge/host (-10) y puertos expuestos (-15).
- Middleware FastAPI (`main.py`) con validación de JWT de Firebase en cada endpoint.
- `docker-compose.yml` del Middleware con montaje de `docker.sock` y `/sys`.
- Pantallas: `LoginScreen`, `ServerListScreen`, `DashboardScreen`, `LogsScreen`, `AuditScreen`, `RadialMenuScreen`.
- Navegación con Native Stack Navigator v7 y Menú Radial como modal transparente.
- Documentación: `alcance.txt` (RF-01 a RF-06, RNF, backlog), `doctecnico.txt`, `TEAMCHART.md`, `CONTRIBUTING.md`, `IA Skills.md`.

---

*Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).*
