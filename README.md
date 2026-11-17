# THE SYSTEM

THE SYSTEM is a MERN application foundation with a Vite + React client and an Express API. The landing page runs without a MongoDB connection; MongoDB configuration is prepared for future modules.

## Requirements

- Node.js 20 or later (Node.js 22 recommended)
- npm
- MongoDB is optional for the current landing page and health check

## Install

From the repository root, install dependencies for the root scripts, client, and server:

```bash
npm install
```

Copy `server/.env.example` to `server/.env` if you want to configure the API port or a future MongoDB connection. No environment file is required for local development.

## Run both applications

```bash
npm run dev
```

The Vite client is served at `http://localhost:5173` and the API at `http://localhost:5000`. Vite proxies `/api` requests to the Express server.

Check the API with `http://localhost:5000/api/health` (or `http://localhost:5173/api/health` through the Vite proxy).

## Other commands

```bash
npm run dev:client
npm run dev:server
npm run build
npm start
```

## Project notes

- React UI lives under `client/src`; API routes and server setup live under `server/src`.
- GSAP and ScrollTrigger are installed as client dependencies. Animations respect the user's reduced-motion preference.
- `server/src/config/database.js` exports an optional Mongoose connection helper. The server does not call it until a database-backed module is introduced.
- `design-reference/` is reserved for design inputs. It was not present in the starting workspace, so no reference files or existing rank animation prototype were available to inspect or modify.

See [AGENTS.md](./AGENTS.md) for conventions for future contributors and Codex sessions.
