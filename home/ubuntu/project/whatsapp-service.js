const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

let sock;
let qrCode = null;
let isConnected = false;
let connectionState = 'disconnected';

// Fungsi untuk memulai koneksi WhatsApp
async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['WhatsApp API', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCode = qr;
            connectionState = 'qr_ready';
            console.log('QR Code generated');
            // Emit QR code ke frontend
            io.emit('qr', qr);
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            
            isConnected = false;
            connectionState = 'disconnected';
            io.emit('connection_status', { status: 'disconnected' });
            
            if (shouldReconnect) {
                startWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('WhatsApp connection opened');
            isConnected = true;
            connectionState = 'connected';
            qrCode = null;
            io.emit('connection_status', { status: 'connected' });
        }
    });

    sock.ev.on('creds.update', saveCreds);
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', (m) => {
        const message = m.messages[0];
        if (!message.key.fromMe && m.type === 'notify') {
            console.log('Received message:', message);
            
            // Emit pesan ke webhook atau simpan ke database
            const messageData = {
                id: message.key.id,
                from: message.key.remoteJid,
                message: message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        'Media message',
                timestamp: message.messageTimestamp
            };
            
            // Emit ke frontend
            io.emit('new_message', messageData);
            
            // Di sini bisa ditambahkan logic untuk mengirim ke webhook eksternal
            console.log('New message received:', messageData);
        }
    });
}

// API Routes
app.get('/status', (req, res) => {
    res.json({
        status: connectionState,
        connected: isConnected,
        qr: qrCode
    });
});

app.get('/qr', (req, res) => {
    if (qrCode) {
        res.json({ qr: qrCode });
    } else {
        res.status(404).json({ error: 'QR code not available' });
    }
});

app.post('/send-message', async (req, res) => {
    try {
        const { to, message } = req.body;
        
        if (!isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }
        
        if (!to || !message) {
            return res.status(400).json({ error: 'Missing required fields: to, message' });
        }
        
        // Format nomor telepon
        const phoneNumber = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
        
        const result = await sock.sendMessage(phoneNumber, { text: message });
        
        res.json({
            success: true,
            messageId: result.key.id,
            to: phoneNumber,
            message: message
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

app.post('/logout', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
        }
        
        // Hapus auth info
        const authPath = path.join(__dirname, 'auth_info_baileys');
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
        
        isConnected = false;
        connectionState = 'disconnected';
        qrCode = null;
        
        res.json({ success: true, message: 'Logged out successfully' });
        
        // Restart connection untuk generate QR baru
        setTimeout(() => {
            startWhatsApp();
        }, 1000);
        
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ error: 'Failed to logout', details: error.message });
    }
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected to socket');
    
    // Send current status to new client
    socket.emit('connection_status', { status: connectionState });
    
    if (qrCode) {
        socket.emit('qr', qrCode);
    }
    
    socket.on('disconnect', () => {
        console.log('Client disconnected from socket');
    });
});

// Start WhatsApp connection
startWhatsApp();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp service running on port ${PORT}`);
});

