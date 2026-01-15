# Workflow Changelog

## 2026-01-15
### qwen-image-edit v1.0.0
- Golden Tests automation introduced for Phase 2 stabilization.
- All Golden Tests (GT01-GT07) must pass before any workflow version is marked ACTIVE.

## 2026-01-16
### qwen-image-edit v1.0.0
- Prompt Engine v1 (rule-based) added for Thai selections with metadata output.
- Frontend state machine scaffold added for deterministic transitions and retry/timeout handling.

## 2026-01-16
### Phase 2 Production Hardening
- Added RunPod webhook handler route and metrics capture.
- Added RunPod staging concept and automation pipeline script.
- Updated docs for logging schema, webhooks, and deployment automation.

## 2026-01-16
### Phase 2 Production Hardening Audit Fixes
- Added webhook idempotency + ordering guards + signature validation.
- Removed automated polling from live flow; added manual recovery poller.
- Added timing breakdown metrics and workflow contract enforcement.
- Added D1 disaster recovery drill documentation and helper script.

## 2026-01-16
### Phase 3 Qwen Image Edit UI + Prompt Engine
- Updated Qwen Image Edit frontend state machine, UI layout, and prompt engine v1 mapping.
- Added frontend API contract and prompt mapping documentation.
- Added prompt-only golden tests for deterministic prompt generation.
