# Programador: Isaac Fernández
# Blue Wine — Backend MercadoPago + Google Sheets + QR

from flask import Flask, request, jsonify
from flask_cors import CORS
import mercadopago
import os
import json
import uuid
import datetime
import qrcode
import io
import resend
import base64
from dotenv import load_dotenv
import gspread
from google.oauth2.service_account import Credentials

load_dotenv()

app = Flask(__name__)
CORS(app)

sdk = mercadopago.SDK(os.getenv("MP_ACCESS_TOKEN"))

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
    """Retorna la hoja 'tickets' del Google Sheet configurado."""
    creds_json = os.getenv("GOOGLE_CREDENTIALS")
    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    client = gspread.authorize(creds)
    sheet = client.open_by_key(SPREADSHEET_ID)
    try:
        return sheet.worksheet("tickets")
    except gspread.WorksheetNotFound:
        ws = sheet.add_worksheet(title="tickets", rows=1000, cols=15)
        ws.append_row([
            "codigo_ticket", "nombre", "apellido", "rut", "email", "telefono",
            "evento", "cantidad", "precio_unit", "total", "fecha_compra",
            "id_pago_mp", "estado", "url_verificacion"
        ])
        return ws


# ══════════════════════════════════════════════════════
# ALMACENAMIENTO TEMPORAL comprador pendiente de pago
# ══════════════════════════════════════════════════════
compradores_pendientes = {}


# ══════════════════════════════════════════════════════
# CREAR PREFERENCIA DE PAGO
# ══════════════════════════════════════════════════════
@app.route("/crear-pago", methods=["POST"])
def crear_pago():
    data      = request.get_json()
    items     = data.get("items", [])
    comprador = data.get("comprador", {})
    compra_id = str(uuid.uuid4())

    preference_data = {
        "items": [
            {
                "title": item["nombre"],
                "quantity": item["cantidad"],
                "unit_price": item["precioFinal"],
                "currency_id": "CLP"
            }
            for item in items
        ],
        "back_urls": {
            "success": "https://itech-dotcom.github.io/BlueWine/bluewine%201/?pago=exitoso",
            "failure": "https://itech-dotcom.github.io/BlueWine/bluewine%201/?pago=fallido",
            "pending": "https://itech-dotcom.github.io/BlueWine/bluewine%201/?pago=pendiente"
        },
        "auto_return": "approved",
        "notification_url": "https://bluewine-production.up.railway.app/webhook-mp",
        "external_reference": compra_id
    }

    preference_response = sdk.preference().create(preference_data)
    print("Respuesta MP:", preference_response)

    if "response" not in preference_response or "id" not in preference_response.get("response", {}):
        return jsonify({"error": "Error MercadoPago", "detalle": preference_response}), 400

    preference = preference_response["response"]

    compradores_pendientes[compra_id] = {
        "comprador": comprador,
        "items": items,
        "preference_id": preference["id"]
    }

    return jsonify({
        "id": preference["id"],
        "init_point": preference["init_point"],
        "sandbox_init_point": preference["sandbox_init_point"]
    })


# ══════════════════════════════════════════════════════
# WEBHOOK MERCADOPAGO
# ══════════════════════════════════════════════════════
@app.route("/webhook-mp", methods=["POST"])
def webhook_mp():
    data       = request.get_json(silent=True) or {}
    topic      = data.get("type") or request.args.get("topic")
    payment_id = data.get("data", {}).get("id") or request.args.get("id")

    if topic == "payment" and payment_id:
        try:
            payment_info = sdk.payment().get(payment_id)
            payment      = payment_info.get("response", {})
            status       = payment.get("status")
            compra_id    = payment.get("external_reference")

            print(f"Pago {payment_id} — estado: {status} — compra_id: {compra_id}")

            if status == "approved" and compra_id and compra_id in compradores_pendientes:
                pendiente = compradores_pendientes.pop(compra_id)
                comprador = pendiente["comprador"]
                items     = pendiente["items"]

                for item in items:
                    for _ in range(item["cantidad"]):
                        _emitir_ticket(
                            comprador   = comprador,
                            evento      = item["nombre"],
                            cantidad    = 1,
                            precio_unit = item["precioFinal"],
                            total       = item["precioFinal"],
                            id_pago     = str(payment_id)
                        )
        except Exception as e:
            print("Error procesando webhook:", e)

    return jsonify({"status": "ok"}), 200


# ══════════════════════════════════════════════════════
# EMITIR TICKET: Sheets + QR + Email
# ══════════════════════════════════════════════════════
def _emitir_ticket(comprador, evento, cantidad, precio_unit, total, id_pago):
    codigo           = str(uuid.uuid4())[:12].upper()
    url_verificacion = f"https://bluewine-production.up.railway.app/verificar/{codigo}"
    fecha            = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Guardar en Google Sheets
    try:
        ws = get_sheet()
        ws.append_row([
            codigo,
            comprador.get("nombre", ""),
            comprador.get("apellido", ""),
            comprador.get("rut", ""),
            comprador.get("email", ""),
            comprador.get("telefono", ""),
            evento, cantidad, precio_unit, total, fecha,
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
            destinatario = comprador.get("email", ""),
            nombre       = f"{comprador.get('nombre', '')} {comprador.get('apellido', '')}".strip(),
            evento       = evento,
            codigo       = codigo,
            qr_img       = qr_img
        )
    except Exception as e:
        print(f"Error enviando email: {e}")


def _generar_qr(contenido):
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(contenido)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _enviar_email_ticket(destinatario, nombre, evento, codigo, qr_img):
    resend.api_key = os.getenv("RESEND_API_KEY")
    copia_bw       = os.getenv("EMAIL_COPIA", "bluewine.contacto@gmail.com")

    # Convertir QR a base64 para adjuntarlo
    qr_b64 = base64.b64encode(qr_img).decode("utf-8")

    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#e8e0d0;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#c9a84c;font-size:28px;margin:0;">Blue Wine</h1>
        <p style="color:#7a7060;font-size:13px;margin:4px 0;">MultiEspacio · Quillón, Ñuble</p>
      </div>
      <h2 style="font-size:20px;margin-bottom:8px;">¡Tu entrada está confirmada! 🎉</h2>
      <p>Hola <strong>{nombre}</strong>, tu compra fue procesada exitosamente.</p>
      <div style="background:#13131a;border:1px solid #2a2820;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Evento:</strong> {evento}</p>
        <p style="margin:0 0 8px;"><strong>Código:</strong> <span style="color:#c9a84c;font-family:monospace;font-size:16px;">{codigo}</span></p>
        <p style="margin:0;">Presenta este QR en la entrada del recinto.</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <img src="data:image/png;base64,{qr_b64}" alt="QR Ticket" style="width:200px;height:200px;border:4px solid #c9a84c;border-radius:8px;" />
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
    }

    response = resend.Emails.send(params)
    print(f"Email enviado a {destinatario} via Resend — ID: {response['id']}")


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