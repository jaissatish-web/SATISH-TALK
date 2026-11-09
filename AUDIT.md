# Upstream audit — 9 November 2026

Source: https://github.com/mrtblount/radio1 at `7f7514d6e43390ec1510c0f586e4aadc59aa8389`.

## Licence and reuse

MIT, copyright 2026 Tony Blount. Modification and redistribution are permitted while preserving the copyright and permission notice. `LICENSE` is retained. Satish Talk reuses the WebRTC mesh and negotiation approach rather than replacing the voice engine.

## Existing architecture

React 18, TypeScript, Vite 6, Tailwind 4. Convex provides transactional floor control, reactive presence and WebRTC signaling. WebRTC is full mesh; each client opens one peer connection to every other member. Audio tracks are pre-negotiated and disabled until the server grants the floor. Perfect negotiation addresses colliding offers; failed connections can be recreated. Wake lock and microphone processing constraints already exist.

The actual source has grown beyond its README: chat, direct calls, AI operations, audio recording, uploaded clips, transcription, push notifications and tasks are present. The README's statement that audio is never recorded is therefore inaccurate for that revision. Those features are excluded from Satish Talk.

## Findings that require correction

- Optional global access code allows public access when unset. Guessable channel names are not room authorization.
- Several operations trust a supplied session ID; original leave and heartbeat lack secret verification.
- Shared code holders can submit another session ID to floor/signaling operations. Session identity needs a separate secret.
- No strict 10-member limit or general input/payload bounds.
- Public shared TURN credentials are bundled. They offer no production capacity guarantee.
- Recorder/upload logic conflicts with the no-recording requirement.
- Mic renewal failures do not immediately fail closed; visibility handling primarily repairs on return.
- Mesh reconnect attempts need bounded retries and a clear manual recovery path.
- Existing browser tests assume upstream channels/UI and a live backend. They do not prove Satish Talk readiness or real-device performance.
- Package manifest includes unnecessary AI, web-push and UI dependencies for this scope. Dependency audit must be run after pruning; see TEST_REPORT.md for actual results.

## Ten-user assessment

Ten members imply 45 peer connections across the room and 9 connections per phone. A single speaker sends 9 encoded streams. At an illustrative 24–48 kbit/s per stream, this is roughly 216–432 kbit/s payload upload, plus transport overhead. These are calculations, not measurements. Even muted WebRTC tracks can create network traffic. RadioMesh is suitable for a small-team trial but 10-user audio quality, battery and carrier-NAT success require acceptance testing. An SFU would reduce sender upload to one stream but introduces another hosted service; do not add one without a separate architecture decision.

## Hosting

Static frontend on an HTTPS host; separate Convex backend; STUN and a dedicated TURN option for networks where direct connectivity fails. Vercel does not relay this audio. No infrastructure has been provisioned or deployed during this task.
