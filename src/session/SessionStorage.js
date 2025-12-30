/**
 * LocalStorage-based session token storage (for browsers)
 */
export class LocalStorageSessionStorage {
    /**
     * @param {string} [key='helios_session'] - Storage key
     */
    constructor(key = 'helios_session') {
        this.key = key;
    }

    /**
     * Save session token to localStorage
     * @param {string} token
     */
    async save(token) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.key, token);
        }
    }

    /**
     * Load session token from localStorage
     * @returns {Promise<string|null>}
     */
    async load() {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(this.key);
        }
        return null;
    }

    /**
     * Clear session token from localStorage
     */
    async clear() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.key);
        }
    }
}

/**
 * In-memory session token storage (for Node.js/Bun)
 */
export class InMemorySessionStorage {
    constructor() {
        this.token = null;
    }

    /**
     * Save session token to memory
     * @param {string} token
     */
    async save(token) {
        this.token = token;
    }

    /**
     * Load session token from memory
     * @returns {Promise<string|null>}
     */
    async load() {
        return this.token;
    }

    /**
     * Clear session token from memory
     */
    async clear() {
        this.token = null;
    }
}
