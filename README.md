# THE SYSTEM

THE SYSTEM is a React and Vite client with an Express API and MongoDB persistence through Mongoose.

## Run locally

Install from the repository root:

```bash
npm install
```

Copy `server/.env.example` to `server/.env` and add your local configuration. Keep `.env` files private. Google OAuth is optional and configured on the server.

Run the services independently in two terminals:

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

The API binds to `127.0.0.1:5001`. Vite uses strict port `5175` and proxies `/api` to the API. The Google OAuth callback is `http://localhost:5175/api/v1/auth/google/callback`. Stop each service with Ctrl+C in its terminal.

## Useful commands

```bash
npm run build
npm test --workspace client
npm test --workspace server
npm run test:browser:smoke
```

The API exposes `/api/health` for liveness and `/api/ready` for database readiness. The public client can run independently; authenticated data requires the backend and MongoDB replica set.

## Review accounts

Set the server-only `APP_REVIEW_MODE=true` to initialize new accounts at Level 100 and Rank 01. Existing accounts are not changed. Set it to `false` or remove it for normal new-account progression.

## Code layout

- `client/src/pages` contains route-level pages.
- `client/src/components` contains shared UI.
- `client/src/context` contains shared account and application state.
- `client/src/services` contains API clients.
- `client/src/styles`, `data`, `hooks`, and `utils` contain shared styling and frontend helpers.
- `server/src/routes`, `controllers`, and `services` define API workflows.
- `server/src/models` contains MongoDB schemas.
- `server/src/config`, `middleware`, `validators`, `jobs`, and `utils` contain server infrastructure.

`design-reference/` is read-only source material.
