# ==============================================================================
# ARCHIVO DE EXPORTACIÓN DE IA (.dm) - TRABAJO INTEGRADOR GALs SECURITY
# PROYECTO: GALs Security - Entrega 3 (Producto Final Escalado)
# ==============================================================================

## ÍNDICE DE TEMAS CONSULTADOS (ACUMULADO E1 + E2 + E3)

### Entrega 1
1. Decisión de tecnología y stack (React Native, FastAPI, Firebase Auth, Cloudflare Tunnels).
2. Documento de Alcance E1 (RF-01 a RF-06, RNF, historias de usuario).
3. Documentación Técnica E1 (diagrama de navegación, decisiones de librería).
4. Implementación del Middleware (FastAPI + docker-py + psutil + firebase-admin).
5. Pantallas E1: LoginScreen, ServerListScreen, DashboardScreen, LogsScreen, AuditScreen, RadialMenuScreen.
6. Script de charla de seguridad en LINSI (SYN Flood, MitM, Kali Linux sandbox).

### Entrega 2
7. Lectura y comprensión del repositorio E1 (repomix completo) y la Guía de Trabajo Integrador 2026.
8. Documento de Alcance E2 — Changelog de RF (RF-07 RBAC, RF-10 Compartir Entornos), User Stories nuevas, gestión de excepciones y validaciones.
9. Documentación Técnica E2 — arquitectura del Directorio de Entornos, endpoints, decisiones de refactor, deuda técnica.
10. Implementación del Grafo de Dependencias de Red (endpoint /topology + NetworkGraphScreen sin dependencias nuevas).
11. Diseño e implementación del microservicio gals-registry (FastAPI + SQLite, tabla environments + collaborators).
12. Implementación de RBAC en el Middleware (require_role, fail-closed, verificación contra el Directorio).
13. Actualización de ServerListScreen (compartir / revocar / eliminar entornos contra el Registro).
14. Troubleshooting de build Android: cache de Gradle por renombre de carpeta, cache de transforms corrupta, módulo no resuelto.
15. Troubleshooting de Cloudflare Tunnels: descubrimiento de que el enrutamiento real corre como servicio systemd centralizado (túnel "raspberry-pi-5"); corrección de Service URL y puertos publicados al host.
16. Debugging de versión desactualizada del Registry (endpoint DELETE inexistente → 404).
17. Debugging de ENVIRONMENT_ID huérfano tras borrar accidentalmente el entorno de prueba.
18. DashboardScreen con gating visual de controles según rol (Administrador / Operador).
19. Bug de Google Sign-In: falta de GoogleSignin.signOut() al cerrar sesión → reingreso automático con misma cuenta.
20. Monitorización concurrente de múltiples nodos (telemetría en paralelo con Promise.allSettled).
21. Sistema de alertas in-app (umbrales CPU/RAM/temperatura + contenedores caídos por exit_code).
22. Generación de APK release (keystore, signingConfigs, SHA-1 en Firebase para Google Sign-In).
23. Limpieza de infraestructura redundante (túnel gals-tunnel duplicado en el Middleware).
24. Guion del video demo E2 (distribuido entre 6 integrantes, ~3 minutos).
25. Comandos de git por integrante para pushear a entrega-2 (con verificación de rama y archivos específicos).

### Entrega 3
26. Planificación de E3: decisión de alcance de las tres funcionalidades (organizaciones, variables de entorno, historial de telemetría).
27. Documento de Alcance Final consolidado (RF E1+E2+E3 con estado, Feature Map, User Stories completas).
28. Documentación Técnica Final consolidada (API completa, seguridad y tokens, performance, refactoring, deuda técnica actualizada).
29. gals-registry v2: tabla organizations, migración no-destructiva, endpoints de agrupación jerárquica (CRUD de organizaciones + asignación de entornos).
30. Middleware v2: endpoints GET y PUT de variables de entorno (/containers/{id}/env), recreación de contenedor con nueva configuración.
31. ServerListScreen E3: llavero con organizaciones colapsables, modal de asignación, modal de creación, integración con telemetría concurrente y alertas.
32. DashboardScreen E3: historial de telemetría con gráfico de línea (dibujado con Views posicionados, sin SVG nativo ni dependencias nuevas), botón ENV por contenedor.
33. EnvVarsScreen nueva: edición de variables de entorno en pares clave/valor, confirmación de recreación del contenedor.
34. App.tsx E3: registro de EnvVarsScreen en el stack de navegación.
35. Troubleshooting de emulador AVD sin espacio suficiente (INSTALL_FAILED_INSUFFICIENT_STORAGE): solución con celular físico.
36. Icono de la app: generación de assets en icon.kitchen y reemplazo de carpetas mipmap-*.
37. APK release E3: rebuild con nuevo SHA-1 de keystore en Firebase Console.

---

# ------------------------------------------------------------------------------
# [SESIÓN 1 — E1] PLANIFICACIÓN Y DOCUMENTACIÓN BASE
# ------------------------------------------------------------------------------
USER: Nuevo proyecto de app mobile para UTN, contexto del sistema GALs Security.
IA: Propuesta de stack (React Native + FastAPI + Firebase + Cloudflare), decisión de arquitectura Zero Trust en tres capas, generación de alcance E1 y doc técnica E1 con diagrama de navegación y decisiones de tecnología.

# ------------------------------------------------------------------------------
# [SESIÓN 2 — E1] IMPLEMENTACIÓN MVP
# ------------------------------------------------------------------------------
USER: Código del Middleware y pantallas del MVP.
IA: [Generación de] main.py (FastAPI, verify_token con firebase-admin, endpoints /containers, /containers/{id}/{action}, /containers/{id}/logs, /metrics, /audit con Risk Score), docker-compose.yml, y las 6 pantallas del MVP (Login con Google Sign-In, ServerList con llavero en AsyncStorage, Dashboard con telemetría + control de contenedores, LogsScreen, AuditScreen, RadialMenuScreen con transparentModal).

# ------------------------------------------------------------------------------
# [SESIÓN 3 — E2] ALCANCE Y DOC TÉCNICA E2
# ------------------------------------------------------------------------------
USER: Vamos con el Documento de Alcance — Actualización E2 completo.
IA: [Generación de alcance_e2.md] RF-07 (RBAC por entorno, no global), RF-10 (Compartir Entornos), modificación de RF-02 y RF-04, actualización de RNF-04. 4 User Stories con Given/When/Then. Tabla de excepciones (409 duplicado, 403 server-side, auto-revocación del único Admin bloqueada) y reglas de negocio explícitas. Decisión clave: rol como relación (uid, environment_id), no como claim global del JWT.

USER: Vamos con la doc_tecnica_e2.
IA: [Generación de doc_tecnica_e2.md] Hallazgo de seguridad de E1 (cualquier JWT válido podía operar cualquier nodo). Capa 4 "Directorio de Entornos" (FastAPI + SQLite, self-hosted en Pi, descartado Firestore por contradicción con filosofía Zero Trust). Flujo de autorización fail-closed (2s timeout, denegar por defecto). Tabla de endpoints del Registry y del Middleware actualizado. Decisiones de refactoring y deuda técnica (X-Service-Key estático, bootstrapping manual del ENVIRONMENT_ID, sin caché de rol con TTL).

# ------------------------------------------------------------------------------
# [SESIÓN 4 — E2] GRAFO DE DEPENDENCIAS DE RED
# ------------------------------------------------------------------------------
USER: Vamos con el Grafo de Dependencias de Red (de la sección "Valor Agregado Algorítmico").
IA: Sin dependencias nuevas (docker-py ya expone networks.list(), Views de RN ya soportan transformOrigin). [Generación de] endpoint /topology (grafo bipartito: nodo por red + nodo por contenedor + aristas de pertenencia, redes bridge/host marcadas como expuestas), NetworkGraphScreen (layout bipartito con líneas dibujadas vía Views rotados), actualización de RadialMenuScreen y App.tsx. Troubleshooting de builds fallidos (cache de Gradle por renombre de carpeta → clean + borrar android/build; cache de transforms corrupta → borrar ~/.gradle/caches/9.3.1/transforms; módulo no resuelto → copiar NetworkGraphScreen.tsx faltante).

# ------------------------------------------------------------------------------
# [SESIÓN 5 — E2] RBAC: gals-registry + Middleware
# ------------------------------------------------------------------------------
USER: ¿Dónde desplegamos el gals-registry? Explicame las opciones primero.
IA: Comparación Raspberry Pi (self-hosted, mismo patrón, single point of failure para el equipo) vs. servicio gestionado (Render/Railway, URL fija automática, más neutral para 6 personas). Recomendación: Pi, justificado por coherencia con la filosofía Zero Trust/self-hosted ya establecida.

USER: Dale, en mi Raspberry Pi.
IA: [Generación de] gals-registry/main.py (tablas environments + collaborators, endpoints create/list/share/revoke/delete, endpoint interno /role con X-Service-Key), requirements.txt, Dockerfile, docker-compose.yml. [Generación de] Middleware actualizado con require_role() como dependencia FastAPI (READ_ROLES y ADMIN_ONLY), get_role_from_registry() con timeout 2s y fail-closed.

# ------------------------------------------------------------------------------
# [SESIÓN 6 — E2] TROUBLESHOOTING CLOUDFLARE + DEBUGGING DE RBAC
# ------------------------------------------------------------------------------
USER: No tengo ~/.cloudflared/ — el tunnel del Middleware lo armé por token del dashboard.
IA: Corrección: método de token no usa archivos locales. Flujo por dashboard de Cloudflare Zero Trust (Networks → Tunnels → token → Public Hostname). Generación de docker-compose del Registry con token variable de entorno.

USER: [Screenshot de Cloudflare] Un solo túnel "raspberry-pi-5" con 6 rutas.
IA: Diagnóstico corregido: el tunnel central corre como servicio systemd del host (systemctl status cloudflared), no en Docker. El contenedor cloudflared no puede resolver nombres de contenedor de otras redes. Solución: eliminar túnel propio del Registry, publicar puerto al host (8088:8086 — 8086 ocupado), cambiar Service URL en dashboard a http://localhost:8088.

USER: [403 al conectar tras activar RBAC] Logs cruzados: el Registry devuelve 200 en /role pero el environment_id en el .env del Middleware corresponde a un entorno que fue borrado durante las pruebas.
IA: Diagnóstico por logs cruzados. Recuperación del ID vigente directo de SQLite con docker exec. Corrección del .env del Middleware. Posterior 502 por docker-compose sin ports: ["8085:8085"] — restaurado.

USER: ¿Por qué tengo un gals-tunnel? ¿Lo borro?
IA: Confirmación: túnel propio del Middleware redundante (el routing real pasa por el systemd central). Se elimina del docker-compose con --remove-orphans.

# ------------------------------------------------------------------------------
# [SESIÓN 7 — E2] DASHBOARD POR ROL, BUG DE LOGIN, MULTI-NODO Y ALERTAS
# ------------------------------------------------------------------------------
USER: DashboardScreen con gating por rol.
IA: [Generación de] DashboardScreen con isAdmin flag, botones Start/Stop/Restart no renderizados (no solo disabled) para Operador, banner de modo solo lectura, badge de rol en header, guarda defensiva del lado del cliente. Actualización de tipos en App.tsx.

USER: No puedo probar otra cuenta, el login cachea la misma cuenta de Google.
IA: Bug: auth().signOut() no limpia la caché nativa de Google Sign-In. Fix: agregar GoogleSignin.signOut() antes del signOut de Firebase en RadialMenuScreen.handleLogout.

USER: Monitorización concurrente de todos los nodos.
IA: [Actualización de ServerListScreen] fetchTelemetry() con Promise.allSettled (no Promise.all — un nodo caído no aborta los demás), badge de estado online/offline, pull-to-refresh.

USER: Notificación dentro de la app.
IA: [Actualización de Middleware] /containers ahora devuelve exit_code para distinguir contenedor detenido (exit 0) de caído por error (exit ≠ 0). [Actualización de ServerListScreen] umbrales CPU/RAM/temperatura, deduplicación de alertas con useRef (no useState — evita re-renders), banner en card + Alert popup la primera vez que aparece una condición nueva.

# ------------------------------------------------------------------------------
# [SESIÓN 8 — E2] APK, ÍCONOS, COMMITS Y CIERRE DE E2
# ------------------------------------------------------------------------------
USER: ¿Cómo genero un APK para pasar a otros celulares?
IA: Distinción debug (necesita Metro corriendo) vs. release (JS empaquetado, standalone). Generación de keystore con keytool, configuración de signingConfigs en android/app/build.gradle, assembleRelease. Troubleshooting de Google Sign-In fallando en APK release: agregar SHA-1 del keystore de release a Firebase Console y descargar google-services.json actualizado.

USER: ¿Cómo le pongo un ícono a la app?
IA: Generación en icon.kitchen o Android Asset Studio, reemplazo de carpetas mipmap-* en android/app/src/main/res/, rebuild nativo requerido.

USER: Video demo E2 y guion distribuido entre 6 integrantes.
IA: [Generación de guion_demo_e2.md] 6 bloques de ~30s distribuidos por integrante, con indicaciones de pantalla. Checklist pre-grabación.

USER: Comandos de git para pushear a entrega-2 entre los 6.
IA: [Generación de bloques por integrante] con git checkout, verificación de rama, archivos específicos por persona, commit semántico y push. Troubleshooting de rama remota inexistente (git checkout -b + git push -u), cache con ruta vieja, conflicts de pull paralelo, archivo untracked bloqueando merge.

# ------------------------------------------------------------------------------
# [SESIÓN 9 — E3] PLANIFICACIÓN Y DOCUMENTACIÓN FINAL
# ------------------------------------------------------------------------------
USER: Vamos con la Entrega 3 (Expansión Vertical). Las organizaciones pueden ser carpetas en el llavero.
IA: Validación de que carpetas en el llavero = expansión vertical real ("agrupación jerárquica bajo una nueva entidad"). Decisión de alcance: implementar las 3 funcionalidades (organizaciones, variables de entorno, historial de telemetría con gráfico simple). Descarte de modificación de reglas de red en caliente y push notifications FCM como postergados con justificación.

USER: Vamos con alcance_final y doc_tecnica_final.
IA: [Generación de alcance_final.md] Listado completo de RF E1+E2+E3 con estado (Completado/Postergado), Feature Map en árbol ASCII, User Stories consolidadas de las 3 entregas con criterios de aceptación verificados. [Generación de doc_tecnica_final.md] API completa de ambos servicios en formato tabla, política de sesiones y tokens, validaciones client-side y server-side, performance (Promise.allSettled, useRef para alertas, decisión de no persistir histórico entre sesiones), decisiones de refactoring por entrega, deuda técnica con estado actualizado en E3.

# ------------------------------------------------------------------------------
# [SESIÓN 10 — E3] CÓDIGO: REGISTRY V2 + MIDDLEWARE V2 + PANTALLAS
# ------------------------------------------------------------------------------
USER: Seguimos con el código de E3.
IA: [Generación de] gals-registry/main.py v2 (tabla organizations nueva, migración no-destructiva con ALTER TABLE + try/except, endpoints POST/GET/PUT/DELETE /organizations, PUT /environments/{id}/organization para asignación). [Generación de] Middleware/main.py v2 (endpoints GET /containers/{id}/env — parseo de variables "CLAVE=valor" a dict — y PUT /containers/{id}/env — detener/eliminar/recrear contenedor con nuevas variables preservando imagen, puertos, volúmenes y red). [Generación de] ServerListScreen E3 (organizaciones colapsables, modal de nueva organización, modal de asignación a organización, integración con telemetría y alertas previas, sección "Sin organización" para entornos no agrupados). [Generación de] DashboardScreen E3 (TelemetryGraph con Views posicionados y rotados — sin SVG nativo, sin dependencias nuevas —, acumulación de hasta 20 muestras en useState, botón ENV por contenedor solo para Admin). [Generación de] EnvVarsScreen nueva (FlatList de pares clave/valor editables, agregar/eliminar variables, confirmación explícita antes de recrear el contenedor, KeyboardAvoidingView). [Generación de] App.tsx E3 (EnvVarsScreen registrada con parámetros containerId y containerName).

USER: [INSTALL_FAILED_INSUFFICIENT_STORAGE en el emulador]
IA: El AVD no tiene espacio para instalar el APK. Solución inmediata: usar celular físico (adb reverse tcp:8081 tcp:8081 + adb install directo del APK ya compilado). Alternativa: ampliar Internal Storage del AVD a 4096MB desde Device Manager de Android Studio.

USER: FUNCIONA PERFECTO!
IA: Confirmación de E3 completa y funcional.

# ------------------------------------------------------------------------------
# SKILLS / CATEGORÍAS DE USO DE IA — ACUMULADO E1 + E2 + E3
# ------------------------------------------------------------------------------
- Generación de código backend (Python / FastAPI / SQLite / docker-py / psutil) y frontend (React Native / TypeScript).
- Diseño de arquitectura distribuida (Zero Trust, RBAC multi-servicio, microservicio Registry, principio fail-closed, migración no-destructiva de base de datos).
- Redacción de documentación técnica formal (alcance con RF/RNF/US, doc técnica con API, seguridad, performance y deuda técnica).
- Debugging iterativo de infraestructura real a partir de logs y capturas de pantalla: Docker, Cloudflare Tunnels, Gradle/Android, Google Sign-In, emulador AVD. No fue debugging simulado — resolución en vivo sobre la Raspberry Pi del equipo.
- Diagnóstico de discrepancias entre el repositorio académico y el despliegue real en producción (ej. túnel systemd no documentado en el repo).
- Generación de guiones de demo y materiales de entrega (guion de video, comandos de git por integrante, documentos de alcance y técnicos).
- Diseño de soluciones sin dependencias nuevas (gráfico de telemetría con Views/transform, grafo de topología con el mismo patrón) para evitar rebuilds nativos innecesarios.

# [FIN DEL HISTORIAL — EXPORTACIÓN FINAL E1 + E2 + E3]
