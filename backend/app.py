# Programador: Isaac Fernández
# Blue Wine — Backend MercadoPago

from flask import Flask, request, jsonify
from flask_cors import CORS
import mercadopago
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

sdk = mercadopago.SDK(os.getenv("MP_ACCESS_TOKEN"))

@app.route("/crear-pago", methods=["POST"])
def crear_pago():
    data = request.get_json()
    items = data.get("items", [])

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
        "auto_return": "approved"
    }

    preference_response = sdk.preference().create(preference_data)
    print("Respuesta MP:", preference_response)

    if "response" not in preference_response or "id" not in preference_response.get("response", {}):
        return jsonify({"error": "Error MercadoPago", "detalle": preference_response}), 400

    preference = preference_response["response"]

    return jsonify({
        "id": preference["id"],
        "init_point": preference["init_point"],
        "sandbox_init_point": preference["sandbox_init_point"]
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)