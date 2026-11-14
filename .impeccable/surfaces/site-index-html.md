---
version: 2
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["site/src/main.ts", "site/src/card.ts", "site/src/earth.ts", "site/src/globe3d.ts", "site/src/sections.ts", "site/src/style.css"]
---

Scope: Parallels v1, the single-page discovery tool (site/index.html). Mode: Operate above the fold, Read below it.
Audience and job: judges and newcomers pick a mission filter and a target, then read why an Earth place matches and where it breaks, in under a minute, on a phone or a laptop.

## Direction contract
seed: none (pinned) — the user dropped the prototype's paper-white survey-ledger look on 15 November and gave full creative freedom, with the guardrail "no AI slop": no dark gradient banners, glowing cartoon planets, pastel rounded cards, pill chips, glassmorphism, purple-blue gradients or emoji icons.
THESIS: three worlds, one instrument. A flight instrument made by people who love maps, not a dashboard.
OWN-WORLD: flat space black (#050607), real NASA imagery as the only colour besides data; light ink, 1px hairlines, sharp corners; Archivo variable (width axis: wide wordmark, condensed labels and numbers) with system UI text; tabular numerals; one perceptually uniform, colour-blind-safe ramp (inferno) for match; one signal colour (cyan #4fd8ff) for selection, pickers and the gap; amber only for "sample", "rarely used" and "where it breaks".
STORY: no Earth place copies a Moon or Mars base whole; each challenge has its own best Earth places, and each match shows its gap honestly.
FIRST VIEWPORT: wordmark between two parallel rules; the sentence picker ("Earth's best places to test [filter] for [target]"); Earth globe with all land coloured by match; top 10 ledger on the left; the target globe (Moon from below at the south pole, Mars turned to Jezero) above the open scorecard on the right; a cyan line links the chosen Earth cell to the target site.
SIGNATURE: parallels. The latitude ring through the chosen Earth cell and through the target site, the linking line between worlds, and the gap ruler: each trait drawn from the Earth value to the target value in real units against Earth's land range, animating along the gap.
MOTION: recolouring Earth's land (380 ms blend), ledger rows sliding to new ranks (FLIP, 360 ms), the target globe turning to its site (1.2 s), Earth flying to a match (1.3 s), scorecard rows settling in order, gap rulers drawing. All off under prefers-reduced-motion.
RISK: dense numbers on black can tire; plain-language row labels, one sentence per challenge and generous hairline spacing carry them.
