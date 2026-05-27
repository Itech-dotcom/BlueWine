# Programador: Isaac Fernández
# Blue Wine — Backend MercadoPago + Google Sheets + QR

from flask import Flask, request, jsonify
from flask_cors import CORS          # permite peticiones desde el frontend (bluewine.cl)
import mercadopago                   # SDK oficial de MercadoPago
import os                            # para leer variables de entorno (.env)
import json                          # para convertir datos a texto y viceversa
import uuid                          # para generar códigos únicos de ticket
import datetime                      # para registrar fecha y hora de compra
import qrcode                        # para generar la imagen del código QR
import io                            # para manejar la imagen QR en memoria
import resend                        # para enviar emails con el ticket
import base64                        # para convertir la imagen QR a texto (adjunto email)
from dotenv import load_dotenv       # para cargar el archivo .env con claves secretas
import gspread                       # para leer/escribir en Google Sheets
from google.oauth2.service_account import Credentials  # autenticación con Google

load_dotenv()  # carga las variables del archivo .env (MP_ACCESS_TOKEN, etc.)

app = Flask(__name__)
CORS(app)  # permite que el frontend haga peticiones al backend sin bloqueos

sdk = mercadopago.SDK(os.getenv("MP_ACCESS_TOKEN"))  # inicializa MercadoPago con la clave del .env

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
# CREAR PREFERENCIA DE PAGO
# ══════════════════════════════════════════════════════
@app.route("/crear-pago", methods=["POST"])
def crear_pago():
    # Recibe los datos del carrito y el comprador desde el frontend,
    # crea una preferencia de pago en MercadoPago y guarda los datos en "pendientes".
    # El frontend redirige al usuario a init_point para que pague.
    data         = request.get_json()
    items        = data.get("items", [])          # lista de entradas del carrito
    comprador    = data.get("comprador", {})       # datos del comprador principal
    acompanantes = data.get("acompanantes", [])    # lista de acompañantes (puede estar vacía)
    compra_id    = str(uuid.uuid4())               # ID único para identificar esta compra

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
    print("Respuesta MP:", preference_response)

    if "response" not in preference_response or "id" not in preference_response.get("response", {}):
        return jsonify({"error": "Error MercadoPago", "detalle": preference_response}), 400

    preference = preference_response["response"]

    # Guardar datos del comprador en la hoja "pendientes" mientras espera confirmación del pago.
    # Cuando el webhook confirme el pago, se recuperan estos datos para emitir los tickets.
    try:
        ws = get_sheet_pendientes()
        ws.append_row([
            compra_id,
            json.dumps(comprador),      # guardado como texto JSON
            json.dumps(items),
            preference["id"],
            datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            json.dumps(acompanantes)    # lista de acompañantes en JSON ([] si no hay)
        ])
        print(f"Compra {compra_id} guardada en pendientes")
    except Exception as e:
        print(f"Error guardando pendiente en Sheets: {e}")

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
                # Evitar emitir tickets duplicados si MP envía el webhook más de una vez
                ws_t = get_sheet()
                tickets_existentes = ws_t.get_all_records()
                for t in tickets_existentes:
                    if str(t.get("id_pago", "")) == str(payment_id):
                        print(f"Pago {payment_id} ya procesado anteriormente — ignorando webhook duplicado")
                        return jsonify({"status": "ok"}), 200

                # Buscar los datos del comprador en la hoja "pendientes"
                ws_p    = get_sheet_pendientes()
                rows_p  = ws_p.get_all_records()
                fila_p  = None
                pendiente = None

                for i, row in enumerate(rows_p, start=2):  # start=2 porque fila 1 es el encabezado
                    if str(row.get("compra_id", "")) == compra_id:
                        fila_p    = i
                        pendiente = row
                        break

                if not pendiente:
                    print(f"compra_id {compra_id} no encontrado en pendientes")
                else:
                    comprador    = json.loads(pendiente["comprador_json"])
                    items        = json.loads(pendiente["items_json"])
                    acompanantes = json.loads(pendiente.get("acompanantes_json") or "[]")  # [] si no hay acompañantes

                    # Expandir el carrito en una lista de tickets individuales.
                    # Ej: 3x Preventa 1 → [ticket, ticket, ticket]
                    tickets_lista = []
                    for item in items:
                        for _ in range(item["cantidad"]):
                            tickets_lista.append({
                                "nombre": item["nombre"],
                                "precio": item["precioFinal"]
                            })

                    # Unir comprador + acompañantes en una sola lista
                    # Cada persona recibe su propio ticket con su propio QR y email
                    todos = [comprador] + acompanantes
                    nombre_comprador = f"{comprador.get('nombre','')} {comprador.get('apellido','')}".strip()
                    print(f"DEBUG — items: {items}, acompañantes: {len(acompanantes)}, tickets_lista: {len(tickets_lista)}, todos: {len(todos)}")

                    # Si hay más personas que tickets, extender tickets_lista repitiendo el último
                    while len(tickets_lista) < len(todos):
                        tickets_lista.append(tickets_lista[-1] if tickets_lista else {"nombre": "Entrada", "precio": 0})

                    for idx, (asistente, ticket) in enumerate(zip(todos, tickets_lista)):
                        es_acomp = idx > 0  # el primero es el comprador, los demás son acompañantes
                        _emitir_ticket(
                            comprador      = asistente,
                            evento         = ticket["nombre"],
                            cantidad       = 1,
                            precio_unit    = ticket["precio"],
                            total          = ticket["precio"],
                            id_pago        = str(payment_id),
                            acompanante_de = nombre_comprador if es_acomp else ""  # vacío para el comprador principal
                        )

                    # Una vez procesado, borrar de pendientes para no emitir de nuevo
                    ws_p.delete_rows(fila_p)
                    print(f"Compra {compra_id} procesada y eliminada de pendientes")

        except Exception as e:
            print("Error procesando webhook:", e)

    # Siempre responder 200 a MP aunque falle, para que no reintente infinitamente
    return jsonify({"status": "ok"}), 200


# ══════════════════════════════════════════════════════
# EMITIR TICKET: Sheets + QR + Email
# ══════════════════════════════════════════════════════
def _emitir_ticket(comprador, evento, cantidad, precio_unit, total, id_pago, acompanante_de=""):
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
            acompanante_de = acompanante_de
        )
    except Exception as e:
        print(f"Error enviando email: {e}")


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


def _enviar_email_ticket(destinatario, nombre, evento, codigo, qr_img, acompanante_de=""):
    resend.api_key = os.getenv("RESEND_API_KEY")
    copia_bw       = os.getenv("EMAIL_COPIA", "bluewine.contacto@gmail.com")

    qr_b64 = base64.b64encode(qr_img).decode("utf-8")

    bloque_acompanante = f"""
      <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:12px 16px;margin:0 0 16px;">
        <p style="margin:0;font-size:0.9rem;color:#c9a84c;">👥 Acompañante de <strong>{acompanante_de}</strong></p>
      </div>
    """ if acompanante_de else ""

    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#e8e0d0;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#c9a84c;font-size:28px;margin:0;">Blue Wine</h1>
        <p style="color:#7a7060;font-size:13px;margin:4px 0;">MultiEspacio · Quillón, Ñuble</p>
      </div>
      <h2 style="font-size:20px;margin-bottom:8px;">¡Tu entrada está confirmada! 🎉</h2>
      <p>Hola <strong>{nombre}</strong>, tu entrada fue procesada exitosamente.</p>
      {bloque_acompanante}
      <div style="background:#13131a;border:1px solid #2a2820;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Evento:</strong> {evento}</p>
        <p style="margin:0 0 8px;"><strong>Código:</strong> <span style="color:#c9a84c;font-family:monospace;font-size:16px;">{codigo}</span></p>
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

    params = {
        "from": "Blue Wine <tickets@bluewine.cl>",
        "to": [destinatario],
        "bcc": [copia_bw],
        "subject": f"🎟️ Tu entrada para {evento} — Blue Wine",
        "html": html_body,
        "attachments": [
            {
                "content": qr_b64,
                "filename": "ticket-qr.png",
                "content_id": "qr-ticket",  # ← coincide con cid:qr-ticket en el HTML
                "content_type": "image/png",  # ← necesario para que Gmail/Outlook rendericen el QR inline
            }
        ],
    }

    response = resend.Emails.send(params)
    print(f"Email enviado a {destinatario} via Resend — ID: {response['id']}")


# ══════════════════════════════════════════════════════
# STOCK DIAMOND — entradas vendidas para mostrar disponibles en tiempo real
# ══════════════════════════════════════════════════════
@app.route("/stock", methods=["GET"])
def stock():
    # El frontend llama a este endpoint cada vez que alguien abre el modal de entradas.
    # Cuenta cuántas entradas de cada tipo ya fueron vendidas y retorna los cupos restantes.
    # Si falla (ej: Sheets no responde), retorna los valores máximos como fallback.
    try:
        ws   = get_sheet()
        rows = ws.get_all_records()
        vendidos = {"prevDiamond": 0, "puertaDiamond": 0, "mesaDiamond": 0}
        for row in rows:
            evento = str(row.get("evento", "")).lower()
            estado = str(row.get("estado", "")).upper()
            if estado in ("ACTIVO", "USADO"):  # no contar tickets anulados
                if "preventa diamond" in evento:
                    vendidos["prevDiamond"] += 1
                elif "puerta diamond" in evento:
                    vendidos["puertaDiamond"] += 1
                elif "mesa diamond" in evento or "mesa vip" in evento:
                    vendidos["mesaDiamond"] += 1  # "mesa vip" por compatibilidad con tickets antiguos
        return jsonify({
            "prevDiamond":   max(0, 50 - vendidos["prevDiamond"]),   # límite: 50
            "puertaDiamond": max(0, 50 - vendidos["puertaDiamond"]), # límite: 50
            "mesaDiamond":   max(0, 10 - vendidos["mesaDiamond"])    # límite: 10 mesas
        })
    except Exception as e:
        print(f"Error en /stock: {e}")
        return jsonify({"prevDiamond": 50, "puertaDiamond": 50, "mesaDiamond": 10})  # fallback


# ══════════════════════════════════════════════════════
# RECUPERAR PAGO PENDIENTE — emite ticket desde pendientes
# Útil cuando el webhook falló pero el pago sí fue aprobado
# ══════════════════════════════════════════════════════
@app.route("/recuperar-pendiente", methods=["POST"])
def recuperar_pendiente():
    data       = request.get_json()
    compra_id  = str(data.get("compra_id", "")).strip()
    email_fix  = str(data.get("email", "")).strip()  # email corregido (opcional)

    if not compra_id:
        return jsonify({"ok": False, "error": "Falta compra_id"}), 400

    try:
        ws_p  = get_sheet_pendientes()
        rows  = ws_p.get_all_records()

        fila_p    = None
        pendiente = None
        for i, row in enumerate(rows, start=2):
            if str(row.get("compra_id", "")) == compra_id:
                fila_p    = i
                pendiente = row
                break

        if not pendiente:
            return jsonify({"ok": False, "error": "compra_id no encontrado en pendientes"}), 404

        comprador = json.loads(pendiente["comprador_json"])
        items     = json.loads(pendiente["items_json"])

        if email_fix:
            comprador["email"] = email_fix

        emitidos = []
        for item in items:
            for _ in range(item["cantidad"]):
                _emitir_ticket(
                    comprador   = comprador,
                    evento      = item["nombre"],
                    cantidad    = 1,
                    precio_unit = item["precioFinal"],
                    total       = item["precioFinal"],
                    id_pago     = "RECUPERADO_MANUAL"
                )
                emitidos.append(item["nombre"])

        ws_p.delete_rows(fila_p)
        print(f"Pendiente {compra_id} recuperado manualmente — tickets: {emitidos}")
        return jsonify({"ok": True, "tickets_emitidos": emitidos, "email": comprador["email"]})

    except Exception as e:
        print(f"Error en recuperar-pendiente: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


# ══════════════════════════════════════════════════════
# REENVIAR TICKET — busca en Sheets y reenvía el email
# ══════════════════════════════════════════════════════
@app.route("/reenviar-ticket", methods=["POST"])
def reenviar_ticket():
    data       = request.get_json()
    buscar_id  = str(data.get("codigo", "")).strip()
    email_dest = str(data.get("email", "")).strip()

    if not buscar_id or not email_dest:
        return jsonify({"ok": False, "error": "Faltan campos codigo y email"}), 400

    try:
        ws   = get_sheet()
        rows = ws.get_all_records()

        ticket = None
        for row in rows:
            codigo  = str(row.get("codigo_ticket", "")).upper()
            id_pago = str(row.get("id_pago_mp", ""))
            if buscar_id.upper() in codigo or buscar_id in id_pago or codigo in buscar_id.upper():
                ticket = row
                break

        if not ticket:
            return jsonify({"ok": False, "error": "Ticket no encontrado"}), 404

        codigo   = ticket["codigo_ticket"]
        nombre   = f"{ticket.get('nombre','')} {ticket.get('apellido','')}".strip()
        evento   = ticket.get("evento", "Blue Wine")
        url_qr   = ticket.get("url_verificacion", f"https://bluewine-production.up.railway.app/verificar/{codigo}")

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
def obtener_entrada_gratis():
    data          = request.get_json()
    comprador     = data.get("comprador", {})
    nombre_evento = data.get("nombreEvento", "Evento Blue Wine")
    cantidad      = int(data.get("cantidad", 1))

    try:
        for _ in range(cantidad):
            _emitir_ticket(
                comprador   = comprador,
                evento      = nombre_evento,
                cantidad    = 1,
                precio_unit = 0,
                total       = 0,
                id_pago     = "ENTRADA_LIBERADA"
            )
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
    resend.api_key = os.getenv("RESEND_API_KEY")

    try:
        dt = datetime.datetime.strptime(fecha_evento, "%Y-%m-%d")
        dias  = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
        meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre']
        fecha_legible = f"{dias[dt.weekday()]} {dt.day} de {meses[dt.month-1]} de {dt.year}"
    except Exception:
        fecha_legible = fecha_evento

    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#e8e0d0;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#c9a84c;font-size:28px;margin:0;">Blue Wine</h1>
        <p style="color:#7a7060;font-size:13px;margin:4px 0;">MultiEspacio · Quillón, Ñuble</p>
      </div>
      <h2 style="font-size:20px;margin-bottom:8px;">⏰ ¡Mañana es el evento!</h2>
      <p>Hola <strong>{nombre}</strong>, te recordamos que mañana tienes una entrada para:</p>
      <div style="background:#13131a;border:1px solid #c9a84c;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:1.2rem;color:#c9a84c;font-weight:bold;">{evento}</p>
        <p style="margin:0;color:#aaa;">📅 {fecha_legible}</p>
        <p style="margin:8px 0 0;font-family:monospace;color:#c9a84c;font-size:15px;">{codigo}</p>
      </div>
      <p>Recuerda traer tu entrada QR (revisa el email anterior) y tu <strong>cédula de identidad</strong>.</p>
      <p style="color:#7a7060;font-size:12px;">📍 Camino Cerro Negro Km 3.5, Quillón, Ñuble</p>
      <hr style="border:none;border-top:1px solid #2a2820;margin:20px 0;" />
      <p style="color:#7a7060;font-size:11px;text-align:center;">© 2026 Blue Wine · @bluewine.quillon</p>
    </div>
    """

    resend.Emails.send({
        "from":    "Blue Wine <tickets@bluewine.cl>",
        "to":      [destinatario],
        "subject": f"⏰ Recordatorio: {evento} es mañana — Blue Wine",
        "html":    html_body,
    })
    print(f"Recordatorio enviado a {destinatario}")



# ══════════════════════════════════════════════════════
# RESERVAS — recibe datos del formulario y envía email
# ══════════════════════════════════════════════════════
@app.route("/reserva", methods=["POST"])
def reserva():
    data     = request.get_json()
    nombre   = data.get("nombre", "")
    telefono = data.get("telefono", "")
    email    = data.get("email", "")
    tipo     = data.get("tipo", "")
    fecha    = data.get("fecha", "")
    personas = data.get("personas", "")
    mensaje  = data.get("mensaje", "")

    try:
        resend.api_key = os.getenv("RESEND_API_KEY")
        copia_bw       = os.getenv("EMAIL_COPIA", "bluewine.contacto@gmail.com")

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

        resend.Emails.send({
            "from":    "Blue Wine <tickets@bluewine.cl>",
            "to":      [copia_bw],
            "subject": f"📋 Nueva reserva de {nombre} — Blue Wine",
            "html":    html_body,
        })
        print(f"Email reserva enviado — {nombre}")
        return jsonify({"ok": True})

    except Exception as e:
        print(f"Error enviando email reserva: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


# ══════════════════════════════════════════════════════
# VERIFICAR TICKET — Página que escanea el guardia
# ══════════════════════════════════════════════════════
@app.route("/verificar/<codigo>", methods=["GET"])
def verificar_ticket(codigo):
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

        if estado == "USADO":
            return _html_verificacion("⚠️ Entrada ya utilizada", "Esta entrada fue escaneada previamente. No se permite el reingreso.", "usado", codigo, ticket)

        if estado != "ACTIVO":
            return _html_verificacion("❌ Entrada inválida", f"Estado: {estado}", "invalido", codigo)

        # Marcar como USADO — columna 13
        ws.update_cell(fila_num, 13, "USADO")
        print(f"Ticket {codigo} marcado como USADO")

        return _html_verificacion("✅ Entrada válida — ¡Bienvenido!", "La entrada fue marcada como utilizada. Puedes dejar pasar al asistente.", "valido", codigo, ticket)

    except Exception as e:
        print(f"Error verificando ticket: {e}")
        return _html_verificacion("⚠️ Error del sistema", str(e), "error", codigo)


def _html_verificacion(titulo, mensaje, tipo, codigo, ticket=None):
    colores = {
        "valido":   ("#0a1f0a", "#4caf50", "#e8f5e9"),
        "usado":    ("#1f150a", "#ff9800", "#fff3e0"),
        "invalido": ("#1f0a0a", "#f44336", "#ffebee"),
        "error":    ("#111",    "#9e9e9e", "#f5f5f5"),
    }
    bg, color, _ = colores.get(tipo, colores["error"])

    detalles = ""
    if ticket:
        nombre   = f"{ticket.get('nombre', '')} {ticket.get('apellido', '')}".strip()
        detalles = f"""
        <div style="background:#0f0f15;border:1px solid #2a2820;border-radius:8px;padding:16px;margin-top:16px;text-align:left;font-size:14px;">
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">Nombre:</strong> {nombre}</p>
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">RUT:</strong> {ticket.get('rut','—')}</p>
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">Evento:</strong> {ticket.get('evento','—')}</p>
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">Fecha compra:</strong> {ticket.get('fecha_compra','—')}</p>
          <p style="margin:4px 0;color:#aaa;"><strong style="color:#ddd;">Código:</strong> <span style="font-family:monospace;color:#c9a84c;">{codigo}</span></p>
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