# Super Calculator — Free Retirement Projection Tool

A free, private Australian superannuation and retirement projection calculator. **Nothing is uploaded — everything runs and stays in your own browser.** No sign-up, no server, no tracking of what you enter.

**Use it here:** [49ford.github.io/super-calculator/generic](https://49ford.github.io/super-calculator/generic/)

## Getting started

1. Open the link above.
2. Under **Starting Point**, enter your (and your partner's, if applicable) current age and super balance. Give yourselves names if you like — everything else in the tool updates to match.
3. Work through the other sections — Concessional Contributions, Returns, Retirement Ages, Spending — adjusting sliders to match your own situation.
4. The Timeline table, chart and headline "money lasts to age X" card update live as you change anything.

There's also a **No Partner** toggle under Starting Point if you're modelling as a single person rather than a couple.

## What it models

- Concessional contributions (income × SG% + extra, or a flat annual total) capped at the legislated concessional cap, with optional 5-year carry-forward of unused cap
- Insurance premiums deducted from the balance while working
- Division 293 tax, non-concessional contributions, and Transfer Balance Cap awareness
- Correct ATO minimum drawdown percentages by age band through to 95+
- Age Pension estimate (assets and income tests), including real estate/other-asset income and correct single-vs-couple rates
- Indexation of contribution caps, pension thresholds and the TBC over time
- Monte Carlo simulation and a goal-seeking solver
- Net worth tracking (super + home + other assets)
- Phased retirement spending (Golden/Silver/Legacy years), including a **Blended** option that alternates Golden and Silver years instead of spending them all consecutively — useful if your "big" retirement years are built around irregular things like overseas travel, so the balance isn't drawn down as fast up front
- Market shock testing and a Scenario B side-by-side comparison
- Lump sum events (inheritances, downsizing, big purchases) at any age
- CSV and JSON export, so you can keep or share a scenario

## Year labelling

Every year shown is the Australian financial year's *end* year (the FY starting July 2026 is labelled "2027"), matching how the ATO refers to a financial year. This is worked out automatically from today's date, so the first projected year is always correct whenever you open the tool.

## Privacy

Everything you enter stays in your browser's local storage on your own device. Nothing is sent anywhere, logged, or shared — there's no backend at all.

The only thing tracked is an anonymous page-visit count (via [GoatCounter](https://www.goatcounter.com/)), used to see how many people are using the tool. It doesn't record anything you type in, and isn't tied to you personally.

## Not financial advice

This is a personal modelling tool, not professional financial advice. Every assumption — investment returns, inflation, contribution caps, pension thresholds — is something you set yourself. Check them against your own circumstances, and consider speaking to a licensed financial adviser before making real decisions.
