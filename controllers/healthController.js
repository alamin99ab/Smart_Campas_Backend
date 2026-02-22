const mongoose = require('mongoose');

const startTime = Date.now();

/**
 * GET /api/health
 * Health check with DB status and uptime (for monitoring and load balancers)
 */
exports.getHealth = async (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    const healthy = dbState === 1;

    res.status(healthy ? 200 : 503).json({
        success: healthy,
        status: healthy ? 'healthy' : 'degraded',
        healthy: healthy,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        service: 'Smart Campus API',
        database: {
            status: dbStatus,
            readyState: dbState
        }
    });
};
