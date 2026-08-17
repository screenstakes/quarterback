# What is unfinished, and what is deliberately absent

## Must happen before real users

1. **Fill in the `LEGAL` object** at the top of the script — entity, email,
   address, governing state, venue. It ships with `[Your legal entity name]`
   placeholders on purpose; inventing a legal entity would be worse than an
   obvious blank.
2. **Have a lawyer review both legal pages**, then set `LEGAL_REVIEWED = true`
   to hide the amber draft banners.
3. **Add `og:url`, `og:image`, `rel=canonical`** once a production domain exists.
4. **Serve over HTTPS.** `localStorage` is origin-scoped, so records saved on
   `http://` and `https://` are separate stores — the difference looks exactly
   like data loss to a user.

## Deliberately not built

Not oversights. Each was left out because doing it badly is worse than not
doing it, and the app says so plainly in the UI rather than faking it.

- **State tax** — fifty rule sets. No placeholder number.
- **Email reminders** — needs a server and an address on file.
- **Cloud backup / multi-device** — needs accounts and a server. This is the
  whole trade-off the privacy model is built on.
- **The "Pro" plan** — described on the Pricing tab as a plan, not a product.
  No checkout exists anywhere.
- **The waitlist** — `WAITLIST_ENDPOINT` is blank, and the button says plainly
  that nothing is being collected rather than showing a fake success message.

If you build any of these, the Privacy Policy and Terms change in the same commit.

## Known model limitations worth improving

- One rate table (tax year 2026) is applied to every selectable year. The UI
  discloses this, but real multi-year support means per-year constant tables.
- Safe harbor ignores payment timing and the annualised income method.
- No net operating loss carryforward; a loss year is floored at $0 profit.
- Married filing separately and qualifying surviving spouse are not modelled.
- Credits are a flat subtraction, never below zero. Refundable credits are not
  modelled.

## Maintenance

Tax constants live in section 2 of the script. Review annually against the IRS
revenue procedure and the SSA wage-base announcement, then update
`CONSTANTS_LAST_REVIEWED` — that string is displayed to users, so a stale value
is a broken promise.
