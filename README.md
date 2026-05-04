# GAL-Security

GAL Security es una aplicación móvil diseñada para la administración remota y auditoría de seguridad de infraestructuras privadas con contenedores Docker , utilizando una arquitectura Zero Trust mediante túneles seguros que eliminan la necesidad de exponer puertos a internet. El sistema permite gestionar el ciclo de vida de los servicios (encendido, apagado, reinicio) y visualizar telemetría de hardware en tiempo real , integrando además un motor de auditoría que mapea redes virtuales, detecta puertos expuestos innecesariamente y genera un índice de riesgo basado en privilegios de ejecución. Desarrollada con React Native en el frontend y un middleware en Python o Node.js , la plataforma garantiza un control centralizado y seguro de entornos múltiples sin comprometer la integridad del servidor host.

### Integrantes:

|Apellido|Nombre|
|-|-|
|Marini|Alvaro|
|Chiappini|Valentino|
|Wilt|Juan Ignacio|
|Oyarzo|Gabriel Francisco|
|Castrosin|Ignacio|
|Alvarez Pieroni|Federico|

A continuación, se presenta la estructura completa del archivo `README.md` redactada con rigor técnico, lista para ser incorporada en el repositorio del proyecto. Este documento unifica la arquitectura distribuida del sistema y detalla los procedimientos de despliegue tanto para el agente remoto como para el cliente móvil.

---

##  Arquitectura del Sistema

El ecosistema se compone de tres pilares fundamentales:

1. **Middleware (Agente Local):** Servicio en Python que se ejecuta en el nodo remoto (ej. Raspberry Pi, VPS). Se comunica de forma nativa con el *Unix Socket* de Docker y expone una API REST interna.

2. **Capa de Red (Túneles Inversos):** Utilización de Cloudflare Tunnels para establecer una conexión *outbound* cifrada desde el nodo hacia internet, evadiendo el NAT y ofuscando la IP real del servidor.

3. **Cliente Móvil (React Native):** Aplicación Android que delega la autenticación a Firebase (OAuth2). Despacha peticiones HTTP firmadas con tokens JWT hacia la URL del túnel.

---

##  Prerrequisitos

Antes de iniciar la instalación, asegúrese de contar con lo siguiente:

* **Para el Servidor (Nodo):** Sistema operativo Linux, Docker Engine, Python 3.8+ y el demonio `cloudflared` instalado.

* **Para el Cliente Móvil:** Entorno de desarrollo de React Native (Node.js, JDK 17, Android Studio).

* **Servicios Externos:** Proyecto en Firebase con autenticación de Google habilitada y una cuenta de Cloudflare.

---

##  Fase 1: Despliegue del Middleware (Servidor)


El agente local debe ejecutarse en el mismo entorno donde residen los contenedores a administrar.

### 1. Clonación e inicialización

```bash

git clone <URL_DEL_REPOSITORIO>

cd gals-security/middleware

```

### Crear y activar entorno virtual
```bash
python3 -m venv venv

source venv/bin/activate
```


### Instalar dependencias (FastAPI, docker, psutil, uvicorn)
```bash
pip install -r requirements.txt

```

### 2. Permisos del Socket de Docker

El middleware requiere acceso al socket para enviar instrucciones. Asegúrese de que el usuario que ejecuta el script pertenezca al grupo `docker`:

```bash
sudo usermod -aG docker $USER
```

### 3. Ejecución del Agente

```bash
# Iniciar el servidor local (por defecto en el puerto 8000)

uvicorn main:app --host 0.0.0.0 --port 8000
```

*Nota: En producción, se recomienda configurar este script como un servicio de `systemd` para garantizar su persistencia ante reinicios del host.*

---

##  Fase 2: Configuración de la Red (Cloudflare Tunnel)

Para exponer el Middleware de forma segura sin abrir puertos en el router:

### 1. Autenticar el servidor con Cloudflare
```bash
cloudflared tunnel login
```

### 2. Crear el túnel
```bash
cloudflared tunnel create gals-tunnel
```

### 3. Enrutar el tráfico del túnel hacia el middleware local
```bash
cloudflared tunnel route dns gals-tunnel api.midominio.com
```

### 4. Ejecutar el túnel apuntando al puerto del middleware
```bash
cloudflared tunnel run --url http://localhost:8000 gals-tunnel
```

**Importante:** Guarde la URL pública generada (ej. `https://api.midominio.com`). Esta será la dirección que ingresará en el "Llavero de Entornos" de la aplicación móvil. **No incluya una barra final (`/`) al guardar la URL en la app para evitar errores de ruteo (HTTP 404).**

---

##  Fase 3: Despliegue de la Aplicación Móvil (Cliente)



### 1. Instalación de dependencias

```bash
cd gals-security/mobile-app

npm install

# o

yarn install
```



### 2. Configuración de Firebase y Variables de Entorno

1. Descargue el archivo `google-services.json` desde la consola de Firebase y colóquelo en el directorio `android/app/`.

2. Cree un archivo `.env` en la raíz del proyecto móvil y defina su ID de cliente web:

```env
GOOGLE_WEB_CLIENT_ID="su-client-id-de-google-cloud.apps.googleusercontent.com"
```



### 3. Compilación y Ejecución

Conecte un dispositivo físico o inicie un emulador de Android y ejecute:

```bash
npx react-native run-android
```

---

## Uso y Flujo Operativo (MVP - Entrega 1)

1. **Autenticación Delegada:** Inicie sesión utilizando su cuenta de Google. El sistema generará un JWT firmado.

2. **Vinculación de Nodo:** Ingrese al Llavero y registre un nuevo servidor utilizando un nombre identificatorio y la URL segura del túnel de Cloudflare. Los datos se persistirán localmente y de forma aislada mediante `AsyncStorage`.

3. **Monitorización (Dashboard):** Al seleccionar el nodo, visualizará la telemetría del hardware subyacente (CPU, RAM, Temperatura) y el estado del ciclo de vida de los contenedores alojados.

4. **Control y Auditoría:** Utilice los botones de acción para alterar el estado de los contenedores (Start/Stop/Restart), consultar la salida estándar (Logs) o invocar el motor de Auditoría Zero Trust para analizar riesgos de red y configuración en la topología del servidor.



---

**Universidad Tecnológica Nacional - Facultad Regional La Plata**  

*Desarrollo de Aplicaciones Móviles - Trabajo Integrador 2026*

```<https://github.com/Juaniip/Desarrollo-Mobile-GAL-Security.git>```