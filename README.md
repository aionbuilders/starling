# @aionbuilders/starling

[![npm version](https://badge.fury.io/js/@aionbuilders%2Fstarling.svg)](https://www.npmjs.com/package/@aionbuilders/starling)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@aionbuilders/starling)](https://bundlephobia.com/package/@aionbuilders/starling)

> Universal WebSocket client for Helios - Works everywhere

## Why Starling?

The universal client for Helios servers:

- 🌐 **Runtime Agnostic** - Browser, Node.js, Bun, Deno
- 🔐 **Session Recovery** - Reconnect without data loss
- 📡 **Room Subscriptions** - Join/leave rooms with ease
- 🎯 **Request/Response** - Promise-based RPC
- 📢 **Event Streams** - Real-time pub/sub
- 🪶 **Lightweight** - Minimal dependencies

## Installation

```bash
# Using bun
bun add @aionbuilders/starling

# Using npm
npm install @aionbuilders/starling

# Using pnpm
pnpm add @aionbuilders/starling
```

## Quick Start

### Basic Connection

```javascript
import { Starling } from '@aionbuilders/starling';

const starling = new Starling({
  url: 'ws://localhost:3000'
});

await starling.connect();
console.log('Connected!');
```

### Request/Response (RPC)

```javascript
// Make a request
const response = await starling.request('user.get', {
  userId: 123
});

console.log('User:', response.data);

// With timeout
const response = await starling.request('slow.operation', {}, {
  timeout: 10000 // 10 seconds
});
```

### Events (Pub/Sub)

```javascript
// Subscribe to events
starling.on('chat:message', (data, context) => {
  console.log('Message:', data.text);
  console.log('From:', context.clientId);
});

// Emit events
starling.emit('chat:message', {
  text: 'Hello world!'
});

// Unsubscribe
starling.off('chat:message', handler);
```

### Rooms

```javascript
// Subscribe to a room
await starling.subscribe('lobby');

// Subscribe with data (for server validation)
await starling.subscribe('user:123', {
  token: 'auth-token'
});

// Listen to room events
starling.on('lobby', (data) => {
  console.log('Room event:', data);
});

// Unsubscribe
await starling.unsubscribe('lobby');
```

### With Session Recovery

```javascript
const starling = new Starling({
  url: 'ws://localhost:3000',
  sessionRecovery: {
    enabled: true,
    autoRecover: true,  // Auto-use stored token (default: true)
    autoRefresh: true   // Auto-refresh before expiry (default: true)
  }
});

// Events
starling.events.on('session:recovered', ({ session }) => {
  console.log('Session recovered!', session.sessionId);
});

starling.events.on('session:recovery-failed', ({ reason }) => {
  console.log('Recovery failed:', reason);
});

// Manual operations
await starling.refreshSession();
await starling.clearSession();
```

## Core Concepts

### Connection State

```javascript
console.log(starling.state); // 'CLOSED' | 'CONNECTING' | 'OPEN' | 'CLOSING'

// Wait for connection
await starling.connect();

// Check state
if (starling.state === 'OPEN') {
  // Ready to send
}
```

### Request/Response Pattern

```javascript
// Simple request
const result = await starling.request('method.name', {
  key: 'value'
});

// With options
const result = await starling.request('method.name', payload, {
  timeout: 5000,           // Request timeout
  throwOnError: true,      // Throw if server returns error
  peer: { id: 'user-123' } // Peer routing (if server supports)
});

// Handle response
if (result.isSuccess()) {
  console.log('Success:', result.data);
} else if (result.isError()) {
  console.log('Error:', result.error);
}
```

### Events and Topics

```javascript
// Pattern matching support
starling.on('chat:**', (data, context) => {
  console.log('Any chat event:', context.topic);
});

// Multiple handlers
starling.on('user:updated', handler1);
starling.on('user:updated', handler2);

// Once
starling.topics.once('user:updated', (data) => {
  console.log('User updated once!');
});

// Unsubscribe all
starling.topics.offAll('chat:message');
```

### Session Storage

Default storage:
- **Browser**: localStorage
- **Node.js/Bun**: In-memory

Custom storage:

```javascript
const starling = new Starling({
  url: 'ws://localhost:3000',
  sessionRecovery: {
    enabled: true,
    storage: {
      async save(token) {
        await redis.set('session', token, 'EX', 300);
      },
      async load() {
        return await redis.get('session');
      },
      async clear() {
        await redis.del('session');
      }
    }
  }
});
```

### Error Handling

```javascript
import { ConnectionClosedError } from '@aionbuilders/starling';

try {
  const result = await starling.request('method', payload);
} catch (error) {
  if (error instanceof ConnectionClosedError) {
    console.log('Connection closed before response');
  } else {
    console.error('Request failed:', error);
  }
}
```

## API Reference

### Starling Options

```typescript
interface StarlingOptions {
  url: string | URL;
  protocols?: string[];
  timeout?: number;              // Connection timeout (default: 10000ms)
  requestTimeout?: number;       // Request timeout (default: 5000ms)
  parseMode?: 'strict' | 'permissive';
  sessionRecovery?: SessionRecoveryOptions;
  healthCheck?: HealthCheckOptions;
}

interface SessionRecoveryOptions {
  enabled: boolean;
  autoRecover?: boolean;         // Default: true
  autoRefresh?: boolean;         // Default: true
  refreshInterval?: number;      // Default: TTL/2
  storage?: SessionStorage;
}

interface HealthCheckOptions {
  enabled?: boolean;             // Default: true
  onPing?: () => void;           // Custom ping handler
}
```

### Main Methods

```typescript
class Starling {
  // Connection
  async connect(options?: Partial<StarlingOptions>): Promise<WebSocket>;

  // Messaging
  async send(message: Message): Promise<boolean>;
  async emit(topic: string, data: any): Promise<boolean>;
  async request(method: string, payload: any, options?: RequestOptions): Promise<Response>;

  // Rooms
  async subscribe(topic: string, data?: any): Promise<{success: boolean}>;
  async unsubscribe(topic: string): Promise<{success: boolean}>;

  // Session
  async refreshSession(): Promise<any>;
  async clearSession(): Promise<void>;

  // Event subscriptions
  on(topic: string, handler: Function): void;
  off(topic: string, handler: Function): void;

  // State
  state: 'CLOSED' | 'CONNECTING' | 'OPEN' | 'CLOSING';
}
```

### Events

```javascript
// Connection events
starling.events.on('open', ({ event, starling, websocket }) => { /* ... */ });
starling.events.on('close', ({ event, starling, websocket }) => { /* ... */ });
starling.events.on('error', ({ event, starling, websocket }) => { /* ... */ });

// Session events
starling.events.on('session:recovered', ({ session, starling }) => { /* ... */ });
starling.events.on('session:recovery-failed', ({ reason, starling }) => { /* ... */ });
starling.events.on('session:refreshed', ({ token, sessionId, starling }) => { /* ... */ });

// Room events (via starling.topics)
starling.topics.on('system:rate-limited', (data, context) => { /* ... */ });
```

## Examples

### Chat Application

```javascript
const starling = new Starling({
  url: 'ws://localhost:3000',
  sessionRecovery: { enabled: true }
});

await starling.connect();

// Subscribe to chat room
await starling.subscribe('chat:general');

// Listen for messages
starling.on('chat:general', ({ from, text, timestamp }) => {
  displayMessage(from, text, timestamp);
});

// Send message
document.querySelector('#send').onclick = () => {
  const text = document.querySelector('#input').value;
  starling.emit('chat:message', { text });
};
```

### Collaborative Editor

```javascript
const starling = new Starling({
  url: 'ws://localhost:3000',
  sessionRecovery: { enabled: true }
});

await starling.connect();

// Subscribe to document
await starling.subscribe(`document:${docId}`, {
  token: authToken
});

// Listen for changes
starling.on(`document:${docId}`, ({ changes, userId }) => {
  if (userId !== myUserId) {
    applyRemoteChanges(changes);
  }
});

// Send local changes
editor.on('change', (changes) => {
  starling.emit(`document:change`, {
    docId,
    changes,
    userId: myUserId
  });
});
```

### API Client with Retry

```javascript
class APIClient {
  constructor(url) {
    this.starling = new Starling({
      url,
      sessionRecovery: { enabled: true }
    });
  }

  async connect() {
    await this.starling.connect();
  }

  async request(method, params, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.starling.request(method, params, {
          timeout: 10000,
          throwOnError: true
        });
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }
}

// Usage
const api = new APIClient('ws://api.example.com');
await api.connect();

const users = await api.request('users.list', { page: 1 });
```

## Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { Starling } from 'https://cdn.skypack.dev/@aionbuilders/starling';

    const starling = new Starling({
      url: 'ws://localhost:3000'
    });

    await starling.connect();
    console.log('Connected!');
  </script>
</head>
<body>
  <h1>Starling in Browser</h1>
</body>
</html>
```

## Node.js Usage

```javascript
import { Starling } from '@aionbuilders/starling';

const starling = new Starling({
  url: 'ws://localhost:3000',
  sessionRecovery: {
    enabled: true,
    // In-memory storage (default for Node.js)
  }
});

await starling.connect();
```

## Related Packages

- [@aionbuilders/helios](https://npm.im/@aionbuilders/helios) - Server implementation
- [@aionbuilders/helios-protocol](https://npm.im/@aionbuilders/helios-protocol) - Core protocol

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Generate types
bun run generate-types

# Development (with example server)
bun run dev
```

## Contributing

Contributions welcome! Please read the contribution guidelines first.

## License

MIT © Killian Di Vincenzo

## Acknowledgments

Built for universal WebSocket communication 🌐
