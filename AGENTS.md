# Project instructions

## Product and stack

THE SYSTEM is a professional MERN application. Keep the React/Vite client and Express/Node server separate. Use JavaScript, CSS, MongoDB through Mongoose when database-backed modules are introduced, and GSAP with ScrollTrigger for animation.

## Structure and boundaries

- Put browser UI in `client/src`; reusable visual elements belong in `components`, page-level composition in `pages`, and larger page sections in `sections`.
- Keep static content and UI configuration in `data`, reusable React behavior in `hooks`, and framework-independent helpers in `utils`.
- Keep shared design tokens and global styles in `client/src/styles`.
- Put HTTP routes in `server/src/routes`, request handling in `controllers`, and reusable application behavior in `services`.
- Keep configuration in `config`, Express middleware in `middleware`, and non-domain helpers in `utils`.
- Keep presentation separate from business logic and data access. Route handlers should stay small and delegate work as modules grow.
- Task scheduling, completion submissions, progression, Recovery Quests, Discipline, Emergency Pause, monthly analysis, leaderboard, notifications, profile/settings and local/Google authentication are implemented in their current approved milestones. Preserve their documented business rules and use the existing service boundaries instead of duplicating them.
- AI proof verification and email delivery are not implemented. Do not imply that optional proof metadata is AI-verified or add email/OTP behavior without a separate approved scope.
- Keep demo fixtures isolated to tests. Do not add fictional accounts or fallback activity to runtime pages.

## Configuration and security

- Read server configuration from environment variables. Keep local `.env` files untracked and update `.env.example` when configuration changes.
- Never put secrets or private API keys in client code or `VITE_` variables. Google OAuth client ID and secret belong only in the backend environment for the Passport redirect flow.
- MongoDB is optional for the static landing page and `/api/health`. Do not make server startup depend on a database connection unless a future product requirement explicitly changes this.
- Validate and handle errors at API boundaries. Keep health checks minimal and free of secrets. Scope member data to `req.user.id` and the correct Progression Run; use MongoDB transactions for multi-record business changes where the service requires them.

## Frontend and accessibility

- Use reusable React components and semantic HTML.
- Keep layouts responsive and keyboard accessible. Preserve visible focus and sufficient color contrast.
- Respect `prefers-reduced-motion` for all animation; scope GSAP work to component lifecycle and clean it up on unmount.
- Use CSS custom properties from `client/src/styles/tokens.css` for shared color, spacing, type, and motion values.

## Changes and verification

- Preserve files in `design-reference/`; treat them as read-only source material unless asked otherwise.
- Keep dependencies in the package manifest for the application that uses them.
- After implementation changes, report what changed and which checks were run. Do not claim a check passed unless it was actually run.
- Do not reset, clean, commit or push local changes unless explicitly requested. Preserve `.env` and existing processes; never stop a process whose project ownership is unverified.
