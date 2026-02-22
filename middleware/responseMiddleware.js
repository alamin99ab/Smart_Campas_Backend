/**
 * Consistent API response format for Smart Campus
 * All successful responses: { success: true, data?: T }
 * All error responses: { success: false, message: string }
 */

function success(res, data = null, statusCode = 200) {
    const payload = { success: true };
    if (data !== undefined && data !== null) payload.data = data;
    return res.status(statusCode).json(payload);
}

function created(res, data = null) {
    return success(res, data, 201);
}

function error(res, message = 'An error occurred', statusCode = 500) {
    return res.status(statusCode).json({
        success: false,
        message: typeof message === 'string' ? message : 'An error occurred'
    });
}

function validationError(res, errors) {
    return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Array.isArray(errors) ? errors : [errors]
    });
}

module.exports = { success, created, error, validationError };
