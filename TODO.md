# Remaining work

## Completed production setup (10 November 2026)

- Existing Satish Talk production backend deployed and connected to https://satishtalk.vercel.app/.
- Independent private channel secrets configured in Convex; scoped replacement deploy key stored only in Vercel Production. Exposed setup key revoked.
- Live 2/5/10-member private coordination tests passed; 11th member rejected and test sessions cleaned up.
- Convex Free confirmed; no paid services activated.

## Required before routine use
- Test Wi-Fi, cellular and restrictive office networks. Configure a tested TURN relay if direct WebRTC fails; any paid option needs approval.
- Run physical Android/iPhone and 2/5/10-user acceptance tests in TEST_REPORT.md.
- Confirm hosting-plan eligibility for office/business use and configure budgets before paid activation.
- Resolve all failed acceptance results before using this app for routine site coordination.

## Optional later improvements

- Consider an SFU only if measured mesh upload, battery or network performance is inadequate.
- Consider a native application if reliable locked-screen/background behavior becomes a requirement.

No AI, recordings, transcripts, location tracking, job management or public channels are planned for version 1.

## Maintenance

- Rotate the production deploy key before its 90-day expiration.
- Monitor Convex usage: the current Free allowance includes 1M function calls per billing period. Presence heartbeats and reactive queries also count, so 300 transmissions/day alone does not predict total usage. Keep radio mode off when not needed; do not enable a paid plan automatically.
