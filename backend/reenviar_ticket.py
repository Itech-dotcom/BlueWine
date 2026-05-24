import os, json, io, base64, qrcode, resend, gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]

def get_sheet():
    creds = Credentials.from_service_account_info(json.loads(os.getenv("GOOGLE_CREDENTIALS")), scopes=SCOPES)
    client = gspread.authorize(creds)
    return client.open_by_key(os.getenv("GOOGLE_SHEET_ID")).worksheet("tickets")

def generar_qr(url):
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

BUSCAR_ID   = "73b3d663-a904-4224-88e9-92fdc015b563"
EMAIL_NUEVO = "francocerda39@gmail.com"

ws   = get_sheet()
rows = ws.get_all_records()

ticket = None
for row in rows:
    codigo = str(row.get("codigo_ticket", ""))
    id_pago = str(row.get("id_pago_mp", ""))
    if BUSCAR_ID[:12].upper() in codigo.upper() or BUSCAR_ID in id_pago or codigo.upper() in BUSCAR_ID.upper():
        ticket = row
        break

if not ticket:
    print("Ticket no encontrado. Mostrando primeros 5 registros:")
    for r in rows[:5]:
        print(r.get("codigo_ticket"), "|", r.get("id_pago_mp"), "|", r.get("email"))
else:
    codigo   = ticket["codigo_ticket"]
    nombre   = f"{ticket.get('nombre','')} {ticket.get('apellido','')}".strip()
    evento   = ticket.get("evento", "Tobal MJ")
    url_qr   = ticket.get("url_verificacion", f"https://bluewine-production.up.railway.app/verificar/{codigo}")

    print(f"Ticket encontrado: {codigo} — {nombre} — {evento}")

    qr_img = generar_qr(url_qr)
    qr_b64 = base64.b64encode(qr_img).decode("utf-8")

    resend.api_key = os.getenv("RESEND_API_KEY")
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
        <img src="cid:qr-ticket" alt="QR Ticket" style="width:200px;height:200px;border:4px solid #c9a84c;border-radius:8px;" />
      </div>
      <p style="color:#7a7060;font-size:12px;text-align:center;">Entrada personal e intransferible. Debes presentar tu cédula de identidad al ingresar.</p>
      <hr style="border:none;border-top:1px solid #2a2820;margin:20px 0;" />
      <p style="color:#7a7060;font-size:11px;text-align:center;">© 2026 Blue Wine · @bluewine.quillon</p>
    </div>
    """

    resp = resend.Emails.send({
        "from": "Blue Wine <tickets@bluewine.cl>",
        "to":   [EMAIL_NUEVO],
        "subject": f"🎟️ Tu entrada para {evento} — Blue Wine",
        "html": html_body,
        "attachments": [{
            "content":      qr_b64,
            "filename":     "ticket-qr.png",
            "content_id":   "qr-ticket",
            "content_type": "image/png",
        }]
    })
    print(f"Email reenviado a {EMAIL_NUEVO} — ID Resend: {resp['id']}")
