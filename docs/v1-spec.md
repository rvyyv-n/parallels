# Parallels v1 spec

The brief for the thread that builds the first full version of Parallels. It sets the goal, the order of work and the decisions already made. It doesn't repeat the plans; it points to them.

**Read first:** [CLAUDE.md](../CLAUDE.md), [guidelines](guidelines.md), [team plan](team-plan.md), [Claude's plan](claudes-plan.md), [challenge](challenge.md), [judging notes](judging-notes.md) and the [Challenge Guide](challenge-guide.pdf).

**When files disagree:** the team plan wins. Claude's plan holds the method, data and checks. This spec wins over both only on the points it settles below.

## 1. Goal

A fully working site **today, Saturday 14 November 2026**, at the Vercel project's production address, running on real data. Sunday is for polish, the demo video and the project page ([plan §8](claudes-plan.md#8-roadmap), steps 7–8).

Today covers roadmap steps 1–6: the first complete draft goes in on Saturday night.

## 2. Before you build

Four gates, in this order. Don't write build code until the user has said yes to gates 1 and 2.

### Gate 1. Setup questions and your approach

- Ask the user what you need to know to start: for example, the production URL, where the Earthdata login lives on this machine, how they want to be reached for approvals, and any limits on time, models or cost.
- Recommend how you'll run the build: tools, which models do which work, how you split it (for example a pipeline track, a site track and a checking track), and how each piece gets tested before it's committed.

### Gate 2. Research and a UI design

- **Rivals:** start from the three in [plan §1](claudes-plan.md#1-rivals), then scan the other public repos for this challenge (at least 22 on 13 November) and similar tools (for example NASA Moon Trek and Mars Trek, and climate-analog finders). Note what each does well and what confuses a newcomer.
- **Our earlier draft:** `main` already holds a working prototype analog finder (`pipeline/` and `site/`, with the main flow and validation chart; screenshots in `docs/screenshots/`). v1 builds on it: keep what works, replace what doesn't.
- **Recommend one UI design** that:
  - is easy to understand at a glance;
  - gets a newcomer to a result in under a minute without help;
  - has good onboarding (the first screen explains itself, with no tutorial wall);
  - works on a phone and a laptop;
  - meets every requirement in [guidelines](guidelines.md) and every benchmark and question in the [Challenge Guide](challenge.md#the-six-objectives-and-how-we-meet-them), each easy to spot in the guide's own words;
  - aims to win: see [judging notes](judging-notes.md) and the awards in [plan §10](claudes-plan.md#10-awards-project-page-and-demo).
- Show the user the design (a sketch, mock or clickable stub) and **wait for their yes**.

### Gate 3. Resolve open links and estimated places

For every dataset and test place you'll use:

- **"Link to confirm" and "size to check" items** in [plan §4](claudes-plan.md#4-data): TES thermal inertia, Diviner regolith properties, the 128 px MOLA map, MODIS albedo, SWIM (site was down) and the GRIP4 licence. Find a working link, size and licence for each.
- **Places marked \*** in [plan appendix A](claudes-plan.md#appendix-a-test-places), and the rough headline candidates in [plan §5](claudes-plan.md#headline-candidates): check each coordinate against a map or a named source.
- **Drop what doesn't resolve** and list what you dropped and why. Don't keep a place or dataset on a guess.

### Gate 4. Weights (before the first validation run)

See section 7. This gate can wait until the pipeline is ready to score; it doesn't block the site.

## 3. Branch and deploy

- Work on branch **`v1`**, cut from `main`. Push after every working step, so any step can be undone.
- The Vercel project (renamed from `dotcatcher` to `parallels`) is connected to the GitHub repo `rvyyv-n/dotcatcher`, with root directory `site`, framework Vite and **`v1` as its production branch**. Each push to `v1` deploys. The Vercel CLI isn't installed and isn't needed: deploys run from the Git connection.
- **Never merge to `main`** (the user does that), never force-push, never delete remote branches. Older branches are kept as tags `archive/prototype` and `archive/research`.
- `research` is retired.

## 4. Scope

Every trait in the [team plan](team-plan.md), built in this order. The data and statistic for each trait are in [plan §3](claudes-plan.md#traits).

1. **Core:** cold, heat swing, dryness, sunlight (and sun height), terrain (slope and roughness).
2. **Next:** Mars minerals (EMIT), bare ground, ice and frozen ground, wind and dust.
3. **Stretch:** thermal inertia, UV, seasons, terrain types and clustering, the zoom stage, the stability badge, reverse mode.

Notes:

- **Derived items ride on tiers 1–2:** landing safety (from slope), industrial sites (from the Surface scores), signs of life (from hydrated minerals), rock type (GLiM for the Moon). Ground strength needs a stand-in: propose one with the weights (gate 4), or show it as "not scored" with the reason.
- **Labels from day one, never scored:** shelter (caves and lava tubes), Moon dust, perchlorates, and the paper lists in [plan §3](claudes-plan.md#traits).
- **Recommended order inside tier 3:** items that meet a Challenge Guide benchmark first: seasons (#5), terrain types and clustering (#2 and #4), thermal inertia (#4). Skipping one of those leaves a benchmark partly met, so tell the user before you cut it.
- **If a stretch item's data fights back, skip it** and say so on the site, in a short "Not in this version" list with the reason.
- **Targets:** the Moon's south pole and Jezero first ([plan §5](claudes-plan.md#5-targets-and-the-headline-find)). Arcadia Planitia and the other Mars sites are extras, after the main flow works.

## 5. What the site shows

As set out in [plan §2](claudes-plan.md#2-the-main-flow), within the UI design approved at gate 2:

- **The main flow:** open on the headline (or the south pole if no headline yet), pick a target and a mission filter, click a spot, read the scorecard. Two clicks to a result.
- **The scorecard:** a bar of Earth rank per trait, with the real Earth and target values, their dataset and their resolution beside it. The overall score never appears without the trait bars ([plan §3, Scoring](claudes-plan.md#scoring)).
- **"Earth can't copy":** gravity, air and radiation, from the table in [plan §3](claudes-plan.md#terrain-types-and-clustering).
- **"Where it breaks":** per match, which traits fall short and by how much, in real units.
- **"How we checked it":** the validation chart ([plan §6](claudes-plan.md#6-how-we-check-it)), with misses explained.
- **The seven questions answered** and the **data list** (every dataset by name, with a link and what it's used for).
- **Hand-set weights:** the team plan asks for them. The browser may combine the pre-computed trait ranks with the user's weights; it never recomputes a rank or a value.

## 6. File contract

The pipeline and the site meet only through pre-computed files in `site/public/data/`. Define the layout first, before either side builds on it, and commit it as typed definitions on both sides (TypeScript types for the site, a schema check in the pipeline's tests).

**Per cell, per trait:**

| Field | Meaning |
|---|---|
| value | the Earth value in real units, or "no data" |
| rank | Earth rank, 0–1 ([plan §3](claudes-plan.md#scoring)), or "no data" |
| dataset | an id pointing into the data list, so every number traces to a named dataset |
| resolution | the resolution that value really has |

Plus, per cell: coordinates, terrain type, cluster, how hard it is to get there, seasons, and the overall score for each target and mission filter.

**Target values file:** one entry per target and trait, with the value, statistic, dataset or paper, and resolution. Per-region values for the nine Artemis regions sit here too.

**Other files:** the data list (dataset ids, names, links, licences, uses), the label lists, the validation results, and the "Not in this version" list.

**Stub first.** Build the site on stub files that follow the contract from the first commit, marked as sample data on screen. The pipeline and the site then run in parallel, and real files replace the stubs without site changes. Keep each file small: about 75,000 land cells, a few MB per target at most ([plan §7](claudes-plan.md#7-tech-stack-and-hosting)); use compact column arrays if plain JSON gets too big.

## 7. Weights and validation

- **You propose** one default weight set per target and mission filter, with a one-line reason per weight, drawn from what the target and the hardware need, never from the test places.
- **The user approves** them before the first validation run.
- **Commit them** in a config file in `pipeline/`, together with the terrain-type thresholds and the fixed held-out split of known analogs, **before** that run. The git history is the proof we didn't tune to pass.
- Pass marks, the Moon test's two parts, and what to do with misses: [plan §6](claudes-plan.md#6-how-we-check-it). If validation fails, publish the honest result ([plan §9](claudes-plan.md#9-risks-and-fallbacks)).

## 8. Data and machine

- **The user has a NASA Earthdata account.** Use it through `earthaccess`; never print, copy or commit the login. If login or downloads fail, switch to the no-login fallback in [plan §9](claudes-plan.md#9-risks-and-fallbacks) by its switch time.
- **Installed:** Python 3.13 with uv; Node 24 with npm. Not installed: the Vercel CLI.
- **Stack and tests:** [plan §7](claudes-plan.md#7-tech-stack-and-hosting): pipeline in `pipeline/`, raw downloads in `data/` (gitignored), site in `site/`, pytest and Playwright.
- **Fallback switch times** in [plan §9](claudes-plan.md#9-risks-and-fallbacks) apply as written. If something has been stuck for an hour, cut it or switch.

## 9. Rules to keep

- **AI note** in the site footer, the README and the project description only. Keep it accurate as the build goes ([CLAUDE.md](../CLAUDE.md)). No `Co-Authored-By` trailers or "Generated with" footers in commits or PRs.
- **AI-made images** carry a visible watermark.
- **No NASA branding** (logos, flags, mission insignia) in anything AI made.
- **Open data only**, each source credited with its licence, on the site and in the README's data section.
- **Raw data stays out of git.** Commit only the small processed files the site needs.
- **Never invent a value.** Missing data shows as "no data" and lowers confidence ([guidelines §2](guidelines.md#2-doing-the-science-honestly)).

## 10. Done means

- The checks for roadmap steps 1–6 in [plan §8](claudes-plan.md#8-roadmap) pass, or a failure is written up honestly on the site.
- The site opens in a private window, with no login, on a phone and a laptop.
- A newcomer gets a result in under a minute without help.
- Every number on screen traces to a named dataset or paper, with its resolution.
- It needs no upkeep until 26 January 2027: no keys, no server, no live data calls, and a bundled background image in case GIBS tiles fail ([plan §7](claudes-plan.md#7-tech-stack-and-hosting)).
- The items in the [guidelines §7](guidelines.md#7-before-we-click-submit-for-judging) checklist that apply to the site are met:
  - the final project link opens in a private window with no login;
  - NASA datasets named with links, and every other source listed;
  - a visible "where it breaks" part;
  - each of the six benchmarks visibly met and the seven questions answered;
  - the AI note in the footer; AI images watermarked; no NASA branding in AI output;
  - no under-18 likenesses.

Report to the user at each checkpoint with what works, what was cut, and the link to test.
