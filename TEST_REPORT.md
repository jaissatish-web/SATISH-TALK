# Verification report

Status: implementation in progress; backend emulator verification completed. No physical-device or deployed-backend pass is claimed by this report.

## Automated checks

Final outcomes will be recorded after implementation. CI runs clean install, lint, TypeScript, tests, production build and production-dependency audit. A green build alone does not prove working audio or mobile background reception.

## Acceptance matrix

| Scenario                                                       | Status / evidence required                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Production build / typecheck / lint                            | Pending final execution                                                         |
| Dependency vulnerability audit                                 | Pending final execution                                                         |
| Private join, invalid access rejection                         | Passed in Convex-test emulator; room is configured rather than publicly created |
| Session impersonation, unauthorized signaling/rename           | Passed in Convex-test emulator                                                  |
| Floor contention, lease expiry/60-second cap and leave cleanup | Passed in Convex-test emulator                                                  |
| Press/release/cancel/hidden/offline lifecycle                  | Pending final automated results                                                 |
| 2/5/10-member control-plane capacity and contention            | Passed in Convex-test emulator; 11th member rejected; not an audio load test    |
| Actual two-way microphone audio                                | Not tested on physical devices                                                  |
| 5/10-phone audio, latency, CPU, bandwidth and battery          | Not tested on physical devices                                                  |
| Android Chrome touch/permission/revoke/tab switch              | Not tested on physical devices                                                  |
| iPhone Safari audio unlock/install/resume                      | Not tested on physical devices                                                  |
| Bluetooth headset and device selection                         | Not tested on physical devices                                                  |
| Locked screen and browser suspension                           | Not tested on physical devices; continuous reception unsupported                |
| Carrier NAT / restrictive network / TURN                       | Not tested on physical networks                                                 |
| Production Convex / Vercel smoke test                          | Not run; deployment explicitly excluded                                         |

## Backend test evidence

`tests/backend.test.ts`: nine Convex-test integration tests passed, covering room credentials, secret-bound identity, duplicate names, membership limits, transactional floor contention, lease expiry and hard cap, signaling isolation and per-member budget, stale-session rejection, owner rename and credential-rotation revocation. Backend TypeScript check passed. These tests use a local emulator; they do not contact a live Convex deployment or test WebRTC audio.

## Manual test procedure

Use distinct names and fresh browser sessions. Test first with two phones in separate rooms to avoid acoustic feedback, then five and ten. Mix office Wi-Fi and cellular. Measure press-to-audio and release-to-silence with an external recording/timer only for the acceptance exercise if everyone consents; the application itself must not record.

For each group size: join, verify roster and peer links, transmit in both directions, press simultaneously, release, cancel a touch, rotate phone, switch tab, deny/revoke permission, disconnect Wi-Fi, turn mode off/on, leave/rejoin and resume after locking. Confirm no stale press restarts the mic. Exercise owner rename/invite rotation and reject an old invitation for new joins. Test receiving audio after reconnect and report unsupported output selection honestly.

Record device/browser versions, network types, observed delay, failures, reconnect attempts and CPU/battery observations. Ten participants appearing in a roster is not a ten-user audio performance pass.
