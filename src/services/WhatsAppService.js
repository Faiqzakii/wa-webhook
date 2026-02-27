import { default as makeWASocket, DisconnectReason, useMultiFileAuthState, generateWAMessageFromContent, proto, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const buttonsWarpper = require('buttons-warpper');
const initFunction = buttonsWarpper.default || buttonsWarpper;
import { existsSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import Setting from '../models/Setting.js';
import AutoReply from '../models/AutoReply.js';
import Message from '../models/Message.js';
import MessageService from './MessageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- QR Reconnect limits ---
const MAX_QR_RETRIES = 3;              // Stop after 3 failed QR cycles
const BASE_RECONNECT_DELAY_MS = 3000;  // 3s, doubles each retry

class WhatsAppService {
    constructor(io) {
        this.io = io;
        this.sessions = new Map(); // userId => session object
        this.appSettings = {};
        this.autoReplies = [];
        this.webhookService = null;
    }

    setWebhookService(service) {
        this.webhookService = service;
    }

    /**
     * Load settings and auto-replies from database
     */
    async loadSettings() {
        try {
            // Load app settings
            const settingsData = await Setting.find({});

            this.appSettings = settingsData.reduce((acc, row) => {
                acc[row.key] = row.value;
                return acc;
            }, {});

            // Log settings loaded
            console.log('App settings loaded:', Object.keys(this.appSettings));

            // Load auto-replies
            const repliesData = await AutoReply.find({});
            this.autoReplies = repliesData;

            console.log('App settings and auto-replies loaded from database.');
        } catch (error) {
            console.error('Failed to load settings from database:', error);
        }
    }

    /**
     * Get session for user, create if doesn't exist
     */
    async ensureSession(userId, phoneNumber = null) {
        const userIdStr = String(userId);
        if (this.sessions.has(userIdStr)) {
            return this.sessions.get(userIdStr);
        }

        return await this.createSession(userIdStr, phoneNumber);
    }

    /**
     * Create a new WhatsApp session for a user
     */
    async createSession(userId, phoneNumber = null) {
        const userIdStr = String(userId);
        const authDir = join(__dirname, '../../auth_info_baileys', userIdStr);
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();

        console.log(`[WhatsAppService] Using WA Web version: ${version.join('.')}, isLatest: ${isLatest}`);

        const session = {
            sock: null,
            isConnected: false,
            state: 'disconnected',
            qr: null,
            startTime: null,
            keepAliveTimer: null,
            qrRetryCount: 0,
            qrFailed: false
        };

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            keepAliveIntervalMs: config.whatsapp.keepAliveIntervalMs,
            markOnlineOnConnect: config.whatsapp.markOnlineOnConnect,
            // Add some timeout settings
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0
        });

        /* Initialize buttons-warpper for enhanced interactive buttons */
        await initFunction(sock);

        session.sock = sock;
        this.setupSessionHandlers(session, userIdStr, saveCreds, authDir);
        this.sessions.set(userIdStr, session);

        return session;
    }

    /**
     * Setup event handlers for a WhatsApp session
     */
    setupSessionHandlers(session, userId, saveCreds, authDir) {
        const { sock } = session;

        // Keep-alive timer
        session.keepAliveTimer = setInterval(async () => {
            if (session.isConnected) {
                try {
                    await sock.sendPresenceUpdate('available');
                } catch (error) {
                    console.error('Keep-alive error:', error);
                }
            }
        }, config.whatsapp.keepAliveInterval);

        // Credentials update handler
        sock.ev.on('creds.update', saveCreds);

        // Connection status handler
        sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update, session, userId, authDir);
        });

        // Message handler
        sock.ev.on('messages.upsert', async (m) => {
            await this.handleIncomingMessage(m, userId, sock);
        });
    }

    /**
     * Handle connection status updates
     */
    handleConnectionUpdate(update, session, userId, authDir) {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            session.qr = qr;
            session.state = 'qr_ready';
            this.io.to(userId).emit('qr', qr);
            if (this.webhookService && this.appSettings.webhook_toggle_connection !== 'false') {
                this.webhookService.send('connection_status', { userId, status: 'qr_ready' });
            }
        }

        if (connection === 'open') {
            session.isConnected = true;
            session.state = 'connected';
            session.qr = null;
            session.qrRetryCount = 0;  // Reset retry counter on successful connection
            session.reconnectRetryCount = 0;
            session.qrFailed = false;
            // Set start time only if not already set or if reconnecting from disconnected state
            if (!session.startTime) {
                session.startTime = Date.now();
            }
            this.io.to(userId).emit('connection_status', {
                status: 'connected',
                startTime: session.startTime
            });
            console.log(`WhatsApp connected for user: ${userId}`);
            if (this.webhookService && this.appSettings.webhook_toggle_connection !== 'false') {
                this.webhookService.send('connection_status', { userId, status: 'connected' });
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message;
            console.log(`WhatsApp connection closed for user ${userId}. Status: ${statusCode}, Reason: ${reason}`);

            session.isConnected = false;
            session.state = 'disconnected';
            session.startTime = null;
            this.io.to(userId).emit('connection_status', { status: 'disconnected' });
            if (this.webhookService && this.appSettings.webhook_toggle_connection !== 'false') {
                this.webhookService.send('connection_status', { userId, status: 'disconnected' });
            }

            if (session.keepAliveTimer) {
                clearInterval(session.keepAliveTimer);
            }

            // Protect against race condition: only delete if this session is still the active one
            if (this.sessions.get(userId) === session) {
                this.sessions.delete(userId);
            }

            // 405 usually means the session is invalid or unlinked from the phone
            // If loggedOut (401), user explicitly logged out from device.
            const isInvalidSession = statusCode === DisconnectReason.loggedOut || statusCode === 405;

            // Only stop reconnect loops for intentional logouts (401). If 405 occurs, we still want to generate a new QR immediately.
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (isInvalidSession) {
                console.log(`Intentional logout or invalid session (status: ${statusCode}) detected for user ${userId}; clearing session.`);
                try {
                    // Only remove directory if THIS session is still the active one or if no session exists for this user
                    // This prevents deleting the authDir of a newly created replacement session
                    if (this.sessions.get(userId) === session || !this.sessions.has(userId)) {
                        if (existsSync(authDir)) {
                            rmSync(authDir, { recursive: true, force: true });
                        }
                    } else {
                        console.log(`Skipping authDir removal for user ${userId} because a new session is already active.`);
                    }
                } catch (error) {
                    console.error('Error removing auth directory:', error);
                }
            }

            // Check if this is a QR timeout (status 515 or "QR refs attempts ended")
            const isQrTimeout = statusCode === 515 ||
                (reason && reason.includes('QR refs attempts ended'));

            if (isQrTimeout) {
                session.qrRetryCount = (session.qrRetryCount || 0) + 1;
                console.log(`QR timeout for user ${userId} (attempt ${session.qrRetryCount}/${MAX_QR_RETRIES})`);

                if (session.qrRetryCount >= MAX_QR_RETRIES) {
                    console.log(`Max QR retries reached for user ${userId}. Stopping reconnect. User must re-initiate manually.`);
                    session.qrFailed = true;
                    this.io.to(userId).emit('connection_status', {
                        status: 'qr_timeout',
                        message: 'QR code expired. Please reconnect manually.'
                    });
                    if (this.webhookService && this.appSettings.webhook_toggle_connection !== 'false') {
                        this.webhookService.send('connection_status', { userId, status: 'qr_timeout' });
                    }
                    return; // Do NOT reconnect
                }
            }

            // Reconnect if not a logout and not QR-failed
            if (shouldReconnect && !session.qrFailed) {
                let delay = 0;

                // If the session requires restart, reconnect instantly.
                if (statusCode === DisconnectReason.restartRequired) {
                    delay = 2000;
                    session.reconnectRetryCount = 0; // reset retry counter for fresh QR
                } else {
                    // Exponential backoff
                    session.reconnectRetryCount = (session.reconnectRetryCount || 0) + 1;
                    delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, session.reconnectRetryCount - 1);

                    // Cap delay at 60 seconds to avoid ridiculously long wait times
                    if (delay > 60000) delay = 60000;
                }

                console.log(`Reconnecting for user ${userId} in ${delay}ms (retry #${session.reconnectRetryCount})...`);
                setTimeout(() => {
                    // Only recreate if another session hasn't been created in the meantime
                    if (!this.sessions.has(userId)) {
                        this.createSession(userId);
                    }
                }, delay);
            } else if (!shouldReconnect) {
                console.log(`Skipping reconnect for user ${userId} due to intentional logout.`);
            }
        }
    }

    /**
     * Handle incoming messages and auto-replies
     */
    async handleIncomingMessage(messageUpdate, userId, sock) {
        const message = messageUpdate.messages[0];

        if (!message.key.fromMe && messageUpdate.type === 'notify') {
            const messageText = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';

            // Handle quoted messages
            const contextInfo = message.message?.extendedTextMessage?.contextInfo;
            let quotedText = null;
            let quotedSender = null;
            let replyToId = null;

            if (contextInfo?.quotedMessage) {
                quotedText = contextInfo.quotedMessage.conversation ||
                    contextInfo.quotedMessage.extendedTextMessage?.text || '...';
                quotedSender = contextInfo.participant;

                // Find the original message ID in database
                const repliedToMsg = await Message.findOne({
                    stanzaId: contextInfo.stanzaId,
                    userId: userId
                });

                if (repliedToMsg) replyToId = repliedToMsg._id;
            }

            // Record incoming message
            const recordedMessage = await MessageService.recordMessage({
                userId,
                chatJid: message.key.remoteJid,
                sender: message.pushName || message.key.participant || message.key.remoteJid,
                senderJid: message.key.participant || message.key.remoteJid,
                text: messageText,
                direction: 'in',
                timestamp: (message.messageTimestamp || Date.now()) * 1000,
                stanzaId: message.key.id,
                rawMessage: message.message,
                replyToId: replyToId,
                quotedText: quotedText,
                quotedSender: quotedSender
            });

            if (recordedMessage) {
                this.io.to(userId).emit('new_message', {
                    ...recordedMessage.toObject(),
                    id: recordedMessage._id,
                    chat_jid: recordedMessage.chatJid
                });
                if (this.webhookService && this.appSettings.webhook_toggle_message_in !== 'false') {
                    this.webhookService.send('message.in', {
                        userId,
                        id: recordedMessage._id,
                        chatJid: recordedMessage.chatJid,
                        sender: recordedMessage.sender,
                        text: recordedMessage.message,
                        timestamp: recordedMessage.timestamp
                    });
                }
            }

            // Handle auto-reply
            await this.handleAutoReply(messageText, message, userId, sock, replyToId, quotedText, quotedSender);
        }
    }

    /**
     * Handle auto-reply logic
     */
    async handleAutoReply(messageText, message, userId, sock, replyToId, quotedText, quotedSender) {
        const autoReplyEnabled = this.appSettings.auto_reply_enabled !== 'false';

        if (autoReplyEnabled && !message.key.remoteJid.endsWith('@g.us') && messageText) {
            const lowerText = messageText.trim().toLowerCase();
            const rule = this.autoReplies.find(r =>
                r.enabled &&
                lowerText.includes(String(r.keyword || '').toLowerCase().trim())
            );

            if (rule) {
                try {
                    const result = await sock.sendMessage(message.key.remoteJid, { text: rule.reply });

                    // Record auto-reply message
                    const recordedReply = await MessageService.recordMessage({
                        userId,
                        chatJid: message.key.remoteJid,
                        sender: 'auto-reply',
                        text: rule.reply,
                        direction: 'out',
                        timestamp: Date.now(),
                        stanzaId: result.key.id,
                        rawMessage: result.message,
                        replyToId: replyToId,
                        quotedText: quotedText,
                        quotedSender: quotedSender,
                        senderJid: sock.user.id.replace(/:.*$/, '@s.whatsapp.net')
                    });

                    if (recordedReply) {
                        this.io.to(userId).emit('new_message', {
                            ...recordedReply.toObject(),
                            id: recordedReply._id,
                            chat_jid: recordedReply.chatJid
                        });
                    }
                } catch (error) {
                    console.error('Auto-reply error:', error);
                }
            }
        }
    }

    /**
     * Send a message via WhatsApp
     */
    async sendMessage(userId, to, message, replyToId = null) {
        const session = await this.ensureSession(userId);

        if (!session.isConnected) {
            throw new Error('WhatsApp not connected');
        }

        const phone = to.includes('@') ? to : `${to}@s.whatsapp.net`;

        let quotedInfo = undefined;
        let quotedDbRecord = null;

        if (replyToId) {
            const data = await Message.findOne({
                _id: replyToId,
                userId: userId
            });

            if (data) {
                quotedDbRecord = data;
                quotedInfo = {
                    key: {
                        remoteJid: data.chatJid,
                        id: data.stanzaId,
                        fromMe: data.direction === 'out',
                        participant: data.senderJid,
                    },
                    message: data.rawMessage
                };
            }
        }

        const result = await session.sock.sendMessage(phone, { text: message }, { quoted: quotedInfo });

        // Record outgoing message
        const recordedOutgoing = await MessageService.recordMessage({
            userId,
            chatJid: phone,
            sender: 'me',
            text: message,
            direction: 'out',
            timestamp: Date.now(),
            stanzaId: result.key.id,
            rawMessage: result.message,
            replyToId: replyToId,
            quotedText: quotedDbRecord?.message,
            quotedSender: quotedDbRecord?.sender,
            senderJid: session.sock.user.id.replace(/:.*$/, '@s.whatsapp.net')
        });

        if (recordedOutgoing) {
            this.io.to(userId).emit('new_message', {
                ...recordedOutgoing.toObject(),
                id: recordedOutgoing._id,
                chat_jid: recordedOutgoing.chatJid
            });
            if (this.webhookService && this.appSettings.webhook_toggle_message_out !== 'false') {
                this.webhookService.send('message.out', {
                    userId,
                    id: recordedOutgoing._id,
                    chatJid: recordedOutgoing.chatJid,
                    sender: recordedOutgoing.sender,
                    text: recordedOutgoing.message,
                    timestamp: recordedOutgoing.timestamp
                });
            }
        }

        return result;
    }

    /**
     * Logout user from WhatsApp
     */
    async logout(userId) {
        const userIdStr = String(userId);
        const session = this.sessions.get(userIdStr);
        if (!session) return;

        try {
            await session.sock.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }

        try {
            if (session.sock) session.sock.end(undefined);
        } catch (error) {
            console.error('Socket end error:', error);
        }

        if (session.keepAliveTimer) {
            clearInterval(session.keepAliveTimer);
        }
        this.sessions.delete(userIdStr);

        const authDir = join(__dirname, '../../auth_info_baileys', userIdStr);
        try {
            if (existsSync(authDir)) {
                rmSync(authDir, { recursive: true, force: true });
            }
        } catch (error) {
            console.error('Error removing auth directory:', error);
        }
    }

    /**
     * Get session status for a user
     */
    getSessionStatus(userId) {
        const session = this.sessions.get(String(userId));
        if (!session) {
            return { status: 'disconnected', connected: false, qr: null };
        }

        return {
            status: session.state,
            connected: session.isConnected,
            qr: session.qr,
            startTime: session.startTime
        };
    }

    /**
     * Preload sessions for users with existing auth files
     */
    async preloadSessions() {
        try {
            const authRoot = join(__dirname, '../../auth_info_baileys');
            if (!existsSync(authRoot)) return;

            // Single-session mode: only load the configured user
            const defaultUserId = config.singleSession?.defaultUserId;
            if (defaultUserId) {
                const userAuthDir = join(authRoot, String(defaultUserId));
                if (existsSync(userAuthDir)) {
                    console.log(`[Single-session] Preloading WhatsApp session for user: ${defaultUserId}`);
                    await this.ensureSession(defaultUserId);
                } else {
                    console.log(`[Single-session] No existing auth for user ${defaultUserId}, will create on first connect`);
                }
                return;
            }

            // Multi-tenant mode: load all existing sessions
            const userDirs = readdirSync(authRoot, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const userId of userDirs) {
                console.log(`Preloading WhatsApp session for user: ${userId}`);
                await this.ensureSession(userId);
            }
        } catch (error) {
            console.error('Error during WhatsApp session preload:', error);
        }
    }
    async requestPairingCode(userId, phoneNumber) {
        const session = await this.ensureSession(userId);
        if (session.isConnected) {
            throw new Error('WhatsApp already connected');
        }

        if (!session.sock) {
            throw new Error('Session not initialized');
        }

        // Wait for connection to be ready
        let attempts = 0;
        while (attempts < 20) {
            if (session.sock.ws && session.sock.ws.isOpen) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        if (!session.sock.ws || !session.sock.ws.isOpen) {
            throw new Error('Connection to WhatsApp server failed, please try again');
        }

        const code = await session.sock.requestPairingCode(phoneNumber);
        return code;
    }

    async sendInteractiveMessage(userId, to, content) {
        console.log(`[WhatsAppService] sendInteractiveMessage start for user: ${userId}`);
        const session = await this.ensureSession(userId);
        if (!session.isConnected) {
            throw new Error('WhatsApp not connected');
        }

        const phone = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        console.log(`[WhatsAppService] Target JID: ${phone}`);

        /* Use buttons-warpper enhanced method for better compatibility */
        console.log(`[WhatsAppService] Using buttons-warpper sendInteractiveMessage...`);
        try {
            const msg = await session.sock.sendInteractiveMessage(phone, {
                text: content.text || '',
                footer: content.footer || '',
                title: content.title || '',
                subtitle: content.subtitle || '',
                interactiveButtons: content.interactiveButtons || []
            });
            console.log(`[WhatsAppService] Message sent successfully via buttons-warpper`);
            return msg;
        } catch (err) {
            console.error(`[WhatsAppService] Failed to send via buttons-warpper:`, err);
            throw err;
        }
    }

    /**
     * Get count of messages for today
     */
    async getTodayMessageCount(userId) {
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const count = await Message.countDocuments({
                userId: userId,
                timestamp: { $gte: startOfDay }
            });

            return count;
        } catch (error) {
            console.error('Error getting message count:', error);
            return 0;
        }
    }
}

export default WhatsAppService;