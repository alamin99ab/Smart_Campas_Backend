/**
 * Transaction Helper Utility
 * Provides safe transaction handling for multi-step operations
 */

const mongoose = require('mongoose');

/**
 * Execute a function within a MongoDB transaction
 * @param {Function} operation - Async function that receives session as parameter
 * @param {Object} options - Transaction options
 * @returns {Promise} - Result of the operation
 */
const withTransaction = async (operation, options = {}) => {
    const session = await mongoose.startSession();
    session.startTransaction({
        readConcern: 'snapshot',
        writeConcern: { w: 'majority' },
        ...options
    });

    try {
        const result = await operation(session);
        await session.commitTransaction();
        return result;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Execute multiple operations in parallel within a transaction
 * @param {Array<Function>} operations - Array of async functions that receive session
 * @param {Object} options - Transaction options
 * @returns {Promise<Array>} - Array of results
 */
const withTransactionParallel = async (operations, options = {}) => {
    return withTransaction(async (session) => {
        const results = await Promise.all(
            operations.map(op => op(session))
        );
        return results;
    }, options);
};

/**
 * Safe bulk update with transaction
 * @param {Model} model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} update - Update payload
 * @param {Object} options - Additional options
 * @returns {Promise} - Update result
 */
const bulkUpdateWithTransaction = async (model, filter, update, options = {}) => {
    return withTransaction(async (session) => {
        const result = await model.updateMany(filter, update, { session, ...options });
        return result;
    });
};

/**
 * Safe bulk insert with transaction
 * @param {Model} model - Mongoose model
 * @param {Array} documents - Documents to insert
 * @param {Object} options - Additional options
 * @returns {Promise} - Insert result
 */
const bulkInsertWithTransaction = async (model, documents, options = {}) => {
    return withTransaction(async (session) => {
        const result = await model.insertMany(documents, { session, ...options });
        return result;
    });
};

/**
 * Safe create with audit log in transaction
 * @param {Model} model - Mongoose model
 * @param {Object} data - Data to create
 * @param {Object} auditData - Audit log data
 * @param {Object} options - Additional options
 * @returns {Promise} - Create result
 */
const createWithAudit = async (model, data, auditData, options = {}) => {
    return withTransaction(async (session) => {
        const AuditLog = require('../models/AuditLog');
        
        // Create main document
        const result = await model.create([data], { session, ...options });
        
        // Create audit log
        if (auditData) {
            await AuditLog.create([auditData], { session });
        }
        
        return result[0]; // Return the created document
    }, options);
};

/**
 * Safe update with audit log in transaction
 * @param {Model} model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} update - Update payload
 * @param {Object} auditData - Audit log data
 * @param {Object} options - Additional options
 * @returns {Promise} - Update result
 */
const updateWithAudit = async (model, filter, update, auditData, options = {}) => {
    return withTransaction(async (session) => {
        const AuditLog = require('../models/AuditLog');
        
        // Update main document
        const result = await model.updateMany(filter, update, { session, ...options });
        
        // Create audit log
        if (auditData && result.modifiedCount > 0) {
            await AuditLog.create([auditData], { session });
        }
        
        return result;
    }, options);
};

/**
 * Safe delete with audit log in transaction
 * @param {Model} model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} auditData - Audit log data
 * @param {Object} options - Additional options
 * @returns {Promise} - Delete result
 */
const deleteWithAudit = async (model, filter, auditData, options = {}) => {
    return withTransaction(async (session) => {
        const AuditLog = require('../models/AuditLog');
        
        // Get documents before deletion for audit
        const documents = await model.find(filter).session(session);
        
        // Delete documents
        const result = await model.deleteMany(filter, { session, ...options });
        
        // Create audit log
        if (auditData && result.deletedCount > 0) {
            await AuditLog.create([{
                ...auditData,
                details: {
                    ...auditData.details,
                    deletedDocuments: documents.map(doc => ({
                        id: doc._id,
                        type: doc.constructor.modelName
                    }))
                }
            }], { session });
        }
        
        return result;
    }, options);
};

/**
 * Retry mechanism for transaction failures
 * @param {Function} operation - Operation to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise} - Operation result
 */
const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Don't retry on validation errors or client errors
            if (error.name === 'ValidationError' || error.status < 500) {
                throw error;
            }
            
            if (attempt < maxRetries) {
                console.warn(`Transaction attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }
    
    throw lastError;
};

/**
 * Check if MongoDB transactions are supported
 * @returns {boolean} - True if transactions are supported
 */
const areTransactionsSupported = () => {
    return mongoose.connection.readyState === 1 && 
           mongoose.connection.db?.serverConfig?.replicaSet !== undefined;
};

/**
 * Validate transaction requirements
 * @throws {Error} - If transactions are not supported
 */
const validateTransactionSupport = () => {
    if (!areTransactionsSupported()) {
        throw new Error('MongoDB transactions require a replica set. Current connection does not support transactions.');
    }
};

module.exports = {
    withTransaction,
    withTransactionParallel,
    bulkUpdateWithTransaction,
    bulkInsertWithTransaction,
    createWithAudit,
    updateWithAudit,
    deleteWithAudit,
    withRetry,
    areTransactionsSupported,
    validateTransactionSupport
};
