from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import docker
import psutil
import firebase_admin
from firebase_admin import credentials, auth

# --- CONFIGURACIÓN DE SEGURIDAD ---
app = FastAPI(title="GALs Middleware API", version="1.0")
security = HTTPBearer()

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
        # verify_id_token se conecta con Google para asegurar que el token es 100% real
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token
    except Exception as e:
        print(f"Error de validación OAuth2: {e}")
        raise HTTPException(status_code=401, detail="Token de Firebase inválido o expirado")

# --- ENDPOINTS PÚBLICOS ---
@app.get("/")
def health_check():
    return {"status": "online", "service": "GALs Middleware", "auth": "Firebase OAuth2"}

# --- ENDPOINTS PROTEGIDOS (Requieren JWT válido de Google/Firebase) ---

@app.get("/containers", dependencies=[Depends(verify_token)])
def list_containers():
    """Lista todos los contenedores y su estado."""
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")
    
    containers = client.containers.list(all=True)
    return {
        "containers": [
            {
                "id": c.short_id,
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else "Unknown"
            } for c in containers
        ]
    }

@app.post("/containers/{container_id}/{action}", dependencies=[Depends(verify_token)])
def control_container(container_id: str, action: str):
    """Ejecuta start, stop o restart en un contenedor específico."""
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")
    
    if action not in ["start", "stop", "restart"]:
        raise HTTPException(status_code=400, detail="Acción no permitida. Usar: start, stop, restart")

    try:
        container = client.containers.get(container_id)
        # Ejecutamos dinámicamente el método (ej: container.start())
        getattr(container, action)()
        
        # Recargamos el estado para confirmar
        container.reload()
        return {"message": f"Contenedor {container_id} -> {action}", "new_status": container.status}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Contenedor no encontrado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/containers/{container_id}/logs", dependencies=[Depends(verify_token)])
def get_logs(container_id: str):
    """Obtiene las últimas 50 líneas de logs del contenedor."""
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=50, stdout=True, stderr=True).decode("utf-8")
        return {"container": container_id, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics", dependencies=[Depends(verify_token)])
def get_hardware_metrics():
    """Lee la telemetría del host."""
    try:
        metrics = {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "ram_percent": psutil.virtual_memory().percent,
            "ram_used_gb": round(psutil.virtual_memory().used / (1024**3), 2),
            "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2)
        }
        
        # Intentamos leer la temperatura (si el SO lo soporta)
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

@app.get("/audit", dependencies=[Depends(verify_token)])
def run_security_audit():
    """Analiza la topología y privilegios para calcular el Risk Score."""
    if not client:
        raise HTTPException(status_code=500, detail="Docker no conectado")
    
    containers = client.containers.list(all=True)
    audit_results = []
    total_score = 100 # Empezamos con calificación perfecta

    for c in containers:
        try:
            attrs = c.attrs
            warnings = []
            risk_penalty = 0

            # 1. Auditoría de Privilegios (Root)
            user = attrs['Config'].get('User', '')
            if not user or user == 'root' or user == '0':
                warnings.append("Ejecutando como ROOT")
                risk_penalty += 15

            # 2. Auditoría de Red (Zero Trust Check)
            net_mode = attrs['HostConfig'].get('NetworkMode', '')
            if net_mode in ['bridge', 'host']:
                warnings.append(f"Red no aislada ({net_mode})")
                risk_penalty += 10

            # 3. Auditoría de Puertos Expuestos (Bind Mounts)
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

    # El score no puede ser menor a 0
    final_score = max(0, total_score)

    return {
        "risk_score": final_score,
        "details": audit_results
    }
