# THE SYSTEM

THE SYSTEM is a MERN application: a React/Vite browser client, an Express API, and MongoDB persistence through Mongoose. Public routes and API liveness can load without MongoDB; authenticated accounts and application data require the database to be ready.

## Requirements and install

- Node.js 20 or newer (Node.js 22 is recommended)
- npm
- A MongoDB replica set for transactional account and progression workflows

From the repository root:

```bash
npm install
```

Copy `server/.env.example` to `server/.env` and configure stable, independent `AUTH_SESSION_SECRET` and `RECOVERY_CODE_HMAC_SECRET` values before relying on sessions and recovery codes across server restarts. Keep `.env` files private. Google OAuth is optional and configured only in the server environment.

## Run locally

Open two terminals from the repository root:

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

The backend binds to `127.0.0.1:5001`. Vite binds to port `5175` with strict port binding and proxies `/api` to `http://127.0.0.1:5001`. The Google OAuth callback remains `http://localhost:5175/api/v1/auth/google/callback`. Each command starts only its own workspace; stop each service with Ctrl+C in its terminal.

Useful commands:

```bash
npm run dev:client
npm run dev:server
npm run build
npm test --workspace client
npm test --workspace server
npm run test:browser:smoke
```

The frontend-only command can serve public pages without an API. The backend remains independently startable and exposes `/api/health` for liveness and `/api/ready` for database readiness.

## Where code belongs

- `client/src/pages`: route-level composition.
- `client/src/components`: reusable UI and application shell.
- `client/src/context`: cross-route account, task, notification and preference state.
- `client/src/services`: HTTP clients and API operations.
- `client/src/styles`, `data`, `hooks`, `utils`: shared styling, content/configuration, reusable behavior and pure helpers.
- `server/src/routes`: HTTP surface and middleware attachment.
- `server/src/controllers`: request/response translation.
- `server/src/services`: application and business workflows.
- `server/src/repositories`: persistence query boundaries where separated.
- `server/src/models`: Mongoose schemas, constraints and indexes.
- `server/src/config`, `middleware`, `validators`, `jobs`, `events`, `utils`: infrastructure and shared server behavior.

## Authentication and data

Passport Local handles username/email password sign-in. Passport Google OAuth 2.0 is optional and uses a server-side callback strategy. Mongo-backed express sessions store only the serialized account ID; CSRF protection applies to unsafe API requests. Passwords use Argon2id, and local account recovery uses one-time codes stored as keyed hashes.

Application records are scoped to account and, where appropriate, the active Progression Run. The current API does not seed fictional leaderboard users into production runtime. See the model map for ownership and retention details.

## Existing visual behavior

The client keeps its current THE SYSTEM visual identity, rank artwork, VOID SHARD cursor, click ripple, page transitions, GSAP and ScrollTrigger effects. Shared reduced-motion preferences and the operating system preference control nonessential animation.

`design-reference/` is read-only source material. Do not change it unless the user explicitly asks.
