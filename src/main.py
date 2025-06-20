import os
import sys
import requests
import subprocess
import threading
import time

from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from src.models.user import db
from src.routes.user import user_bp
from src.routes.whatsapp import whatsapp_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

# Enable CORS
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")

app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')

# uncomment if you need to use database
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
with app.app_context():
    db.create_all()

# WhatsApp service process
whatsapp_process = None

def start_whatsapp_service():
    """Start the Node.js WhatsApp service"""
    global whatsapp_process
    try:
        project_root = os.path.dirname(__file__)
        whatsapp_service_path = os.path.join(project_root, 'whatsapp-service.js')
        
        whatsapp_process = subprocess.Popen(
            ['node', whatsapp_service_path],
            cwd=project_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print("WhatsApp service started successfully")
        return True
    except Exception as e:
        print(f"Failed to start WhatsApp service: {e}")
        return False

def stop_whatsapp_service():
    """Stop the Node.js WhatsApp service"""
    global whatsapp_process
    if whatsapp_process:
        whatsapp_process.terminate()
        whatsapp_process = None
        print("WhatsApp service stopped")

# Start WhatsApp service in background
def init_whatsapp_service():
    time.sleep(2)  # Wait for Flask to start
    start_whatsapp_service()

# Routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

@app.route('/api/webhook', methods=['POST'])
def webhook():
    """Webhook endpoint untuk menerima pesan dari sistem eksternal"""
    try:
        data = request.get_json()
        
        # Log webhook data
        print("Webhook received:", data)
        
        # Emit ke frontend via SocketIO
        socketio.emit('webhook_message', data)
        
        return jsonify({"status": "success", "message": "Webhook received"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# SocketIO events
@socketio.on('connect')
def handle_connect():
    print('Client connected to Flask SocketIO')
    emit('status', {'message': 'Connected to Flask server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected from Flask SocketIO')

if __name__ == '__main__':
    # Start WhatsApp service in background thread
    whatsapp_thread = threading.Thread(target=init_whatsapp_service)
    whatsapp_thread.daemon = True
    whatsapp_thread.start()
    
    try:
        socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
    except KeyboardInterrupt:
        stop_whatsapp_service()
        print("Application stopped")

