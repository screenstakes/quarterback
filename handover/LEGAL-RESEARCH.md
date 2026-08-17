# Legal research

The Terms of Service and Privacy Policy were not generated from a template. They
were built from the published legal pages of comparable US self-employment tax
products, then adapted for a product that has no account, no server, no payment,
and no transmission of user data.

## Comparables studied

### Keeper Tax — Terms of Service (19 sections)
`keepertax.com/terms`

Section order: The Service · Apps · User Content · Our Proprietary Rights ·
Paid Services · **No Professional Advice** · Tax Return Filing Services · Text
Messaging · Privacy · Security · Third-Party Links · Cooperation · Release and
Indemnity · No Warranty · **Limitation of Liability** · Governing Law,
Arbitration, Class Action/Jury Waiver · California Residents · E-Sign Consent ·
General.

Points carried across:
- Liability capped at the **greater of** fees paid in the preceding 12 months
  **or $50** — the standard shape for a low/no-cost consumer product. Ours uses
  the same construction, noting the 12-month figure is currently $0.00.
- "You have the final responsibility for the accuracy and completeness of each
  item" — user-responsibility framing.
- Explicit "not a financial planner, investment advisor, broker, or accountant."
- Delaware law, AAA arbitration, class waiver.

### Hurdlr — Terms of Use (18 sections)
`hurdlr.com/terms`

- All-caps warranty and liability blocks, which is conventional for
  conspicuousness under UCC §2-316. Ours uses the same treatment for sections
  11, 12 and 16.4.
- "HURDLR IS NOT PROVIDING TO YOU … LEGAL, FINANCIAL, ACCOUNTING OR INVESTMENT
  ADVICE."
- 18+ eligibility. Maryland law, individual arbitration, class waiver.

### Hurdlr — Privacy Policy (18 sections)
Separate GDPR, CCPA, Do-Not-Sell, Do-Not-Track, Shine the Light, and California
minor sections. The most complete structure of the comparables, and the model
for ours.

### Keeper Tax — Privacy Policy (9 sections)
Thinner. Notably **no CCPA categories table**, which is a gap ours closes.

## What ours does that the comparables do not

1. **Discloses `localStorage` by key name.** Most privacy notices describe
   cookies and never mention web storage at all — a widely documented compliance
   gap, since regulators treat storing information on a user's device as
   requiring disclosure regardless of the technology. Section 5 lists every key,
   its contents and its lifetime, and tells the reader how to inspect and delete
   them in DevTools.

2. **A full CCPA/CPRA statutory categories table.** All eleven categories (A–K)
   plus sensitive personal information, each marked collected/sold/shared. Every
   row is "No," which is unusual and worth stating precisely rather than
   hand-waving.

3. **Positions the product against the tax statutes by name**, rather than
   vaguely disclaiming advice:
   - Not a tax return preparer under **26 U.S.C. § 7701(a)(36)** /
     **26 C.F.R. § 301.7701-15**.
   - Therefore **26 U.S.C. § 7216** (disclosure and use of tax return
     information) never arises between the parties — not because consent was
     obtained, but because the information never reaches us.
   - Not a **Circular 230** practitioner, so nothing produced is written tax
     advice on which penalty protection can rest.

4. **Explains the Google Fonts decision** in section 8.2 and cites the case
   (*LG München I*, 3 O 17493/20, 20 January 2022) rather than just asserting a
   preference.

5. **Is honest about the trade-off.** Section 11 states plainly that local
   storage is unencrypted, that there is no login, that other software on the
   device may read it, and that shared or synced devices are a poor choice. A
   policy that only listed strengths would be less trustworthy, not more.

## Structural choices

Sections that exist in the comparables only because those companies hold user
data on a server were **omitted rather than copied for bulk**: user content
licences, DMCA notice-and-takedown, e-sign consent, account suspension.

Arbitration was **not** adopted. The comparables use mandatory AAA arbitration;
ours uses informal resolution first, then courts, with a small-claims carve-out
and a class waiver. For a free tool with no account that is the more defensible
position, but it is a business decision — flagged in `TODO.md` for counsel.

## Regulatory references used

- CCPA as amended by CPRA — notice at collection, categories, sources, purposes,
  retention, right to know/delete/correct, opt-out of sale and sharing,
  limit use of sensitive PI, non-discrimination.
- GDPR Articles 6(1)(b) and 6(1)(f); data subject rights; transfer mechanisms.
- COPPA (under 13) and CCPA minor provisions (under 16).
- California Civil Code § 1798.83 (Shine the Light).
- 5 U.S.C. § 6103 (federal holidays) and 26 U.S.C. § 7503 (deadline shifting) —
  used by the deadline model, not the legal pages.

## Standing caveat

None of this was reviewed by a lawyer. The documents are structurally sound and
factually accurate for the current build, but publisher identity, governing law
and the arbitration position are business decisions. `LEGAL_REVIEWED` stays
`false` until counsel signs off.
