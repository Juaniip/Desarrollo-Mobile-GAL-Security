import os
import secrets
import sqlite3

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, auth

app = FastAPI(title="GALs Registry", version="1.0")
security = HTTPBearer()

DB_PATH = os.environ.get("REGISTRY_DB_PATH", "/app/data/registry.db")
SERVICE_KEY = os.environ.get("SERVICE_KEY", "")

# --- FIREBASE ADMIN (mismo proyecto que el Middleware, misma firebase-key.json) ---
try:
    cred = credentials.Certificate("firebase-key.json")
    firebase_admin.initialize_app(cred)
    print("Firebase Admin inicializado correctamente en el Registro.")
except Exception as e:
    print(f"Error cargando Firebase en el Registro: {e}")


# --- PERSISTENCIA (SQLite, montada vía volumen para sobrevivir a rebuilds) ---
def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS environments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            administrador_uid TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS collaborators (
            environment_id TEXT NOT NULL,
            uid TEXT NOT NULL,
            role TEXT NOT NULL,
            PRIMARY KEY (environment_id, uid)
        )
    """)
    conn.commit()
    conn.close()


init_db()


# --- AUTENTICACIÓN ---
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Valida el JWT de Firebase del usuario (mismo criterio que el Middleware)."""
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token
    except Exception as e:
        print(f"Error de validación OAuth2 en el Registro: {e}")
        raise HTTPException(status_code=401, detail="Token de Firebase inválido o expirado")


def verify_service_key(x_service_key: str = Header(default="")):
    """Valida el secreto compartido que usan los Middlewares de cada nodo (no es un JWT de usuario)."""
    if not SERVICE_KEY or x_service_key != SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Service key inválida")
    return True


# --- MODELOS DE ENTRADA ---
class CreateEnvironmentBody(BaseModel):
    name: str
    url: str


class ShareEnvironmentBody(BaseModel):
    email: str


# --- HELPERS ---
def get_environment_or_404(conn, environment_id: str):
    row = conn.execute("SELECT * FROM environments WHERE id = ?", (environment_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Entorno no encontrado")
    return row


# --- ENDPOINT PÚBLICO ---
@app.get("/")
def health_check():
    return {"status": "online", "service": "GALs Registry"}


# --- ENDPOINTS DE USUARIO (Bearer JWT de Firebase) ---

@app.post("/environments")
def create_environment(body: CreateEnvironmentBody, token: dict = Depends(verify_token)):
    """Registra un nuevo entorno. Quien lo crea queda como Administrador."""
    uid = token["uid"]
    environment_id = f"env_{secrets.token_hex(6)}"
    clean_url = body.url.rstrip("/")

    conn = get_db()
    conn.execute(
        "INSERT INTO environments (id, name, url, administrador_uid) VALUES (?, ?, ?, ?)",
        (environment_id, body.name, clean_url, uid),
    )
    conn.commit()
    conn.close()

    return {
        "environment_id": environment_id,
        "name": body.name,
        "url": clean_url,
        "role": "administrador",
    }


@app.get("/environments/mine")
def list_my_environments(token: dict = Depends(verify_token)):
    """Lista todos los entornos donde el usuario es Administrador u Operador."""
    uid = token["uid"]
    conn = get_db()

    admin_rows = conn.execute(
        "SELECT id, name, url FROM environments WHERE administrador_uid = ?", (uid,)
    ).fetchall()

    operator_rows = conn.execute(
        """
        SELECT e.id, e.name, e.url
        FROM environments e
        JOIN collaborators c ON c.environment_id = e.id
        WHERE c.uid = ? AND c.role = 'operador'
        """,
        (uid,),
    ).fetchall()
    conn.close()

    environments = [
        {"environment_id": r["id"], "name": r["name"], "url": r["url"], "role": "administrador"}
        for r in admin_rows
    ] + [
        {"environment_id": r["id"], "name": r["name"], "url": r["url"], "role": "operador"}
        for r in operator_rows
    ]

    return {"environments": environments}


@app.delete("/environments/{environment_id}")
def delete_environment(environment_id: str, token: dict = Depends(verify_token)):
    """Elimina por completo un entorno y revoca a todos sus colaboradores. Solo el Administrador."""
    requester_uid = token["uid"]
    conn = get_db()
    env = get_environment_or_404(conn, environment_id)

    if env["administrador_uid"] != requester_uid:
        conn.close()
        raise HTTPException(status_code=403, detail="Solo el Administrador puede eliminar este entorno")

    conn.execute("DELETE FROM collaborators WHERE environment_id = ?", (environment_id,))
    conn.execute("DELETE FROM environments WHERE id = ?", (environment_id,))
    conn.commit()
    conn.close()

    return {"message": "Entorno eliminado"}


@app.post("/environments/{environment_id}/share")
def share_environment(environment_id: str, body: ShareEnvironmentBody, token: dict = Depends(verify_token)):
    """Otorga acceso de Operador a otro usuario, identificado por su email de Google."""
    requester_uid = token["uid"]
    conn = get_db()
    env = get_environment_or_404(conn, environment_id)

    if env["administrador_uid"] != requester_uid:
        conn.close()
        raise HTTPException(status_code=403, detail="Solo el Administrador puede compartir este entorno")

    try:
        target_user = auth.get_user_by_email(body.email)
    except Exception:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if target_user.uid == env["administrador_uid"]:
        conn.close()
        raise HTTPException(status_code=409, detail="Ese usuario ya es el Administrador de este entorno")

    existing = conn.execute(
        "SELECT 1 FROM collaborators WHERE environment_id = ? AND uid = ?",
        (environment_id, target_user.uid),
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="El usuario ya tiene acceso a este entorno")

    conn.execute(
        "INSERT INTO collaborators (environment_id, uid, role) VALUES (?, ?, 'operador')",
        (environment_id, target_user.uid),
    )
    conn.commit()
    conn.close()

    return {"message": "Acceso otorgado", "operador_uid": target_user.uid}


@app.delete("/environments/{environment_id}/collaborators/{uid}")
def revoke_access(environment_id: str, uid: str, token: dict = Depends(verify_token)):
    """
    Revoca el acceso de un Operador. Lo puede hacer el Administrador del
    entorno (revoca a cualquiera), o el propio Operador sobre sí mismo
    (abandonar el entorno sin depender del Administrador).
    """
    requester_uid = token["uid"]
    conn = get_db()
    env = get_environment_or_404(conn, environment_id)

    is_admin = env["administrador_uid"] == requester_uid
    is_self = requester_uid == uid

    if not is_admin and not is_self:
        conn.close()
        raise HTTPException(status_code=403, detail="No tenés permisos para revocar este acceso")

    if uid == env["administrador_uid"]:
        conn.close()
        raise HTTPException(status_code=400, detail="No se puede revocar al único Administrador del entorno")

    conn.execute(
        "DELETE FROM collaborators WHERE environment_id = ? AND uid = ?",
        (environment_id, uid),
    )
    conn.commit()
    conn.close()

    return {"message": "Acceso revocado"}


@app.get("/environments/{environment_id}/collaborators")
def list_collaborators(environment_id: str, token: dict = Depends(verify_token)):
    """Lista los colaboradores de un entorno. Solo visible para su Administrador."""
    requester_uid = token["uid"]
    conn = get_db()
    env = get_environment_or_404(conn, environment_id)

    if env["administrador_uid"] != requester_uid:
        conn.close()
        raise HTTPException(status_code=403, detail="Solo el Administrador puede ver los colaboradores")

    rows = conn.execute(
        "SELECT uid, role FROM collaborators WHERE environment_id = ?", (environment_id,)
    ).fetchall()
    conn.close()

    return {"collaborators": [{"uid": r["uid"], "role": r["role"]} for r in rows]}


# --- ENDPOINT INTERNO (consumido solo por los Middlewares de cada nodo) ---

@app.get("/environments/{environment_id}/role")
def get_role(environment_id: str, uid: str, _: bool = Depends(verify_service_key)):
    """
    Resuelve el rol de un uid sobre un entorno. Autenticado con X-Service-Key
    (secreto compartido entre el Registro y los Middlewares), no con JWT de usuario.
    """
    conn = get_db()
    row = conn.execute(
        "SELECT administrador_uid FROM environments WHERE id = ?", (environment_id,)
    ).fetchone()

    if not row:
        conn.close()
        return {"role": None}

    if row["administrador_uid"] == uid:
        conn.close()
        return {"role": "administrador"}

    collab = conn.execute(
        "SELECT role FROM collaborators WHERE environment_id = ? AND uid = ?",
        (environment_id, uid),
    ).fetchone()
    conn.close()

    return {"role": collab["role"] if collab else None}
