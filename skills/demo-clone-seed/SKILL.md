---
name: demo-clone-seed
version: 1.0.0
description: Checklist for cloning a production property into a safely redacted demo or seed fixture. Prevents PII leakage, over-redaction of public-business data, and false confidence on 0-hit scans.
tags: [ops, data, redaction, demo, seed]
---

# Skill: demo-clone-seed

Procedure for creating a safely redacted demo property on prod (or any target environment)
by cloning real property content. Follow all gates in order — do not skip.

## Why this exists

Three failure modes captured from a real run (2026-06-29, cottagesconcierge-prod):

1. A blanket "redact every address-shaped line" rule over-redacted public-business addresses
   (a pizzeria became "100 Lakeshore Demo Drive"), breaking the demo bot's local-recommendations
   accuracy. Fix: target the SELF-LOCATION address specifically.
2. A 0-hit scan on a known secret (WiFi password) was initially read as "clean." Required an
   independent in-DB read to confirm genuine absence from prose vs. a missed pattern.
3. `extras` JSONB and manual prose went through the structured-column scan only — address and
   contact data cloned verbatim into prose were missed until the GATE-3 residual scan.

## Checklist

### GATE-1 — Scope and environment
- [ ] Identify source property (slug, property_id, environment).
- [ ] Confirm you are targeting the CORRECT environment. Run the discriminator check
  (`scripts/check-destructive.mjs` or equivalent — read `public._metadata.environment`).
- [ ] List the tables to clone: `property_structured_data`, `documents`, `document_chunks`,
  and any property-scoped config rows.
- [ ] Do NOT clone `messages`, `conversations`, `leads`, `audit_log`, or
  `notification_claims` — seed synthetic replacements if activity volume is needed (GATE-4).

### GATE-2 — Structured-column redaction
- [ ] **SUBSTITUTE credentials** (do not blank — substitute): WiFi SSID → fake SSID, WiFi
  password → fake password (e.g. `LakesideDemo!23`), host phone → fake phone, emergency
  phone → fake phone, guest emergency contact → fake.
- [ ] **EXCLUDE access codes entirely** (door_code, lockbox_code, gate_code, alarm_code,
  garage_code) per ADR 0013 — set to NULL. Do NOT substitute; NULL is correct.
- [ ] **Self-location address only:** redact the property's own civic address (street number +
  street name). Do NOT apply a blanket "flatten every address-shaped line" rule — that
  over-redacts public-business addresses (restaurants, parks, marinas) and breaks the demo
  bot's local recommendations. Target self-location specifically.
- [ ] Scan `extras` JSONB field(s) explicitly — free-form JSONB bypasses column-level checks
  and has caused real GATE-3 HIGH findings when omitted.

### GATE-3 — Prose / document redaction
- [ ] Run all source documents (house manual, etc.) through the redaction + residual-scan
  pipeline, not just the structured columns.
- [ ] Scan for: host phone numbers (all formats: (xxx) xxx-xxxx, xxx-xxx-xxxx, +1…), WiFi
  credentials (SSID + password in prose), the property's self-location civic address
  (street-level), guest emergency contacts, host email addresses.
- [ ] Preserve: public business names and their addresses, local attraction details, publicly
  known facts about the area.
- [ ] Perform a residual scan (regex + keyword pass) after redaction. Record hit counts per
  category. Zero hits is not confidence-sufficient on its own — see GATE-5.

**GATE-3 HIGH block:** Any scan finding where `address` or contact-field data was cloned
verbatim into prose is a HIGH-severity block. Do not proceed to seeding until resolved.

### GATE-4 — Synthetic activity seeding (if demo needs realistic volume)
- [ ] Seed conversations, messages, leads, content-gaps, refusals with SYNTHETIC data only:
  fake names, `@example.com` email addresses, dates within a plausible recent window.
- [ ] Record seed counts in CLAUDE.md / deployment notes (e.g. "40 conv / 152 msg / 8 leads
  / 6 content-gaps / 3 refusals").
- [ ] Respect the `(source_conversation_id, lead_type)` composite UNIQUE constraint in
  `leads` — ensure seed scripts handle ON CONFLICT correctly.

### GATE-5 — 0-hit false-confidence check
- [ ] For any category where the residual-scan hit count is 0 AND you know the source
  property had a value in that category (e.g. WiFi password present in structured data),
  perform an INDEPENDENT in-DB read to confirm genuine absence from prose vs. a missed
  pattern.
- [ ] "0 hits" is not confidence-sufficient when the secret is KNOWN to exist in the source.
  The pattern-match may have missed it. Confirm with a direct query.

### GATE-6 — Demo property metadata
- [ ] Slug must signal synthetic nature: use a `demo-*`, `test-*`, or `sandbox-*` prefix.
- [ ] Set `plan = 'pro'`, `status = 'active'`, comped (no real subscription). Owner-less or
  operator-managed is acceptable for a demo fixture.
- [ ] Record in CLAUDE.md Deployed resources table AND relevant stanzas: property_id, slug,
  created date, synthetic flag. Note that it MUST be excluded from real-tenant ops,
  analytics, and cleanup sweeps.

### Post-clone verification
- [ ] A chat session works against the demo property slug (session-create → SSE chat turn).
- [ ] Local-recommendations responses reference real public businesses (not fake addresses).
- [ ] Access-code requests return the tool's normal deferral — codes are NULL; no substituted
  values should appear in any response.
- [ ] No real host phone, email, WiFi SSID, or WiFi password appears in any chat response.
- [ ] Confirm synthetic activity counts in the analytics endpoint (if applicable) match seeded
  values.
