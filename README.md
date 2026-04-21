# Nodetto

A modernized version of Notto, ported from Tauri/Rust to a Node.js/Express backend and a PWA frontend.

## Architecture

- **Frontend**: React-based Progressive Web App (PWA) using Vite.
- **Local Storage**: IndexedDB (via Dexie.js).
- **Encryption**: End-to-end encryption using Web Crypto API and Argon2id (via hash-wasm).
- **Backend**: Node.js Express server with QuickDB (SQLite).
- **Synchronization**: Automatic background synchronization with the server.

## Getting Started

### Prerequisites

- Node.js v18 or higher (Node v25 recommended for development).

### Installation

```bash
npm run install:all
```

### Running Locally

1. Start the server:
   ```bash
   npm run server:dev
   ```
   (Server runs at http://localhost:3000)

2. Start the client:
   ```bash
   npm run client:dev
   ```
   (Client runs at http://localhost:1420)

## Security

Nodetto maintains the same Zero-Knowledge security model as the original Notto:
- All notes are encrypted locally before being sent to the server.
- The server never sees your master password or unencrypted notes.
- Encryption keys are derived using Argon2id.
