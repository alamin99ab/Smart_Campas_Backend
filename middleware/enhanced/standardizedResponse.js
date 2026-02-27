
/**
 * 🎯 STANDARDIZED RESPONSE MIDDLEWARE
 * Ensures consistent API response format
 */

const standardizedResponse = (req, res, next) => {
    // Override res.json to standardize format
    const originalJson = res.json;
    
    res.json = function(data) {
        // If data already has standard format, use it
        if (data && typeof data === 'object' && data.hasOwnProperty('success')) {
            return originalJson.call(this, data);
        }
        
        // Standardize the response
        const standardResponse = {
            success: res.statusCode < 400,
            data: data,
            message: res.statusCode < 400 ? 'Success' : 'Error',
            timestamp: new Date().toISOString(),
            requestId: req.id || null
        };
        
        // Add pagination if present
        if (data && data.pagination) {
            standardResponse.pagination = data.pagination;
            standardResponse.data = data.data || data;
        }
        
        return originalJson.call(this, standardResponse);
    };
    
    next();
};

module.exports = standardizedResponse;
