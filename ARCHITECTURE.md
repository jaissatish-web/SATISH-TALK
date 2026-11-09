# Architecture

## Components

| Component            | Responsibility                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| React/Vite frontend  | Join, radio, members, settings, device permissions and PWA shell        |
| Convex               | Private access, member sessions, presence, floor leases and signaling   |
| WebRTC mesh          | Encrypted live audio directly between peers or through TURN             |
| STUN/TURN            | ICE connectivity; TURN relays encrypted media when a direct route fails |
| Static HTTPS hosting | Delivers app assets; does not carry live audio                          |

A room with ten members has 45 peer connections in total and nine per member. Only the floor holder enables its outbound microphone track. Audio is not written to Convex, storage, analytics or a message history. No recorder/transcriber exists in version 1.

## Joining and identity

The server requires both a strong private room token and an access code. A client creates an unpredictable session ID and a separate session secret. Convex stores the secret hash and derives the member/channel from that authenticated session for subsequent operations. Public rosters omit secret hashes. Duplicate active names and more than ten active members are rejected.

Successful backend registration confirms presence; it does not alone prove every peer audio link works. The UI reports linking/failure separately. Browser network status is only an additional hint, not proof of server reachability.

## Push-to-talk

A press requests the floor through a Convex mutation. Convex transactions serialize conflicting acquisitions. The track stays disabled until an affirmative grant for the current press/session. Release disables the track synchronously before notifying the server. Canceled or stale grants cannot enable a new session's track.

The floor lease lasts ten seconds, must be renewed, and has a 60-second transmission cap. Client renewal errors fail closed. Expiry permits a new speaker even before cleanup removes an old row. Hiding the page, connectivity loss, mode off and canceled interactions stop local transmission. The mesh relies on cooperative clients for mic muting; a malicious authorized client can modify its own software, so this is not a certified moderation or emergency system.

## Presence and signaling

Presence is fresh for 30 seconds. A 30-second cleanup cron removes stale members, expired floors and signals older than 60 seconds. Queries use timestamps and session validation rather than waiting for cleanup to enforce access. Signaling is session-bound, limited to live members in the same channel, capped at 32 KiB per payload and rate-limited. Signaling carries SDP/ICE network metadata, never voice frames.

## Resource lifecycle

Mode off tears down subscriptions, peer connections, microphone tracks, timers, playback elements and wake lock. Permission denial and revoked/ended tracks leave clear errors. Reconnect creates fresh state and cannot inherit a held press. Peer retries are bounded; persistent failure offers manual reconnect.

Wake lock is best effort, requested only for an active visible session and released on disable/off. Browser suspension may interrupt audio and signaling. Installation provides app-like launch behavior, not guaranteed background operation.

## Limits and future scaling

Ten-user audio quality is not established by a member limit or a simulated backend test. Test on real phones/networks and measure upload, CPU and battery. An SFU is a possible later option if measurements justify its hosting cost and operational complexity. Do not introduce one as an unapproved service.

Each peer pair elects the lower session ID as its sole offerer. The counterpart answers and can send an authenticated restart request. ICE restarts keep the same peer connection, are bounded, and show a failed audio link after exhaustion. This avoids simultaneous-offer rollback and candidate loss. An independent 30-second control-plane watchdog stops a session even when a network request never settles.
