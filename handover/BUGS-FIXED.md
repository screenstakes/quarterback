# Bug log

Every defect found in the original single-page version and fixed in the rebuild.
`original-before-rebuild.html` is kept in this folder for diffing.

## Correctness

**1. The headline figure was permanently $0.00.**
`dom.quarterSetAside` was cached in the DOM map and never written to by any
renderer. The suggested quarterly set-aside — the single most prominent number
on the landing view — displayed `$0` no matter what had been entered. A dead
comment in `renderDeadlines()` acknowledged the intent and no code implemented
it. *Fix:* `renderOverview()` writes it from the shared snapshot. Regression
test asserts `$0 → $4,708` after entering known figures.

**2. The Q4 deadline was wrong in multiple years.**
Only DC Emancipation Day was modelled. But 15 January **is** Martin Luther King
Jr. Day whenever it falls on a Monday — 2029, 2035 and others — which shifts the
Q4 estimated-tax deadline to the 16th. The original reported the 15th.
*Fix:* `federalHolidays()` models all eleven federal legal public holidays
(5 U.S.C. § 6103) with correct nth-weekday and observed-date rules, plus DC
Emancipation Day for April. Tests pin TY2028 Q4 → 16 Jan 2029, TY2027 Q4 →
18 Jan 2028, 2028 Q1 → 18 Apr 2028.

**3. NaN propagation from unvalidated settings.**
`settingsByYear` was copied out of storage without validation, and numeric
fields were read as `parseFloat(x) || 0`. A truthy non-numeric string passes
straight through that guard and poisons every downstream calculation — the whole
estimate renders as `NaN`. Reachable via a hand-edited or corrupted JSON backup.
*Fix:* `validateYearSettings()` plus a `safeNumber()` coercion helper used on
every numeric field from storage or import. Test feeds deliberate garbage and
asserts every returned number is finite.

## Security

**4. XSS via an imported backup.**
Category filter options were built by string concatenation:
`'<option value="' + escapeHtml(c) + '">'`. The escaper used a `div.innerHTML`
round trip, which escapes `& < >` but leaves `"` and `'` intact — so a category
string containing a double quote could break out of the attribute and inject
markup. Expense categories come from a fixed list in the UI, but an imported
JSON backup can contain arbitrary strings.
*Fix:* options are built with `createElement` and `.value`/`.textContent`, which
cannot be parsed as markup. `escapeHtml` was additionally rewritten as an
explicit map covering `& < > " '`. Test injects
`"><script>alert(2)</script>` as a category and asserts no `<script>` or `<img>`
element is created and the string survives as inert option text.

## State

**5. Onboarding reappeared forever.**
Completion was stamped inside the last step's `onNext`. "Skip this step" bypasses
`onNext` by design, so skipping the final step never set
`onboardingCompletedAt` — the whole flow reappeared on every subsequent load.
*Fix:* stamped in `finishOnboarding()`, which every exit path goes through.
Test drives the real flow and skips the last step.

## Presentation

**6. Sticky header hardcoded to dark.**
`background: rgba(20,21,29,0.86)` regardless of theme, so light mode showed a
dark navy bar over cream. *Fix:* theme tokens with a `@supports` fallback.

**7. Icons rendered as solid black blobs.**
Sprite icons are stroke-drawn, but `fill:none; stroke:currentColor` was applied
only via an opt-in `.icon` class. Every bare `<svg><use></svg>` — the tab bar,
the brand mark, buttons, row actions, empty states — rendered as a filled shape.
*Fix:* `svg:where(:not(.bar-chart):not([data-art]))`. `:where()` contributes
zero specificity, so per-context size and stroke-width rules still win, and
illustrations opt out via `data-art` because their children rely on `fill`.

**8. Horizontal page scroll on phones.**
Grid and flex items default to `min-width: auto`, so a child with a wide
min-content size — the ledger table with `white-space: nowrap` headers — expanded
its whole track past the viewport instead of letting its `.table-wrap` scroll
container absorb it. *Fix:* `min-width: 0` on every layout child.

**9. Layout thrash on every profile render.**
`hexToRgbStyle()` appended a probe `<div>` to the document, read
`getComputedStyle`, and removed it — once per colour swatch, per render — purely
to compare a hex against a browser-normalised `rgb()` string. Also fragile:
Firefox expands the `background` shorthand, so the comparison could silently
fail. *Fix:* compare `dataset.color`.

## Accessibility

**10.** A `<select>` lost its accessible name whenever the shared `<label for>`
retargeted to the sibling free-text field. *Fix:* permanent `aria-label` on both.

**11.** Three Privacy Policy data tables had no `<caption>`.

**12.** The Help view jumped from `H1` straight to `H3`, breaking heading
navigation. *Fix:* added the missing section heading.

## Not bugs — test harness artefacts

Recorded so they are not "fixed" again. Two apparent failures during the sweep
were the harness being wrong, not the app: `scroll-behavior: smooth` moving
elements between measuring and clicking, and `documentElement.scrollWidth`
false-positiving on nested scroll containers. See `TESTING.md`.
