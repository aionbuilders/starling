# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-31

### Added

#### Client Core
- Universal WebSocket client (browser, Node.js, Bun, Deno)
- Request/Response pattern with promises
- Event subscription (pub/sub)
- Connection state management
- Proper cleanup on disconnection

#### Session Recovery
- Client-side session token storage
- Automatic reconnection with stored token
- Auto-refresh before expiration
- Configurable storage (localStorage, in-memory, custom)
- Events: `session:recovered`, `session:recovery-failed`, `session:refreshed`

#### Room Management
- Subscribe/unsubscribe to rooms via RPC
- Built-in methods: `subscribe()`, `unsubscribe()`
- Listen to room events via topics

#### Health Check
- Client-side health check support
- Automatic ping/pong handling
- Custom ping callback support

#### Developer Experience
- TypeScript definitions
- JSDoc documentation
- Comprehensive error handling
- ConnectionClosedError for closed connections
- Event-driven architecture

### Features

- Runtime-agnostic design
- Minimal dependencies
- Promise-based API
- Middleware support (inherited from protocol)
- Pattern matching support for topics

### Dependencies
- `@aionbuilders/helios-protocol` ^1.1.0
- `@killiandvcz/pulse` ^2.1.3

[1.0.0]: https://github.com/aionbuilders/starling/releases/tag/v1.0.0
