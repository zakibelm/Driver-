<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1K32M9sQDclpZYmBDkbiqbEMMEMqW6Ny8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Local administrator account

The local administrator signs in with their configured username or email and password.
Authentication runs in the Vite server (`server/auth.mjs`), using a salted scrypt
password hash from `admin-auth.local`. This private file is ignored by Git and denied
by Vite's file server. Never put it in `public/` or commit it.

Sessions use an HttpOnly, SameSite=Strict cookie, expire after eight hours, and are
invalidated on logout or server restart. Demo mode remains a separate driver session.
The administrator can access the existing dashboard, services, assistant and settings;
there is no separate user-management screen yet.

This account works with the local Vite dev/preview server. A static deployment of
`dist/` does not include the authentication server or account configuration. Production
requires a deployed authentication service, HTTPS cookies and server-side authorization
for data operations. Course data and application settings still use browser storage;
the role shown in the interface does not secure those records or external n8n endpoints.

Run authentication checks with `node --test server/auth.test.mjs`.

## Private account path

Set ADMIN_AUTH_FILE to an absolute path outside this project and outside any directory served by HTTP. Missing, relative or project-internal paths disable real login (503). Move the existing account file manually; it is never migrated or opened by setup scripts. No secret is injected into the frontend build. Vite is pinned to 6.4.4, the latest 6.x returned by the npm registry during this review.
