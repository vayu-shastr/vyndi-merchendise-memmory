# Security Status — 2026-10-02

## Scope

My Road — My Glory merchandise / VYNDI Terrain Medal Studio

Canonical service:

`https://vmm.vayushastr.workers.dev/`

## Live external audit — 2026-10-02

Observed from GitHub-hosted external network checks against the deployed Worker and public DNS.

### PASS — deployed Worker

- HTTPS reachable: HTTP 200 over `https://vmm.vayushastr.workers.dev/`
- HSTS: `Strict-Transport-Security: max-age=31536000`
- Content-Security-Policy present
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `/.well-known/security.txt` live with HTTP 200
- `/security-policy.html` live with HTTP 200

### PASS — public email/DNS controls

- one SPF record is published
- Google DKIM selector is published
- Google Workspace MX records are published
- DNSSEC DS record is published

### OPEN — required for full target posture

1. **VYNDI_AUTH_SECRET on vmm**
   - live endpoint currently returns `{"configured":false,"version":1}`
   - configure the secret directly in the Cloudflare vmm Worker; never commit it to GitHub

2. **SPF hard-fail**
   - current: `v=spf1 include:_spf.google.com ~all`
   - target, after confirming Google Workspace is the only legitimate sender: `v=spf1 include:_spf.google.com -all`

3. **DMARC enforcement**
   - current: `v=DMARC1; p=none; pct=100`
   - first enforcement stage: `v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:info@vayushastr.com`
   - later target after reviewing reports: `v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:info@vayushastr.com`

## Repository / Worker controls implemented

- strict CSP with self-only browser scripts
- anti-framing via `X-Frame-Options: DENY` and `frame-ancestors 'none'`
- MIME sniffing disabled
- HSTS response header
- restrictive Permissions-Policy
- COOP / CORP / Origin-Agent-Cluster
- wildcard CORS removed
- same-origin browser API enforcement
- static security headers in `dist/_headers`
- `/.well-known/security.txt`
- responsible disclosure page
- HMAC-SHA256 authenticity implementation
- SHA-256 export-manifest hashes
- authenticity verification endpoints
- general API and authenticity-signing rate-limit bindings
- SSRF/private-network URL guards
- request size guards
- weekly Dependabot
- weekly security baseline with `npm audit --audit-level=high`
- CodeQL JavaScript security-extended scan
- GitHub Actions pinned to immutable action SHAs
- deterministic `package-lock.json`
- scheduled/on-push external Worker and public-DNS audit

## Qualification language

The public UI can still be copied. The anti-clone control is cryptographic provenance: once the vmm Worker secret is configured, a clone cannot generate a valid VYNDI authenticity signature without that secret.

Do not call the complete system fully secured until the three OPEN items above are closed and re-audited.
