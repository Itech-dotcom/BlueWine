# Programador: Isaac Fernández
# Blue Wine — Backend MercadoPago + Google Sheets + QR

from flask import Flask, request, jsonify
from flask_cors import CORS          # permite peticiones desde el frontend (bluewine.cl)
import mercadopago                   # SDK oficial de MercadoPago
import requests                      # para llamadas HTTP (Brevo API)
import os                            # para leer variables de entorno (.env)
import json                          # para convertir datos a texto y viceversa
import uuid                          # para generar códigos únicos de ticket
import datetime                      # para registrar fecha y hora de compra
import qrcode                        # para generar la imagen del código QR
import io                            # para manejar la imagen QR en memoria
import base64                        # para adjuntar imágenes inline en emails Brevo
import psycopg2                      # para guardar tickets en PostgreSQL
import hmac                          # para verificar firma HMAC-SHA256 del webhook de MP
import hashlib                       # para el algoritmo SHA-256
import threading                     # para actualizar Sheets en background al verificar tickets
import secrets                       # para generar IDs criptográficamente seguros
import html as _html                 # para escapar datos de usuario en templates HTML
from dotenv import load_dotenv       # para cargar el archivo .env con claves secretas
from flask_limiter import Limiter    # para rate limiting en endpoints públicos
import gspread                       # para leer/escribir en Google Sheets
from google.oauth2.service_account import Credentials  # autenticación con Google

load_dotenv()  # carga las variables del archivo .env (MP_ACCESS_TOKEN, etc.)

app = Flask(__name__)
CORS(app, origins=[
    "https://bluewine.cl",
    "https://www.bluewine.cl",
    "https://itech-dotcom.github.io",
    "http://localhost",
    "http://127.0.0.1",
])

def _get_real_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()

limiter = Limiter(
    key_func=_get_real_ip,
    app=app,
    storage_uri="memory://",
    default_limits=[],
)

sdk = mercadopago.SDK(os.getenv("MP_ACCESS_TOKEN"))  # inicializa MercadoPago con la clave del .env

# Clave para endpoints administrativos (/emitir-manual, /reenviar-ticket, /recuperar-pendiente).
# Configurar ADMIN_KEY en las variables de entorno de Railway; este valor es solo un fallback.
ADMIN_KEY = os.getenv("ADMIN_KEY", "bw-admin-2026")

# ══════════════════════════════════════════════════════
# PRECIOS Y TIPOS DE ENTRADA — fuente de verdad para validar montos
# Debe reflejar el objeto ENTRADAS de JS/main.js. Cuando cambie el evento
# (ver CLAUDE.md → "nuevo evento"), actualizar también esta tabla.
# ══════════════════════════════════════════════════════
NOMBRE_EVENTO_PRINCIPAL = "Aniversario Blue Wine"
COMISION_MP = 0.15  # 15% MercadoPago, igual que en main.js

PRECIOS_ENTRADAS = {
    "general":        {"nombre": "General",               "precio": 5000,   "personas": 1},
    "vip":            {"nombre": "VIP",                   "precio": 10000,  "personas": 1},
    "mesaGoldenVip":  {"nombre": "Mesa Golden VIP",       "precio": 150000, "personas": 1},
    "generalMujeres": {"nombre": "General Mujeres",       "precio": 5000,   "personas": 1},
    "generalHombres": {"nombre": "General Hombres",       "precio": 7000,   "personas": 1},
    "preventaVip":    {"nombre": "VIP",                   "precio": 10000,  "personas": 1},
    "preventa1":      {"nombre": "General",               "precio": 5000,   "personas": 1},
    "preventa2":      {"nombre": "Preventa 2",            "precio": 13000,  "personas": 1},
    "soloMujeres":    {"nombre": "Solo Mujeres 2x",       "precio": 12000,  "personas": 2},
    "mesaDiamond":    {"nombre": "Mesa Diamond (4 pers.)","precio": 150000, "personas": 4},
    "meetAndGreet":   {"nombre": "Meet & Greet",          "precio": 50000,  "personas": 1},
    "prevDiamond":    {"nombre": "Diamond",               "precio": 20000,  "personas": 1},
    "puertaDiamond":  {"nombre": "Puerta Diamond",        "precio": 30000,  "personas": 1},
}

# Bandera para activar la entrada liberada (/obtener-entrada-gratis).
# Mantener en False salvo que el evento actual regale entradas.
ENTRADA_GRATIS_ACTIVA = True
LIMITE_ENTRADAS_GRATIS = 100

# ══════════════════════════════════════════════════════
# GOOGLE SHEETS — CONFIGURACIÓN
# Las credenciales del service account van en la variable
# de entorno GOOGLE_CREDENTIALS como JSON string
# ══════════════════════════════════════════════════════
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]
SPREADSHEET_ID = os.getenv("GOOGLE_SHEET_ID")  # ID del Google Sheet

def get_sheet():
    # Conecta con Google Sheets y retorna la hoja "tickets" donde se guardan todas las entradas vendidas.
    # Si la hoja no existe todavía, la crea con los encabezados correctos.
    creds_json = os.getenv("GOOGLE_CREDENTIALS")      # credenciales del service account de Google
    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    client = gspread.authorize(creds)
    sheet = client.open_by_key(SPREADSHEET_ID)
    try:
        return sheet.worksheet("tickets")
    except gspread.WorksheetNotFound:
        # primera vez que se ejecuta: crea la hoja con todos los encabezados
        ws = sheet.add_worksheet(title="tickets", rows=1000, cols=16)
        ws.append_row([
            "codigo_ticket", "nombre", "apellido", "rut", "evento", "acompanante_de",
            "email", "telefono", "cantidad", "precio_unit", "total", "fecha_compra",
            "id_pago_mp", "estado", "url_verificacion"
        ])
        return ws


def get_sheet_pendientes():
    # Conecta con la hoja "pendientes" donde se guardan los datos del comprador ANTES
    # de que MercadoPago confirme el pago. Se borran una vez que el pago es aprobado.
    creds_json = os.getenv("GOOGLE_CREDENTIALS")
    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    client = gspread.authorize(creds)
    sheet = client.open_by_key(SPREADSHEET_ID)
    try:
        return sheet.worksheet("pendientes")
    except gspread.WorksheetNotFound:
        ws = sheet.add_worksheet(title="pendientes", rows=500, cols=6)
        ws.append_row(["compra_id", "comprador_json", "items_json", "preference_id", "fecha", "acompanantes_json"])
        return ws


# ══════════════════════════════════════════════════════
# POSTGRESQL — CONEXIÓN Y SETUP
# ══════════════════════════════════════════════════════
def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"), connect_timeout=5)

def init_db():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tickets (
                        id               SERIAL PRIMARY KEY,
                        codigo           TEXT UNIQUE NOT NULL,
                        nombre           TEXT,
                        apellido         TEXT,
                        rut              TEXT,
                        evento           TEXT,
                        acompanante_de   TEXT DEFAULT '',
                        email            TEXT,
                        telefono         TEXT,
                        cantidad         INTEGER DEFAULT 1,
                        precio_unit      INTEGER,
                        total            INTEGER,
                        fecha_compra     TIMESTAMP,
                        id_pago          TEXT,
                        estado           TEXT DEFAULT 'ACTIVO',
                        url_verificacion TEXT
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS config (
                        clave   TEXT PRIMARY KEY,
                        valor   TEXT NOT NULL,
                        updated TIMESTAMP DEFAULT NOW()
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS pendientes (
                        compra_id         TEXT PRIMARY KEY,
                        comprador_json    TEXT NOT NULL,
                        items_json        TEXT NOT NULL,
                        preference_id     TEXT,
                        fecha             TIMESTAMP DEFAULT NOW(),
                        acompanantes_json TEXT DEFAULT '[]'
                    )
                """)
            conn.commit()
        print("PostgreSQL inicializado")
    except Exception as e:
        print(f"Error inicializando PostgreSQL: {e}")

def _guardar_ticket_pg(codigo, comprador, evento, acompanante_de, cantidad, precio_unit, total, fecha, id_pago, url_verificacion):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO tickets (codigo, nombre, apellido, rut, evento, acompanante_de,
                        email, telefono, cantidad, precio_unit, total, fecha_compra, id_pago, estado, url_verificacion)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'ACTIVO',%s)
                    ON CONFLICT (codigo) DO NOTHING
                """, (
                    codigo,
                    comprador.get("nombre", ""),
                    comprador.get("apellido", ""),
                    comprador.get("rut", ""),
                    evento,
                    acompanante_de,
                    comprador.get("email", ""),
                    comprador.get("telefono", ""),
                    cantidad, precio_unit, total,
                    fecha, id_pago, url_verificacion,
                ))
            conn.commit()
        print(f"Ticket {codigo} guardado en PostgreSQL")
    except Exception as e:
        print(f"Error guardando en PostgreSQL: {e}")

init_db()


def _get_config_bool(clave, default=False):
    """Lee un valor booleano desde la tabla config. Fallback al default si falla o no existe."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT valor FROM config WHERE clave = %s", (clave,))
                row = cur.fetchone()
        if row:
            return json.loads(row[0]) is True
        return default
    except Exception:
        return default


def _verificar_firma_webhook(req, secret):
    """Verifica la firma HMAC-SHA256 que MercadoPago envía en x-signature.
    Retorna True si la firma es válida (o si secret está vacío en env).
    Formato x-signature: 'ts=<timestamp>,v1=<hmac_hex>'
    Template firmado:    'id:<data_id>;request-id:<x-request-id>;ts:<ts>;'
    """
    try:
        x_sig     = req.headers.get("x-signature", "")
        x_req_id  = req.headers.get("x-request-id", "")
        ts = v1 = ""
        for part in x_sig.split(","):
            k, _, v = part.partition("=")
            k = k.strip()
            if k == "ts":
                ts = v.strip()
            elif k == "v1":
                v1 = v.strip()
        if not ts or not v1:
            return False
        body     = req.get_json(silent=True) or {}
        data_id  = str(body.get("data", {}).get("id", "") or req.args.get("id", ""))
        template = f"id:{data_id};request-id:{x_req_id};ts:{ts};"
        expected = hmac.new(secret.encode(), template.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, v1)
    except Exception as e:
        print(f"[webhook] error verificando firma: {e}")
        return False


def _get_entradas_config():
    """Lee los tipos de entrada desde el config en PostgreSQL.
    Fallback a PRECIOS_ENTRADAS si la tabla no tiene datos aún."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT valor FROM config WHERE clave = 'entradas'")
                row = cur.fetchone()
        if not row:
            return PRECIOS_ENTRADAS
        entradas = json.loads(row[0])
        for val in entradas.values():
            val.setdefault('personas', 1)
        return entradas
    except Exception:
        return PRECIOS_ENTRADAS


def _get_limite_entradas_gratis(dia='viernes'):
    """Lee el límite de entradas gratis desde PG config. Fallback a LIMITE_ENTRADAS_GRATIS."""
    clave = 'limiteEntradasGratisViernes' if dia == 'viernes' else 'limiteEntradasGratisSabado'
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT valor FROM config WHERE clave = %s", (clave,))
                row = cur.fetchone()
        if row:
            val = int(json.loads(row[0]))
            if val > 0:
                return val
    except Exception:
        pass
    return LIMITE_ENTRADAS_GRATIS


def _get_nombre_evento():
    """Lee NOMBRE_EVENTO_PRINCIPAL desde el config en PostgreSQL (eventoViernes.nombre).
    Fallback a la constante hardcodeada si no existe o está vacío."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT valor FROM config WHERE clave = 'eventoViernes'")
                row = cur.fetchone()
        if row:
            ev = json.loads(row[0])
            nombre = ev.get('nombre', '').strip()
            if nombre:
                return nombre
    except Exception:
        pass
    return NOMBRE_EVENTO_PRINCIPAL


def _get_stock_disponible():
    """Retorna {key: cupos_disponibles} consultando PostgreSQL.
    Si limite == 0, se omite la clave (sin límite). Usado para validar stock en /crear-pago."""
    try:
        entradas = _get_entradas_config()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT evento, COUNT(*) FROM tickets
                    WHERE acompanante_de = '' AND estado IN ('ACTIVO','USADO')
                    GROUP BY evento
                """)
                rows = cur.fetchall()
        vendidos = {str(ev).strip(): int(cnt) for ev, cnt in rows}
        result = {}
        for key, val in entradas.items():
            limite = val.get("limite", 0)
            if limite <= 0:
                continue
            nombre_entrada = val.get("nombre", key)
            evento_key = f"{_get_nombre_evento()} — {nombre_entrada}"
            result[key] = max(0, limite - vendidos.get(evento_key, 0))
        return result
    except Exception as e:
        print(f"[stock] Error calculando disponibles: {e}")
        return {}


# ══════════════════════════════════════════════════════
# CREAR PREFERENCIA DE PAGO
# ══════════════════════════════════════════════════════
@app.route("/crear-pago", methods=["POST"])
@limiter.limit("10 per minute")
def crear_pago():
    # Recibe los datos del carrito y el comprador desde el frontend,
    # crea una preferencia de pago en MercadoPago y guarda los datos en "pendientes".
    # El frontend redirige al usuario a init_point para que pague.
    data              = request.get_json()
    items_recibidos   = data.get("items", [])          # lista de entradas del carrito (sin confiar en precios/cantidades)
    comprador         = data.get("comprador", {})       # datos del comprador principal
    acompanantes      = data.get("acompanantes", [])    # lista de acompañantes (puede estar vacía)
    compra_id         = secrets.token_urlsafe(16)         # ID único criptográficamente seguro

    # Validar cada item contra la config actual — nunca confiar en precio/personas/nombre
    # que vengan del frontend, para evitar manipulación de montos o tipos de entrada.
    entradas_config = _get_entradas_config()
    items = []
    total_personas = 0
    for item in items_recibidos:
        info = entradas_config.get(item.get("id"))
        if not info:
            return jsonify({"error": f"Tipo de entrada inválido: {item.get('id')}"}), 400
        try:
            cantidad = int(item.get("cantidad", 0))
        except (TypeError, ValueError):
            cantidad = 0
        if cantidad < 1 or cantidad > 20:
            return jsonify({"error": "Cantidad inválida"}), 400

        precio_final = info["precio"] + round(info["precio"] * COMISION_MP)
        personas     = info.get("personas", 1)
        nombre_evento = _get_nombre_evento()
        items.append({
            "id": item["id"],
            "nombre": f"{nombre_evento} — {info['nombre']}",
            "cantidad": cantidad,
            "precioFinal": precio_final,
            "personas": personas
        })
        total_personas += cantidad * personas

    if not items:
        return jsonify({"error": "El carrito está vacío"}), 400

    # M10: validar stock disponible antes de crear el link de pago
    stock_disponible = _get_stock_disponible()
    for item in items:
        disponible = stock_disponible.get(item["id"])
        if disponible is not None and item["cantidad"] > disponible:
            nombre_entrada = entradas_config[item["id"]].get("nombre", item["id"])
            return jsonify({"error": f"Stock insuficiente para '{nombre_entrada}'. Quedan {disponible} entradas disponibles."}), 400

    # La cantidad de acompañantes debe coincidir exactamente con los cupos comprados
    # (total de personas - 1 por el comprador principal).
    if len(acompanantes) != total_personas - 1:
        return jsonify({"error": "La cantidad de acompañantes no coincide con las entradas compradas"}), 400

    # Armar la preferencia de pago para MercadoPago
    preference_data = {
        "items": [
            {
                "title": item["nombre"],           # nombre que aparece en MercadoPago
                "quantity": item["cantidad"],
                "unit_price": item["precioFinal"], # precio ya con comisión incluida
                "currency_id": "CLP"
            }
            for item in items
        ],
        "back_urls": {
            # URLs a las que MP redirige al usuario según resultado del pago
            "success": "https://bluewine.cl/?pago=exitoso",
            "failure": "https://bluewine.cl/?pago=fallido",
            "pending": "https://bluewine.cl/?pago=pendiente"
        },
        "auto_return": "approved",  # redirige automáticamente si el pago fue aprobado
        "notification_url": "https://bluewine-production.up.railway.app/webhook-mp",  # MP avisa aquí cuando se paga
        "external_reference": compra_id  # vincula el pago con los datos guardados en pendientes
    }

    preference_response = sdk.preference().create(preference_data)

    if "response" not in preference_response or "id" not in preference_response.get("response", {}):
        return jsonify({"error": "Error MercadoPago", "detalle": preference_response}), 400

    preference = preference_response["response"]

    # Guardar pendiente en PostgreSQL (crítico — si falla, no entregar link de pago)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO pendientes (compra_id, comprador_json, items_json, preference_id, fecha, acompanantes_json)
                    VALUES (%s, %s, %s, %s, NOW(), %s)
                    ON CONFLICT (compra_id) DO NOTHING
                """, (compra_id, json.dumps(comprador), json.dumps(items),
                      preference["id"], json.dumps(acompanantes)))
            conn.commit()
        print(f"Compra {compra_id} guardada en pendientes (PG)")
    except Exception as e:
        print(f"Error crítico guardando pendiente en PostgreSQL: {e}")
        return jsonify({"error": "Error temporal al procesar la compra. Intenta nuevamente en unos segundos."}), 500

    # También guardar en Sheets como respaldo (no crítico — fallo silencioso)
    try:
        ws = get_sheet_pendientes()
        ws.append_row([
            compra_id,
            json.dumps(comprador),
            json.dumps(items),
            preference["id"],
            datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            json.dumps(acompanantes)
        ])
    except Exception as e:
        print(f"Advertencia: no se pudo guardar pendiente en Sheets (no crítico): {e}")

    # Retorna la URL de pago al frontend para redirigir al usuario a MercadoPago
    return jsonify({
        "id": preference["id"],
        "init_point": preference["init_point"],             # URL de pago en producción
        "sandbox_init_point": preference["sandbox_init_point"]  # URL de prueba
    })


# ══════════════════════════════════════════════════════
# WEBHOOK MERCADOPAGO
# ══════════════════════════════════════════════════════
@app.route("/webhook-mp", methods=["POST"])
def webhook_mp():
    # MercadoPago llama a esta URL automáticamente cuando ocurre un pago.
    # Aquí se verifica si fue aprobado y se emiten los tickets correspondientes.
    mp_secret = os.getenv("MP_WEBHOOK_SECRET", "")
    if mp_secret and not _verificar_firma_webhook(request, mp_secret):
        print("[webhook] firma inválida — solicitud rechazada")
        return jsonify({"ok": False}), 400
    data       = request.get_json(silent=True) or {}
    topic      = data.get("type") or request.args.get("topic")
    payment_id = data.get("data", {}).get("id") or request.args.get("id")

    if topic == "payment" and payment_id:
        try:
            # Consultar a MP los detalles reales del pago (status, monto, etc.)
            payment_info = sdk.payment().get(payment_id)
            payment      = payment_info.get("response", {})
            status       = payment.get("status")
            compra_id    = payment.get("external_reference")  # ID que vincula con "pendientes"

            print(f"Pago {payment_id} — estado: {status} — compra_id: {compra_id}")

            if status == "approved" and compra_id:
                # Evitar duplicados: verificar en PostgreSQL (rápido, sin condición de carrera)
                try:
                    with get_db() as conn:
                        with conn.cursor() as cur:
                            cur.execute("SELECT 1 FROM tickets WHERE id_pago = %s LIMIT 1", (str(payment_id),))
                            if cur.fetchone():
                                print(f"Pago {payment_id} ya procesado — ignorando webhook duplicado")
                                return jsonify({"status": "ok"}), 200
                except Exception as e:
                    print(f"Error verificando duplicado en PG: {e}")

                # Buscar pendiente: PostgreSQL primero (confiable), Sheets como fallback
                pendiente = None
                fila_sheets_p = None
                ws_p_ref = None

                try:
                    with get_db() as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "SELECT comprador_json, items_json, acompanantes_json FROM pendientes WHERE compra_id = %s",
                                (compra_id,)
                            )
                            row_pg = cur.fetchone()
                    if row_pg:
                        pendiente = {"comprador_json": row_pg[0], "items_json": row_pg[1],
                                     "acompanantes_json": row_pg[2] or "[]"}
                except Exception as e:
                    print(f"Error buscando pendiente en PG: {e}")

                if not pendiente:
                    try:
                        ws_p_ref = get_sheet_pendientes()
                        rows_p = ws_p_ref.get_all_records()
                        for i, row in enumerate(rows_p, start=2):
                            if str(row.get("compra_id", "")) == compra_id:
                                fila_sheets_p = i
                                pendiente = row
                                break
                    except Exception as e:
                        print(f"Error buscando pendiente en Sheets: {e}")

                if not pendiente:
                    print(f"ALERTA: compra_id {compra_id} no encontrado en ninguna fuente — pago {payment_id} sin datos de comprador")
                else:
                    comprador    = json.loads(pendiente["comprador_json"])
                    items        = json.loads(pendiente["items_json"])
                    acompanantes = json.loads(pendiente.get("acompanantes_json") or "[]")  # [] si no hay acompañantes

                    # Expandir el carrito respetando cuántas personas incluye cada tipo de entrada.
                    # Ej: 1x Solo Mujeres 2x (personas:2) + 1x Preventa 1 → [soloMujeres, soloMujeres, preventa1]
                    tickets_lista = []
                    for item in items:
                        personas = item.get("personas", 1)
                        for _ in range(item["cantidad"]):
                            for _ in range(personas):
                                tickets_lista.append({
                                    "nombre": item["nombre"],
                                    "precio": item["precioFinal"]
                                })

                    # Unir comprador + acompañantes en una sola lista
                    todos = [comprador] + acompanantes
                    nombre_comprador = f"{comprador.get('nombre','')} {comprador.get('apellido','')}".strip()
                    print(f"Procesando compra: {len(todos)} personas, {len(tickets_lista)} tickets")

                    # Safety net: si aún faltan slots, extender repitiendo el último
                    while len(tickets_lista) < len(todos):
                        tickets_lista.append(tickets_lista[-1] if tickets_lista else {"nombre": "Entrada", "precio": 0})

                    # Mesa Diamond: calcular número de mesa asignada a este grupo
                    mesa_num = None
                    es_mesa_diamond = any("Mesa Diamond" in item.get("nombre", "") for item in items)
                    if es_mesa_diamond:
                        try:
                            with get_db() as conn:
                                with conn.cursor() as cur:
                                    cur.execute("""
                                        SELECT COUNT(*) FROM tickets
                                        WHERE evento ILIKE %s
                                        AND (acompanante_de IS NULL OR acompanante_de = '')
                                        AND estado IN ('ACTIVO','USADO')
                                    """, ('%Mesa Diamond%',))
                                    mesas_vendidas = cur.fetchone()[0]
                        except Exception:
                            mesas_vendidas = 0
                        mesa_num = mesas_vendidas + 1
                        print(f"Mesa Diamond asignada: Mesa {mesa_num}")

                    # Nombres de acompañantes para mostrar en el correo del comprador principal
                    nombres_acomp = [
                        f"{a.get('nombre','')} {a.get('apellido','')}".strip()
                        for a in acompanantes
                    ]

                    qrs_emitidos = []
                    for idx, (asistente, ticket) in enumerate(zip(todos, tickets_lista)):
                        es_acomp = idx > 0
                        codigo, qr_img = _emitir_ticket(
                            comprador      = asistente,
                            evento         = ticket["nombre"],
                            cantidad       = 1,
                            precio_unit    = ticket["precio"],
                            total          = ticket["precio"],
                            id_pago        = str(payment_id),
                            acompanante_de = nombre_comprador if es_acomp else "",
                            mesa           = mesa_num,
                            companions     = nombres_acomp if not es_acomp else None
                        )
                        qrs_emitidos.append((asistente, ticket, codigo, qr_img))

                    # Enviar resumen de la compra completa a Blue Wine (1 solo email por compra)
                    _enviar_resumen_compra(
                        comprador     = comprador,
                        todos         = todos,
                        tickets_lista = tickets_lista,
                        id_pago       = str(payment_id),
                        qrs           = qrs_emitidos
                    )

                    # Borrar pendiente de PostgreSQL y Sheets para no emitir de nuevo
                    try:
                        with get_db() as conn:
                            with conn.cursor() as cur:
                                cur.execute("DELETE FROM pendientes WHERE compra_id = %s", (compra_id,))
                            conn.commit()
                    except Exception as e:
                        print(f"Error borrando pendiente de PG: {e}")
                    if fila_sheets_p and ws_p_ref:
                        try:
                            ws_p_ref.delete_rows(fila_sheets_p)
                        except Exception as e:
                            print(f"Error borrando pendiente de Sheets: {e}")
                    print(f"Compra {compra_id} procesada y pendiente eliminado")

        except Exception as e:
            print("Error procesando webhook:", e)

    # Siempre responder 200 a MP aunque falle, para que no reintente infinitamente
    return jsonify({"status": "ok"}), 200


# ══════════════════════════════════════════════════════
# EMITIR TICKET: Sheets + QR + Email
# ══════════════════════════════════════════════════════
def _emitir_ticket(comprador, evento, cantidad, precio_unit, total, id_pago, acompanante_de="", mesa=None, companions=None):
    # Genera un ticket completo para una persona: lo guarda en Sheets, crea el QR y envía el email.
    # acompanante_de: si no está vacío, indica el nombre del comprador principal (para acompañantes).
    codigo           = str(uuid.uuid4())[:12].upper()  # código único del ticket, ej: "A1B2C3D4E5F6"
    url_verificacion = f"https://bluewine-production.up.railway.app/verificar/{codigo}"  # URL que codifica el QR
    fecha            = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Guardar en Google Sheets
    try:
        ws = get_sheet()
        ws.append_row([
            codigo,
            comprador.get("nombre", ""),
            comprador.get("apellido", ""),
            comprador.get("rut", ""),
            evento,
            acompanante_de,
            comprador.get("email", ""),
            comprador.get("telefono", ""),
            cantidad, precio_unit, total, fecha,
            id_pago, "ACTIVO", url_verificacion
        ])
        print(f"Ticket {codigo} guardado en Sheets")
    except Exception as e:
        print(f"Error guardando en Sheets: {e}")

    # 1b. Guardar también en PostgreSQL
    _guardar_ticket_pg(codigo, comprador, evento, acompanante_de, cantidad, precio_unit, total, fecha, id_pago, url_verificacion)

    # 2. Generar QR
    qr_img = _generar_qr(url_verificacion)

    # 3. Enviar email
    try:
        _enviar_email_ticket(
            destinatario   = comprador.get("email", ""),
            nombre         = f"{comprador.get('nombre', '')} {comprador.get('apellido', '')}".strip(),
            evento         = evento,
            codigo         = codigo,
            qr_img         = qr_img,
            acompanante_de = acompanante_de,
            mesa           = mesa,
            companions     = companions,
        )
    except Exception as e:
        import traceback
        print(f"ERROR CRÍTICO enviando email a {comprador.get('email','?')} — ticket {codigo}: {e}")
        print(traceback.format_exc())

    return codigo, qr_img


def _smtp_send(to_list, subject, html, inline_imgs=None):
    # Envía email via Brevo API HTTP (evita bloqueos de puertos SMTP en Railway).
    # inline_imgs: lista de {"cid": str, "data": bytes} — se adjuntan con contentId.
    api_key = os.getenv("BREVO_API_KEY")

    payload = {
        "sender":      {"name": "Blue Wine", "email": "tickets@bluewine.cl"},
        "to":          [{"email": addr} for addr in to_list],
        "subject":     subject,
        "htmlContent": html,
    }

    if inline_imgs:
        payload["attachment"] = [
            {
                "content":   base64.b64encode(img["data"]).decode(),
                "name":      f'{img["cid"]}.png',
                "contentId": img["cid"],
            }
            for img in inline_imgs
        ]

    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    dominios = [e.split("@")[-1] for e in to_list]
    print(f"Email enviado via Brevo API — destinatarios: {len(to_list)} ({', '.join(dominios)})")


def _enviar_resumen_compra(comprador, todos, tickets_lista, id_pago, qrs=None):
    # Manda UN solo email resumen a Blue Wine con todos los tickets de la compra.
    # Así en vez de recibir N copias individuales, recibe 1 resumen por compra.
    try:
        copia_bw = os.getenv("EMAIL_COPIA", "bluewine.contacto@gmail.com")

        nombre_comprador = f"{comprador.get('nombre','')} {comprador.get('apellido','')}".strip()
        total_personas   = len(todos)

        # Construir filas de la tabla e imágenes inline
        filas_html  = ""
        inline_imgs = []
        qrs_map     = {i: (codigo, qr_img) for i, (_, _, codigo, qr_img) in enumerate(qrs)} if qrs else {}

        e = _html.escape
        for idx, (asistente, ticket) in enumerate(zip(todos, tickets_lista)):
            rol    = "Comprador principal" if idx == 0 else f"Acompañante {idx}"
            nombre = e(f"{asistente.get('nombre','')} {asistente.get('apellido','')}".strip())
            email  = e(asistente.get("email", "—"))
            rut    = e(asistente.get("rut", "—"))
            tipo   = e(ticket.get("nombre", "—"))
            cid    = f"qr-resumen-{idx}"

            qr_cell = ""
            if idx in qrs_map:
                codigo_t, qr_img_t = qrs_map[idx]
                inline_imgs.append({"cid": cid, "data": qr_img_t})
                qr_cell = f'<img src="cid:{cid}" width="80" height="80" style="border:2px solid #c9a84c;border-radius:4px;" /><br><span style="font-family:monospace;font-size:10px;color:#c9a84c;">{e(codigo_t)}</span>'

            filas_html += f"""
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #2a2820;color:#c9a84c;font-size:13px;">{rol}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #2a2820;font-size:13px;">{nombre}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #2a2820;font-size:13px;">{rut}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #2a2820;font-size:13px;">{email}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #2a2820;font-size:13px;">{tipo}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #2a2820;text-align:center;">{qr_cell}</td>
            </tr>"""

        nombre_comprador_e = e(nombre_comprador)
        html_resumen = f"""
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#0a0a0f;color:#e8e0d0;padding:32px;border-radius:12px;">
          <h2 style="color:#c9a84c;margin-bottom:4px;">🎟️ Nueva compra registrada</h2>
          <p style="color:#7a7060;font-size:13px;margin:0 0 20px;">Pago ID: {e(str(id_pago))}</p>
          <p><strong>Comprador:</strong> {nombre_comprador_e} — {e(comprador.get('email','—'))} — {e(comprador.get('telefono','—'))}</p>
          <p><strong>Total personas:</strong> {total_personas}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#13131a;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#1a1a2e;">
                <th style="padding:10px 12px;text-align:left;color:#c9a84c;font-size:13px;">Rol</th>
                <th style="padding:10px 12px;text-align:left;color:#c9a84c;font-size:13px;">Nombre</th>
                <th style="padding:10px 12px;text-align:left;color:#c9a84c;font-size:13px;">RUT</th>
                <th style="padding:10px 12px;text-align:left;color:#c9a84c;font-size:13px;">Email</th>
                <th style="padding:10px 12px;text-align:left;color:#c9a84c;font-size:13px;">Tipo entrada</th>
                <th style="padding:10px 12px;text-align:left;color:#c9a84c;font-size:13px;">QR</th>
              </tr>
            </thead>
            <tbody>{filas_html}</tbody>
          </table>
          <hr style="border:none;border-top:1px solid #2a2820;margin:24px 0;" />
          <p style="color:#7a7060;font-size:11px;text-align:center;">Blue Wine · Sistema de tickets automático</p>
        </div>
        """

        _smtp_send(
            to_list     = [copia_bw],
            subject     = f"🎟️ Nueva compra — {nombre_comprador} ({total_personas} persona{'s' if total_personas > 1 else ''})",
            html        = html_resumen,
            inline_imgs = inline_imgs or None,
        )
        # nombre_comprador en subject es para admin interno — no necesita escape (no es HTML)
        print(f"Resumen de compra enviado a {copia_bw}")
    except Exception as e:
        print(f"Error enviando resumen de compra: {e}")


def _generar_qr(contenido):
    # Genera una imagen QR a partir de una URL y la retorna como bytes (PNG en memoria).
    # El QR apunta a /verificar/{codigo} — cuando lo escanean en puerta, verifican el ticket.
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(contenido)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()       # buffer en memoria, no guarda archivo en disco
    img.save(buf, format="PNG")
    return buf.getvalue()    # retorna los bytes de la imagen PNG


def _enviar_email_ticket(destinatario, nombre, evento, codigo, qr_img, acompanante_de="", mesa=None, companions=None):
    e = _html.escape  # shorthand para escapar datos de usuario en HTML

    # Bloque acompañante (si es acompañante de alguien)
    bloque_acompanante = f"""
      <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:12px 16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:0.9rem;color:#c9a84c;">👥 Acompañante de <strong>{e(acompanante_de)}</strong></p>
        {"<p style='margin:0;font-size:0.9rem;color:#c9a84c;'>🪑 " + f"Mesa {e(str(mesa))}</p>" if mesa else ""}
      </div>
    """ if acompanante_de else ""

    # Bloque mesa Diamond (solo para comprador principal)
    bloque_mesa = ""
    if mesa and not acompanante_de:
        companions_html = ""
        if companions:
            items_li = "".join(f"<li style='margin:2px 0;color:#c9a84c;'>{e(c)}</li>" for c in companions)
            companions_html = f"<ul style='margin:8px 0 0 16px;padding:0;font-size:0.85rem;'>{items_li}</ul>"
        bloque_mesa = f"""
      <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.4);border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 6px;font-size:1rem;color:#c9a84c;font-weight:bold;">🪑 Mesa {e(str(mesa))}</p>
        <p style="margin:0 0 6px;font-size:0.9rem;color:#c9a84c;">🥃 Botella Red Label incluida</p>
        {"<p style='margin:6px 0 2px;font-size:0.85rem;color:#a08840;'>Acompañantes registrados:</p>" + companions_html if companions else ""}
      </div>
    """

    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#e8e0d0;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#c9a84c;font-size:28px;margin:0;">Blue Wine</h1>
        <p style="color:#7a7060;font-size:13px;margin:4px 0;">MultiEspacio · Quillón, Ñuble</p>
      </div>
      <h2 style="font-size:20px;margin-bottom:8px;">¡Tu entrada está confirmada! 🎉</h2>
      <p>Hola <strong>{e(nombre)}</strong>, tu entrada fue procesada exitosamente.</p>
      {bloque_acompanante}
      {bloque_mesa}
      <div style="background:#13131a;border:1px solid #2a2820;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Evento:</strong> {e(evento)}</p>
        <p style="margin:0 0 8px;">⏰ Acceso hasta las 01:00 hrs</p>
        <p style="margin:0 0 8px;"><strong>Código:</strong> <span style="color:#c9a84c;font-family:monospace;font-size:16px;">{e(codigo)}</span></p>
        <p style="margin:0;">Presenta este QR en la entrada del recinto.</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <img src="cid:qr-ticket" alt="QR Ticket" style="width:200px;height:200px;border:4px solid #c9a84c;border-radius:8px;" />
      </div>
      <div style="background:rgba(224,82,82,0.1);border:1px solid rgba(224,82,82,0.35);border-radius:8px;padding:14px 16px;margin-bottom:16px;">
        <p style="margin:0;font-size:0.82rem;color:#e88;line-height:1.5;">
          ⚠️ <strong>Uso único:</strong> Este código QR es de un solo uso y será escaneado únicamente en la puerta al momento de ingresar al evento. No lo compartas ni lo presentes antes de llegar al recinto.
        </p>
      </div>
      <p style="color:#7a7060;font-size:12px;text-align:center;">Entrada personal e intransferible. Debes presentar tu cédula de identidad al ingresar.</p>
      <hr style="border:none;border-top:1px solid #2a2820;margin:20px 0;" />
      <p style="color:#7a7060;font-size:11px;text-align:center;">© 2026 Blue Wine · @bluewine.quillon</p>
    </div>
    """

    _smtp_send(
        to_list     = [destinatario],
        subject     = f"🎟️ Tu entrada para {evento} — Blue Wine",
        html        = html_body,
        inline_imgs = [{"cid": "qr-ticket", "data": qr_img}],
    )
    print(f"Email ticket enviado a {destinatario} via Brevo")


# ══════════════════════════════════════════════════════
# STOCK DIAMOND — entradas vendidas para mostrar disponibles en tiempo real
# ══════════════════════════════════════════════════════
@app.route("/stock", methods=["GET"])
@limiter.limit("60 per minute")
def stock():
    # Retorna cupos disponibles por tipo de entrada usando _get_stock_disponible().
    # Entradas sin límite (limite=0) no aparecen en la respuesta.
    try:
        return jsonify(_get_stock_disponible())
    except Exception as e:
        print(f"Error en /stock: {e}")
        return jsonify({})


# ══════════════════════════════════════════════════════
# RECUPERAR PAGO PENDIENTE — emite ticket desde pendientes
# Útil cuando el webhook falló pero el pago sí fue aprobado
# ══════════════════════════════════════════════════════
@app.route("/recuperar-pendiente", methods=["POST"])
def recuperar_pendiente():
    if request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    data       = request.get_json()
    compra_id  = str(data.get("compra_id", "")).strip()
    email_fix  = str(data.get("email", "")).strip()  # email corregido (opcional)

    if not compra_id:
        return jsonify({"ok": False, "error": "Falta compra_id"}), 400

    try:
        # Buscar pendiente en PostgreSQL primero, Sheets como fallback
        pendiente = None
        fila_sheets_p = None
        ws_p_ref = None

        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT comprador_json, items_json, acompanantes_json FROM pendientes WHERE compra_id = %s",
                    (compra_id,)
                )
                row_pg = cur.fetchone()
        if row_pg:
            pendiente = {"comprador_json": row_pg[0], "items_json": row_pg[1],
                         "acompanantes_json": row_pg[2] or "[]"}

        if not pendiente:
            try:
                ws_p_ref = get_sheet_pendientes()
                rows_s = ws_p_ref.get_all_records()
                for i, row in enumerate(rows_s, start=2):
                    if str(row.get("compra_id", "")) == compra_id:
                        fila_sheets_p = i
                        pendiente = row
                        break
            except Exception as e:
                print(f"Error buscando en Sheets: {e}")

        if not pendiente:
            return jsonify({"ok": False, "error": "compra_id no encontrado en pendientes"}), 404

        comprador    = json.loads(pendiente["comprador_json"])
        items        = json.loads(pendiente["items_json"])
        acompanantes = json.loads(pendiente.get("acompanantes_json") or "[]")

        if email_fix:
            comprador["email"] = email_fix

        # Expandir items respetando personas por entrada (igual que en el webhook)
        tickets_lista = []
        for item in items:
            personas = item.get("personas", 1)
            for _ in range(item["cantidad"]):
                for _ in range(personas):
                    tickets_lista.append({"nombre": item["nombre"], "precio": item["precioFinal"]})

        todos = [comprador] + acompanantes
        nombre_comprador = f"{comprador.get('nombre','')} {comprador.get('apellido','')}".strip()

        while len(tickets_lista) < len(todos):
            tickets_lista.append(tickets_lista[-1] if tickets_lista else {"nombre": "Entrada", "precio": 0})

        emitidos = []
        for idx, (asistente, ticket) in enumerate(zip(todos, tickets_lista)):
            _emitir_ticket(
                comprador   = asistente,
                evento      = ticket["nombre"],
                cantidad    = 1,
                precio_unit = ticket["precio"],
                total       = ticket["precio"],
                id_pago     = "RECUPERADO_MANUAL",
                acompanante_de = nombre_comprador if idx > 0 else ""
            )
            emitidos.append(ticket["nombre"])

        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM pendientes WHERE compra_id = %s", (compra_id,))
                conn.commit()
        except Exception as e:
            print(f"Error borrando pendiente de PG: {e}")
        if fila_sheets_p and ws_p_ref:
            try:
                ws_p_ref.delete_rows(fila_sheets_p)
            except Exception as e:
                print(f"Error borrando pendiente de Sheets: {e}")
        print(f"Pendiente {compra_id} recuperado manualmente — tickets: {emitidos}")
        return jsonify({"ok": True, "tickets_emitidos": emitidos, "email": comprador["email"]})

    except Exception as e:
        print(f"Error en recuperar-pendiente: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


# ══════════════════════════════════════════════════════
# EMITIR MANUAL — uso interno para corregir tickets faltantes
# Requiere clave secreta en el header X-Admin-Key
# ══════════════════════════════════════════════════════
@app.route("/emitir-manual", methods=["POST"])
def emitir_manual():
    if request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    data = request.get_json()
    comprador = data.get("comprador", {})
    evento    = data.get("evento", "")
    precio    = data.get("precio", 0)
    acomp_de  = data.get("acompanante_de", "")
    if not comprador or not evento:
        return jsonify({"ok": False, "error": "Faltan campos"}), 400
    try:
        _emitir_ticket(comprador=comprador, evento=evento, cantidad=1,
                       precio_unit=precio, total=precio,
                       id_pago="MANUAL", acompanante_de=acomp_de)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ══════════════════════════════════════════════════════
# REENVIAR TICKET — busca en Sheets y reenvía el email
# ══════════════════════════════════════════════════════
@app.route("/reenviar-ticket", methods=["POST"])
def reenviar_ticket():
    if request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    data       = request.get_json()
    buscar_id  = str(data.get("codigo", "")).strip()
    email_dest = str(data.get("email", "")).strip()

    if not buscar_id or not email_dest:
        return jsonify({"ok": False, "error": "Faltan campos codigo y email"}), 400

    # Buscar en PostgreSQL primero (fuente de verdad), luego Sheets como fallback
    ticket = None
    codigo = nombre = evento = url_qr = None

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT codigo, nombre, apellido, evento, url_verificacion
                    FROM tickets
                    WHERE UPPER(codigo) = UPPER(%s) OR id_pago = %s
                    LIMIT 1
                """, (buscar_id, buscar_id))
                row = cur.fetchone()
        if row:
            codigo, nom, ape, evento, url_qr = row
            nombre  = f"{nom or ''} {ape or ''}".strip()
            url_qr  = url_qr or f"https://bluewine-production.up.railway.app/verificar/{codigo}"
            ticket  = True
    except Exception as e:
        print(f"[reenviar] PG falló, probando Sheets: {e}")

    if not ticket:
        try:
            ws   = get_sheet()
            rows = ws.get_all_records()
            for row in rows:
                c = str(row.get("codigo_ticket", "")).upper()
                p = str(row.get("id_pago_mp", ""))
                if c == buscar_id.upper() or p == buscar_id:
                    codigo  = row["codigo_ticket"]
                    nombre  = f"{row.get('nombre','')} {row.get('apellido','')}".strip()
                    evento  = row.get("evento", "Blue Wine")
                    url_qr  = row.get("url_verificacion", f"https://bluewine-production.up.railway.app/verificar/{codigo}")
                    ticket  = True
                    break
        except Exception as e:
            print(f"[reenviar] Sheets falló: {e}")

    if not ticket:
        return jsonify({"ok": False, "error": "Ticket no encontrado"}), 404

    try:
        qr_img = _generar_qr(url_qr)
        _enviar_email_ticket(
            destinatario = email_dest,
            nombre       = nombre,
            evento       = evento,
            codigo       = codigo,
            qr_img       = qr_img
        )
        print(f"Ticket {codigo} reenviado a {email_dest}")
        return jsonify({"ok": True, "codigo": codigo, "nombre": nombre, "evento": evento})
    except Exception as e:
        print(f"Error en reenviar-ticket: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


# ══════════════════════════════════════════════════════
# ENTRADA LIBERADA — sin pago, genera ticket directo
# ══════════════════════════════════════════════════════
@app.route("/obtener-entrada-gratis", methods=["POST"])
@limiter.limit("5 per hour")
def obtener_entrada_gratis():
    data      = request.get_json()
    comprador = data.get("comprador", {})
    rut       = str(comprador.get("rut", "")).strip()
    dia       = str(data.get("dia", "viernes")).strip()  # "viernes" o "sabado"

    # Verificar que gratis esté activo para el día solicitado
    if dia == 'sabado':
        gratis_activa = False
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT valor FROM config WHERE clave = 'eventoSabado'")
                    row = cur.fetchone()
                    if row:
                        gratis_activa = bool(json.loads(row[0]).get('entradasGratis', False))
        except Exception:
            pass
        if not gratis_activa and not ENTRADA_GRATIS_ACTIVA:
            return jsonify({"ok": False, "error": "La entrada liberada no está activa"}), 403
    else:
        if not _get_config_bool('entradasGratis', ENTRADA_GRATIS_ACTIVA):
            return jsonify({"ok": False, "error": "La entrada liberada no está activa"}), 403
    limite    = _get_limite_entradas_gratis(dia)

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM tickets WHERE id_pago = 'ENTRADA_LIBERADA'")
                total_gratis = cur.fetchone()[0]

                if rut:
                    cur.execute("""
                        SELECT 1 FROM tickets
                        WHERE id_pago = 'ENTRADA_LIBERADA' AND rut = %s AND estado = 'ACTIVO'
                        LIMIT 1
                    """, (rut,))
                    if cur.fetchone():
                        return jsonify({"ok": False, "error": "Ya tienes una entrada registrada para este evento. No es posible obtener una segunda entrada."}), 400

        if total_gratis >= limite:
            return jsonify({"ok": False, "error": "Las entradas gratuitas se han agotado."}), 400

    except Exception as e:
        print(f"Error verificando límite/duplicado: {e}")
        return jsonify({"ok": False, "error": "Error al verificar disponibilidad. Intenta nuevamente."}), 500

    try:
        _emitir_ticket(
            comprador   = comprador,
            evento      = f"{_get_nombre_evento()} — Entrada Gratuita",
            cantidad    = 1,
            precio_unit = 0,
            total       = 0,
            id_pago     = "ENTRADA_LIBERADA"
        )
        print(f"Entrada gratuita emitida — total: {total_gratis + 1}/{limite}")
        # Notificar a Blue Wine
        try:
            copia_bw = os.getenv("EMAIL_COPIA", "bluewine.contacto@gmail.com")
            e = _html.escape
            nombre_c = e(f"{comprador.get('nombre','')} {comprador.get('apellido','')}".strip())
            _smtp_send(
                to_list = [copia_bw],
                subject = f"🎟️ Entrada gratis emitida — {nombre_c} ({total_gratis + 1}/{limite})",
                html    = f"""<div style="font-family:Arial,sans-serif;max-width:500px;background:#0a0a0f;color:#e8e0d0;padding:24px;border-radius:12px;">
                  <h3 style="color:#c9a84c;">🎟️ Entrada gratuita emitida</h3>
                  <p><strong>Nombre:</strong> {nombre_c}</p>
                  <p><strong>RUT:</strong> {e(comprador.get('rut','—'))}</p>
                  <p><strong>Email:</strong> {e(comprador.get('email','—'))}</p>
                  <p><strong>Teléfono:</strong> {e(comprador.get('telefono','—'))}</p>
                  <p><strong>Total emitidas:</strong> {total_gratis + 1}/{limite}</p>
                </div>"""
            )
        except Exception as ex:
            print(f"Error enviando copia gratis a BW: {ex}")
        return jsonify({"ok": True})
    except Exception as e:
        print(f"Error generando entrada gratis: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500



# ══════════════════════════════════════════════════════
# RECORDATORIOS — cron job diario desde cron-job.org
# Envía email 1 día antes del evento a todos los tickets ACTIVOS
# ══════════════════════════════════════════════════════
@app.route("/enviar-recordatorios", methods=["POST"])
def enviar_recordatorios():
    token = request.headers.get("X-Cron-Token", "")
    if token != os.getenv("CRON_TOKEN", ""):
        return jsonify({"error": "No autorizado"}), 401

    manana = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        ws   = get_sheet()
        rows = ws.get_all_records()

        enviados = 0
        for row in rows:
            fecha_ev = str(row.get("fecha_evento", "")).strip()
            estado   = str(row.get("estado", "")).upper()
            email    = row.get("email", "")

            if fecha_ev == manana and estado == "ACTIVO" and email:
                try:
                    _enviar_email_recordatorio(
                        destinatario = email,
                        nombre       = f"{row.get('nombre','')} {row.get('apellido','')}".strip(),
                        evento       = row.get("evento", "Evento Blue Wine"),
                        fecha_evento = fecha_ev,
                        codigo       = row.get("codigo_ticket", "")
                    )
                    enviados += 1
                except Exception as e:
                    print(f"Error enviando recordatorio a {email}: {e}")

        print(f"Recordatorios enviados: {enviados}")
        return jsonify({"ok": True, "enviados": enviados})

    except Exception as e:
        print(f"Error en recordatorios: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


def _enviar_email_recordatorio(destinatario, nombre, evento, fecha_evento, codigo):
    e = _html.escape

    try:
        dt = datetime.datetime.strptime(fecha_evento, "%Y-%m-%d")
        dias  = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
        meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre']
        fecha_legible = f"{dias[dt.weekday()]} {dt.day} de {meses[dt.month-1]} de {dt.year}"
    except Exception:
        fecha_legible = _html.escape(str(fecha_evento))

    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#e8e0d0;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#c9a84c;font-size:28px;margin:0;">Blue Wine</h1>
        <p style="color:#7a7060;font-size:13px;margin:4px 0;">MultiEspacio · Quillón, Ñuble</p>
      </div>
      <h2 style="font-size:20px;margin-bottom:8px;">⏰ ¡Mañana es el evento!</h2>
      <p>Hola <strong>{e(nombre)}</strong>, te recordamos que mañana tienes una entrada para:</p>
      <div style="background:#13131a;border:1px solid #c9a84c;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:1.2rem;color:#c9a84c;font-weight:bold;">{e(evento)}</p>
        <p style="margin:0;color:#aaa;">📅 {fecha_legible}</p>
        <p style="margin:8px 0 0;font-family:monospace;color:#c9a84c;font-size:15px;">{e(codigo)}</p>
      </div>
      <p>Recuerda traer tu entrada QR (revisa el email anterior) y tu <strong>cédula de identidad</strong>.</p>
      <p style="color:#7a7060;font-size:12px;">📍 Camino Cerro Negro Km 3.5, Quillón, Ñuble</p>
      <hr style="border:none;border-top:1px solid #2a2820;margin:20px 0;" />
      <p style="color:#7a7060;font-size:11px;text-align:center;">© 2026 Blue Wine · @bluewine.quillon</p>
    </div>
    """

    _smtp_send(
        to_list = [destinatario],
        subject = f"⏰ Recordatorio: {evento} es mañana — Blue Wine",
        html    = html_body,
    )
    print(f"Recordatorio enviado a {destinatario} via Brevo")



# ══════════════════════════════════════════════════════
# RESERVAS — recibe datos del formulario y envía email
# ══════════════════════════════════════════════════════
@app.route("/reserva", methods=["POST"])
@limiter.limit("5 per hour")
def reserva():
    try:
        data     = request.get_json(force=True) or {}
        nombre   = _html.escape(str(data.get("nombre", "")))
        telefono = _html.escape(str(data.get("telefono", "")))
        email    = _html.escape(str(data.get("email", "")))
        tipo     = _html.escape(str(data.get("tipo", "")))
        fecha    = _html.escape(str(data.get("fecha", "")))
        personas = _html.escape(str(data.get("personas", "")))
        mensaje  = _html.escape(str(data.get("mensaje", "")))
        copia_bw = os.getenv("EMAIL_COPIA", "bluewine.contacto@gmail.com")

        html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#e8e0d0;padding:32px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#c9a84c;font-size:28px;margin:0;">Blue Wine</h1>
            <p style="color:#7a7060;font-size:13px;margin:4px 0;">MultiEspacio · Quillón, Ñuble</p>
          </div>
          <h2 style="font-size:18px;margin-bottom:16px;">📋 Nueva Solicitud de Reserva</h2>
          <div style="background:#13131a;border:1px solid #2a2820;border-radius:8px;padding:20px;margin:16px 0;">
            <p style="margin:0 0 8px;"><strong style="color:#c9a84c;">Nombre:</strong> {nombre}</p>
            <p style="margin:0 0 8px;"><strong style="color:#c9a84c;">Teléfono:</strong> {telefono}</p>
            <p style="margin:0 0 8px;"><strong style="color:#c9a84c;">Email:</strong> {email}</p>
            <p style="margin:0 0 8px;"><strong style="color:#c9a84c;">Tipo:</strong> {tipo}</p>
            <p style="margin:0 0 8px;"><strong style="color:#c9a84c;">Fecha:</strong> {fecha}</p>
            <p style="margin:0 0 8px;"><strong style="color:#c9a84c;">Personas:</strong> {personas}</p>
            <p style="margin:0;"><strong style="color:#c9a84c;">Mensaje:</strong> {mensaje}</p>
          </div>
          <hr style="border:none;border-top:1px solid #2a2820;margin:20px 0;" />
          <p style="color:#7a7060;font-size:11px;text-align:center;">© 2026 Blue Wine · @bluewine.quillon</p>
        </div>
        """

        _smtp_send(
            to_list = [copia_bw],
            subject = f"📋 Nueva reserva de {nombre} — Blue Wine",
            html    = html_body,
        )
        print(f"Email reserva enviado via Brevo — {nombre}")
        return jsonify({"ok": True})

    except Exception as e:
        print(f"Error enviando email reserva: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


# ══════════════════════════════════════════════════════
# CONFIG — lectura pública y escritura admin
# ══════════════════════════════════════════════════════
@app.route("/config", methods=["GET"])
def get_config():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT clave, valor FROM config")
                rows = cur.fetchall()
        result = {}
        for k, v in rows:
            try:
                result[k] = json.loads(v)
            except Exception:
                result[k] = v
        return jsonify({"ok": True, **result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/admin/config", methods=["POST"])
def set_config():
    if request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    try:
        data = request.get_json(force=True) or {}
        with get_db() as conn:
            with conn.cursor() as cur:
                for clave, valor in data.items():
                    cur.execute("""
                        INSERT INTO config (clave, valor, updated)
                        VALUES (%s, %s, NOW())
                        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated = NOW()
                    """, (clave, json.dumps(valor)))
            conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ══════════════════════════════════════════════════════
# ADMIN — tickets y anulación
# ══════════════════════════════════════════════════════
@app.route("/admin/tickets", methods=["GET"])
def admin_tickets():
    if request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    try:
        limit  = min(int(request.args.get("limit",  500)), 1000)
        offset = max(int(request.args.get("offset", 0)),   0)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM tickets")
                total = cur.fetchone()[0]
                cur.execute("""
                    SELECT codigo, nombre, apellido, rut, evento, acompanante_de,
                           email, telefono, precio_unit, fecha_compra, id_pago, estado
                    FROM tickets
                    ORDER BY fecha_compra DESC NULLS LAST
                    LIMIT %s OFFSET %s
                """, (limit, offset))
                cols = [d[0] for d in cur.description]
                rows = cur.fetchall()
        tickets_list = []
        for row in rows:
            t = dict(zip(cols, row))
            if t.get("fecha_compra"):
                t["fecha_compra"] = t["fecha_compra"].strftime("%Y-%m-%d %H:%M")
            tickets_list.append(t)
        return jsonify({"ok": True, "tickets": tickets_list, "total": total, "limit": limit, "offset": offset})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/admin/anular-ticket", methods=["POST"])
def admin_anular_ticket():
    if request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    try:
        data   = request.get_json(force=True) or {}
        codigo = str(data.get("codigo", "")).strip().upper()
        if not codigo:
            return jsonify({"ok": False, "error": "Falta codigo"}), 400
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE tickets SET estado = 'ANULADO'
                    WHERE codigo = %s AND estado != 'ANULADO'
                """, (codigo,))
                updated = cur.rowcount
            conn.commit()
        if updated == 0:
            return jsonify({"ok": False, "error": "Ticket no encontrado o ya anulado"}), 404

        def _sync_anulado(cod):
            try:
                ws   = get_sheet()
                rows = ws.get_all_records()
                for i, r in enumerate(rows, start=2):
                    if str(r.get("codigo_ticket", "")).upper() == cod.upper():
                        ws.update_cell(i, 14, "ANULADO")
                        break
            except Exception as ex:
                print(f"[anular] Sheets sync en background falló: {ex}")
        threading.Thread(target=_sync_anulado, args=(codigo,), daemon=True).start()

        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ══════════════════════════════════════════════════════
# VERIFICAR TICKET — Página que escanea el guardia
# ══════════════════════════════════════════════════════
@app.route("/verificar/<codigo>", methods=["GET"])
def verificar_ticket(codigo):
    # I5: buscar en PostgreSQL primero (rápido) — fallback a Sheets si no se encuentra
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT codigo, nombre, apellido, rut, evento, acompanante_de,
                           email, telefono, precio_unit, id_pago, estado
                    FROM tickets WHERE UPPER(codigo) = UPPER(%s)
                """, (codigo,))
                row = cur.fetchone()
                ticket_pg = None
                if row:
                    cols = ['codigo', 'nombre', 'apellido', 'rut', 'evento', 'acompanante_de',
                            'email', 'telefono', 'precio_unit', 'id_pago', 'estado']
                    ticket_pg = dict(zip(cols, row))
                    nombre_completo_pg = f"{ticket_pg.get('nombre','')} {ticket_pg.get('apellido','')}".strip()
                    cur.execute("""
                        SELECT nombre, apellido FROM tickets
                        WHERE acompanante_de = %s AND acompanante_de != ''
                    """, (nombre_completo_pg,))
                    acompanantes_pg = [f"{r[0]} {r[1]}".strip() for r in cur.fetchall()]

        if ticket_pg:
            estado = ticket_pg.get('estado', '').upper()
            if estado == "USADO":
                return _html_verificacion("⚠️ Entrada ya utilizada", "Esta entrada fue escaneada previamente. No se permite el reingreso.", "usado", codigo, ticket_pg, acompanantes_pg)
            if estado != "ACTIVO":
                return _html_verificacion("❌ Entrada inválida", f"Estado: {estado}", "invalido", codigo)

            # Marcar USADO en PostgreSQL
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute("UPDATE tickets SET estado = 'USADO' WHERE UPPER(codigo) = UPPER(%s)", (codigo,))
                conn.commit()

            # Actualizar Sheets en background (no bloquea la respuesta)
            def _sync_sheets_usado(cod):
                try:
                    ws   = get_sheet()
                    rows = ws.get_all_records()
                    for i, r in enumerate(rows, start=2):
                        if str(r.get("codigo_ticket", "")).upper() == cod.upper():
                            ws.update_cell(i, 14, "USADO")
                            break
                except Exception as ex:
                    print(f"[verificar] Sheets sync en background falló: {ex}")
            threading.Thread(target=_sync_sheets_usado, args=(codigo,), daemon=True).start()

            print(f"Ticket {codigo} marcado como USADO (PostgreSQL)")
            return _html_verificacion("✅ Entrada válida — ¡Bienvenido!", "La entrada fue marcada como utilizada. Puedes dejar pasar al asistente.", "valido", codigo, ticket_pg, acompanantes_pg)

    except Exception as e:
        print(f"[verificar] PostgreSQL falló, usando Sheets como fallback: {e}")

    # Fallback: Sheets (lento pero siempre disponible)
    try:
        ws   = get_sheet()
        rows = ws.get_all_records()

        fila_num = None
        ticket   = None
        for i, row in enumerate(rows, start=2):
            if str(row.get("codigo_ticket", "")).upper() == codigo.upper():
                fila_num = i
                ticket   = row
                break

        if not ticket:
            return _html_verificacion("❌ Ticket no encontrado", "Este código QR no corresponde a ninguna entrada válida.", "invalido", codigo)

        estado = ticket.get("estado", "").upper()
        nombre_completo = f"{ticket.get('nombre','')} {ticket.get('apellido','')}".strip()
        acompanantes = [
            f"{r.get('nombre','')} {r.get('apellido','')}".strip()
            for r in rows
            if str(r.get("acompanante_de", "")).strip().lower() == nombre_completo.lower()
        ]

        if estado == "USADO":
            return _html_verificacion("⚠️ Entrada ya utilizada", "Esta entrada fue escaneada previamente. No se permite el reingreso.", "usado", codigo, ticket, acompanantes)
        if estado != "ACTIVO":
            return _html_verificacion("❌ Entrada inválida", f"Estado: {estado}", "invalido", codigo)

        ws.update_cell(fila_num, 14, "USADO")
        print(f"Ticket {codigo} marcado como USADO (Sheets fallback)")
        return _html_verificacion("✅ Entrada válida — ¡Bienvenido!", "La entrada fue marcada como utilizada. Puedes dejar pasar al asistente.", "valido", codigo, ticket, acompanantes)

    except Exception as e:
        print(f"Error verificando ticket (Sheets): {e}")
        return _html_verificacion("⚠️ Error del sistema", str(e), "error", codigo)
    


def _html_verificacion(titulo, mensaje, tipo, codigo, ticket=None, acompanantes=None):
    colores = {
        "valido":   ("#0a1f0a", "#4caf50", "#e8f5e9"),
        "usado":    ("#1f150a", "#ff9800", "#fff3e0"),
        "invalido": ("#1f0a0a", "#f44336", "#ffebee"),
        "error":    ("#111",    "#9e9e9e", "#f5f5f5"),
    }
    bg, color, _ = colores.get(tipo, colores["error"])

    detalles = ""
    if ticket:
        ev = _html.escape
        nombre       = ev(f"{ticket.get('nombre', '')} {ticket.get('apellido', '')}".strip())
        evento_raw   = ticket.get('evento', '—')
        tipo_entrada = ev(evento_raw.split(' — ', 1)[-1] if ' — ' in evento_raw else evento_raw)
        acomp_de     = ev(ticket.get("acompanante_de", "").strip())
        acomp_de_html = f'<p style="margin:4px 0;color:#aaa;"><strong style="color:#c9a84c;">👥 Acompañante de:</strong> {acomp_de}</p>' if acomp_de else ""

        acomp_lista = ""
        if acompanantes:
            items_html = "".join(f'<li style="margin:2px 0;color:#aaa;">{ev(a)}</li>' for a in acompanantes)
            acomp_lista = f"""
            <div style="margin-top:10px;">
              <p style="margin:4px 0;color:#ddd;font-weight:bold;">👥 Acompañantes registrados:</p>
              <ul style="margin:6px 0 0 16px;padding:0;font-size:13px;">{items_html}</ul>
            </div>"""

        detalles = f"""
        <div style="background:#0f0f15;border:1px solid #2a2820;border-radius:8px;padding:16px;margin-top:16px;text-align:left;font-size:14px;">
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">Nombre:</strong> {nombre}</p>
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">RUT:</strong> {ev(ticket.get('rut','—'))}</p>
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">Entrada:</strong> {tipo_entrada}</p>
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">Código:</strong> <span style="font-family:monospace;color:#c9a84c;">{ev(codigo)}</span></p>
          {acomp_de_html}
          {acomp_lista}
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificación — Blue Wine</title>
  <style>
    *{{box-sizing:border-box;}} body{{font-family:Arial,sans-serif;background:#07070d;color:#e0d8cc;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:16px;}}
    .card{{background:{bg};border:2px solid {color};border-radius:16px;padding:32px 24px;max-width:420px;width:100%;text-align:center;}}
    h1{{color:{color};font-size:20px;margin:0 0 12px;}} p{{color:#bbb;font-size:14px;margin:0 0 8px;line-height:1.5;}}
    .brand{{color:#c9a84c;font-size:13px;margin-bottom:20px;}}
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">🍷 Blue Wine · Verificación de entrada</div>
    <h1>{titulo}</h1>
    <p>{mensaje}</p>
    {detalles}
  </div>
</body>
</html>""", 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)