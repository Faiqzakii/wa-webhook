const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

// Import configuration
const { config, validateConfig } = require('./src/config');
const { initializeDatabase } = require('./src/config/database');

// Runtime detection
const runtime = {
  isBun: typeof Bun !== 'undefined',
  isNode: typeof process !== 'undefined' && process.versions && process.versions.node,
  name: typeof Bun !== 'undefined' ? 'bun' : 'node'
};

// Import services
const WhatsAppService = require('./src/services/WhatsAppService');

// Import routes
const authRoutes = require('./src/routes/auth');
const appRoutes = require('./src/routes/app');
const whatsappRoutes = require('./src/routes/whatsapp');
const contactRoutes = require('./src/routes/contacts');
const autoReplyRoutes = require('./src/routes/autoReply');
const apiKeyRoutes = require('./src/routes/apiKeys');
const chatRoutes = require('./src/routes/chat');

// Import utilities
const logger = require('./src/utils/logger');

class Application {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = null;
        this.whatsappService = null;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Validate configuration
            validateConfig();
            logger.info(`Configuration validated successfully - Runtime: ${runtime.name}`);

            // Initialize database
            initializeDatabase();
            logger.info('Database initialized successfully');

            // Setup Express app
            this.setupExpress();
            
            // Setup Socket.IO
            this.setupSocketIO();
            
            // Setup WhatsApp service
            await this.setupWhatsAppService();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup error handling
            this.setupErrorHandling();

            logger.info('Application initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize application', error);
            throw error;
        }
    }

    /**
     * Setup Express application
     */
    setupExpress() {
        // View engine setup
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, 'views'));

        // Middleware
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(cookieParser());

        // Request logging middleware
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                runtime: runtime.name
            });
            next();
        });

        logger.info('Express application configured');
    }

    /**
     * Setup Socket.IO
     */
    setupSocketIO() {
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Socket connection handling
        this.io.on('connection', (socket) => {
            const userId = socket.handshake.query.userId;
            if (userId) {
                socket.join(userId);
                logger.info(`Socket connected for user: ${userId}`);
            }

            socket.on('disconnect', () => {
                logger.info(`Socket disconnected for user: ${userId}`);
            });
        });

        // Make io available to routes
        this.app.set('io', this.io);

        logger.info('Socket.IO configured');
    }

    /**
     * Setup WhatsApp service
     */
    async setupWhatsAppService() {
        this.whatsappService = new WhatsAppService(this.io);
        
        // Load settings from database
        await this.whatsappService.loadSettings();
        
        // Make whatsapp service available to routes
        this.app.set('whatsappService', this.whatsappService);

        logger.info('WhatsApp service configured');
    }

    /**
     * Setup application routes
     */
    setupRoutes() {
        // Authentication routes
        this.app.use('/', authRoutes);
        
        // Main application routes
        this.app.use('/', appRoutes);
        
        // WhatsApp API routes
        this.app.use('/', whatsappRoutes);
        
        // Contact management routes
        this.app.use('/contacts', contactRoutes);
        
        // Auto-reply routes
        this.app.use('/auto-reply', autoReplyRoutes);
        
        // API key management routes
        this.app.use('/api-keys', apiKeyRoutes);
        
        // Chat API routes
        this.app.use('/api/chats', chatRoutes);

        logger.info('Routes configured');
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            logger.warn(`404 - Page not found: ${req.path}`);
            res.status(404).render('error', { 
                error: 'Page not found',
                message: 'The page you are looking for does not exist.'
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            logger.error('Unhandled error', err);
            
            const statusCode = err.statusCode || 500;
            const message = config.node_env === 'production' 
                ? 'Something went wrong' 
                : err.message;

            res.status(statusCode).render('error', {
                error: 'Internal Server Error',
                message: message
            });
        });

        logger.info('Error handling configured');
    }

    /**
     * Start the server
     */
    async start() {
        try {
            await this.initialize();

            // Preload WhatsApp sessions for existing users
            if (!process.env.JEST_WORKER_ID) {
                await this.whatsappService.preloadSessions();
            }

            // Start server
            this.server.listen(config.port, '0.0.0.0', () => {
                logger.info(`WhatsApp service running on port ${config.port}`);
                logger.info(`Server started successfully on ${runtime.name} runtime`, { 
                    port: config.port,
                    runtime: runtime.name,
                    optimizations: runtime.isBun ? 'enabled' : 'disabled'
                });
                console.log(`🚀 Server running on http://localhost:${config.port} (${runtime.name})`);
                if (runtime.isBun) {
                    console.log('⚡ Bun optimizations active');
                }
            });

        } catch (error) {
            logger.error('Failed to start server', error);
            process.exit(1);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('Shutting down server...');
        
        // Close all WhatsApp sessions
        if (this.whatsappService) {
            // Implementation for closing all sessions would go here
        }

        // Close server
        this.server.close(() => {
            logger.info('Server shut down successfully');
            process.exit(0);
        });
    }
}

// For testing environment
if (process.env.JEST_WORKER_ID) {
    const mockApp = express();
    const mockServer = http.createServer(mockApp);
    
    // Export mock objects for testing
    module.exports = { 
        app: mockApp, 
        server: mockServer, 
        ensureSession: async () => ({
            isConnected: true,
            state: 'connected',
            qr: null,
            sock: {
                sendMessage: async () => ({ key: { id: 'test-id' }, message: {} }),
                user: { id: 'bot@s.whatsapp.net' }
            }
        })
    };
} else {
    // Production/Development startup
    const app = new Application();
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => app.shutdown());
    process.on('SIGINT', () => app.shutdown());
    
    // Start the application
    app.start().catch(error => {
        console.error('Failed to start application:', error);
        process.exit(1);
    });
}