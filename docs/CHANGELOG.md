# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.0.0] - MVP (Entrega 1) - 2026-05-03

### Added (Añadido)
- **Middleware (Python):** API REST local para comunicación directa con el demonio de Docker vía Unix Socket.
- **Middleware (Métricas):** Motor de extracción de telemetría de hardware en tiempo real (CPU, RAM, Temperatura térmica).
- **Mobile (Autenticación):** Sistema de inicio de sesión *Identity-First* delegado en Google Firebase (OAuth2) con emisión de JWT.
- **Mobile (Llavero):** Persistencia local cifrada (`AsyncStorage`) para almacenar credenciales y URLs seguras de túneles Cloudflare.
- **Mobile (Dashboard):** Panel de control remoto para mutación de estado de contenedores (Start, Stop, Restart).
- **Mobile (Auditoría):** Motor de análisis estático *Zero Trust* para calcular el nivel de exposición de red y privilegios (*Risk Score*).
- **Mobile (Logs):** Consola remota para lectura de salida estándar (`stdout`/`stderr`) de los contenedores alojados.
- **Infraestructura:** Archivos `Dockerfile` y `docker-compose.yml` para el empaquetado del agente local.

### Security (Seguridad)
- Implementación de arquitectura evasiva de NAT mediante *Cloudflare Tunnels*, eliminando la necesidad de exponer puertos entrantes.
- Validación por *Bearer Token* exigida en todos los endpoints del middleware.
