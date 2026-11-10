# Security and privacy

Satish Talk is private routine communication software, not certified safety equipment. Do not report security vulnerabilities by posting secrets or private invitations in a public GitHub issue. Contact the repository owner privately.

## Access model

- Required high-entropy room token plus separate access code; backend fails closed if configuration is missing.
- Per-session unpredictable secret, stored as a SHA-256 hash by the server, authorizes presence, floor, roster and signaling operations.
- Owner token separately authorizes channel rename and is never part of a member invitation.
- Active names are unique and membership is capped at ten. Display names are not verified identities.
- Input bounds, signaling limits and transactional floor ownership reduce accidental/malicious abuse. Authenticated signaling is capped at 600 messages per member per minute. Native Convex mutations do not expose a client IP here, so there is no application IP throttle on unauthenticated attempts. Strong invitation entropy is required; provider-level abuse protection remains necessary. Application limits are not a distributed-denial-of-service guarantee; monitor usage.

Invitation tokens are bearer credentials. A forwarded link plus the code grants access. Share privately and rotate when a member leaves the team or credentials leak. URL fragments avoid normal HTTP/referrer transmission but remain visible to the browser, recipient, extensions, clipboard and screenshots.

## What services process

| Party                 | Information processed                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTPS host            | Static requests and normal operational/network logs; no live voice                                                                                       |
| Convex                | Channel display name, member display names, session IDs/secret hashes, presence timestamps, floor ownership, signaling/ICE metadata and operational logs |
| Other joined members  | Your display name, presence, live speech while transmitting and WebRTC network addresses depending on ICE route                                          |
| STUN provider         | Connectivity requests and public network address                                                                                                         |
| TURN provider if used | Network addresses, allocation metadata, traffic volume and encrypted relayed WebRTC packets                                                              |

WebRTC transport uses DTLS-SRTP encryption. TURN relays encrypted media but third-party services still process network metadata. There is no voice recording, clip storage, transcription or spoken-content analytics. Providers may retain operational logs under their own policies; do not promise zero retention by third parties. Ephemeral member/signaling cleanup is not a promise that provider backups/logs erase at the same instant.

## Secret handling

Never commit `.env.local`, deployment keys or real access/owner tokens. Only the public Convex URL and public ICE configuration belong in Vite variables. TURN browser credentials are visible to users; use dedicated limited credentials and rotate them. Do not expose a TURN master API key.

Keep the owner token in a password manager. Changing either `ROOM_TOKEN` or `ACCESS_CODE` invalidates existing sessions on their next backend query or mutation. Test old access denial and reconnect legitimate members. For immediate incident response, stop frontend distribution if necessary and remove active member/floor/signaling records in the separate Convex dashboard. A peer-to-peer connection already established by malicious clients cannot be remotely unlearned; end sessions and rotate credentials.

## Remaining risks

Authorized members can hear and externally record what they receive. A modified client may ignore half-duplex discipline. Browser/device compromise, leaked bearer credentials, weak passphrases and site network restrictions remain risks. HTTPS and backend authorization do not make ordinary phones intrinsically safe for hazardous areas.

Dependencies must be reviewed using the lockfile and `npm audit` before deployment. See TEST_REPORT.md for actual audit outcomes, not an assumed clean bill of health.

## Optional device access storage
The opt-in Remember team access setting stores the room invitation and access code in localStorage after joining. Anyone with access to that browser profile, or JavaScript running on this origin, can retrieve them. Use only a trusted personal device. Turning the setting off or choosing Leave channel removes the saved entry. Owner keys and session identities are never persisted by this feature. Backend credential rotation still rejects old saved credentials.
