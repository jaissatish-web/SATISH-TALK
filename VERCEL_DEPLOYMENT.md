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
| TURN    | Bandwidth-dependent. Dedicated relay cost is additional. As one verified example, Metered lists a 500 MB trial, then $99/month for 150 GB with overages. This is an example, not a recommendation or a required purchase. Compare alternatives before selecting. |
| Domain  | Optional, separately billed if purchased. The Vercel subdomain does not require buying a domain.                                                                                                                                                                 |

A small-team trial may fit Convex's included resources, but no fixed $0 total is promised. Presence, floor leases, reactive subscriptions and signaling all use backend resources. TURN may dominate costs if much traffic is relayed.

Official references:

- https://vercel.com/pricing
- https://vercel.com/legal/terms (Hobby plan)
- https://www.convex.dev/pricing
- https://docs.convex.dev/production/state/limits
- https://www.metered.ca/pricing

## Rollback

Keep the previous known-good frontend deployment and backend revision. Review schema compatibility before backend rollback. Never roll a frontend back to the original public-access or recording-enabled upstream configuration. Rotate exposed secrets rather than relying on deletion from Git history.
