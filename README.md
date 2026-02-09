# Keenetic VPN Manager

Web UI for managing per-device VPN policies on a Keenetic router via the RCI REST API.

Toggle VPN on/off for any connected device with a single click. Dark-themed, mobile-responsive, no auth required (designed for local network use).

## Features

- Device list with online/offline status, name, MAC, and IP
- Per-device VPN toggle with verification
- Filter by name, hostname, MAC, or IP
- Online-only filter
- Auto-refresh every 30 seconds
- Toast notifications for toggle results

## Quick Start

### Local development

```bash
cp .env.example .env
# Edit .env with your router credentials

npm install
ROUTER_PASS=your_password npm run dev
```

Open http://localhost:3000

### Docker

```bash
cp .env.example .env
# Edit .env with your router credentials

docker compose up --build
```

Or without `.env`:

```bash
ROUTER_PASS=your_password docker compose up --build
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ROUTER_IP` | `192.168.1.1` | Router address |
| `ROUTER_USER` | `admin` | Router login |
| `ROUTER_PASS` | *(required)* | Router password |
| `VPN_POLICY` | `Policy0` | Keenetic connection policy name |
| `PORT` | `3000` | Server port |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/devices` | GET | List all devices with VPN status |
| `/api/devices/:mac/vpn` | POST | Toggle VPN: `{ "enabled": true }` |
| `/api/health` | GET | Router connectivity check (503 when unreachable) |

## Project Structure

```
src/
├── server.ts                  # Express entry point
├── config.ts                  # Env var loading + validation
├── routes/
│   └── devices.ts             # /api/devices route handlers
├── keenetic/
│   ├── types.ts               # Shared interfaces
│   ├── client.ts              # RCI HTTP client (auth + transport)
│   └── device-service.ts      # Business logic (merge, VPN toggle, verify)
└── utils/
    └── crypto.ts              # Keenetic challenge-response hashing

public/
├── index.html                 # UI shell
├── style.css                  # Dark theme, responsive layout
└── app.js                     # Device rendering, filtering, VPN toggling
```

## How Auth Works

Keenetic uses a challenge-response scheme:

1. `GET /auth` returns `X-NDM-Challenge` and `X-NDM-Realm` headers
2. Compute `SHA256(challenge + MD5(login:realm:password))`
3. `POST /auth` with the hash to get a session cookie

The client handles this automatically, including re-authentication on 401.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Vanilla HTML/CSS/JS (no build step)
- **Docker**: `node:22-alpine` multi-stage build
