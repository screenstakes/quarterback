# Testing

Four harnesses in `tests/`. Zero dependencies — Node 26 ships global `fetch` and
`WebSocket`, so headless Chrome is driven directly over the DevTools Protocol
with no Puppeteer or Playwright.

```
node handover/tests/drive.mjs   # 46 assertions
node handover/tests/deep.mjs    # 60 assertions
node handover/tests/diag.mjs    # diagnostic: names a11y + overflow culprits
node handover/tests/probe.mjs   # scratch probe for layout questions
```

Override the file under test with `QB_FILE=/path/to/file.html`.

## What they cover

**`drive.mjs`** — routing across all eleven views, deep anchors, legacy hashes,
the tax model against hand-computed figures, SE threshold and wage-base edges,
loss years, garbage-input NaN resistance, federal holiday deadline edges,
escaping, CSV formula injection, storage round trip, theme, legal placeholders.

**`deep.mjs`** — the same app driven by **real** `Input.dispatchMouseEvent` and
key events: full onboarding flow, tab clicks, entry create/edit/delete,
validation, filters, search, payments, settings, export/import, danger zone with
undo, insight dismissal. Then a responsive sweep at 375/768/1280 and an
accessibility pass.

**Both** assert **zero external network requests**. That is the enforcement
mechanism for the privacy claim — if someone adds a CDN font or an analytics
snippet, the suite fails.

## Traps

Three things cost real time when these were written. Do not rediscover them.

1. **`scroll-behavior: smooth` breaks clicking.** `scrollIntoView()` animates, so
   a rect read immediately afterwards is stale and the click lands on the wrong
   element. Emulate `prefers-reduced-motion: reduce` over CDP before testing.

2. **`documentElement.scrollWidth` false-positives on horizontal overflow.** It
   counts content inside nested `overflow:auto` scrollers, so any page with a
   wide table looks broken when it is not. Test whether the page can actually be
   panned: `window.scrollTo(600,0)` then read `window.scrollX`. Also drop
   `body{overflow-x:hidden}` first, so you detect genuine overflow rather than
   overflow that is merely masked.

3. **A stale Chrome profile carries `localStorage` between runs**, so the second
   run of a suite fails on assertions about first-load state. `rm -rf` the
   `chrome-profile` / `cp-*` directories before each run.
