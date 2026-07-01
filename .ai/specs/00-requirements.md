# 00 — Requirements (verbatim capture)

> Seeded by `/bootstrap`. Raw requirements below; design happens in `01-spec.md` (run `/spec`).

## Problem
A personal, local-first tax agent (in the spirit of TaxFix / TaxDown) — built for the author
first. It removes the manual work of collecting bills and producing a country-correct tax /
billing report, starting with **Spain**.

## Functional requirements
- The agent generates a small **TUI (opentui)** that interviews the user for the regular inputs:
  country, tax/residency situation, documents, etc.
- Answers + user profile are stored **locally** in a small **RAG system / vector DB** on-device.
- A **daily cron job** runs the model to look for new bills/invoices, and extract + classify them.
- From the collected data it generates the **correct billing/tax report for the user's country**.
- **Spain first**; other countries added later behind the same per-country interface.
- **LLM-agnostic**: initially runs locally against the user's existing **Claude / Codex / Gemini**
  CLI subscriptions (no paid API keys); the provider must be swappable.

## Non-functional requirements / constraints
- Local-first; personal financial data / PII stays on-device (except the minimal content sent to
  the chosen LLM CLI).
- Stack locked (see `.ai/context.md`): Node 22 + TypeScript, pnpm, opentui, zod, local SQLite +
  sqlite-vec, vitest, Biome.
- Tax-figure correctness is the dominant constraint — numbers must be traceable to a source
  document or a cited country rule.
- ≥ 80% test coverage.

## Out of scope / non-goals
- No cloud service, hosted DB, or multi-user/SaaS deployment (single user, local machine).
- No direct filing/submission to the tax authority (report generation only, for now).
- No paid LLM API integration (local CLI subscriptions only, for now).

## Acceptance criteria (seed)
- Running the CLI opens an opentui interview and persists the profile locally.
- Profile + documents are searchable via the local RAG / vector store.
- A cron-triggered run ingests new bills and updates the stored dataset.
- The agent produces a Spain-correct tax/billing report from the stored data, every figure
  traceable to a source.
- Swapping the LLM CLI (claude → codex → gemini) requires no code change beyond config.
