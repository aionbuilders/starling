import {Pulse} from "@killiandvcz/pulse";
import { StarlingEvent } from "./utils/events.utils";
import { EventManager, MethodManager, Parser } from "@aionbuilders/helios-protocol";
import { ProtocolError } from "@aionbuilders/helios-protocol";
import { Request, Event as EventMessage, Response, Message } from "@aionbuilders/helios-protocol";
import { Serializer } from "@aionbuilders/helios-protocol";
import { ConnectionClosedError } from "./errors.js";
import { LocalStorageSessionStorage, InMemorySessionStorage } from "./session/SessionStorage.js";


/**
* @typedef {import("./types").StarlingOptions} StarlingOptions
*/

export class Starling {
    /**@param {Partial<StarlingOptions>} [options] */
    constructor(options = {}) {
        this.options = {
            ...options,
            url: options.url instanceof URL ? options.url : new URL(options.url || "ws://localhost:8080"),
            timeout: options.timeout ?? 10000,
            requestTimeout: options.requestTimeout || 5000,
            parseMode: options.parseMode || 'strict',
        };

        this.events = new Pulse({ EventClass: StarlingEvent });

        this.methods = new MethodManager();
        this.method = this.methods.register.bind(this.methods);
        this.namespace = this.methods.namespace.bind(this.methods);
        this.use = this.methods.use.bind(this.methods);

        this.topics = new EventManager();
        this.on = this.topics.on.bind(this.topics);
        this.off = this.topics.off.bind(this.topics);

        // State management
        this.state = 'CLOSED'; // 'CLOSED' | 'CONNECTING' | 'OPEN' | 'CLOSING'

        // Track pending requests for cleanup
        this.pendingRequests = new Map(); // requestId -> { requestId, timeoutId, cleanup, reject }

        // Track connection timeout for cleanup
        this.connectionTimer = null;

        // Setup session storage
        if (options.sessionRecovery?.enabled) {
            const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
            this.sessionStorage = options.sessionRecovery.storage ||
                (isBrowser ? new LocalStorageSessionStorage() : new InMemorySessionStorage());

            this.sessionRecoveryEnabled = true;
            this.autoRecover = options.sessionRecovery.autoRecover !== false; // default: true
        } else {
            this.sessionRecoveryEnabled = false;
            this.autoRecover = false;
        }
    }
    
    /** @type {StarlingOptions} */
    options;
    
    /** @type {WebSocket | null | undefined} */
    websocket;
    
    /** @param {string | ArrayBufferLike | Blob | ArrayBufferView<ArrayBufferLike>} data */
    raw = async (data) => {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not connected.");
        }
        try {
            this.websocket.send(data);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /** @param {Message} message */
    send = async (message) => {
        if (!(message instanceof Message)) throw new Error("Message must be an instance of Message");
        if (!message.id) throw new Error("Message must have an ID to be sent");
        
        try {
            this.websocket?.send(Serializer.serialize(message));
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /** @param {any} data @param {Partial<Parameters<typeof Message.outgoing>[1]>} options */
    json = (data, options = {}) => this.send(Message.outgoing(data, {dataType: "json", ...options}));

    /** @param {string} data @param {Partial<Parameters<typeof Message.outgoing>[1]>} options */
    text = (data, options = {}) => this.send(Message.outgoing(data, {dataType: "string", ...options}));

    /** @param {ArrayBuffer | Uint8Array | Buffer} data @param {Partial<Parameters<typeof Message.outgoing>[1]>} options */
    binary = (data, options = {}) => this.send(Message.outgoing(data, {dataType: "buffer", ...options}));

    /** @param {string} topic @param {any} data @param {Partial<Parameters<typeof EventMessage.outgoing>[1]>} options */
    emit = (topic, data, options = {}) => this.send(EventMessage.outgoing(data, { topic, ...options }));

    /**
     * @param {string} method @param {any} payload @param {Partial<Parameters<typeof Request.outgoing>[1]> & {throwOnError?: boolean}} options
     * @returns {Promise<Response>}
     */
    request = async (method, payload, options = {}) => {
        // Check connection state
        if (this.state !== 'OPEN') {
            return Promise.reject(new ConnectionClosedError('Connection is not open'));
        }

        return new Promise((resolve, reject) => {
            const request = Request.outgoing(payload, { method, ...options });
            const requestId = request.id;

            // Setup timeout
            const timeoutMs = options.timeout || this.options.requestTimeout;
            const timeoutId = setTimeout(() => {
                // Check if still connected before emitting
                if (this.state === 'OPEN') {
                    this.events.emit(`error:${requestId}`, new Error("Request timed out."));
                }
            }, timeoutMs);

            // Cleanup function
            const cleanup = () => {
                clearTimeout(timeoutId);
                this.events.off(`response:${requestId}`);
                this.events.off(`error:${requestId}`);
                this.pendingRequests.delete(requestId);
            };

            // Store pending request info for cleanup
            this.pendingRequests.set(requestId, {
                requestId,
                timeoutId,
                cleanup,
                reject
            });

            // Setup listeners
            this.events.once(`response:${requestId}`, ({event}) => {
                cleanup();
                const response = /** @type {Response} */ (event.data);
                if (options.throwOnError && response.error) reject(new Error(response.error.message || "Server returned an error"));
                resolve(/** @type {Response} */ (event.data));
            });

            this.events.once(`error:${requestId}`, ({event}) => {
                cleanup();
                reject(event.data);
            });

            // Send request
            this.send(request);
        });
    }
    
    /** @param {Event} event */
    handleOpen(event) {
        this.state = 'OPEN';

        // Setup session event handlers if enabled
        if (this.sessionRecoveryEnabled) {
            this.setupSessionHandlers();
        }

        this.events.emit("open", {event, starling: this, websocket: this.websocket});
    }

    /**
     * Setup handlers for session recovery events
     */
    setupSessionHandlers() {
        // Session created - save token
        this.topics.on('session:created', async (data) => {
            const { token } = data;
            try {
                await this.sessionStorage?.save(token);
                console.log('[Starling] Session token saved');
            } catch (error) {
                console.error('[Starling] Failed to save session token:', error);
            }
        });

        // Session recovered - notify success
        this.topics.on('session:recovered', (data) => {
            const { sessionId, metadata } = data;
            console.log('[Starling] Session recovered:', sessionId);

            this.events.emit('session:recovered', {
                session: data,
                starling: this
            });
        });

        // Recovery failed - clear invalid token and start fresh
        this.topics.on('session:recovery-failed', async (data) => {
            const { reason } = data;
            console.log('[Starling] Session recovery failed:', reason);

            // Clear invalid token
            try {
                await this.sessionStorage?.clear();
            } catch (error) {
                console.error('[Starling] Failed to clear session token:', error);
            }

            this.events.emit('session:recovery-failed', {
                reason,
                starling: this
            });
        });
    }

    /**
     * Clear session token manually
     */
    async clearSession() {
        if (this.sessionStorage) {
            await this.sessionStorage.clear();
        }
    }
    
    /** @param {MessageEvent} event */
    handleMessage(event) {
        const raw = event.data;
        try {
            const message = Parser.parse(raw);
            this.events.emit(message.type, {message, starling: this, websocket: this.websocket}).then(e => {
                if (e.stopped) return;
                if (message instanceof Request) this.handleRequest(message);
                else if (message instanceof Response) this.handleResponse(message);
                else if (message instanceof EventMessage) this.handleEvent(message);
            });
        } catch (error) {
            let message = raw;
            if (error instanceof ProtocolError) {
                if (this.options.parseMode === 'strict') throw error;
                else if (this.options.parseMode === 'permissive') {
                    let dataType = typeof message === 'string' ? 'text' : 'binary';
                    if (dataType === 'text') try {
                        const json = JSON.parse(/** @type {string} */ (message));
                        dataType = 'json';
                        message = json;
                    } catch (e) {}
                    this.events.emit(dataType, {message, starling: this, websocket: this.websocket});
                }
            }
        }
    }
    
    /** @param {Request} request */
    handleRequest(request) {
        this.methods.handle(request, { starling: this }).then(res => {
            if (res) this.send(res);
        });
    }
    
    /** @param {Response} response */
    handleResponse(response) {
        if (this.state === 'CLOSING' || this.state === 'CLOSED') {
            console.warn(`[Starling] Response received for closing/closed connection: ${response.requestId}`);
            return;
        }
        this.events.emit(`response:${response.requestId}`, response);
    }
    
    /** @param {EventMessage} event */
    handleEvent(event) {
        this.topics.handle(event, { connection: this });
    }
    
    /** @param {CloseEvent} event */
    handleClose(event) {
        // Mark as closing IMMEDIATELY
        this.state = 'CLOSING';

        // 1. Clear connection timeout if exists
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }

        // 2. Cancel all pending requests
        if (this.pendingRequests && this.pendingRequests.size > 0) {
            for (const [requestId, pendingInfo] of this.pendingRequests) {
                // Clear timeout
                if (pendingInfo.timeoutId) {
                    clearTimeout(pendingInfo.timeoutId);
                }

                // Call cleanup function (removes listeners)
                if (typeof pendingInfo.cleanup === 'function') {
                    pendingInfo.cleanup();
                }

                // Reject promise with ConnectionClosedError
                if (typeof pendingInfo.reject === 'function') {
                    pendingInfo.reject(new ConnectionClosedError('Connection closed'));
                }
            }
            this.pendingRequests.clear();
        }

        // 3. Cleanup topics EventManager
        if (this.topics && typeof this.topics.clear === 'function') {
            this.topics.clear();
        }

        // 4. Mark as closed
        this.state = 'CLOSED';

        // 5. Emit close event AFTER cleanup
        this.events.emit("close", {event, starling: this, websocket: this.websocket});
    }
    
    /** @param {Event} event */
    handleError(event) {
        this.events.emit("error", {event, starling: this, websocket: this.websocket});
    }
    
    /** @param {Partial<StarlingOptions>} options */
    async connect(options = {}) {
        // Set state to CONNECTING
        this.state = 'CONNECTING';

        const opt = {
            ...this.options,
            ...options
        };

        if (!opt.url) throw new Error("No URL provided for WebSocket connection.");
        let url = opt.url instanceof URL ? opt.url : new URL(opt.url);

        // Try to load session token for recovery
        if (this.sessionRecoveryEnabled && this.autoRecover) {
            try {
                const token = await this.sessionStorage?.load();
                if (token) {
                    // Add token to URL query parameters
                    url = new URL(url.toString());
                    url.searchParams.set('session_token', token);
                }
            } catch (error) {
                console.warn('[Starling] Failed to load session token:', error);
            }
        }

        const protocols = opt.protocols || [];
        this.websocket = new WebSocket(url, protocols);
        this.websocket.onopen = event => {
            this.events.emit("open", {event, starling: this, websocket: this.websocket}).then(e => {
                if (e.stopped) return;
                this.handleOpen(event);
            });
        }
        this.websocket.onmessage = event => {
            this.events.emit("message", {event, starling: this, websocket: this.websocket}).then(e => {
                if (e.stopped) return;
                this.handleMessage(event);
            });
        }
        this.websocket.onclose = event => {
            this.events.emit("close", {event, starling: this, websocket: this.websocket}).then(e => {
                if (e.stopped) return;
                this.handleClose(event);
            });
        }
        this.websocket.onerror = event => {
            this.events.emit("error", {event, starling: this, websocket: this.websocket}).then(e => {
                if (e.stopped) return;
                this.handleError(event);
            });
        };

        return new Promise((resolve, reject) => {
            // Store timer for cleanup in handleClose
            this.connectionTimer = setTimeout(() => {
                this.websocket?.close();
                reject(new Error("Connection timed out."));
            }, opt.timeout ?? 10000);

            this.events.once("open", () => {
                // Clear timer on successful connection
                if (this.connectionTimer) {
                    clearTimeout(this.connectionTimer);
                    this.connectionTimer = null;
                }
                resolve(this.websocket);
            });
        });
    }
    
}