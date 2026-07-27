import os

import docker
import psutil
import requests
import firebase_admin
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import credentials, auth

# --- CONFIGURACIÓN DE SEGURIDAD ---
app = FastAPI(title="GALs Middleware API", version="1.0")
security = HTTPBearer()

# --- CONFIGURACIÓN DEL DIRECTORIO DE ENTORNOS (NUEVO EN E2) ---
REGISTRY_URL = os.environ.get("REGISTRY_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SERVICE_KEY", "")
ENVIRONMENT_ID = os.environ.get("ENVIRONMENT_ID", "")

# Inicializar Firebase Admin SDK con la llave privada de Google
try:
    # Asegurate de que 'firebase-key.json' esté en la misma carpeta que este archivo
    cred = credentials.Certificate("firebase-key.json")
    firebase_admin.initialize_app(cred)
    print("Firebase Admin inicializado correctamente. Autenticación delegada a Google.")
except Exception as e:
    print(f"Error cargando Firebase: {e}")

# --- CONEXIÓN A DOCKER ---
try:
    client = docker.from_env()
except Exception as e:
    print(f"Error conectando a Docker: {e}")
    client = None

# --- MIDDLEWARE DE AUTENTICACIÓN ZERO TRUST ---
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Valida el JWT de Firebase preguntándole a los servidores de Google."""
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token
    except Exception as e:
        print(f"Error de validación OAuth2: {e}")
        raise HTTPException(status_code=401, detail="Token de Firebase inválido o expirado")


# --- VERIFICACIÓN DE ROL CONTRA EL DIRECTORIO (E2) ---
def get_role_from_registry(uid: str):
    """
    Consulta al Directorio de Entornos (gals-registry) para resolver el rol
    del uid sobre ESTE nodo (ENVIRONMENT_ID). Fail-closed: cualquier error
    de configuración, red o respuesta inesperada se trata como "sin rol",
    nunca como acceso permitido.
    """
    if not REGISTRY_URL or not ENVIRONMENT_ID or not SERVICE_KEY:
        print("ADVERTENCIA: REGISTRY_URL / ENVIRONMENT_ID / SERVICE_KEY no configurados. Denegando por defecto.")
        return None

    try:
        res = requests.get(
            f"{REGISTRY_URL}/environments/{ENVIRONMENT_ID}/role",
            params={"uid": uid},
            headers={"X-Service-Key": SERVICE_KEY},
            timeout=2,
        )
        if res.status_code != 200:
            return None
        return res.json().get("role")
    except requests.RequestException as e:
        print(f"No se pudo contactar al Directorio de Entornos: {e}")
        return None


def require_role(allowed_roles: list):
    """
    Fábrica de dependencias de FastAPI: exige que el uid autenticado tenga
    uno de los roles permitidos sobre el entorno de este nodo.
    """
    def dependency(token: dict = Depends(verify_token)):
        uid = token["uid"]
        role = get_role_from_registry(uid)
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="No tenés permisos sobre este entorno")
        return token
    return dependency


READ_ROLES = ["administrador", "operador"]
ADMIN_ONLY = ["administrador"]

# --- ENDPOINTS PÚBLICOS ---
@app.get("/")
def health_check():
    return {"status": "online", "service": "GALs Middleware", "auth": "Firebase OAuth2"}

# --- ENDPOINTS PROTEGIDOS (Requieren rol válido sobre este entorno) ---

@app.get("/containers", dependencies=[Depends(require_role(READ_ROLES))])
def list_containers():
    """
    Lista todos los contenedores y su estado. Incluye exit_code para que el
    cliente pueda distinguir un contenedor detenido a propósito (exit_code 0)
    de uno que se cayó por error (exit_code != 0) — usado por las alertas
    de "interrupción inesperada de servicios" en la app.
    """
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")

    containers = client.containers.list(all=True)
    return {
        "containers": [
            {
                "id": c.short_id,
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else "Unknown",
                "exit_code": c.attrs.get("State", {}).get("ExitCode")
            } for c in containers
        ]
    }

@app.post("/containers/{container_id}/{action}", dependencies=[Depends(require_role(ADMIN_ONLY))])
def control_container(container_id: str, action: str):
    """Ejecuta start, stop o restart en un contenedor específico. Solo Administrador."""
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")

    if action not in ["start", "stop", "restart"]:
        raise HTTPException(status_code=400, detail="Acción no permitida. Usar: start, stop, restart")

    try:
        container = client.containers.get(container_id)
        getattr(container, action)()
        container.reload()
        return {"message": f"Contenedor {container_id} -> {action}", "new_status": container.status}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Contenedor no encontrado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/containers/{container_id}/logs", dependencies=[Depends(require_role(READ_ROLES))])
def get_logs(container_id: str):
    """Obtiene las últimas 50 líneas de logs del contenedor."""
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=50, stdout=True, stderr=True).decode("utf-8")
        return {"container": container_id, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics", dependencies=[Depends(require_role(READ_ROLES))])
def get_hardware_metrics():
    """Lee la telemetría del host."""
    try:
        metrics = {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "ram_percent": psutil.virtual_memory().percent,
            "ram_used_gb": round(psutil.virtual_memory().used / (1024**3), 2),
            "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2)
        }

        try:
            temps = psutil.sensors_temperatures()
            if temps and 'cpu_thermal' in temps:
                metrics["cpu_temp_c"] = temps['cpu_thermal'][0].current
            elif temps and 'coretemp' in temps:
                 metrics["cpu_temp_c"] = temps['coretemp'][0].current
        except:
            metrics["cpu_temp_c"] = "N/A"

        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/audit", dependencies=[Depends(require_role(READ_ROLES))])
def run_security_audit():
    """Analiza la topología y privilegios para calcular el Risk Score."""
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")

    containers = client.containers.list(all=True)
    audit_results = []
    total_score = 100

    for c in containers:
        try:
            attrs = c.attrs
            warnings = []
            risk_penalty = 0

            user = attrs['Config'].get('User', '')
            if not user or user == 'root' or user == '0':
                warnings.append("Ejecutando como ROOT")
                risk_penalty += 15

            net_mode = attrs['HostConfig'].get('NetworkMode', '')
            if net_mode in ['bridge', 'host']:
                warnings.append(f"Red no aislada ({net_mode})")
                risk_penalty += 10

            ports = attrs['HostConfig'].get('PortBindings')
            if ports:
                warnings.append(f"Puertos expuestos al Host")
                risk_penalty += 15

            if warnings:
                audit_results.append({
                    "name": c.name,
                    "warnings": warnings,
                    "penalty": risk_penalty
                })
                total_score -= risk_penalty

        except Exception as e:
            print(f"Error auditando {c.name}: {e}")

    final_score = max(0, total_score)

    return {
        "risk_score": final_score,
        "details": audit_results
    }

@app.get("/topology", dependencies=[Depends(require_role(READ_ROLES))])
def get_network_topology():
    """Construye el Grafo de Dependencias de Red del nodo."""
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")

    networks = client.networks.list()
    containers = client.containers.list(all=True)

    nodes = []
    edges = []

    for net in networks:
        nodes.append({
            "id": f"net_{net.short_id}",
            "type": "network",
            "label": net.name,
            "driver": net.attrs.get("Driver", "unknown"),
            "is_exposed": net.name in ["bridge", "host"]
        })

    for c in containers:
        try:
            nodes.append({
                "id": f"cnt_{c.short_id}",
                "type": "container",
                "label": c.name,
                "status": c.status
            })

            container_networks = c.attrs.get("NetworkSettings", {}).get("Networks", {})
            for net_name in container_networks.keys():
                matching_net = next((n for n in networks if n.name == net_name), None)
                if matching_net:
                    edges.append({
                        "source": f"cnt_{c.short_id}",
                        "target": f"net_{matching_net.short_id}",
                        "exposed": net_name in ["bridge", "host"]
                    })
        except Exception as e:
            print(f"Error mapeando topología de {c.name}: {e}")

    return {"nodes": nodes, "edges": edges}