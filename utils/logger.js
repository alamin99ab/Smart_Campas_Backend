/**
 * 📝 LOGGER UTILITY
 * Centralized logging for Smart Campus SaaS
 */

const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

// Get log directory
const getLogDir = () => {
    const logDir = process.env.LOG_FILE_PATH 
        ? path.dirname(process.env.LOG_FILE_PATH) 
        : path.join(__dirname, '..', 'logs');
    
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
};

// Format log message
const formatMessage = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return `[${timestamp}] [${level}] ${message} ${metaStr}\n`;
};

// Write to file
const writeToFile = (filename, message) => {
    try {
        const logPath = path.join(getLogDir(), filename);
        fs.appendFileSync(logPath, message);
    } catch (error) {
        console.error('Failed to write to log file:', error.message);
    }
};

// Logger functions
const logger = {
    error: (message, meta = {}) => {
        const formatted = formatMessage(LOG_LEVELS.ERROR, message, meta);
        console.error(formatted);
        writeToFile('error.log', formatted);
    },

    warn: (message, meta = {}) => {
        const formatted = formatMessage(LOG_LEVELS.WARN, message, meta);
        console.warn(formatted);
        writeToFile('warn.log', formatted);
    },

    info: (message, meta = {}) => {
        const formatted = formatMessage(LOG_LEVELS.INFO, message, meta);
        console.log(formatted);
        
        // Only write to file in production or if explicitly enabled
        if (process.env.NODE_ENV === 'production' || process.env.FILE_LOGGING === 'true') {
            writeToFile('info.log', formatted);
        }
    },

    debug: (message, meta = {}) => {
        if (process.env.NODE_ENV !== 'production') {
            const formatted = formatMessage(LOG_LEVELS.DEBUG, message, meta);
            console.log(formatted);
        }
    },

    // HTTP request logging
    http: (message, meta = {}) => {
        const formatted = formatMessage('HTTP', message, meta);
        writeToFile('http.log', formatted);
    },

    // Audit logging for security events
    audit: (message, meta = {}) => {
        const formatted = formatMessage('AUDIT', message, meta);
        console.log(formatted);
        writeToFile('audit.log', formatted);
    }
};

module.exports = logger;
