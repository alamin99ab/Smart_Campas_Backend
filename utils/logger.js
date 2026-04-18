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

// Logger functions with cache and performance monitoring
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
            console.debug(formatted);
            writeToFile('debug.log', formatted);
        }
    },

    // Performance monitoring helpers
    performance: (operation, duration, meta = {}) => {
        const message = `Performance: ${operation} completed in ${duration}ms`;
        logger.info(message, { ...meta, operation, duration });
    },

    cache: (operation, key, hit = null, meta = {}) => {
        const message = `Cache ${operation}: ${key}${hit !== null ? ` (${hit ? 'HIT' : 'MISS'})` : ''}`;
        logger.debug(message, { ...meta, operation, key, hit });
    },

    export: (operation, status, meta = {}) => {
        const message = `Export ${operation}: ${status}`;
        logger.info(message, { ...meta, operation, status });
    },

    audit: (action, userId, schoolId, meta = {}) => {
        const message = `Audit: ${action} by user ${userId} in school ${schoolId}`;
        logger.info(message, { ...meta, action, userId, schoolId });
    },

    // Structured error logging for production
    structuredError: (error, context = {}) => {
        const errorData = {
            message: error.message,
            stack: error.stack,
            code: error.code,
            statusCode: error.statusCode,
            timestamp: new Date().toISOString(),
            context
        };
        
        // Don't log sensitive data
        const sanitizedContext = { ...context };
        delete sanitizedContext.password;
        delete sanitizedContext.token;
        delete sanitizedContext.secret;
        
        logger.error('Structured Error', errorData);
    }
};

module.exports = logger;
