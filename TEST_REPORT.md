# Verification report

The implementation is prepared for a separately authorized deployment and real-device acceptance task. No Vercel or Convex infrastructure has been deployed, and no physical-phone pass is claimed.

## Automated evidence

- Clean `npm ci`, ESLint, frontend/backend TypeScript, unit/integration tests and production build pass locally and in GitHub CI.
- 33 unit/integration tests: 9 backend, 12 radio lifecycle, 8 press-and-hold input and 4 mesh negotiation/playback recovery cases.
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
| Production Convex / Vercel smoke test | Not run; deployment excluded |

Synthetic tests log connection setup timing, first observed generated-audio energy and RTP counters. Those are CI transport diagnostics, not physical speech latency or phone resource benchmarks. Ten engines share one Chromium page/network stack; they do not replace independent-device load tests. The original Convex adapter has backend emulator coverage and typed integration, but live Convex subscription behavior remains a post-configuration acceptance check.

## Manual test procedure

Use distinct names and fresh browser sessions. Start with two phones in separate rooms, then five and ten; mix office Wi-Fi and cellular. Record device/browser versions, connection success, press-to-audio delay, release-to-silence delay, audio clarity, failures, reconnect behavior and battery/CPU observations.

For each group size: join, verify roster and audio links, speak both ways, press simultaneously, release, cancel a touch, rotate phone, switch tab, deny/revoke permission, disconnect Wi-Fi, turn mode off/on, leave/rejoin and resume after locking. Confirm an old press cannot restart the microphone. Test owner rename and rotated credentials, receiving after reconnect, explicit speaker unlock, headset routing and forced TURN relay.

Resolve critical failures before routine site use. No certified emergency-radio performance is claimed.
