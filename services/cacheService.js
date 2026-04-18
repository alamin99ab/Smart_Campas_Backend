/**
 * Production-Safe Cache Service for Smart Campus SaaS
 * 
 * Features:
 * - In-memory cache with Redis-ready design
 * - Tenant-safe cache keys
 * - TTL support
 * - Structured invalidation
 * - Memory protection
 * - Production-ready logging
 */

class CacheService {
    constructor(options = {}) {
        this.cache = new Map();
        this.ttlMap = new Map();
        this.defaultTTL = options.defaultTTL || 300; // 5 minutes
        this.maxSize = options.maxSize || 1000;
        this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
        this.enabled = options.enabled !== false;
        
        // Start cleanup interval
        if (this.enabled) {
            this.startCleanup();
        }
    }

    /**
     * Build tenant-safe cache key
     * Format: {module}:{action}:{schoolId}:{role?}:{params...}
     */
    buildKey(module, action, schoolId, role = null, params = {}) {
        const parts = [module, action, schoolId];
        
        if (role) {
            parts.push(role);
        }
        
        // Add relevant params to key
        const paramKeys = Object.keys(params).sort();
        for (const key of paramKeys) {
            if (params[key] !== undefined && params[key] !== null) {
                parts.push(`${key}=${params[key]}`);
            }
        }
        
        return parts.join(':');
    }

    /**
     * Get cached value
     */
    async get(key) {
        if (!this.enabled) return null;
        
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        // Check TTL
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.ttlMap.delete(key);
            return null;
        }
        
        // Update access time for LRU
        entry.accessedAt = Date.now();
        
        // Log cache hit (lightweight)
        if (process.env.NODE_ENV !== 'test') {
            console.debug(`[CACHE HIT] ${key}`);
        }
        
        return entry.value;
    }

    /**
     * Set cache value with TTL
     */
    async set(key, value, ttl = null) {
        if (!this.enabled) return;
        
        const actualTTL = ttl || this.defaultTTL;
        const expiresAt = actualTTL > 0 ? Date.now() + (actualTTL * 1000) : null;
        
        // Check size limit
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }
        
        this.cache.set(key, {
            value,
            createdAt: Date.now(),
            accessedAt: Date.now(),
            expiresAt
        });
        
        if (expiresAt) {
            this.ttlMap.set(key, expiresAt);
        }
        
        // Log cache set (lightweight)
        if (process.env.NODE_ENV !== 'test') {
            console.debug(`[CACHE SET] ${key} (TTL: ${actualTTL}s)`);
        }
    }

    /**
     * Delete specific key
     */
    async delete(key) {
        if (!this.enabled) return;
        
        this.cache.delete(key);
        this.ttlMap.delete(key);
        
        if (process.env.NODE_ENV !== 'test') {
            console.debug(`[CACHE DELETE] ${key}`);
        }
    }

    /**
     * Invalidate by prefix pattern
     * Format: {module}:{action}:{schoolId}:*
     */
    async invalidatePrefix(prefix) {
        if (!this.enabled) return;
        
        const keysToDelete = [];
        
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.cache.delete(key);
            this.ttlMap.delete(key);
        }
        
        if (process.env.NODE_ENV !== 'test' && keysToDelete.length > 0) {
            console.info(`[CACHE INVALIDATE] ${prefix} (${keysToDelete.length} keys)`);
        }
    }

    /**
     * Invalidate all cache for a school
     */
    async invalidateSchool(schoolId) {
        await this.invalidatePrefix(`*:*:${schoolId}:*`);
    }

    /**
     * Invalidate module-specific cache for a school
     */
    async invalidateModule(module, schoolId) {
        await this.invalidatePrefix(`${module}:*:${schoolId}:*`);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const now = Date.now();
        let expiredCount = 0;
        let activeCount = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                expiredCount++;
            } else {
                activeCount++;
            }
        }
        
        return {
            total: this.cache.size,
            active: activeCount,
            expired: expiredCount,
            maxSize: this.maxSize,
            enabled: this.enabled
        };
    }

    /**
     * Clear all cache
     */
    async clear() {
        if (!this.enabled) return;
        
        this.cache.clear();
        this.ttlMap.clear();
        
        if (process.env.NODE_ENV !== 'test') {
            console.info('[CACHE CLEAR] All cache cleared');
        }
    }

    /**
     * Evict least recently used entries
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.accessedAt < oldestTime) {
                oldestTime = entry.accessedAt;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.ttlMap.delete(oldestKey);
            
            if (process.env.NODE_ENV !== 'test') {
                console.debug(`[CACHE EVICT] LRU: ${oldestKey}`);
            }
        }
    }

    /**
     * Start cleanup interval for expired entries
     */
    startCleanup() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.cache.delete(key);
            this.ttlMap.delete(key);
        }
        
        if (keysToDelete.length > 0 && process.env.NODE_ENV !== 'test') {
            console.debug(`[CACHE CLEANUP] Removed ${keysToDelete.length} expired entries`);
        }
    }

    /**
     * Stop cleanup interval
     */
    stop() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        this.stop();
        this.clear();
    }
}

// Singleton instance for the application
let cacheInstance = null;

/**
 * Get or create cache instance
 */
function getCacheInstance(options = {}) {
    if (!cacheInstance) {
        cacheInstance = new CacheService(options);
        
        // Handle graceful shutdown
        process.on('SIGTERM', () => {
            cacheInstance.shutdown();
        });
        
        process.on('SIGINT', () => {
            cacheInstance.shutdown();
        });
    }
    
    return cacheInstance;
}

/**
 * Cache helper functions for common patterns
 */
const CacheHelpers = {
    /**
     * Cache dashboard data
     */
    async cacheDashboard(role, schoolId, data, ttl = 300) {
        const cache = getCacheInstance();
        const key = cache.buildKey('dashboard', role, schoolId, role);
        await cache.set(key, data, ttl);
    },

    /**
     * Get cached dashboard data
     */
    async getCachedDashboard(role, schoolId) {
        const cache = getCacheInstance();
        const key = cache.buildKey('dashboard', role, schoolId, role);
        return await cache.get(key);
    },

    /**
     * Cache list data with pagination
     */
    async cacheList(module, schoolId, params, data, ttl = 180) {
        const cache = getCacheInstance();
        const key = cache.buildKey(module, 'list', schoolId, null, params);
        await cache.set(key, data, ttl);
    },

    /**
     * Get cached list data
     */
    async getCachedList(module, schoolId, params) {
        const cache = getCacheInstance();
        const key = cache.buildKey(module, 'list', schoolId, null, params);
        return await cache.get(key);
    },

    /**
     * Cache reference data (classes, subjects, etc.)
     */
    async cacheReference(module, schoolId, data, ttl = 600) {
        const cache = getCacheInstance();
        const key = cache.buildKey(module, 'reference', schoolId);
        await cache.set(key, data, ttl);
    },

    /**
     * Get cached reference data
     */
    async getCachedReference(module, schoolId) {
        const cache = getCacheInstance();
        const key = cache.buildKey(module, 'reference', schoolId);
        return await cache.get(key);
    },

    /**
     * Invalidate cache on data changes
     */
    async invalidateOnDataChange(module, schoolId) {
        const cache = getCacheInstance();
        
        // Invalidate module-specific cache
        await cache.invalidateModule(module, schoolId);
        
        // Invalidate dashboard cache (affected by most data changes)
        await cache.invalidateModule('dashboard', schoolId);
    }
};

module.exports = {
    CacheService,
    getCacheInstance,
    CacheHelpers
};
