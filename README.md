# Satish Talk

A private internet walkie-talkie for a team of 2–10 people. Built for routine instrumentation, commissioning, control-room and field communication.

**This is not an emergency communication system or certified industrial radio.** Use phones only where permitted by your site's equipment and safety rules.

## Everyday use

1. Open your team's Satish Talk link in a compatible browser.
2. Enter your display name and private access details.
3. Turn **Walkie-Talkie Mode** on and allow microphone access.
4. Wait until the connection status is ready. Hold **Hold to talk**, speak, then release. Only one person can speak at a time.
5. Turn the mode off to stop receiving, disconnect and release the microphone.

**Keep Screen Awake** is optional and uses more battery. Voice reception cannot be guaranteed when the phone locks or the browser is suspended. Return to the app and reconnect if needed.

Install using Chrome's install/Add to Home screen menu, or Safari's Share → Add to Home Screen where supported. Installation does not remove browser background restrictions. Internet is required for live audio; cached app assets are not an offline radio.

## What this version includes

- Private channel, member names, presence and current speaker.
- Server-arbitrated push-to-talk with expiring ownership.
- Walkie-Talkie Mode, wake lock, connection recovery and device controls where supported.
- Responsive navy-and-blue interface and installable PWA.
- No recording, transcription, voice history, AI, advertising or public channels.

## Project status

Source is prepared for a separate deployment task. No Vercel or Convex deployment is part of this implementation. See [TEST_REPORT.md](TEST_REPORT.md) for verified results and outstanding physical-device checks. Ten-user support is an architectural target, not a claim of certified network performance.

## Setup and ownership

- [SETUP.md](SETUP.md): run locally and configure a separate backend.
- [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md): future deployment checklist and costs.
- [ARCHITECTURE.md](ARCHITECTURE.md): audio, signaling and resource lifecycle.
- [SECURITY.md](SECURITY.md): private access and information handling.
- [AUDIT.md](AUDIT.md): upstream findings and licence review.
- [TODO.md](TODO.md): remaining acceptance work.

## Attribution

Based on [Team Radio by Tony Blount](https://github.com/mrtblount/radio1). Its MIT notice is preserved in [LICENSE](LICENSE). Satish Talk is independent of GCC Mentor.
