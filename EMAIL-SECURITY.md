# Email Anti-Phishing Security — vayushastr.com

Status basis: historical observations recorded 2026-09-30 in the VYNDI Ride Stories repository. Reverify public DNS before changing enforcement.

## Previously observed

- Mail provider: Google Workspace / Gmail
- SPF: `v=spf1 include:_spf.google.com ~all` — soft-fail
- DKIM: Google selector present — recorded as PASS
- DMARC: `v=DMARC1; p=none; pct=100` — monitoring only
- DNSSEC: recorded as enabled

## Target state

After confirming Google Workspace is the only legitimate sender:

- SPF: `v=spf1 include:_spf.google.com -all`
- DKIM: continue Google Workspace signing and verify alignment
- DMARC Stage 1: `v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:info@vayushastr.com`
- DMARC Stage 2: `v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:info@vayushastr.com`
- DNSSEC: remain enabled

Do not publish a second SPF record. Do not move to strict DMARC alignment until every legitimate sender is verified.

These DNS/mail controls are account-level and are not changed by this repository or Worker deployment.
