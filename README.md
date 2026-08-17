# Quarterback

A federal tax planning estimate for freelancers, contractors and 1099 workers.
Record business income and expenses, and keep a running estimate of what you
owe the IRS — so quarterly deadlines stop being a surprise.

**Quarterback is not affiliated with the IRS, is not tax preparation software,
and is not tax advice.** See [Terms of Service](#/terms) and
[Privacy Policy](#/privacy) in the app.

## What makes it different

**It runs entirely in your browser.** No account, no server, no database.
Everything you type is written to `localStorage` on your own device and is
never transmitted anywhere.

The app makes **zero network requests after the page loads** — no analytics,
no cookies, no trackers, and no webfonts. That last one is deliberate: loading
a font from a third-party CDN would send every visitor's IP address to that
provider on every page view, which would contradict the privacy policy. A
German court found exactly that pattern to be an unlawful transfer under the
GDPR (*LG München I*, 3 O 17493/20, 20 January 2022). So the app uses the
platform UI typefaces instead.

You can verify the claim yourself: open DevTools, go to the Network tab, and
use the app. After the initial document load, it stays empty.

The trade-off is real and stated plainly in the app: **because nothing is
stored on a server, nothing can be recovered.** Export backups.

## Features

- Income and expense ledger with categories, search, filters and inline editing
- Simplified federal self-employment and income tax estimate based on **net
  profit**, not gross income
- Estimated-tax payment tracking and a remaining-balance calculation
- Quarterly deadline schedule, adjusted for weekends, all eleven federal
  holidays, and the District of Columbia Emancipation Day rule that can shift
  the April deadline
- Reports: monthly and quarterly breakdowns, category analysis, year over year
- Deterministic rule-based insights — no AI, no model, no data leaves the device
- CSV export and full JSON backup / restore
- Light and dark themes, keyboard accessible, works offline

## What it deliberately does not do

State tax. Itemized deductions. The section 199A qualified business income
deduction. Capital gains rates. AMT. NIIT. Retirement or self-employed health
insurance deductions. Net operating losses. Specific credits. Married filing
separately.

Every omission is listed in full under the **Estimate** tab. The point is that
you can see exactly what the number does and does not account for.

## Running it

It is a single self-contained HTML file. Open `index.html` in any modern
browser — no build step, no dependencies, no server required.

Serve it over HTTPS if you host it. `localStorage` is origin-scoped, so records
saved on `http://` and `https://` are separate stores and the difference looks
like data loss to the user.

## Before you deploy this yourself

See the **DEPLOYMENT NOTES** block at the end of the `<script>` in `index.html`.
In short:

1. Fill in the `LEGAL` config object (entity name, contact email, address,
   governing state and venue), have the legal pages reviewed, then set
   `LEGAL_REVIEWED = true` to hide the draft banners.
2. Add `og:url`, `og:image` and `rel=canonical` once you have a real domain.
3. **The privacy claim is load-bearing.** Adding analytics, a hosted font, an
   embedded script, a waitlist endpoint or any server-side logging makes parts
   of the Privacy Policy false. Update the policy in the same change.
4. Review the tax constants against the annual IRS revenue procedure and the
   SSA wage base each year, and update `CONSTANTS_LAST_REVIEWED`.

## Testing

The app ships with no runtime dependencies, and the test harnesses in the
project scratchpad drive real Chrome over the DevTools Protocol — checking
runtime exceptions, console errors, **every network request**, tax arithmetic
against hand-computed figures, federal holiday deadline edge cases, XSS
resistance, storage round trips, responsive overflow and accessibility.

## Licence

Copyright © 2026. All rights reserved. No licence is granted for reuse or
redistribution at this time.
