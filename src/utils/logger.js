/**
 * Logger utility with different levels - optimized for both Node.js and Bun
 */

const fs = require('fs');
const path = require('path');

// Runtime detection
const runtime = {
    isBun: typeof Bun !== 'undefined',
    isNode: typeof process !== 'undefined' && process.versions && process.versions.node
};

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.ensureLogDirectory();
        this.runtime = runtime;
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            runtime: this.runtime.isBun ? 'bun' : 'node',
            ...(data && { data })
        };
        return JSON.stringify(logEntry) + '\n';
    }

    writeToFile(filename, content) {
        const filePath = path.join(this.logDir, filename);
        
        // Use Bun's optimized file writing if available
        if (this.runtime.isBun && typeof Bun !== 'undefined' && Bun.write) {
            // Bun has async file operations that are faster
            const file = Bun.file(filePath);
            // For append operation, we'll use Node.js fs for compatibility
            fs.appendFileSync(filePath, content);
        } else {
            fs.appendFileSync(filePath, content);
        }
    }

    info(message, data = null) {
        const logMessage = this.formatMessage('INFO', message, data);
        console.log(`[INFO] ${message}`, data || '');
        this.writeToFile('app.log', logMessage);
    }

    error(message, error = null) {
        const errorData = error ? {
            message: error.message,
            stack: error.stack
        } : null;
        const logMessage = this.formatMessage('ERROR', message, errorData);
        console.error(`[ERROR] ${message}`, error || '');
        this.writeToFile('error.log', logMessage);
    }

    warn(message, data = null) {
        const logMessage = this.formatMessage('WARN', message, data);
        console.warn(`[WARN] ${message}`, data || '');
        this.writeToFile('app.log', logMessage);
    }

    debug(message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            const logMessage = this.formatMessage('DEBUG', message, data);
            console.debug(`[DEBUG] ${message}`, data || '');
            this.writeToFile('debug.log', logMessage);
        }
    }

    whatsapp(message, data = null) {
        const logMessage = this.formatMessage('WHATSAPP', message, data);
        console.log(`[WHATSAPP] ${message}`, data || '');
        this.writeToFile('whatsapp.log', logMessage);
    }
}

module.exports = new Logger();