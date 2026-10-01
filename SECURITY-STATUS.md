# Security Status — 2026-10-02

## Scope

My Road — My Glory merchandise / VYNDI Terrain Medal Studio

Canonical service:

`https://vmm.vayushastr.workers.dev/`

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

## Cloudflare/account controls requiring independent verification

The repository cannot prove or configure these account-level states by itself:

- active `VYNDI_AUTH_SECRET` on the **vmm** Worker
- Cloudflare WAF / bot / account security settings
- zone-level HSTS for any future custom domain
- DNSSEC state for `vayushastr.com`
- SPF / DKIM / DMARC public DNS
- GitHub secret scanning, push protection and branch/ruleset policy

Do not call the system fully secured until those external controls are verified.
