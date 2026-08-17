# Architecture

## Why one file

No build step, no dependencies, no framework, no bundler, no server. You can
email it, open it from a USB stick, or run it on a plane. For a tool whose
selling point is "your financial data never leaves your device," shipping a
single auditable artefact is the point — a reader can verify the privacy claim
by reading one file.

The cost is a ~6,000-line file. It is navigable because both the CSS and the JS
carry a numbered table of contents at the top. Read those first.

## Three parts

### 1. `<head>`
Meta tags, JSON-LD `SoftwareApplication`, and one `<style>` block organised in
11 sections: tokens, reset, typography, app shell, primitives, forms, tables,
data display, feature areas, utilities, print.

Theming is CSS custom properties. Light is authored as the default; dark comes
from `prefers-color-scheme` **or** an explicit `data-theme` on `<html>`. The
explicit attribute is declared last so a manual choice beats the OS in both
directions.

### 2. `<body>`
An inline SVG sprite of 37 icons, the app bar, the tab bar, then eleven
`<section class="view">` blocks, then the footer. Only one view is un-`hidden`
at a time.

Icons are stroke-drawn and inherit `currentColor`. The stroke defaults are set
via `svg:where(:not(.bar-chart):not([data-art]))` — `:where()` contributes zero
specificity, so per-context size and width rules still win, and illustrations
opt out with `data-art` because their children rely on `fill`.

### 3. `<script>`
33 numbered sections. Rough shape:

- **1–3** config, tax constants, state
- **4–8** DOM cache, validation, storage/migration, dates, formatting
- **9–10** deadlines and the tax model (pure functions, no DOM access)
- **11** selectors and aggregation
- **12–13** router and theme
- **14–23** renderers, one per surface
- **24** `renderAll()` orchestrator
- **25–31** forms, export/import, settings, waitlist, danger zone, onboarding
- **32–33** init and deployment notes

## Data flow

```
localStorage ──▶ loadState() ──▶ validateLoadedState() ──▶ state
                                                            │
                     ┌──────────────────────────────────────┘
                     ▼
              computeSnapshot()   ← called ONCE per render pass
                     │
                     ▼
                 renderAll() ──▶ renderOverview, renderLedgerTable,
                                 renderEstimate, renderReports, …
```

`computeSnapshot()` runs the tax model once and threads the result through every
renderer. Do not recompute inside a renderer — the original did that in four
places and they drifted.

The tax model (`calculateEstimate`, `progressiveTax`, `calculateSafeHarbor`) is
pure. It takes an object, returns an object, touches no DOM. That is what makes
it testable in isolation, and the test suite checks it against hand-computed
figures.

## Routing

Hash-based, eleven routes. `navigate()` toggles `hidden` on the views, sets
`aria-current` on the tab, updates `document.title`, and moves focus to the
view's `<h1>` (each has `tabindex="-1"`).

`resolveHash()` also handles two special cases: anchors starting `tos-`/`pp-`
open the right legal view and then scroll to the section, and old anchors from
the pre-tab version map through `LEGACY_HASHES`.

## Storage

- `quarterback:app:v3` — everything
- `quarterback:theme` — separate on purpose, so the theme survives "clear all"

Migration from `quarterback:app:v2` and the original v1 keys happens in
`loadState()`. Legacy keys are removed **only after** a confirmed successful save.

Everything read back is re-validated. Nothing from storage is trusted.
