# Verification report

Production setup completed on 10 November 2026. The application is live at https://satishtalk.vercel.app/ against the separate Satish Talk Convex backend. No physical-phone pass is claimed.

## Automated evidence

- Clean `npm ci`, ESLint, frontend/backend TypeScript, unit/integration tests and production build pass locally and in GitHub CI.
- 36 unit/integration tests: 9 backend, 12 radio lifecycle, 8 press-and-hold input, 4 mesh negotiation/playback recovery and 3 production-secret initialization cases.
- Full dependency audit reports zero known vulnerabilities at the 9 November 2026 check. Inherited high/critical development-tool advisories were resolved by updating Vite/Vitest and transitive dependencies. The lockfile and explicit minimatch override are committed. This is a point-in-time audit, not a security guarantee.
- Three responsive Chromium checks pass at 360×800, 800×360 and 1280×900. They verify navigation, safe offline controls, wake preference, invite-fragment removal and no horizontal overflow.
- Synthetic Chromium WebRTC tests exercise 2, 5 and 10 logical users: all 2/20/90 directed peer connections establish, encoded audio reaches every other peer and cleanup removes playback elements. The final suite also reverses the speaker to verify the return direction. It uses fake microphone permission, generated audio and a test-only local signaling relay, not a deployed Convex service or ten phones.

GitHub evidence is available in [PR #1 Checks](https://github.com/jaissatish-web/SATISH-TALK/pull/1/checks). The first full six-browser-test pass was [run 42693537300](https://github.com/jaissatish-web/SATISH-TALK/actions/runs/42693537300), commit `a9624bf`. Final changes must retain green required checks before merging.

Initial multi-peer tests exposed ICE candidate loss with simultaneous offers. Electing one offerer per pair and coordinating bounded ICE restarts resolved that failure in CI. The restricted local workspace cannot establish ICE even for two peers; this environment limitation is recorded separately from the successful standard GitHub runner result.

## Acceptance matrix

| Scenario | Status |
| --- | --- |
| Build / typecheck / lint / clean install | Passed automated |
| Dependency audit | Zero known vulnerabilities at check time |
| Correct/incorrect private access, session impersonation, duplicate names | Passed Convex-test emulator |
| Unauthorized signaling, owner rename and credential rotation | Passed emulator |
| Floor contention, lease expiry, 60-second cap and leave cleanup | Passed emulator |
| 2/5/10-member control-plane capacity; reject 11th member | Passed emulator |
| Press/release/cancel/lost capture/keyboard and stale grants | Passed automated |
| Mode off during pending microphone/backend operations | Passed automated |
| Hidden/offline handling, stalled heartbeat watchdog, denied microphone | Passed automated |
| Wake lock toggle, pending request, hidden release and visible reacquisition | Passed automated |
| Autoplay denial and explicit speaker-audio recovery | Passed mocked browser API test |
| Responsive portrait/landscape/desktop UI | Passed Chromium automation |
| 2/5/10-peer synthetic WebRTC transport | Passed standard Chromium CI; physical acceptance still required |
| Actual speech quality and two-way microphone audio on phones | Not tested |
| 5/10-phone latency, CPU, bandwidth and battery | Not tested |
| Android Chrome touch/permission revoke/tab switch | Physical testing outstanding |
| iPhone Safari audio unlock/install/resume | Physical testing outstanding |
| Bluetooth headset and device/output selection | Physical testing outstanding |
| Locked screen/background suspension | Physical testing outstanding; continuous reception unsupported |
| Carrier NAT / corporate firewall / TURN | Not tested on physical networks |
| Production Convex / Vercel smoke test | Passed deployment/build and live private coordination checks on 10 November 2026 |

Synthetic tests log connection setup timing, first observed generated-audio energy and RTP counters. Those are CI transport diagnostics, not physical speech latency or phone resource benchmarks. Ten engines share one Chromium page/network stack; they do not replace independent-device load tests. The original Convex adapter has backend emulator coverage and typed integration, but live browser subscription behavior and physical audio still need authenticated phone acceptance checks.

## Manual test procedure

Use distinct names and fresh browser sessions. Start with two phones in separate rooms, then five and ten; mix office Wi-Fi and cellular. Record device/browser versions, connection success, press-to-audio delay, release-to-silence delay, audio clarity, failures, reconnect behavior and battery/CPU observations.

For each group size: join, verify roster and audio links, speak both ways, press simultaneously, release, cancel a touch, rotate phone, switch tab, deny/revoke permission, disconnect Wi-Fi, turn mode off/on, leave/rejoin and resume after locking. Confirm an old press cannot restart the microphone. Test owner rename and rotated credentials, receiving after reconnect, explicit speaker unlock, headset routing and forced TURN relay.

Resolve critical failures before routine site use. No certified emergency-radio performance is claimed.

## Live production evidence — 10 November 2026

Verified production deployment: `dpl_7P1kdQRtyG6odUfXKQymqdvUS21r`, commit `238cdca538376a830eb1b7f1391be81c072e6ae0`. [Deployment build evidence](https://vercel.com/satishs-projects-c02c354b/satishtalk/7P1kdQRtyG6odUfXKQymqdvUS21r). The production backend is `descriptive-akita-759` in Sydney. Vercel reports READY and the public site renders the private radio interface instead of Setup required.

Server-only checks passed on the actual production backend for groups of 2, 5 and 10: private join/presence, secret-bound session validation, exactly one floor winner, renewal, release/reacquire, heartbeat, signaling send/inbox/consume and leave cleanup. Invalid invitation/code/session were rejected and the 11th member was refused. Only randomly named test sessions were removed; no real member or audio data was erased. The opt-in check flag was disabled after this successful run.

The live browser displayed a safe offline join form, settings and invalid-access error. No successful authenticated browser microphone/speech test is claimed. These HTTP coordination checks do not establish actual WebRTC transport, browser-suspension recovery or phone audio quality on the production network; those remain in the manual acceptance matrix above. The existing synthetic Chromium transport tests are separate evidence.

Convex billing shows Free; usage at setup inspection was 0 of 1M function calls and 0 database/file/egress usage before acceptance tests. No paid plan or TURN service was activated. Presence and reactive subscriptions consume resources even with few transmissions; monitor actual connected hours. The exposed unused setup deploy key was revoked and replaced with the same three production permissions and 90-day expiry. No credential values are included here.
