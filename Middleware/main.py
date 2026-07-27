import os

import docker
import psutil
import requests
import firebase_admin
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import credentials, auth
from pydantic import BaseModel

app = FastAPI(title="GALs Middleware API", version="2.0")
security = HTTPBearer()

REGISTRY_URL = os.environ.get("REGISTRY_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SERVICE_KEY", "")
ENVIRONMENT_ID = os.environ.get("ENVIRONMENT_ID", "")

try:
    cred = credentials.Certificate("firebase-key.json")
    firebase_admin.initialize_app(cred)
    print("Firebase Admin inicializado correctamente. Autenticación delegada a Google.")
except Exception as e:
    print(f"Error cargando Firebase: {e}")

try:
    client = docker.from_env()
except Exception as e:
    print(f"Error conectando a Docker: {e}")
    client = None


# --- AUTENTICACIÓN ---
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        return auth.verify_id_token(credentials.credentials)
    except Exception as e:
        print(f"Error de validación OAuth2: {e}")
        raise HTTPException(status_code=401, detail="Token de Firebase inválido o expirado")


# --- AUTORIZACIÓN ---
def get_role_from_registry(uid: str):
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
    def dependency(token: dict = Depends(verify_token)):
        uid = token["uid"]
        role = get_role_from_registry(uid)
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="No tenés permisos sobre este entorno")
        return token
    return dependency


READ_ROLES = ["administrador", "operador"]
ADMIN_ONLY = ["administrador"]


# --- MODELOS ---
class EnvVarsBody(BaseModel):
    env_vars: dict[str, str]


# --- ENDPOINTS PÚBLICOS ---
@app.get("/")
def health_check():
    return {"status": "online", "service": "GALs Middleware", "version": "2.0", "auth": "Firebase OAuth2"}


# --- ENDPOINTS PROTEGIDOS ---

@app.get("/containers", dependencies=[Depends(require_role(READ_ROLES))])
def list_containers():
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
                "exit_code": c.attrs.get("State", {}).get("ExitCode"),
            }
            for c in containers
        ]
    }


@app.post("/containers/{container_id}/{action}", dependencies=[Depends(require_role(ADMIN_ONLY))])
def control_container(container_id: str, action: str):
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
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=50, stdout=True, stderr=True).decode("utf-8")
        return {"container": container_id, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics", dependencies=[Depends(require_role(READ_ROLES))])
def get_hardware_metrics():
    try:
        metrics = {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "ram_percent": psutil.virtual_memory().percent,
            "ram_used_gb": round(psutil.virtual_memory().used / (1024**3), 2),
            "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
        }
        try:
            temps = psutil.sensors_temperatures()
            if temps and "cpu_thermal" in temps:
                metrics["cpu_temp_c"] = temps["cpu_thermal"][0].current
            elif temps and "coretemp" in temps:
                metrics["cpu_temp_c"] = temps["coretemp"][0].current
        except:
            metrics["cpu_temp_c"] = "N/A"
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/audit", dependencies=[Depends(require_role(READ_ROLES))])
def run_security_audit():
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
            user = attrs["Config"].get("User", "")
            if not user or user in ("root", "0"):
                warnings.append("Ejecutando como ROOT")
                risk_penalty += 15
            net_mode = attrs["HostConfig"].get("NetworkMode", "")
            if net_mode in ("bridge", "host"):
                warnings.append(f"Red no aislada ({net_mode})")
                risk_penalty += 10
            ports = attrs["HostConfig"].get("PortBindings")
            if ports:
                warnings.append("Puertos expuestos al Host")
                risk_penalty += 15
            if warnings:
                audit_results.append({"name": c.name, "warnings": warnings, "penalty": risk_penalty})
                total_score -= risk_penalty
        except Exception as e:
            print(f"Error auditando {c.name}: {e}")
    return {"risk_score": max(0, total_score), "details": audit_results}


@app.get("/topology", dependencies=[Depends(require_role(READ_ROLES))])
def get_network_topology():
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")
    networks = client.networks.list()
    containers = client.containers.list(all=True)
    nodes, edges = [], []
    for net in networks:
        nodes.append({
            "id": f"net_{net.short_id}", "type": "network",
            "label": net.name, "driver": net.attrs.get("Driver", "unknown"),
            "is_exposed": net.name in ("bridge", "host"),
        })
    for c in containers:
        try:
            nodes.append({"id": f"cnt_{c.short_id}", "type": "container", "label": c.name, "status": c.status})
            for net_name in c.attrs.get("NetworkSettings", {}).get("Networks", {}).keys():
                matching = next((n for n in networks if n.name == net_name), None)
                if matching:
                    edges.append({
                        "source": f"cnt_{c.short_id}", "target": f"net_{matching.short_id}",
                        "exposed": net_name in ("bridge", "host"),
                    })
        except Exception as e:
            print(f"Error mapeando topología de {c.name}: {e}")
    return {"nodes": nodes, "edges": edges}


# ============================================================
# ENDPOINTS DE VARIABLES DE ENTORNO (E3)
# ============================================================

@app.get("/containers/{container_id}/env", dependencies=[Depends(require_role(ADMIN_ONLY))])
def get_env_vars(container_id: str):
    """
    Devuelve las variables de entorno actuales del contenedor.
    Solo visible para el Administrador del entorno.
    """
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")
    try:
        container = client.containers.get(container_id)
        raw_env = container.attrs.get("Config", {}).get("Env") or []
        # Las variables vienen como ["CLAVE=valor", ...] — las parseamos a dict
        env_dict = {}
        for entry in raw_env:
            if "=" in entry:
                key, _, value = entry.partition("=")
                env_dict[key] = value
        return {"container_id": container_id, "env_vars": env_dict}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Contenedor no encontrado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/containers/{container_id}/env", dependencies=[Depends(require_role(ADMIN_ONLY))])
def update_env_vars(container_id: str, body: EnvVarsBody):
    """
    Actualiza las variables de entorno de un contenedor recreándolo con
    la nueva configuración. El contenedor se detiene, se elimina y se
    vuelve a crear con la misma imagen, puertos y volúmenes, pero con
    las nuevas variables de entorno.

    ADVERTENCIA: el contenedor debe estar detenido o será detenido
    automáticamente antes de recrearse.
    """
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")
    try:
        container = client.containers.get(container_id)
        attrs = container.attrs

        # Tomamos la configuración actual del contenedor para recrearlo fielmente
        image = attrs["Config"]["Image"]
        name = attrs["Name"].lstrip("/")
        ports = attrs["HostConfig"].get("PortBindings") or {}
        volumes = attrs["HostConfig"].get("Binds") or []
        network_mode = attrs["HostConfig"].get("NetworkMode", "bridge")
        restart_policy = attrs["HostConfig"].get("RestartPolicy", {})

        # Convertimos el dict de variables al formato ["CLAVE=valor", ...]
        new_env = [f"{k}={v}" for k, v in body.env_vars.items()]

        # Detenemos y eliminamos el contenedor viejo
        if container.status == "running":
            container.stop(timeout=10)
        container.remove()

        # Recreamos el contenedor con las nuevas variables
        new_container = client.containers.run(
            image=image,
            name=name,
            environment=new_env,
            ports=ports if ports else None,
            volumes=volumes if volumes else None,
            network_mode=network_mode,
            restart_policy=restart_policy if restart_policy.get("Name") else None,
            detach=True,
        )

        return {
            "message": f"Contenedor '{name}' recreado con las nuevas variables de entorno.",
            "new_container_id": new_container.short_id,
            "status": new_container.status,
        }
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Contenedor no encontrado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
