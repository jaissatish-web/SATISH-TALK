# Setup for the owner

No deployment has been performed. These instructions are for a separately authorized setup task. Use a new Satish Talk project; do not select an existing Team Radio or GCC Mentor backend.

## Local tools

Use Node.js 22 and npm. Clone `https://github.com/jaissatish-web/SATISH-TALK`, open its directory and run:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Separate Convex project

After authorization, run `npx convex dev` and carefully choose/create **Satish Talk** in your own account. This command provisions/updates a backend: it is intentionally not run as part of source-only implementation. The CLI creates local deployment settings. Never commit deployment credentials.

Configure these server environment variables using the Convex dashboard's environment settings:

| Name          | Value and purpose                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ROOM_TOKEN`  | Cryptographically random base64url string, 32–256 characters. Private invitation capability; required.                     |
| `ACCESS_CODE` | At least 8 characters; separate private access code required in addition to the invitation token. Use a strong passphrase. |
| `OWNER_TOKEN` | Separate cryptographically random base64url string, 32–256 characters. Allows channel rename; keep it only with the owner. |

Generate each random token independently with a password manager or `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Do not paste real values into GitHub issues, commits, screenshots or chat. Enter secrets through the dashboard rather than shell command arguments/history.

The one supported channel is `instrumentation`, displayed by default as **Instrumentation Team**. There is no room-creation database step or public channel directory. Owner rename changes the display name, not the private identifier.

## Frontend configuration

Copy `.env.example` to `.env.local`. Set `VITE_CONVEX_URL` to your new backend URL. Vite's `VITE_` values are public browser configuration, not a secret store.

`VITE_ICE_SERVERS` optionally accepts a JSON array in the WebRTC `RTCIceServer` format, for example a STUN URL and dedicated TURN endpoints with scoped credentials. Without it the application uses STUN only. Direct connections can fail behind carrier NAT or corporate firewalls; a reliable rollout needs a tested TURN option. Long-lived TURN account/master keys must never be bundled. A dynamic short-lived credential endpoint is a future improvement if your relay service requires it; do not pretend a fixed build-time credential is ephemeral.

Run `npm run dev`, then open the printed localhost URL. Microphone access requires localhost or HTTPS; opening the developer's LAN HTTP address on a phone usually will not work. Use an authorized HTTPS preview for phone tests.

## Private invitation

The owner distributes the room token through the app's invitation mechanism and sends the access code through a separate trusted channel. Invitation data belongs in a URL fragment, never query parameters, so normal HTTP requests and referrer headers do not carry the token. Anyone receiving both credentials can join until they are rotated. Never post an invitation publicly.

Use a distinct display name for every member. A name already active in the room is rejected. This prevents accidental duplication, but names are not verified legal identities. There are no accounts or identity-provider guarantees.

## Owner actions and rotation

Enter the owner token only in owner controls when changing the channel display name. It is not an invitation credential.

To rotate access, replace `ROOM_TOKEN` and/or `ACCESS_CODE` in the Convex dashboard, then send updated credentials privately. Confirm an old invitation fails before relying on revocation. Read SECURITY.md for active-session behavior and emergency cleanup.

For a future production deployment, use `npx convex deploy` only after checking the selected project and environment. Follow VERCEL_DEPLOYMENT.md afterward; do not run Vercel deployment commands during source preparation.
