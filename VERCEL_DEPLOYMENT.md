# Future Vercel deployment

**Do not execute this document until the founder authorizes deployment.** No Vercel project, domain, paid plan or third-party service should be created automatically.

## Prerequisites

- GitHub `main` has passed CI; read TEST_REPORT.md for remaining acceptance checks.
- A new, separate Satish Talk Convex project. Never use Team Radio's backend or GCC Mentor resources.
- Owner secrets generated outside source control and stored in a password manager.
- A TURN strategy for carrier NAT/restrictive networks. STUN alone is insufficient on some networks.
- Decide the appropriate Vercel plan for office use before connecting the repository.

## Deployment procedure after approval

1. Follow SETUP.md to configure and deploy the Satish Talk Convex backend. Review its functions/schema and environment values before confirmation.
2. In Vercel, import only `jaissatish-web/SATISH-TALK`. Select Vite, build `npm run build`, output `dist` and Node 22.
3. Set `VITE_CONVEX_URL` to the new backend's production HTTPS URL. Build-time `VITE_` variables are public: never put owner bootstrap secrets, private access secrets, Convex deploy keys or long-lived TURN master credentials there.
4. Configure any supported ICE settings according to SETUP.md. TURN credentials given to a browser are visible to that browser. Use dedicated scoped/expiring relay credentials for production; do not rely on shared public relay capacity.
5. Preview first. Verify HTTPS, security headers, manifest/icons, install behavior and browser permission prompts.
6. Run private-channel, two-phone and 5/10-member tests across Wi-Fi and cellular. Include a restrictive network or forced relay test. Do not promote until critical failures are resolved.
7. Request `satish-talk.vercel.app` if available. Availability is not guaranteed. A custom domain is optional and requires a separate purchase/approval.
8. Verify access from an unauthenticated browser is denied, logs contain no credentials/audio, and mode off removes microphone and remote audio.

## Costs and plan eligibility

Official pricing checked 9 November 2026; prices are USD before taxes, usage and regional differences. Check again before purchasing.

| Service | Planning assumption                                                                                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel  | Hobby is for personal/non-commercial use. Routine office/business communication should not be assumed eligible merely because the app is private or has no subscriptions. Pro starts at $20/month; included usage and overages apply.                            |
| Convex  | Free has included resource caps; Starter is $0 base with pay-as-you-go beyond included resources. Professional is $25/developer/month. Choose based on current terms and actual usage; no paid plan is activated here.                                           |
| STUN    | Usually low cost or public service, but availability is not guaranteed.                                                                                                                                                                                          |
| TURN    | Bandwidth-dependent. Open Relay advertises 20 GB/month free; evaluate its current terms, credentials, limits and reliability before use. Dedicated commercial relay pricing varies; Metered premium lists a 500 MB trial and $99/month for 150 GB. Neither paid service is required or activated by this implementation. |
| Domain  | Optional, separately billed if purchased. The Vercel subdomain does not require buying a domain.                                                                                                                                                                 |

A small-team trial may fit Convex's included resources, but no fixed $0 total is promised. Presence, floor leases, reactive subscriptions and signaling all use backend resources. TURN may dominate costs if much traffic is relayed.

Official references:

- https://vercel.com/pricing
- https://vercel.com/legal/terms (Hobby plan)
- https://www.convex.dev/pricing
- https://docs.convex.dev/production/state/limits
- https://www.metered.ca/tools/openrelay/
- https://www.metered.ca/pricing

## Rollback

Keep the previous known-good frontend deployment and backend revision. Review schema compatibility before backend rollback. Never roll a frontend back to the original public-access or recording-enabled upstream configuration. Rotate exposed secrets rather than relying on deletion from Git history.

## Production integration build

Production uses `node scripts/vercel-build.mjs`. It runs the pinned Convex CLI with the Vercel server-side `SATISH_CONVEX_DEPLOY_KEY` (passed only to the CLI as `CONVEX_DEPLOY_KEY`), injects the actual selected backend URL, and checks it against `SATISH_EXPECTED_CONVEX_URL` before building or pushing functions. A mismatch stops the deployment. Preview/local builds run the ordinary frontend build without changing production.

The pre-push helper initializes only missing `ROOM_TOKEN`, `ACCESS_CODE` and `OWNER_TOKEN` values with independent 32-byte cryptographic randomness. Existing names are preserved, never rotated automatically. Values are written to a mode-0600 temporary file for the official Convex CLI, with command output captured and the file removed afterward. They are not printed, committed, bundled in the frontend or returned as artifacts. Retrieve the values privately in the signed-in Convex production Environment Variables page; never put them in a public issue or report.

The production deploy key needs backend deploy plus environment-variable view/write permissions. Set `SATISH_EXPECTED_CONVEX_URL` and `VITE_CONVEX_URL` to the same verified production cloud URL. Never reuse a key or URL from another project. The separate Convex Free plan remains unchanged by this build.

Use `SATISH_CONVEX_DEPLOY_KEY` for this verified production deployment. Existing Marketplace-managed `CONVEX_DEPLOY_KEY` entries are preserved; the build does not rely on them and does not require deleting an integration. Set the custom key only in Production, mark it Sensitive, and rotate it before its selected expiration.
