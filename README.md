# Super Calculator (V13)

An offline-first Australian superannuation and retirement projection tool — a single self-contained HTML file with no build step, no server, and no external dependencies. Open it in a browser and it runs entirely client-side.

This repo contains two versions of the same underlying engine:

- **`index.html`** (this file, repo root) — the personal instance, pre-loaded with real historical balances and settings. Not a template; not meant for anyone else's numbers.
- **`generic/index.html`** — a blank public template anyone can use with their own figures. Hosted at [49ford.github.io/super-calculator/generic](https://49ford.github.io/super-calculator/generic/). Nothing entered there is uploaded anywhere — it all stays in your browser.

## What it models

- Accumulation-phase growth with a real concessional contribution model (income × SG% + extra, or a flat annual total), capped at the legislated concessional cap, with optional 5-year carry-forward of unused cap
- Insurance premiums deducted from the balance while working
- Division 293 tax on concessional contributions above the high-income threshold
- Non-concessional contributions with their own cap and eligibility window
- Retirement drawdown with the correct ATO minimum drawdown percentage by age band (including the 90–94 bracket)
- Transfer Balance Cap awareness (balance above the cap stays taxed in accumulation phase)
- Age Pension estimate — assets and income tests, with real estate/other-asset income assessed directly rather than always deemed, and correct single-vs-couple pension rates
- Indexation of contribution caps, pension thresholds and the TBC over the projection horizon
- Monte Carlo simulation and a goal-seeking solver
- Net worth tracking (super + home + other assets) alongside the super-only balance
- Phased retirement spending (Golden/Silver/Legacy years), including an optional **Blended** mode that alternates Golden and Silver years instead of running them back-to-back, to soften early-retirement drawdown
- Market shock scenario testing and a side-by-side Scenario B comparison
- Lump sum events (inflows/outflows) at any age
- CSV and JSON export of the full projection

## Year labelling

Every year shown is the Australian financial year's *end* year — the FY starting July 2026 is labelled "2027", matching how the ATO and most Australians refer to a financial year. The current calendar date is read automatically, so the first forecast row always lands on the correct year whether the tool is opened partway through a financial year or right at the start of one.

## Personal instance specifics (this file)

This copy has actual historical fund balances baked in (age 48 onward) and tracks two named funds — shown separately (and compared year-over-year) alongside the combined household total. The "Fund Return (YoY)" figures back out each year's assumed concessional contribution (using the actual legislated cap for that year) before calculating a return, so what's shown approximates real fund performance rather than raw balance growth inflated by new contributions.

## Not financial advice

Personal modelling tool only. Every assumption (returns, inflation, contribution caps, pension thresholds) is a slider or an input — check them before relying on any output, and treat this as a planning aid, not professional financial advice.
