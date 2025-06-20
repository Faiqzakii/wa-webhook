from flask import Blueprint, request, jsonify
import requests
import json

whatsapp_bp = Blueprint('whatsapp', __name__)

# WhatsApp service URL
WHATSAPP_SERVICE_URL = 'http://localhost:3000'

@whatsapp_bp.route('/status', methods=['GET'])
def get_status():
    """Get WhatsApp connection status"""
    try:
        response = requests.get(f'{WHATSAPP_SERVICE_URL}/status', timeout=5)
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'WhatsApp service unavailable',
            'details': str(e)
        }), 503

@whatsapp_bp.route('/qr', methods=['GET'])
def get_qr():
    """Get QR code for WhatsApp login"""
    try:
        response = requests.get(f'{WHATSAPP_SERVICE_URL}/qr', timeout=5)
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'QR code not available'}), 404
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'WhatsApp service unavailable',
            'details': str(e)
        }), 503

@whatsapp_bp.route('/send', methods=['POST'])
def send_message():
    """Send WhatsApp message"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Validate required fields
        if 'to' not in data or 'message' not in data:
            return jsonify({'error': 'Missing required fields: to, message'}), 400
        
        # Forward request to WhatsApp service
        response = requests.post(
            f'{WHATSAPP_SERVICE_URL}/send-message',
            json=data,
            timeout=10
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify(response.json()), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'WhatsApp service unavailable',
            'details': str(e)
        }), 503
    except Exception as e:
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@whatsapp_bp.route('/logout', methods=['POST'])
def logout():
    """Logout from WhatsApp"""
    try:
        response = requests.post(f'{WHATSAPP_SERVICE_URL}/logout', timeout=10)
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'WhatsApp service unavailable',
            'details': str(e)
        }), 503

@whatsapp_bp.route('/receive', methods=['POST'])
def receive_message():
    """Webhook endpoint untuk menerima pesan dari WhatsApp"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Log pesan yang diterima
        print("Received WhatsApp message:", data)
        
        # Di sini bisa ditambahkan logic untuk:
        # - Menyimpan pesan ke database
        # - Mengirim ke webhook eksternal
        # - Memproses pesan otomatis
        
        # Contoh response untuk auto-reply
        message_text = data.get('message', '').lower().strip()
        sender = data.get('from', '')
        
        if message_text == 'ping':
            # Auto reply dengan "pong"
            reply_data = {
                'to': sender,
                'message': 'pong'
            }
            
            # Kirim auto reply
            try:
                requests.post(
                    f'{WHATSAPP_SERVICE_URL}/send-message',
                    json=reply_data,
                    timeout=5
                )
            except requests.exceptions.RequestException as e:
                print(f"Failed to send auto-reply: {e}")
        
        return jsonify({
            'status': 'success',
            'message': 'Message received and processed'
        })
        
    except Exception as e:
        print(f"Error processing received message: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

