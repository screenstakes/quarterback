# Quarterback — context for Claude

You are picking up an existing, working project. Read this before changing anything.

**What it is:** a federal tax planning estimate for US freelancers and 1099 workers.
One self-contained HTML file, `index.html`, ~6,000 lines. No build step, no
dependencies, no framework, no server.

**Current state:** finished and verified. 106 automated assertions pass, 0 runtime
exceptions, 0 console errors. Deployed to GitHub Pages. It is not a prototype
that needs finishing — it is a working product with a known, deliberate scope.

---

## The three rules that matter most

### 1. Zero external network requests. This is load-bearing.

After the initial document load the page makes **no network requests at all** —
no analytics, no cookies, no trackers, no webfonts, no CDN of any kind. Every
asset (icons, illustrations, charts) is inline SVG.

The Privacy Policy states this as fact, in several places, and invites the reader
to verify it in DevTools. So this is not a style preference — **it is a factual
claim in a published legal document.**

If you add analytics, a hosted font, an embedded script, an error reporter, a
service worker that phones home, or connect `WAITLIST_ENDPOINT`, you make
sections 1, 4, 7, 8 and 9 of the Privacy Policy false. Update the policy in the
same change or don't make the change.

There is a test that enforces this. It fails the build if anything external is
requested.

**In particular: do not "fix" the missing webfonts.** The platform UI font stack
is deliberate. Loading Google Fonts sends every visitor's IP and User-Agent to
Google on every page view; a German court held exactly that pattern to be an
unlawful GDPR transfer (*LG München I*, 3 O 17493/20, 20 Jan 2022). The reasoning
is written into a comment at the top of `index.html`.

### 2. Never overstate what the tax model does.

This is tax software adjacent to real financial consequences, aimed partly at
people who cannot afford an accountant. Every disclaimer in it is load-bearing.

- It is **not** affiliated with the IRS. Say so anywhere it could be mistaken.
- It is **not** a tax return preparer under 26 U.S.C. § 7701(a)(36), and not a
  Circular 230 practitioner. The Terms say this explicitly.
- It produces an **estimate**, not a liability. It omits state tax, itemized
  deductions, section 199A QBI, capital gains rates, AMT, NIIT, retirement and
  health-insurance deductions, NOLs, and most credits.
- Every omission is listed under the Estimate tab. If you add a feature, add its
  limitations to that list too.

Never make the numbers look more authoritative than they are. Never remove a
disclaimer to clean up the UI.

### 3. There is no server, so there is no undo.

Data lives in `localStorage` on the user's own device. If it is lost, it is gone —
we cannot recover it because we never had it. Be extremely careful with anything
that writes to or clears storage. The destructive paths (`clearYearBtn`,
`clearAllConfirmBtn`, JSON import in replace mode) all have confirmations, and
the year-clear has an undo window. Keep it that way.

---

## Layout of the file

`index.html` is one file in three parts:

1. `<head>` — meta, JSON-LD, and a single `<style>` block. CSS is organised in
   11 numbered sections; the map is in a comment at the top.
2. `<body>` — an inline SVG sprite (37 icons), the app bar, a tab bar, then
   eleven `<section class="view">` elements, then the footer.
3. `<script>` — the application, organised in 33 numbered sections with a table
   of contents at the top. **Read that TOC first.**

### Routing

Hash-based. `#/ledger`, `#/estimate`, `#/privacy` and so on. Eleven routes:
`overview, ledger, expenses, payments, estimate, reports, settings, help,
pricing, terms, privacy`.

Anchors starting `tos-` or `pp-` deep-link into the legal pages and open the
right view first. Old anchors from the original single-page version
(`#history`, `#profile`, `#expenses-page`) redirect via `LEGACY_HASHES`.

Adding a route means touching four things: the `<section data-route>`, the
`ROUTES` array, `ROUTE_TITLES`, and a `.tab` link. The test suite checks all four
line up.

### Rendering

`renderAll()` is the single entry point. It calls `computeSnapshot()` **once** and
threads the result through every renderer. Do not recompute the estimate inside a
renderer — that was a bug in the original.

### Storage

`quarterback:app:v3` holds everything; `quarterback:theme` is separate so the
theme survives "clear all data". Migration from `v2` and the original v1 keys is
handled in `loadState()`. Legacy keys are only deleted after a confirmed save.

**Everything read from storage is re-validated.** `validateLoadedState()` filters
and normalises every record. Use `safeNumber()` on any numeric field from storage
or an imported backup — `parseFloat(x) || 0` is not safe, because a truthy
non-numeric string passes straight through and turns the whole estimate into NaN.
That was a real bug.

---

## Bugs already found and fixed — do not reintroduce these

| # | Bug | Fix |
|---|-----|-----|
| 1 | Hero set-aside was permanently `$0.00` — the element was cached but never written | `renderOverview()` writes it from the shared snapshot |
| 2 | Q4 deadline wrong whenever 15 Jan is a Monday, i.e. MLK Day (2029, 2035) — only DC Emancipation Day was modelled | `federalHolidays()` models all eleven federal holidays |
| 3 | XSS: `<option value="'+escapeHtml(c)+'">` with an escaper that didn't escape quotes — a category from an imported backup could break out of the attribute | options built via `createElement`/`.value`; escaper covers `& < > " '` |
| 4 | NaN propagation from unvalidated `settingsByYear` | `validateYearSettings()` + `safeNumber()` |
| 5 | Onboarding reappeared forever if the last step was skipped — `onNext` bypassed, so `onboardingCompletedAt` never set | stamped in `finishOnboarding()` |
| 6 | Sticky header hardcoded `rgba(20,21,29,.86)` — dark bar in light mode | theme tokens |
| 7 | `hexToRgbStyle()` appended a probe div to the document per swatch per render | compare `dataset.color` |
| 8 | Sprite icons rendered as solid black blobs unless they carried `class="icon"` | stroke defaults on `svg:where(:not(.bar-chart):not([data-art]))` — `:where()` keeps specificity at 0,0,1 so per-context rules still win |
| 9 | Horizontal page scroll on phones — grid items default to `min-width:auto`, so a nowrap table blew out its whole track | `min-width:0` on every layout child |
| 10 | `<select>` lost its accessible name when the shared `<label for>` retargeted | permanent `aria-label` on both controls |

---

## Testing

Zero-dependency Chrome DevTools Protocol harnesses in `handover/tests/`. Node 26
has global `fetch` and `WebSocket`, so no Puppeteer or Playwright needed.

```
node handover/tests/drive.mjs   # 46 assertions: routing, tax math, storage, XSS
node handover/tests/deep.mjs    # 60 assertions: real clicks, responsive, a11y
node handover/tests/diag.mjs    # diagnostic: a11y and overflow culprits
```

They launch headless Chrome, serve `index.html` over localhost, and check runtime
exceptions, console errors, **every network request**, tax arithmetic against
hand-computed figures, federal holiday edge cases, XSS resistance, storage round
trips, responsive overflow and accessibility.

Run them after any change. `rm -rf` the `chrome-profile`/`cp-*` directories
between runs — a stale profile carries `localStorage` over and produces confusing
failures.

Two traps if you write more tests:
- `scroll-behavior: smooth` moves elements between measuring a rect and clicking
  it. Emulate `prefers-reduced-motion: reduce` via CDP.
- `documentElement.scrollWidth` counts content inside nested `overflow:auto`
  scrollers, so it false-positives on any page with a wide table. Test whether
  the page can actually be panned instead.

---

## Before this goes to real users

1. Fill in the `LEGAL` object at the top of the script — entity, email, address,
   state, venue. It currently shows `[Your legal entity name]` placeholders.
2. Have a lawyer review both legal pages, then set `LEGAL_REVIEWED = true` to
   hide the amber draft banners.
3. Add `og:url`, `og:image` and `rel=canonical` once there is a real domain.
4. Review the tax constants against the annual IRS revenue procedure and the SSA
   wage base, and update `CONSTANTS_LAST_REVIEWED` — it is shown to users.
5. Do not enable `PRO_PAYMENT_LINK` without a backend that verifies entitlement
   via Stripe webhooks. A Payment Link alone cannot establish who paid, so any
   client-side unlock is trivially bypassed and would take money for nothing.

See `handover/` for architecture notes, the legal research, and the full bug log.
