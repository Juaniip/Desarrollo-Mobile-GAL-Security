import os
import secrets
import sqlite3

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, auth

app = FastAPI(title="GALs Registry", version="2.0")
security = HTTPBearer()

DB_PATH = os.environ.get("REGISTRY_DB_PATH", "/app/data/registry.db")
SERVICE_KEY = os.environ.get("SERVICE_KEY", "")

try:
    cred = credentials.Certificate("firebase-key.json")
    firebase_admin.initialize_app(cred)
    print("Firebase Admin inicializado correctamente en el Registro.")
except Exception as e:
    print(f"Error cargando Firebase en el Registro: {e}")


# --- PERSISTENCIA ---
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
            administrador_uid TEXT NOT NULL,
            organization_id TEXT
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
    # Tabla nueva E3: organizaciones para agrupación jerárquica del llavero
    conn.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_uid TEXT NOT NULL
        )
    """)
    # Migración no-destructiva: agrega la columna si no existía en bases previas
    try:
        conn.execute("ALTER TABLE environments ADD COLUMN organization_id TEXT")
    except Exception:
        pass
    conn.commit()
    conn.close()


init_db()


# --- AUTENTICACIÓN ---
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        return auth.verify_id_token(credentials.credentials)
    except Exception as e:
        print(f"Error de validación OAuth2 en el Registro: {e}")
        raise HTTPException(status_code=401, detail="Token de Firebase inválido o expirado")


def verify_service_key(x_service_key: str = Header(default="")):
    if not SERVICE_KEY or x_service_key != SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Service key inválida")
    return True


# --- MODELOS ---
class CreateEnvironmentBody(BaseModel):
    name: str
    url: str

class ShareEnvironmentBody(BaseModel):
    email: str

class CreateOrganizationBody(BaseModel):
    name: str

class RenameOrganizationBody(BaseModel):
    name: str

class AssignOrganizationBody(BaseModel):
    organization_id: str | None = None


# --- HELPERS ---
def get_environment_or_404(conn, environment_id: str):
    row = conn.execute("SELECT * FROM environments WHERE id = ?", (environment_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Entorno no encontrado")
    return row

def get_organization_or_404(conn, organization_id: str):
    row = conn.execute("SELECT * FROM organizations WHERE id = ?", (organization_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return row


# --- HEALTH ---
@app.get("/")
def health_check():
    return {"status": "online", "service": "GALs Registry", "version": "2.0"}


# ============================================================
# ENDPOINTS DE ENTORNOS (E2 — sin cambios funcionales)
# ============================================================

@app.post("/environments")
def create_environment(body: CreateEnvironmentBody, token: dict = Depends(verify_token)):
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
    return {"environment_id": environment_id, "name": body.name, "url": clean_url, "role": "administrador"}


@app.get("/environments/mine")
def list_my_environments(token: dict = Depends(verify_token)):
    uid = token["uid"]
    conn = get_db()
    admin_rows = conn.execute(
        "SELECT id, name, url, organization_id FROM environments WHERE administrador_uid = ?", (uid,)
    ).fetchall()
    operator_rows = conn.execute(
        """
        SELECT e.id, e.name, e.url, e.organization_id
        FROM environments e
        JOIN collaborators c ON c.environment_id = e.id
        WHERE c.uid = ? AND c.role = 'operador'
        """, (uid,),
    ).fetchall()
    conn.close()
    environments = [
        {"environment_id": r["id"], "name": r["name"], "url": r["url"],
         "role": "administrador", "organization_id": r["organization_id"]}
        for r in admin_rows
    ] + [
        {"environment_id": r["id"], "name": r["name"], "url": r["url"],
         "role": "operador", "organization_id": r["organization_id"]}
        for r in operator_rows
    ]
    return {"environments": environments}


@app.delete("/environments/{environment_id}")
def delete_environment(environment_id: str, token: dict = Depends(verify_token)):
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
    conn.execute("DELETE FROM collaborators WHERE environment_id = ? AND uid = ?", (environment_id, uid))
    conn.commit()
    conn.close()
    return {"message": "Acceso revocado"}


@app.get("/environments/{environment_id}/collaborators")
def list_collaborators(environment_id: str, token: dict = Depends(verify_token)):
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


# Endpoint interno — solo para Middlewares
@app.get("/environments/{environment_id}/role")
def get_role(environment_id: str, uid: str, _: bool = Depends(verify_service_key)):
    conn = get_db()
    row = conn.execute("SELECT administrador_uid FROM environments WHERE id = ?", (environment_id,)).fetchone()
    if not row:
        conn.close()
        return {"role": None}
    if row["administrador_uid"] == uid:
        conn.close()
        return {"role": "administrador"}
    collab = conn.execute(
        "SELECT role FROM collaborators WHERE environment_id = ? AND uid = ?", (environment_id, uid)
    ).fetchone()
    conn.close()
    return {"role": collab["role"] if collab else None}


# ============================================================
# ENDPOINTS DE ORGANIZACIONES (E3 — expansión vertical)
# ============================================================

@app.post("/organizations")
def create_organization(body: CreateOrganizationBody, token: dict = Depends(verify_token)):
    """Crea una organización. El creador es el owner."""
    uid = token["uid"]
    org_id = f"org_{secrets.token_hex(6)}"
    conn = get_db()
    conn.execute(
        "INSERT INTO organizations (id, name, owner_uid) VALUES (?, ?, ?)",
        (org_id, body.name.strip(), uid),
    )
    conn.commit()
    conn.close()
    return {"organization_id": org_id, "name": body.name.strip()}


@app.get("/organizations/mine")
def list_my_organizations(token: dict = Depends(verify_token)):
    """Lista las organizaciones del usuario con los entornos que contiene cada una."""
    uid = token["uid"]
    conn = get_db()
    orgs = conn.execute(
        "SELECT id, name FROM organizations WHERE owner_uid = ?", (uid,)
    ).fetchall()
    result = []
    for org in orgs:
        envs = conn.execute(
            "SELECT id, name, url FROM environments WHERE organization_id = ? AND administrador_uid = ?",
            (org["id"], uid),
        ).fetchall()
        result.append({
            "organization_id": org["id"],
            "name": org["name"],
            "environments": [{"environment_id": e["id"], "name": e["name"], "url": e["url"]} for e in envs],
        })
    conn.close()
    return {"organizations": result}


@app.put("/organizations/{organization_id}")
def rename_organization(organization_id: str, body: RenameOrganizationBody, token: dict = Depends(verify_token)):
    """Renombra una organización. Solo el owner puede hacerlo."""
    uid = token["uid"]
    conn = get_db()
    org = get_organization_or_404(conn, organization_id)
    if org["owner_uid"] != uid:
        conn.close()
        raise HTTPException(status_code=403, detail="Solo el creador puede renombrar esta organización")
    conn.execute("UPDATE organizations SET name = ? WHERE id = ?", (body.name.strip(), organization_id))
    conn.commit()
    conn.close()
    return {"message": "Organización renombrada", "name": body.name.strip()}


@app.delete("/organizations/{organization_id}")
def delete_organization(organization_id: str, token: dict = Depends(verify_token)):
    """
    Elimina la organización. Los entornos que pertenecían a ella quedan
    con organization_id = NULL (sin agrupar), no se eliminan.
    """
    uid = token["uid"]
    conn = get_db()
    org = get_organization_or_404(conn, organization_id)
    if org["owner_uid"] != uid:
        conn.close()
        raise HTTPException(status_code=403, detail="Solo el creador puede eliminar esta organización")
    conn.execute("UPDATE environments SET organization_id = NULL WHERE organization_id = ?", (organization_id,))
    conn.execute("DELETE FROM organizations WHERE id = ?", (organization_id,))
    conn.commit()
    conn.close()
    return {"message": "Organización eliminada. Los entornos quedaron sin agrupar."}


@app.put("/environments/{environment_id}/organization")
def assign_organization(environment_id: str, body: AssignOrganizationBody, token: dict = Depends(verify_token)):
    """
    Asigna o desasigna un entorno a una organización.
    Pasar organization_id = null desasigna el entorno (queda sin agrupar).
    Solo el Administrador del entorno puede cambiar su organización.
    """
    uid = token["uid"]
    conn = get_db()
    env = get_environment_or_404(conn, environment_id)
    if env["administrador_uid"] != uid:
        conn.close()
        raise HTTPException(status_code=403, detail="Solo el Administrador puede cambiar la organización del entorno")
    if body.organization_id is not None:
        org = conn.execute(
            "SELECT 1 FROM organizations WHERE id = ? AND owner_uid = ?",
            (body.organization_id, uid),
        ).fetchone()
        if not org:
            conn.close()
            raise HTTPException(status_code=404, detail="Organización no encontrada o no es tuya")
    conn.execute(
        "UPDATE environments SET organization_id = ? WHERE id = ?",
        (body.organization_id, environment_id),
    )
    conn.commit()
    conn.close()
    return {"message": "Organización asignada" if body.organization_id else "Entorno desasignado de su organización"}
